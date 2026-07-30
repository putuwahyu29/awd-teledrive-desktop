package main

import (
	"context"
	"encoding/json"
	_ "embed"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gotd/td/telegram"
	"github.com/gotd/td/tg"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/appicon.png
var appIcon []byte

type App struct {
	ctx    context.Context
	cancel context.CancelFunc

	clientCtx    context.Context
	clientCancel context.CancelFunc

	client        *telegram.Client
	api           *tg.Client
	apiMu         sync.RWMutex
	connectedCh   chan struct{}
	clientRunning bool
	lastClientErr error

	channelCache map[int64]*tg.InputPeerChannel
	cacheMu      sync.RWMutex

	manifestCache *TeleDriveManifest
	manifestMu    sync.RWMutex

	folderSizeCache map[string]int64
	folderSizeMu    sync.RWMutex

	lastTelegramReq time.Time
	telegramReqMu   sync.Mutex

	sessionPath    string
	configPath     string
	authPhone      string
	authHash       string
	minimizeToTray bool

	dispatcher      *tg.UpdateDispatcher
	qrCancel        context.CancelFunc
	qrMu            sync.Mutex
	webServer       *WebServer
	virtualDriveMgr *NativeVirtualDriveManager
	quitting        bool
	isHeadless      bool
	headlessPort    int
}

func NewApp() *App {
	disp := tg.NewUpdateDispatcher()
	app := &App{
		connectedCh:     make(chan struct{}),
		channelCache:    make(map[int64]*tg.InputPeerChannel),
		folderSizeCache: make(map[string]int64),
		dispatcher:      &disp,
	}
	app.virtualDriveMgr = NewNativeVirtualDriveManager(app)
	return app
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.clientCtx, a.clientCancel = context.WithCancel(ctx)
	userDataDir, _ := os.UserConfigDir()
	a.sessionPath = filepath.Join(userDataDir, "teledrive", "session.json")
	a.configPath = filepath.Join(userDataDir, "teledrive", "config.json")
	os.MkdirAll(filepath.Dir(a.sessionPath), 0755)

	a.webServer = NewWebServer(a)
	_ = a.webServer.Start()

	a.buildClient()
	go a.runClient()
	a.startTray() // start system tray icon

	// Resume Auto Backup if enabled
	cfg := a.loadConfig()
	a.minimizeToTray = cfg.MinimizeToTray
	if cfg.ChannelCache != nil {
		a.cacheMu.Lock()
		for idStr, cc := range cfg.ChannelCache {
			if id, err := strconv.ParseInt(idStr, 10, 64); err == nil {
				a.channelCache[id] = &tg.InputPeerChannel{
					ChannelID:  id,
					AccessHash: cc.AccessHash,
				}
			}
		}
		a.cacheMu.Unlock()
	}

	if cfg.AutoBackupEnabled {
		go func() {
			// Wait for client to connect
			time.Sleep(3 * time.Second)
			a.StartAutoBackup(cfg.BackupFolder, cfg.BackupDestChatId)
		}()
	}

	// Auto mount virtual drive on app startup if enabled in settings
	if cfg.AutoMountDrive {
		go func() {
			time.Sleep(2 * time.Second)
			letter := cfg.AutoMountLetter
			if letter == "" {
				letter = "Z:"
			}
			_, _ = a.MountVirtualDrive("0", letter)
		}()
	}
}

func (a *App) shutdown(ctx context.Context) {
	if a.clientCancel != nil {
		a.clientCancel()
	}
	if a.webServer != nil {
		a.webServer.Stop()
	}
	if a.virtualDriveMgr != nil {
		a.UnmountAllVirtualDrives()
		_ = a.StopNativeWebDAVServer()
	}
}

// BeforeClose is called when user clicks X — minimize to tray if enabled or ask confirmation
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	if a.quitting {
		return false
	}
	if a.minimizeToTray {
		runtime.WindowHide(ctx)
		return true // prevent actual close
	}
	
	// Request frontend to show material dialog
	runtime.EventsEmit(ctx, "app:request-exit-confirm")
	return true
}

var (
	buildAPIID   = "0"
	buildAPIHash = ""
)

func (a *App) LogDebug(msg string) {
	fmt.Println("[FRONTEND ERROR]", msg)
}

const AppVersion = "1.2.0"

type VersionCheckResult struct {
	HasUpdate     bool   `json:"has_update"`
	LatestVersion string `json:"latest_version"`
	UpdateURL     string `json:"update_url"`
	ReleaseNotes  string `json:"release_notes"`
}

func compareVersions(v1, v2 string) int {
	v1 = strings.TrimPrefix(v1, "v")
	v2 = strings.TrimPrefix(v2, "v")
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")
	for i := 0; i < len(parts1) || i < len(parts2); i++ {
		p1 := 0
		p2 := 0
		if i < len(parts1) {
			p1, _ = strconv.Atoi(parts1[i])
		}
		if i < len(parts2) {
			p2, _ = strconv.Atoi(parts2[i])
		}
		if p1 > p2 {
			return 1
		}
		if p1 < p2 {
			return -1
		}
	}
	return 0
}

func (a *App) CheckForUpdates() (VersionCheckResult, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("GET", "https://api.github.com/repos/putuwahyu29/awd-teledrive-desktop/releases/latest", nil)
	if err != nil {
		return VersionCheckResult{}, err
	}
	req.Header.Set("User-Agent", "awd-teledrive-desktop-updater")

	resp, err := client.Do(req)
	if err != nil {
		return VersionCheckResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return VersionCheckResult{}, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return VersionCheckResult{}, err
	}

	hasUpdate := compareVersions(release.TagName, AppVersion) > 0

	return VersionCheckResult{
		HasUpdate:     hasUpdate,
		LatestVersion: release.TagName,
		UpdateURL:     release.HTMLURL,
		ReleaseNotes:  release.Body,
	}, nil
}

func (a *App) OpenReleaseURL(url string) {
	if a.isHeadless || a.ctx == nil {
		return
	}
	defer func() { _ = recover() }()
	runtime.BrowserOpenURL(a.ctx, url)
}

func (a *App) GetAppVersion() string {
	return AppVersion
}

func (a *App) emitEvent(eventName string, data ...interface{}) {
	if a == nil || a.isHeadless || a.ctx == nil {
		return
	}
	defer func() {
		_ = recover()
	}()
	runtime.EventsEmit(a.ctx, eventName, data...)
}
