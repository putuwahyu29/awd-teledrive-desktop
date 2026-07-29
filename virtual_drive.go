package main

import (
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gotd/td/telegram/downloader"
	"golang.org/x/net/webdav"
)

type VirtualDriveStatus struct {
	ActiveDriveCount int      `json:"activeDriveCount"`
	AvailableDrives  []string `json:"availableDrives"`
	WebDAVServerPort int      `json:"webdavServerPort"`
	WebDAVRunning    bool     `json:"webdavRunning"`
	WebDAVPassword   string   `json:"webdavPassword"`
	OS               string   `json:"os"`
	AutoMountOnStart bool     `json:"autoMountOnStart"`
	AutoMountLetter  string   `json:"autoMountLetter"`
}

type MountedDriveInfo struct {
	ID          string    `json:"id"`
	DriveLetter string    `json:"driveLetter"`
	AccountID   string    `json:"accountId"`
	TargetName  string    `json:"targetName"`
	URL         string    `json:"url"`
	StartTime   time.Time `json:"startTime"`
	Status      string    `json:"status"`
}

type NativeVirtualDriveManager struct {
	app            *App
	mu             sync.Mutex
	mounts         map[string]*MountedDriveInfo
	webdavServer   *http.Server
	webdavPort     int
	webdavPassword string
	webdavActive   bool
	vdiskDir       string
}

func NewNativeVirtualDriveManager(app *App) *NativeVirtualDriveManager {
	userConfig, _ := os.UserConfigDir()
	vdisk := filepath.Join(userConfig, "teledrive", "vdisk")
	_ = os.MkdirAll(vdisk, 0755)

	return &NativeVirtualDriveManager{
		app:      app,
		mounts:   make(map[string]*MountedDriveInfo),
		vdiskDir: vdisk,
	}
}

func sanitizeFilename(name string) string {
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	clean := name
	for _, c := range invalidChars {
		clean = strings.ReplaceAll(clean, c, "_")
	}
	clean = strings.TrimSpace(clean)
	if clean == "" {
		clean = "unnamed"
	}
	return clean
}

// syncFolderRec recursively syncs TeleDrive items into target directory path.
func (mgr *NativeVirtualDriveManager) syncFolderRec(chatId string, currentDirPath string) {
	if mgr.app == nil {
		return
	}

	items := mgr.app.GetFiles(chatId)
	for _, item := range items {
		safeName := sanitizeFilename(item.Name)
		targetPath := filepath.Join(currentDirPath, safeName)

		if item.Type == "folder" || item.MimeType == "virtual_folder" {
			_ = os.MkdirAll(targetPath, 0755)
			mgr.syncFolderRec(item.ID, targetPath)
		} else {
			f, err := os.Create(targetPath)
			if err == nil {
				if item.Size > 0 {
					_ = f.Truncate(item.Size)
				}
				f.Close()
			}
		}
	}
}

// syncVirtualDriveRoot maps TeleDrive records into vdiskDir filesystem so WebDAV shows real TeleDrive files.
func (mgr *NativeVirtualDriveManager) syncVirtualDriveRoot(chatId string) {
	if mgr.app == nil {
		return
	}

	if chatId == "" {
		chatId = "0"
	}

	// Clean vdiskDir root
	entries, _ := os.ReadDir(mgr.vdiskDir)
	for _, entry := range entries {
		_ = os.RemoveAll(filepath.Join(mgr.vdiskDir, entry.Name()))
	}

	mgr.syncFolderRec(chatId, mgr.vdiskDir)
}

// findItemByPath recursively traverses folder path parts to find target DriveItem.
func (a *App) findItemByPath(currentChatID string, pathParts []string) (*DriveItem, string) {
	if len(pathParts) == 0 {
		return nil, ""
	}

	fileName := pathParts[0]
	items := a.GetFiles(currentChatID)

	if len(pathParts) == 1 {
		for _, it := range items {
			if (it.Name == fileName || sanitizeFilename(it.Name) == fileName) && it.Type != "folder" && it.MimeType != "virtual_folder" {
				itemCopy := it
				return &itemCopy, currentChatID
			}
		}
		return nil, ""
	}

	for _, it := range items {
		if (it.Type == "folder" || it.MimeType == "virtual_folder") && (it.Name == fileName || sanitizeFilename(it.Name) == fileName) {
			return a.findItemByPath(it.ID, pathParts[1:])
		}
	}

	return nil, ""
}

