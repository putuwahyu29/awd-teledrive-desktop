//go:build !windows

package main

func (a *App) startTray() {
	// Stub implementation for macOS and Linux.
	// Wails v2 does not have a built-in cross-platform system tray out of the box,
	// and cross-platform tray packages require CGO. Leaving this stubbed allows
	// macOS/Linux builds to compile cleanly and run in standard windowed mode.
}
