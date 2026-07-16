//go:build !windows

package main

import (
	"os/exec"
)

func configureSysProcAttr(cmd *exec.Cmd) {
	// No-op on macOS and Linux
}