// streamCloudFile streams real Telegram cloud file content directly to HTTP response for PDF, Video, Image, Document viewing.
func (a *App) streamCloudFile(w http.ResponseWriter, r *http.Request, relPath string) bool {
	cleanPath := filepath.Clean(relPath)
	parts := strings.Split(strings.Trim(cleanPath, "/\\"), string(filepath.Separator))
	if len(parts) == 0 {
		return false
	}

	targetItem, parentID := a.findItemByPath("0", parts)
	if targetItem == nil {
		return false
	}

	if targetItem == nil {
		return false
	}

	api := a.getAPI()
	if api == nil {
		return false
	}

	loc, err := a.getMessageLocation(parentID, targetItem.ID)
	if err != nil {
		log.Printf("[VirtualDrive] Error locating Telegram file %s: %v", targetItem.Name, err)
		return false
	}

	ext := strings.ToLower(filepath.Ext(targetItem.Name))
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		switch ext {
		case ".pdf":
			contentType = "application/pdf"
		case ".mp4":
			contentType = "video/mp4"
		case ".mkv":
			contentType = "video/x-matroska"
		case ".webm":
			contentType = "video/webm"
		case ".mp3":
			contentType = "audio/mpeg"
		case ".png":
			contentType = "image/png"
		case ".jpg", ".jpeg":
			contentType = "image/jpeg"
		case ".txt":
			contentType = "text/plain; charset=utf-8"
		default:
			contentType = "application/octet-stream"
		}
	}

	w.Header().Set("Content-Type", contentType)
	if targetItem.Size > 0 {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", targetItem.Size))
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", targetItem.Name))
	w.WriteHeader(http.StatusOK)

	d := downloader.NewDownloader()
	_, err = d.Download(api, loc).Stream(a.ctx, w)
	if err != nil {
		log.Printf("[VirtualDrive] Error streaming file %s: %v", targetItem.Name, err)
	}
	return true
}

// GetVirtualDriveStatus returns system status for TeleDrive Virtual Drives across OS platforms.
func (a *App) GetVirtualDriveStatus() (VirtualDriveStatus, error) {
	drives := []string{"Z:", "Y:", "X:", "W:", "V:", "U:", "T:", "S:", "R:", "P:"}
	var available []string

	for _, d := range drives {
		if runtime.GOOS == "windows" {
			if _, err := os.Stat(d + "\\"); os.IsNotExist(err) {
				available = append(available, d)
			}
		} else {
			available = append(available, d)
		}
	}

	activeCount := 0
	webdavRunning := false
	webdavPort := 8085
	webdavPassword := ""

	if a.virtualDriveMgr != nil {
		a.virtualDriveMgr.mu.Lock()
		activeCount = len(a.virtualDriveMgr.mounts)
		webdavRunning = a.virtualDriveMgr.webdavActive
		webdavPassword = a.virtualDriveMgr.webdavPassword
		if a.virtualDriveMgr.webdavPort > 0 {
			webdavPort = a.virtualDriveMgr.webdavPort
		}
		a.virtualDriveMgr.mu.Unlock()
	}

	cfg := a.loadConfig()
	autoMountStr := strconv.FormatBool(cfg.AutoMountDrive)
	autoMountLetter := cfg.AutoMountLetter
	if autoMountLetter == "" {
		autoMountLetter = "Z:"
	}

	return VirtualDriveStatus{
		ActiveDriveCount: activeCount,
		AvailableDrives:  available,
		WebDAVServerPort: webdavPort,
		WebDAVRunning:    webdavRunning,
		WebDAVPassword:   webdavPassword,
		OS:               runtime.GOOS,
		AutoMountOnStart: autoMountStr == "true",
		AutoMountLetter:  autoMountLetter,
	}, nil
}

