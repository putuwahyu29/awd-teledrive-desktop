package main

import (
	"fmt"
	"github.com/gen2brain/beeep"
)

// ShowBalloonNotification displays a cross-platform desktop notification.
func (a *App) ShowBalloonNotification(title, message string) {
	// Send notification using beeep.
	// Empty string is passed for the icon path (beeep will use a default icon).
	err := beeep.Notify(title, message, "")
	if err != nil {
		fmt.Printf("[Notification] Error displaying desktop notification: %v\n", err)
	}
}
