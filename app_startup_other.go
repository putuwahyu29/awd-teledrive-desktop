//go:build !windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

func getStartupConfig() (dirPath string, filePath string, content string, err error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", "", "", err
	}

	exePath, err := os.Executable()
	if err != nil {
		return "", "", "", err
	}

	if runtime.GOOS == "darwin" {
		dirPath = filepath.Join(homeDir, "Library", "LaunchAgents")
		filePath = filepath.Join(dirPath, "com.awd.teledrive.plist")
		content = fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.awd.teledrive</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>`, exePath)
	} else {
		// Linux
		dirPath = filepath.Join(homeDir, ".config", "autostart")
		filePath = filepath.Join(dirPath, "AwdTeleDrive.desktop")
		content = fmt.Sprintf(`[Desktop Entry]
Type=Application
Version=1.0
Name=Awd TeleDrive
Comment=Awd TeleDrive Desktop Application
Exec="%s"
StartupNotify=false
Terminal=false`, exePath)
	}

	return dirPath, filePath, content, nil
}

func (a *App) SetStartup(enable bool) map[string]interface{} {
	dirPath, filePath, content, err := getStartupConfig()
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	if enable {
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
		if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
	} else {
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
	}
	return map[string]interface{}{"success": true}
}

func (a *App) IsStartupEnabled() bool {
	_, filePath, _, err := getStartupConfig()
	if err != nil {
		return false
	}
	_, err = os.Stat(filePath)
	return err == nil
}