// SetAutoMountOnStartup updates the preference to automatically mount drive on app launch.
func (a *App) SetAutoMountOnStartup(enabled bool, driveLetter string) error {
	if driveLetter == "" {
		driveLetter = "Z:"
	}
	cfg := a.loadConfig()
	cfg.AutoMountDrive = enabled
	cfg.AutoMountLetter = driveLetter
	a.saveConfig(cfg)
	return nil
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err == nil {
		var candidate string
		for _, address := range addrs {
			if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				ip := ipnet.IP.To4()
				if ip != nil {
					ipStr := ip.String()
					if strings.HasPrefix(ipStr, "192.168.") || strings.HasPrefix(ipStr, "10.") || strings.HasPrefix(ipStr, "172.") {
						return ipStr
					}
					if !strings.HasPrefix(ipStr, "100.") {
						candidate = ipStr
					}
				}
			}
		}
		if candidate != "" {
			return candidate
		}
	}
	return "127.0.0.1"
}

// serveLoginPageHTML renders a sleek, glassmorphic login page for web browsers with theme support.
func serveLoginPageHTML(w http.ResponseWriter, r *http.Request, errMsg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Awd TeleDrive - Login Akses Wi-Fi</title>
<style>
  :root {
    --bg-body: #0f172a;
    --bg-card: #1e293b;
    --bg-input: #0f172a;
    --border-color: #334155;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --brand-blue: #3b82f6;
  }
  [data-theme="light"] {
    --bg-body: #f1f5f9;
    --bg-card: #ffffff;
    --bg-input: #f8fafc;
    --border-color: #e2e8f0;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --brand-blue: #2563eb;
  }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
  body { background: var(--bg-body); color: var(--text-main); display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; transition: background 0.25s, color 0.25s; }
  .card { width: 100%%; max-width: 420px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 20px; padding: 32px 24px 28px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; position: relative; }
  .brand-logo { display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
  .brand-logo img { height: 48px; width: auto; max-width: 200px; object-fit: contain; }
  h2 { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; color: var(--brand-blue); }
  p { font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0; line-height: 1.5; }
  input { width: 100%%; height: 48px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 16px; margin-bottom: 16px; outline: none; transition: border-color 0.2s; }
  input:focus { border-color: var(--brand-blue); box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
  button { width: 100%%; height: 48px; border-radius: 12px; border: none; background: linear-gradient(135deg, #3b82f6 0%%, #6366f1 100%%); color: #fff; font-weight: 600; font-size: 16px; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
  button:active { transform: scale(0.98); opacity: 0.9; }
  .theme-toggle-top { position: absolute; top: 16px; right: 16px; width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.2s; }
  .theme-toggle-top:hover { border-color: var(--brand-blue); }
  .error { color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; font-weight: 500; }
  @media (max-width: 480px) {
    .card { padding: 28px 18px 24px 18px; border-radius: 16px; }
    h2 { font-size: 18px; }
  }
</style>
</head>
<body>
<div class="card">
  <button type="button" class="theme-toggle-top" id="themeBtnTop" onclick="toggleTheme()" title="Ganti Tema"></button>
  <div class="brand-logo">
    <img src="/logo-drive.png" alt="Awd TeleDrive Logo" onerror="this.onerror=null; this.src='/icon.webp';" />
  </div>
  <h2>Awd TeleDrive Wi-Fi</h2>
  <p>Masukkan Password / PIN Akses Wi-Fi untuk membuka berkas cloud Telegram Anda pada HP atau Smart TV ini.</p>
  %s
  <form method="POST" action="/__login">
    <input type="password" name="password" placeholder="Masukkan Password / PIN 6-Digit" required autofocus />
    <button type="submit">Masuk Akses Wi-Fi</button>
  </form>
</div>
<script>
  const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function initTheme() {
    const saved = localStorage.getItem('awd_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeBtnTop');
    if (btn) btn.innerHTML = saved === 'dark' ? sunSvg : moonSvg;
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('awd_theme', next);
    const btn = document.getElementById('themeBtnTop');
    if (btn) btn.innerHTML = next === 'dark' ? sunSvg : moonSvg;
  }
  initTheme();
</script>
</body>
</html>`, func() string {
		if errMsg != "" {
			return fmt.Sprintf(`<div class="error">%s</div>`, errMsg)
		}
		return ""
	}())

	_, _ = w.Write([]byte(html))
}

// serveWebExplorerHTML renders a ultra-sleek, 100% mobile-responsive HTML Web File Explorer with Light/Dark Mode SVG toggle and Search filter.
func serveWebExplorerHTML(w http.ResponseWriter, r *http.Request, vdiskDir string) bool {
	reqPath := filepath.Clean(r.URL.Path)
	fullPath := filepath.Join(vdiskDir, reqPath)

	info, err := os.Stat(fullPath)
	if err != nil || !info.IsDir() {
		return false
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return false
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	var sb strings.Builder
	sb.WriteString(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Awd TeleDrive - Cloud Web Explorer</title>
<style>
  :root {
    --bg-body: #0f172a;
    --bg-card: #1e293b;
    --bg-input: #0f172a;
    --border-color: #334155;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --item-bg: #0f172a;
    --item-hover: #334155;
    --brand-blue: #3b82f6;
    --badge-bg: #1e293b;
  }
  [data-theme="light"] {
    --bg-body: #f1f5f9;
    --bg-card: #ffffff;
    --bg-input: #f8fafc;
    --border-color: #e2e8f0;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --item-bg: #f8fafc;
    --item-hover: #e2e8f0;
    --brand-blue: #2563eb;
    --badge-bg: #e2e8f0;
  }

  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
  body { background: var(--bg-body); color: var(--text-main); margin: 0; padding: 16px; min-height: 100vh; transition: background 0.25s, color 0.25s; }
  .container { max-width: 960px; margin: 0 auto; background: var(--bg-card); border-radius: 20px; padding: 24px; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.15); transition: background 0.25s, border-color 0.25s; }
  
  /* Header Section */
  .header { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; }
  .header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 38px; width: auto; max-width: 180px; object-fit: contain; border-radius: 8px; }
  .title { font-size: 20px; font-weight: 700; color: var(--brand-blue); margin: 0; line-height: 1.2; }
  .subtitle { font-size: 12px; color: var(--text-muted); margin: 2px 0 0 0; }
  
  .theme-btn { background: var(--item-bg); border: 1px solid var(--border-color); color: var(--text-main); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.2s; }
  .theme-btn:hover { border-color: var(--brand-blue); }

  /* Search Box */
  .search-box { width: 100%; position: relative; }
  .search-input { width: 100%; height: 44px; padding: 0 16px 0 40px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 15px; outline: none; transition: border-color 0.2s; }
  .search-input:focus { border-color: var(--brand-blue); box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
  .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; stroke: var(--text-muted); display: flex; align-items: center; pointer-events: none; }
  
  /* Path Bar */
  .path-bar { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; background: var(--item-bg); padding: 10px 14px; border-radius: 10px; font-weight: 500; display: flex; align-items: center; gap: 8px; overflow-x: auto; white-space: nowrap; border: 1px solid var(--border-color); }
  .path-bar::-webkit-scrollbar { height: 4px; }
  .path-bar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
  
  /* File List Layout */
  .file-list { display: flex; flex-direction: column; gap: 8px; }
  .item-card { display: flex; align-items: center; justify-content: space-between; min-height: 54px; padding: 10px 16px; background: var(--item-bg); border: 1px solid var(--border-color); border-radius: 12px; text-decoration: none; color: var(--text-main); transition: all 0.15s ease; gap: 12px; }
  .item-card:hover, .item-card:active { background: var(--item-hover); border-color: var(--brand-blue); }
  .item-card:active { transform: scale(0.99); }
  
  .item-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
  .item-icon { flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
  .item-name { font-weight: 600; font-size: 14px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; word-break: break-all; }
  .item-size { font-size: 12px; color: var(--text-muted); flex-shrink: 0; background: var(--badge-bg); padding: 4px 10px; border-radius: 6px; font-weight: 600; }

  @media (max-width: 640px) {
    body { padding: 8px; }
    .container { padding: 16px 14px; border-radius: 16px; border: none; }
    .title { font-size: 17px; }
    .search-input { height: 42px; font-size: 14px; }
    .item-card { padding: 12px; min-height: 54px; }
    .item-name { font-size: 13.5px; }
    .item-size { font-size: 11px; padding: 3px 8px; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="header-top">
      <div class="brand">
        <img src="/logo-drive.png" alt="Awd TeleDrive Logo" onerror="this.onerror=null; this.src='/icon.webp';" />
        <div>
          <h1 class="title">Awd TeleDrive</h1>
          <p class="subtitle">Cloud Web Explorer</p>
        </div>
      </div>
      <button type="button" class="theme-btn" id="themeBtn" onclick="toggleTheme()" title="Ganti Tema"></button>
    </div>
    <div class="search-box">
      <div class="search-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      </div>
      <input type="text" id="searchInput" class="search-input" placeholder="Cari file atau folder..." onkeyup="filterFiles()" />
    </div>
  </div>
`)

	sb.WriteString(fmt.Sprintf("<div class='path-bar'>Lokasi: %s</div>", reqPath))
	sb.WriteString("<div class='file-list' id='fileGrid'>")

	svgFolder := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
	svgVideo := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
	svgAudio := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`
	svgImage := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
	svgArchive := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>`
	svgDoc := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
	svgFile := `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`

	if reqPath != "/" && reqPath != "." {
		parent := filepath.Dir(reqPath)
		if parent == "." {
			parent = "/"
		}
		sb.WriteString(fmt.Sprintf(`<a class="item-card" href="%s">
      <div class="item-left"><span class="item-icon">%s</span><span class="item-name">.. (Kembali ke Folder Atas)</span></div>
      <span class="item-size">Folder</span>
    </a>`, parent, svgFolder))
	}

	for _, entry := range entries {
		name := entry.Name()
		itemURL := filepath.Join(reqPath, name)
		ext := strings.ToLower(filepath.Ext(name))

		icon := svgFile
		if entry.IsDir() {
			icon = svgFolder
		} else if ext == ".mp4" || ext == ".mkv" || ext == ".avi" || ext == ".mov" || ext == ".webm" {
			icon = svgVideo
		} else if ext == ".mp3" || ext == ".flac" || ext == ".wav" || ext == ".aac" || ext == ".m4a" {
			icon = svgAudio
		} else if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp" {
			icon = svgImage
		} else if ext == ".zip" || ext == ".rar" || ext == ".7z" || ext == ".tar" || ext == ".gz" {
			icon = svgArchive
		} else if ext == ".pdf" || ext == ".txt" || ext == ".doc" || ext == ".docx" {
			icon = svgDoc
		}

		if entry.IsDir() {
			sb.WriteString(fmt.Sprintf(`<a class="item-card file-item" href="%s/">
        <div class="item-left"><span class="item-icon">%s</span><span class="item-name">%s</span></div>
        <span class="item-size">Folder</span>
      </a>`, itemURL, icon, name))
		} else {
			info, _ := entry.Info()
			sz := ""
			if info != nil {
				sz = fmt.Sprintf("%.2f MB", float64(info.Size())/(1024*1024))
			}
			sb.WriteString(fmt.Sprintf(`<a class="item-card file-item" href="%s" target="_blank">
        <div class="item-left"><span class="item-icon">%s</span><span class="item-name">%s</span></div>
        <span class="item-size">%s</span>
      </a>`, itemURL, icon, name, sz))
		}
	}

	sb.WriteString(`</div>
</div>
<script>
  const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function initTheme() {
    const saved = localStorage.getItem('awd_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeBtn(saved);
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('awd_theme', next);
    updateThemeBtn(next);
  }
  function updateThemeBtn(t) {
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = t === 'dark' ? sunSvg : moonSvg;
    }
  }
  function filterFiles() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const items = document.getElementsByClassName('file-item');
    for (let i = 0; i < items.length; i++) {
      const txt = items[i].textContent || items[i].innerText;
      if (txt.toLowerCase().indexOf(input) > -1) {
        items[i].style.display = "";
      } else {
        items[i].style.display = "none";
      }
    }
  }
  initTheme();
</script>
</body>
</html>`)
	_, _ = w.Write([]byte(sb.String()))
	return true
}

func generateRandomPIN() string {
	return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
}

// StartNativeWebDAVServer starts a native Go WebDAV server with Password Authentication.
func (a *App) StartNativeWebDAVServer(port int, password string) (string, error) {
	if port <= 0 {
		port = 8085
	}

	if password == "" {
		password = generateRandomPIN()
	}

	if a.virtualDriveMgr == nil {
		return "", fmt.Errorf("Virtual Drive Manager not initialized")
	}

	a.virtualDriveMgr.syncVirtualDriveRoot("0")

	localIP := getLocalIP()

	a.virtualDriveMgr.mu.Lock()
	a.virtualDriveMgr.webdavPassword = password
	if a.virtualDriveMgr.webdavActive {
		p := a.virtualDriveMgr.webdavPort
		a.virtualDriveMgr.mu.Unlock()
		return fmt.Sprintf("http://%s:%d/", localIP, p), nil
	}
	a.virtualDriveMgr.mu.Unlock()

	wdHandler := &webdav.Handler{
		FileSystem: webdav.Dir(a.virtualDriveMgr.vdiskDir),
		LockSystem: webdav.NewMemLS(),
	}

	httpHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 0. Handle embedded static images logo-drive.png & icon.webp
		if r.URL.Path == "/logo-drive.png" || r.URL.Path == "/icon.webp" {
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Cache-Control", "public, max-age=86400")
			if len(logoDrivePngBytes) > 0 {
				w.Write(logoDrivePngBytes)
			} else {
				w.Write(iconWebpBytes)
			}
			return
		}

		a.virtualDriveMgr.mu.Lock()
		reqPassword := a.virtualDriveMgr.webdavPassword
		a.virtualDriveMgr.mu.Unlock()

		// 1. Handle Login POST request from Web Explorer
		if r.Method == "POST" && r.URL.Path == "/__login" {
			_ = r.ParseForm()
			pass := r.FormValue("password")
			if reqPassword != "" && pass == reqPassword {
				http.SetCookie(w, &http.Cookie{
					Name:     "webdav_auth",
					Value:    reqPassword,
					Path:     "/",
					Expires:  time.Now().Add(24 * time.Hour),
					HttpOnly: true,
				})
				http.Redirect(w, r, "/", http.StatusSeeOther)
				return
			}
			serveLoginPageHTML(w, r, "Password / PIN salah, silakan coba lagi.")
			return
		}

		// 2. Security Check if Password is set
		isLoopback := strings.HasPrefix(r.RemoteAddr, "127.0.0.1") || strings.HasPrefix(r.RemoteAddr, "[::1]") || strings.HasPrefix(r.RemoteAddr, "localhost")
		if reqPassword != "" && !isLoopback {
			authed := false

			_, pass, ok := r.BasicAuth()
			if ok && pass == reqPassword {
				authed = true
			}

			if !authed {
				cookie, err := r.Cookie("webdav_auth")
				if err == nil && cookie.Value == reqPassword {
					authed = true
				}
			}

			if !authed {
				if strings.Contains(r.Header.Get("User-Agent"), "Mozilla") {
					serveLoginPageHTML(w, r, "")
					return
				}
				w.Header().Set("WWW-Authenticate", `Basic realm="Awd TeleDrive Wi-Fi Access"`)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
		}

		w.Header().Set("DAV", "1, 2")
		w.Header().Set("MS-Author-Via", "DAV")

		// Enforce Read-Only mode for WebDAV / Mount Drive (block write operations)
		if r.Method == "PUT" || r.Method == "MKCOL" || r.Method == "DELETE" || r.Method == "MOVE" || r.Method == "COPY" || r.Method == "PROPPATCH" {
			http.Error(w, "WebDAV drive is Read-Only", http.StatusMethodNotAllowed)
			return
		}

		// Auto re-sync vdisk if root is requested or if vdisk is empty
		if r.URL.Path == "/" || r.URL.Path == "" {
			a.virtualDriveMgr.syncVirtualDriveRoot("0")
		} else {
			entries, _ := os.ReadDir(a.virtualDriveMgr.vdiskDir)
			if len(entries) == 0 {
				a.virtualDriveMgr.syncVirtualDriveRoot("0")
			}
		}

		reqPath := filepath.Clean(r.URL.Path)
		fullPath := filepath.Join(a.virtualDriveMgr.vdiskDir, reqPath)

		// 3. Handle browser GET requests for directories
		if r.Method == "GET" && strings.Contains(r.Header.Get("User-Agent"), "Mozilla") {
			if serveWebExplorerHTML(w, r, a.virtualDriveMgr.vdiskDir) {
				return
			}
		}

		// 4. Handle GET requests for files (Stream real cloud content)
		if r.Method == "GET" {
			info, err := os.Stat(fullPath)
			if err == nil && !info.IsDir() {
				if a.streamCloudFile(w, r, reqPath) {
					return
				}
			}
		}

		wdHandler.ServeHTTP(w, r)
	})

	listener, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
	if err != nil {
		listener, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			return "", fmt.Errorf("failed to listen on port %d: %v", port, err)
		}
	}

	server := &http.Server{Handler: httpHandler}
	a.virtualDriveMgr.mu.Lock()
	a.virtualDriveMgr.webdavServer = server
	a.virtualDriveMgr.webdavPort = port
	a.virtualDriveMgr.webdavActive = true
	a.virtualDriveMgr.mu.Unlock()

	go func() {
		_ = server.Serve(listener)
		a.virtualDriveMgr.mu.Lock()
		a.virtualDriveMgr.webdavActive = false
		a.virtualDriveMgr.mu.Unlock()
	}()

	return fmt.Sprintf("http://%s:%d/", localIP, port), nil
}

