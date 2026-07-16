package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type SyncTask struct {
	ID         string `json:"id"`
	LocalPath  string `json:"localPath"`
	DestChatId string `json:"destChatId"`
	Enabled    bool   `json:"enabled"`
}

var (
	backupTicker *time.Ticker
	backupStop   chan struct{}
)

func (a *App) OpenDirectoryDialog() string {
	res, _ := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Folder for Backup",
	})
	return res
}

func (a *App) StartAutoBackup(folderPath string, destChatId string) map[string]interface{} {
	if backupTicker != nil {
		a.StopAutoBackup()
	}
	
	cfg := a.loadConfig()
	if folderPath != "" && destChatId != "" {
		taskExists := false
		for _, t := range cfg.SyncTasks {
			if t.LocalPath == folderPath && t.DestChatId == destChatId {
				taskExists = true
				break
			}
		}
		if !taskExists {
			cfg.SyncTasks = append(cfg.SyncTasks, SyncTask{
				ID:         fmt.Sprintf("%d", time.Now().UnixNano()),
				LocalPath:  folderPath,
				DestChatId: destChatId,
				Enabled:    true,
			})
		}
		cfg.BackupFolder = folderPath
		cfg.BackupDestChatId = destChatId
	}
	
	cfg.AutoBackupEnabled = true
	a.saveConfig(cfg)
	
	interval := cfg.SyncInterval
	if interval < 10 {
		interval = 60
	}
	backupTicker = time.NewTicker(time.Duration(interval) * time.Second)
	backupStop = make(chan struct{})
	
	go func() {
		runBackup := func() {
			currentCfg := a.loadConfig()
			syncMode := currentCfg.SyncMode
			if syncMode == "" {
				syncMode = "one-way"
			}

			for _, task := range currentCfg.SyncTasks {
				if !task.Enabled {
					continue
				}
				
				if _, err := os.Stat(task.LocalPath); os.IsNotExist(err) {
					continue
				}

				existingFiles := a.GetFiles(task.DestChatId)
				existingMap := make(map[string]DriveItem)
				for _, f := range existingFiles {
					existingMap[f.Name] = f
				}

				// 1. One-way / Upload: Local to Telegram
				localFiles, err := os.ReadDir(task.LocalPath)
				if err != nil {
					continue
				}
				localMap := make(map[string]bool)
				for _, f := range localFiles {
					if !f.IsDir() {
						localMap[f.Name()] = true
						if _, exists := existingMap[f.Name()]; exists {
							continue
						}

						fi, err := f.Info()
						var size int64
						if err == nil {
							size = fi.Size()
						}

						fullPath := filepath.Join(task.LocalPath, f.Name())
						runtime.EventsEmit(a.ctx, "sync:activity", map[string]interface{}{
							"name":   f.Name(),
							"size":   size,
							"status": "uploading",
							"action": "upload",
							"time":   time.Now().Unix(),
						})
						
						r := a.UploadFile(fullPath, task.DestChatId)
						
						status := "success"
						if !r["success"].(bool) {
							status = "failed"
						}
						runtime.EventsEmit(a.ctx, "sync:activity", map[string]interface{}{
							"name":   f.Name(),
							"size":   size,
							"status": status,
							"action": "upload",
							"time":   time.Now().Unix(),
						})
												if status == "success" {
							a.ShowBalloonNotification("Awd TeleDrive", "Disinkronkan (Diunggah) / Synced (Uploaded): "+f.Name())
						}
					}
				}

				// 2. Two-way / Download: Telegram to Local
				if syncMode == "two-way" {
					for name, driveItem := range existingMap {
						if driveItem.Type == "folder" {
							continue
						}
						if localMap[name] {
							continue
						}
						runtime.EventsEmit(a.ctx, "sync:activity", map[string]interface{}{
							"name":   name,
							"size":   driveItem.Size,
							"status": "uploading",
							"action": "download",
							"time":   time.Now().Unix(),
						})

						err := a.downloadFileDirect(task.DestChatId, driveItem.ID, name, driveItem.Size, task.LocalPath)
						status := "success"
						if err != nil {
							status = "failed"
						}
						runtime.EventsEmit(a.ctx, "sync:activity", map[string]interface{}{
							"name":   name,
							"size":   driveItem.Size,
							"status": status,
							"action": "download",
							"time":   time.Now().Unix(),
						})
						if err == nil {
							a.ShowBalloonNotification("Awd TeleDrive", "Disinkronkan (Diunduh) / Synced (Downloaded): "+name)
						}
					}
				}
			}
		}

		runBackup()
		
		for {
			select {
			case <-backupTicker.C:
				runBackup()
			case <-backupStop:
				return
			case <-a.ctx.Done():
				return
			}
		}
	}()
	
	return map[string]interface{}{"success": true}
}

func (a *App) AddSyncTask(localPath string, destChatId string) map[string]interface{} {
	if _, err := os.Stat(localPath); os.IsNotExist(err) {
		return map[string]interface{}{"success": false, "error": "Folder does not exist"}
	}
	cfg := a.loadConfig()
	for _, t := range cfg.SyncTasks {
		if t.LocalPath == localPath && t.DestChatId == destChatId {
			return map[string]interface{}{"success": false, "error": "Sync task already exists"}
		}
	}
	cfg.SyncTasks = append(cfg.SyncTasks, SyncTask{
		ID:         fmt.Sprintf("%d", time.Now().UnixNano()),
		LocalPath:  localPath,
		DestChatId: destChatId,
		Enabled:    true,
	})
	if err := a.saveConfig(cfg); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	if backupTicker != nil {
		a.StartAutoBackup("", "")
	}
	return map[string]interface{}{"success": true}
}

func (a *App) RemoveSyncTask(id string) map[string]interface{} {
	cfg := a.loadConfig()
	newTasks := []SyncTask{}
	found := false
	for _, t := range cfg.SyncTasks {
		if t.ID == id {
			found = true
			continue
		}
		newTasks = append(newTasks, t)
	}
	if !found {
		return map[string]interface{}{"success": false, "error": "Task not found"}
	}
	cfg.SyncTasks = newTasks
	if err := a.saveConfig(cfg); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	if backupTicker != nil {
		a.StartAutoBackup("", "")
	}
	return map[string]interface{}{"success": true}
}

func (a *App) ToggleSyncTask(id string, enabled bool) map[string]interface{} {
	cfg := a.loadConfig()
	found := false
	for i, t := range cfg.SyncTasks {
		if t.ID == id {
			cfg.SyncTasks[i].Enabled = enabled
			found = true
			break
		}
	}
	if !found {
		return map[string]interface{}{"success": false, "error": "Task not found"}
	}
	if err := a.saveConfig(cfg); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	if backupTicker != nil {
		a.StartAutoBackup("", "")
	}
	return map[string]interface{}{"success": true}
}

func (a *App) StopAutoBackup() map[string]interface{} {
	cfg := a.loadConfig()
	cfg.AutoBackupEnabled = false
	a.saveConfig(cfg)

	if backupTicker != nil {
		backupTicker.Stop()
		close(backupStop)
		backupTicker = nil
	}
	return map[string]interface{}{"success": true}
}
