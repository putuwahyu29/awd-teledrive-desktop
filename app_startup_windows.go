//go:build windows

package main

import (
	"os"
	"golang.org/x/sys/windows/registry"
)

const (
	startupRegKey  = `Software\Microsoft\Windows\CurrentVersion\Run`
	startupAppName = "AwdTeleDrive"
)

func (a *App) SetStartup(enable bool) map[string]interface{} {
	k, err := registry.OpenKey(registry.CURRENT_USER, startupRegKey, registry.SET_VALUE)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	defer k.Close()

	if enable {
		exePath, err := os.Executable()
		if err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
		if err := k.SetStringValue(startupAppName, exePath); err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
	} else {
		if err := k.DeleteValue(startupAppName); err != nil && err != registry.ErrNotExist {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
	}
	return map[string]interface{}{"success": true}
}

func (a *App) IsStartupEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, startupRegKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	val, _, err := k.GetStringValue(startupAppName)
	if err != nil {
		return false
	}
	exePath, _ := os.Executable()
	return val == exePath
}