// StopNativeWebDAVServer stops the running native WebDAV server.
func (a *App) StopNativeWebDAVServer() error {
	if a.virtualDriveMgr == nil {
		return nil
	}

	a.virtualDriveMgr.mu.Lock()
	defer a.virtualDriveMgr.mu.Unlock()

	if a.virtualDriveMgr.webdavServer != nil {
		_ = a.virtualDriveMgr.webdavServer.Close()
		a.virtualDriveMgr.webdavServer = nil
	}
	a.virtualDriveMgr.webdavActive = false

	return nil
}

func findAvailableDriveLetter(preferred string) string {
	if runtime.GOOS != "windows" {
		return preferred
	}

	preferred = strings.ToUpper(strings.TrimSpace(preferred))
	if !strings.HasSuffix(preferred, ":") && len(preferred) > 0 {
		preferred += ":"
	}

	isDriveUsed := func(letter string) bool {
		_, err := os.Stat(letter + "\\")
		return err == nil
	}

	if preferred != "" && preferred != ":" && !isDriveUsed(preferred) {
		return preferred
	}

	letters := []string{"Z:", "Y:", "X:", "W:", "V:", "U:", "T:", "S:", "R:", "Q:", "P:", "O:", "N:", "M:", "L:", "K:", "J:", "I:", "H:", "G:", "F:", "E:", "D:"}
	for _, l := range letters {
		if !isDriveUsed(l) {
			return l
		}
	}

	if preferred == "" || preferred == ":" {
		return "Z:"
	}
	return preferred
}

