package main

import (
	"context"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
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

	sessionPath    string
	configPath     string
	authPhone      string
	authHash       string
	minimizeToTray bool

	dispatcher *tg.UpdateDispatcher
	qrCancel   context.CancelFunc
	qrMu       sync.Mutex
	webServer  *WebServer
	quitting   bool
}

func NewApp() *App {
	disp := tg.NewUpdateDispatcher()
	return &App{
		connectedCh:  make(chan struct{}),
		channelCache: make(map[int64]*tg.InputPeerChannel),
		dispatcher:   &disp,
	}
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
}

func (a *App) shutdown(ctx context.Context) {
	if a.clientCancel != nil {
		a.clientCancel()
	}
	if a.webServer != nil {
		a.webServer.Stop()
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
