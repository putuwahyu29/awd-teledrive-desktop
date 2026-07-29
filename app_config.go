package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/gotd/td/tg"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type AppConfig struct {
	APIID             string     `json:"api_id"`
	APIHash           string     `json:"api_hash"`
	AutoBackupEnabled bool       `json:"autoBackupEnabled"`
	BackupFolder      string     `json:"backupFolder"`
	BackupDestChatId  string     `json:"backupDestChatId"`
	SyncTasks         []SyncTask `json:"syncTasks"`
	SyncMode          string     `json:"syncMode"`     // "one-way" or "two-way"
	SyncInterval      int        `json:"syncInterval"` // seconds between sync checks
	ChannelCache      map[string]CachedChannel `json:"channelCache"`
	MinimizeToTray    bool       `json:"minimizeToTray"`
	AutoMountDrive    bool       `json:"autoMountDrive"`
	AutoMountLetter   string     `json:"autoMountLetter"`
}

type CachedChannel struct {
	AccessHash int64  `json:"accessHash"`
	Title      string `json:"title"`
}

func (a *App) persistChannelCache(id int64, hash int64, title string) {
	cfg := a.loadConfig()
	if cfg.ChannelCache == nil {
		cfg.ChannelCache = make(map[string]CachedChannel)
	}
	idStr := fmt.Sprintf("%d", id)
	if existing, ok := cfg.ChannelCache[idStr]; !ok || existing.Title != title {
		cfg.ChannelCache[idStr] = CachedChannel{AccessHash: hash, Title: title}
		a.saveConfig(cfg)
	}
}

func (a *App) GetSettings() map[string]interface{} {
	cfg := a.loadConfig()
	syncMode := cfg.SyncMode
	if syncMode == "" { syncMode = "one-way" }
	syncInterval := cfg.SyncInterval
	if syncInterval == 0 { syncInterval = 60 }
	tasks := cfg.SyncTasks
	if tasks == nil { tasks = []SyncTask{} }
	return map[string]interface{}{
		"autoBackupEnabled": cfg.AutoBackupEnabled,
		"backupFolder":      cfg.BackupFolder,
		"backupDestChatId":  cfg.BackupDestChatId,
		"syncTasks":         tasks,
		"syncMode":          syncMode,
		"syncInterval":      syncInterval,
		"minimizeToTray":    cfg.MinimizeToTray,
	}
}

func (a *App) SaveSyncSettings(syncMode string, syncInterval int) map[string]interface{} {
	if syncMode != "one-way" && syncMode != "two-way" {
		syncMode = "one-way"
	}
	if syncInterval < 10 { syncInterval = 10 }
	if syncInterval > 3600 { syncInterval = 3600 }
	cfg := a.loadConfig()
	cfg.SyncMode = syncMode
	cfg.SyncInterval = syncInterval
	if err := a.saveConfig(cfg); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	return map[string]interface{}{"success": true}
}

func (a *App) loadConfig() AppConfig {
	if a.configPath == "" {
		return AppConfig{}
	}
	data, err := os.ReadFile(a.configPath)
	if err != nil {
		return AppConfig{}
	}
	var cfg AppConfig
	json.Unmarshal(data, &cfg)
	return cfg
}

func (a *App) saveConfig(cfg AppConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.configPath, data, 0600)
}

func (a *App) GetAPICredentials() AppConfig {
	cfg := a.loadConfig()
	return cfg
}

func (a *App) SetAPICredentials(apiId string, apiHash string) map[string]interface{} {
	if apiId == "" || apiHash == "" {
		return map[string]interface{}{"success": false, "error": "API ID and API Hash cannot be empty"}
	}
	testID := 0
	if n, _ := fmt.Sscanf(apiId, "%d", &testID); n == 0 || testID == 0 {
		return map[string]interface{}{"success": false, "error": "API ID must be a valid number"}
	}
	cfg := a.loadConfig()
	cfg.APIID = apiId
	cfg.APIHash = apiHash
	if err := a.saveConfig(cfg); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	if a.clientCancel != nil {
		a.clientCancel()
	}
	a.clientCtx, a.clientCancel = context.WithCancel(a.ctx)
	a.connectedCh = make(chan struct{})
	a.channelCache = make(map[int64]*tg.InputPeerChannel)
	a.buildClient()
	a.apiMu.Lock()
	a.clientRunning = true
	a.apiMu.Unlock()
	go a.runClient()

	return map[string]interface{}{"success": true}
}


func (a *App) SetMinimizeToTray(enable bool) {
	a.minimizeToTray = enable
	cfg := a.loadConfig()
	cfg.MinimizeToTray = enable
	a.saveConfig(cfg)
}

func (a *App) ShowWindow() {
	runtime.WindowShow(a.ctx)
	runtime.WindowUnminimise(a.ctx)
	runtime.WindowSetAlwaysOnTop(a.ctx, true)
	runtime.WindowSetAlwaysOnTop(a.ctx, false)
}

func (a *App) QuitApp() {
	a.quitting = true
	a.minimizeToTray = false
	runtime.Quit(a.ctx)
}