// MountVirtualDrive maps Drive letter (Windows) or Volumes (macOS/Linux).
func (a *App) MountVirtualDrive(chatId string, driveLetter string) (MountedDriveInfo, error) {
	driveLetter = findAvailableDriveLetter(driveLetter)

	if a.virtualDriveMgr != nil {
		a.virtualDriveMgr.syncVirtualDriveRoot(chatId)
	}

	// 1. Ensure Native WebDAV server is running
	_, err := a.StartNativeWebDAVServer(8085, "")
	if err != nil {
		return MountedDriveInfo{}, fmt.Errorf("could not start native WebDAV engine: %v", err)
	}

	targetName := "Awd TeleDrive Cloud"
	mountID := fmt.Sprintf("vdrive-%d", time.Now().UnixNano())
	localhostURL := fmt.Sprintf("http://127.0.0.1:%d/", a.virtualDriveMgr.webdavPort)
	cleanURL := fmt.Sprintf("http://127.0.0.1:%d", a.virtualDriveMgr.webdavPort)

	// 2. Cross-platform Mount Execution
	switch runtime.GOOS {
	case "windows":
		_ = exec.Command("cmd.exe", "/c", "net use "+driveLetter+" /delete /y").Run()
		_ = exec.Command("cmd.exe", "/c", "subst "+driveLetter+" /d").Run()
		_ = exec.Command("cmd.exe", "/c", "sc start WebClient").Run()

		cmd := exec.Command("cmd.exe", "/c", fmt.Sprintf("net use %s %s /persistent:no", driveLetter, cleanURL))
		output, err := cmd.CombinedOutput()
		if err != nil {
			uncURL := fmt.Sprintf("\\\\127.0.0.1@%d\\DavWWWRoot", a.virtualDriveMgr.webdavPort)
			cmdFB := exec.Command("cmd.exe", "/c", fmt.Sprintf("net use %s %s /persistent:no", driveLetter, uncURL))
			outputFB, errFB := cmdFB.CombinedOutput()
			if errFB != nil {
				cleanVdiskDir := filepath.Clean(a.virtualDriveMgr.vdiskDir)
				_ = os.MkdirAll(cleanVdiskDir, 0755)
				cmdSubst := exec.Command("cmd.exe", "/c", fmt.Sprintf(`subst %s "%s"`, driveLetter, cleanVdiskDir))
				outputSubst, errSubst := cmdSubst.CombinedOutput()
				if errSubst != nil {
					return MountedDriveInfo{}, fmt.Errorf("Windows mount error: %s (WebDAV: %s, UNC: %s)", strings.TrimSpace(string(outputSubst)), strings.TrimSpace(string(output)), strings.TrimSpace(string(outputFB)))
				}
			}
		}
		_ = exec.Command("explorer.exe", driveLetter+"\\").Run()

	case "darwin":
		_ = exec.Command("open", localhostURL).Run()

	case "linux":
		davURL := fmt.Sprintf("dav://127.0.0.1:%d/", a.virtualDriveMgr.webdavPort)
		_ = exec.Command("gio", "mount", davURL).Run()
	}

	info := MountedDriveInfo{
		ID:          mountID,
		DriveLetter: driveLetter,
		AccountID:   chatId,
		TargetName:  targetName,
		URL:         localhostURL,
		StartTime:   time.Now(),
		Status:      "mounted",
	}

	if a.virtualDriveMgr != nil {
		a.virtualDriveMgr.mu.Lock()
		a.virtualDriveMgr.mounts[driveLetter] = &info
		a.virtualDriveMgr.mu.Unlock()
	}

	return info, nil
}

