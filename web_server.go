package main

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	stdruntime "runtime"
	"strings"
	"sync"
	"time"
)

//go:embed icon.webp
var iconWebpBytes []byte

//go:embed logo-drive.png
var logoDrivePngBytes []byte

type WebShareItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`        // "file" or "folder"
	TelegramID  string `json:"telegramId"`  // Message ID for files, Channel ID for folders
	ParentID    string `json:"parentId"`    // Channel ID for files, empty for folders
	Size        int64  `json:"size"`
	MimeType    string `json:"mimeType"`
	Date        int64  `json:"date"`
	Password    string `json:"password"`    // Optional password protection
	AccessCount int64  `json:"accessCount"`
}

type WebServer struct {
	App         *App
	Port        int
	SharedItems []WebShareItem
	ConfigFile  string
	PublicUrl   string
	TunnelCmd   *exec.Cmd
	Mu          sync.Mutex
	Listener    net.Listener
	Server      *http.Server
	Tunneling   bool
}

func NewWebServer(a *App) *WebServer {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		appData = os.Getenv("USERPROFILE")
	}
	configDir := filepath.Join(appData, "teledrive")
	_ = os.MkdirAll(configDir, 0755)

	return &WebServer{
		App:         a,
		ConfigFile:  filepath.Join(configDir, "web_shares.json"),
		SharedItems: []WebShareItem{},
	}
}

func (ws *WebServer) LoadShares() {
	ws.Mu.Lock()
	defer ws.Mu.Unlock()

	file, err := os.Open(ws.ConfigFile)
	if err != nil {
		return
	}
	defer file.Close()

	var items []WebShareItem
	if err := json.NewDecoder(file).Decode(&items); err == nil {
		ws.SharedItems = items
	}
}

func (ws *WebServer) SaveShares() {
	ws.Mu.Lock()
	defer ws.Mu.Unlock()

	file, err := os.Create(ws.ConfigFile)
	if err != nil {
		return
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	_ = encoder.Encode(ws.SharedItems)
}

func (ws *WebServer) Start() error {
	ws.LoadShares()

	// Find random open port
	l, err := net.Listen("tcp", "0.0.0.0:0")
	if err != nil {
		return err
	}
	ws.Listener = l
	ws.Port = l.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/share/", ws.handleShare)
	mux.HandleFunc("/download/", ws.handleDownload)
	mux.HandleFunc("/download_batch/", ws.handleBatchDownload)
	mux.HandleFunc("/local-temp/", ws.handleLocalTemp)
	mux.HandleFunc("/logo-drive.png", ws.handleLogoDrive)
	mux.HandleFunc("/icon.webp", ws.handleIcon)
	mux.HandleFunc("/", ws.handleIndex)

	ws.Server = &http.Server{
		Handler: mux,
	}

	go func() {
		if err := ws.Server.Serve(l); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Web server error: %v\n", err)
		}
	}()

	fmt.Printf("Web Share Server started on port %d\n", ws.Port)
	return nil
}

func (ws *WebServer) Stop() {
	ws.StopTunnel()
	if ws.Server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = ws.Server.Shutdown(ctx)
	}
	if ws.Listener != nil {
		_ = ws.Listener.Close()
	}
}

func (ws *WebServer) GetLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	var fallback string
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ip4 := ipnet.IP.To4(); ip4 != nil {
				ipStr := ip4.String()
				if strings.HasPrefix(ipStr, "169.254.") {
					continue
				}
				if ip4.IsPrivate() {
					return ipStr
				}
				if fallback == "" {
					fallback = ipStr
				}
			}
		}
	}
	if fallback != "" {
		return fallback
	}
	return "127.0.0.1"
}

func (ws *WebServer) StartTunnel() (string, error) {
	ws.Mu.Lock()
	if ws.Tunneling {
		url := ws.PublicUrl
		ws.Mu.Unlock()
		return url, nil
	}
	ws.Mu.Unlock()

	// Determine the correct binary name and download URL based on OS and architecture
	var exeName string
	var downloadURL string

	switch stdruntime.GOOS {
	case "windows":
		exeName = "cloudflared.exe"
		downloadURL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
	case "darwin":
		exeName = "cloudflared"
		if stdruntime.GOARCH == "arm64" {
			downloadURL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64"
		} else {
			downloadURL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64"
		}
	case "linux":
		exeName = "cloudflared"
		if stdruntime.GOARCH == "arm64" {
			downloadURL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
		} else {
			downloadURL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
		}
	default:
		return "", fmt.Errorf("unsupported OS: %s", stdruntime.GOOS)
	}

	// Ensure cloudflared exists in cross-platform user config directory
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config directory: %v", err)
	}
	binDir := filepath.Join(userConfigDir, "teledrive", "bin")
	_ = os.MkdirAll(binDir, 0755)
	cfPath := filepath.Join(binDir, exeName)

	if _, err := os.Stat(cfPath); os.IsNotExist(err) {
		ws.App.emitEvent("tunnel:status", "downloading")
		// Download cloudflared for the current platform
		err = ws.downloadCloudflared(cfPath, downloadURL)
		if err != nil {
			ws.App.emitEvent("tunnel:status", "failed")
			return "", fmt.Errorf("failed to download cloudflared: %v", err)
		}
		// Make the binary executable on Unix systems
		if stdruntime.GOOS != "windows" {
			_ = os.Chmod(cfPath, 0755)
		}
	}

	ws.App.emitEvent("tunnel:status", "connecting")

	// Launch Cloudflare Tunnel
	cmd := exec.Command(cfPath, "tunnel", "--url", fmt.Sprintf("http://localhost:%d", ws.Port))
	// Hide window console on Windows via platform-specific helper
	configureSysProcAttr(cmd)

	stdout, err := cmd.StderrPipe() // cloudflared prints tunnel info to stderr
	if err != nil {
		return "", err
	}

	if err := cmd.Start(); err != nil {
		ws.App.emitEvent("tunnel:status", "failed")
		return "", err
	}

	ws.Mu.Lock()
	ws.TunnelCmd = cmd
	ws.Tunneling = true
	ws.Mu.Unlock()

	// Parse public URL from stdout
	urlChan := make(chan string, 1)
	errChan := make(chan error, 1)

	go func() {
		scanner := bufio.NewScanner(stdout)
		found := false
		for scanner.Scan() {
			line := scanner.Text()
			fmt.Println("[cloudflared]", line)
			if strings.Contains(line, ".trycloudflare.com") {
				parts := strings.Fields(line)
				for _, p := range parts {
					if strings.HasPrefix(p, "https://") && strings.Contains(p, ".trycloudflare.com") {
						urlChan <- strings.TrimSpace(p)
						found = true
						break
					}
				}
			}
		}
		if err := scanner.Err(); err != nil {
			errChan <- err
			return
		}
		if !found {
			errChan <- fmt.Errorf("tunnel URL not found in output")
		}
	}()

	select {
	case url := <-urlChan:
		ws.Mu.Lock()
		ws.PublicUrl = url
		ws.Mu.Unlock()
		ws.App.emitEvent("tunnel:status", "connected")
		return url, nil
	case err := <-errChan:
		ws.StopTunnel()
		ws.App.emitEvent("tunnel:status", "failed")
		return "", err
	case <-time.After(30 * time.Second):
		ws.StopTunnel()
		ws.App.emitEvent("tunnel:status", "timeout")
		return "", fmt.Errorf("tunnel initialization timeout")
	}
}

func (ws *WebServer) StopTunnel() {
	ws.Mu.Lock()
	if ws.TunnelCmd != nil && ws.TunnelCmd.Process != nil {
		_ = ws.TunnelCmd.Process.Kill()
		ws.TunnelCmd = nil
	}
	ws.PublicUrl = ""
	ws.Tunneling = false
	ws.Mu.Unlock()
	ws.App.emitEvent("tunnel:status", "disconnected")
}

func (ws *WebServer) downloadCloudflared(dest string, url string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}
