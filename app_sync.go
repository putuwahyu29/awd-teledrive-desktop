package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

func (a *App) ensureVirtualPath(destChatId string, dirRel string) string {
	if dirRel == "" || dirRel == "." || dirRel == "/" {
		return destChatId
	}

	parts := strings.Split(filepath.ToSlash(dirRel), "/")
	currentParent := destChatId
	if currentParent == "" || currentParent == "/" {
		currentParent = "0"
	}

	manifest := a.loadCloudManifest()
	if manifest.VirtualFolders == nil {
		manifest.VirtualFolders = make(map[string]VirtualFolder)
	}

	updated := false
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "." {
			continue
		}

		foundID := ""
		for _, vf := range manifest.VirtualFolders {
			if strings.EqualFold(vf.Name, part) && (vf.ParentID == currentParent || (currentParent == "0" && (vf.ParentID == "" || vf.ParentID == "0"))) {
				foundID = vf.ID
				break
			}
		}

		if foundID != "" {
			currentParent = foundID
		} else {
			newID := fmt.Sprintf("vf_%d", time.Now().UnixNano())
			manifest.VirtualFolders[newID] = VirtualFolder{
				ID:        newID,
				Name:      part,
				ParentID:  currentParent,
				CreatedAt: time.Now().Unix(),
				Type:      "virtual_folder",
			}
			currentParent = newID
			updated = true
			time.Sleep(1 * time.Millisecond)
		}
	}

	if updated {
		_ = a.saveCloudManifest(manifest)
	}

	return currentParent
}

func (a *App) StartAutoBackup(folderPath string, destChatId string) map[string]interface{} {
	if backupTicker != nil {
		a.StopAutoBackup()
	}
	
	cfg := a.loadConfig()
	if folderPath == "" {
		folderPath = cfg.BackupFolder
	}
	if destChatId == "" {
		destChatId = cfg.BackupDestChatId
	}

	if folderPath != "" && (destChatId == "" || destChatId == "0" || destChatId == "/") {
		folderName := filepath.Base(folderPath)
		r := a.CreateFolder("0", folderName, "virtual")
		if succ, ok := r["success"].(bool); ok && succ {
			if idStr, ok := r["id"].(string); ok && idStr != "" {
				destChatId = idStr
			}
		}
	}

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
	_ = a.saveConfig(cfg)
	
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

				localMap := make(map[string]bool)

				// 1. One-way / Upload: Local to Telegram (support subfolders via WalkDir & Virtual Folders)
				_ = filepath.WalkDir(task.LocalPath, func(path string, d os.DirEntry, err error) error {
					if err != nil || d.IsDir() {
						return nil
					}

					fileName := d.Name()
					localMap[fileName] = true

					relPath, err := filepath.Rel(task.LocalPath, path)
					if err != nil {
						relPath = fileName
					}
					dirRel := filepath.Dir(relPath)

					targetFolderID := task.DestChatId
					isTelegramChannel := task.DestChatId != "0" && task.DestChatId != "" && !strings.HasPrefix(task.DestChatId, "vf_")
					if !isTelegramChannel && dirRel != "." && dirRel != "" && dirRel != "/" {
						targetFolderID = a.ensureVirtualPath(task.DestChatId, dirRel)
					}

					existingInTarget := a.GetFiles(targetFolderID)
					for _, ef := range existingInTarget {
						if strings.EqualFold(ef.Name, fileName) {
							return nil
						}
					}

					fi, err := d.Info()
					var size int64
					if err == nil {
						size = fi.Size()
					}

					runtime.EventsEmit(a.ctx, "sync:activity", map[string]interface{}{
						"name":   fileName,
						"size":   size,
						"status": "uploading",
						"action": "upload",
						"time":   time.Now().Unix(),
					})
					
					r := a.UploadFile(path, targetFolderID)
					
					status := "failed"
					if r != nil {
						if succ, ok := r["success"].(bool); ok && succ {
							status = "success"
						}
					}

					runtime.EventsEmit(a.ctx, "sync:activity", map[string]interface{}{
						"name":   fileName,
						"size":   size,
						"status": status,
						"action": "upload",
						"time":   time.Now().Unix(),
					})

					if status == "success" {
						a.ShowBalloonNotification("Awd TeleDrive", "Disinkronkan (Diunggah): "+fileName)
					}

					return nil
				})

				// 2. Two-way / Download: Telegram to Local
				if syncMode == "two-way" {
					existingFiles := a.GetFiles(task.DestChatId)
					existingMap := make(map[string]DriveItem)
					for _, f := range existingFiles {
						existingMap[f.Name] = f
					}

					for name, driveItem := range existingMap {
						if driveItem.Type == "folder" || driveItem.MimeType == "virtual_folder" {
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
							a.ShowBalloonNotification("Awd TeleDrive", "Disinkronkan (Diunduh): "+name)
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

	// Auto-create a new Virtual Folder named after local folder if target is not specified
	if destChatId == "" || destChatId == "0" || destChatId == "/" {
		folderName := filepath.Base(localPath)
		r := a.CreateFolder("0", folderName, "virtual")
		if succ, ok := r["success"].(bool); ok && succ {
			if idStr, ok := r["id"].(string); ok && idStr != "" {
				destChatId = idStr
			}
		}
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