// UnmountVirtualDrive unmaps the drive letter or volume.
func (a *App) UnmountVirtualDrive(driveLetter string) error {
	if !strings.HasSuffix(driveLetter, ":") && runtime.GOOS == "windows" {
		driveLetter += ":"
	}

	switch runtime.GOOS {
	case "windows":
		_ = exec.Command("cmd.exe", "/c", "net use "+driveLetter+" /delete /y").Run()
		_ = exec.Command("cmd.exe", "/c", "subst "+driveLetter+" /d").Run()
	case "darwin":
		_ = exec.Command("umount", "/Volumes/DavWWWRoot").Run()
	case "linux":
		_ = exec.Command("gio", "mount", "-u", "dav://127.0.0.1:8085/").Run()
	}

	if a.virtualDriveMgr != nil {
		a.virtualDriveMgr.mu.Lock()
		delete(a.virtualDriveMgr.mounts, driveLetter)
		a.virtualDriveMgr.mu.Unlock()
	}

	return nil
}

// GetMountedVirtualDrives returns active mounted drive letters.
func (a *App) GetMountedVirtualDrives() []MountedDriveInfo {
	if a.virtualDriveMgr == nil {
		return []MountedDriveInfo{}
	}

	a.virtualDriveMgr.mu.Lock()
	defer a.virtualDriveMgr.mu.Unlock()

	var result []MountedDriveInfo
	for _, info := range a.virtualDriveMgr.mounts {
		result = append(result, *info)
	}
	return result
}
