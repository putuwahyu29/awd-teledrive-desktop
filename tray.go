//go:build windows

package main

import (
	_ "embed"
	"encoding/binary"
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

//go:embed build/windows/icon.ico
var trayIconBytes []byte

// ─── Windows API ─────────────────────────────────────────────────────────────
const (
	WM_USER          = 0x0400
	WM_TRAYICON      = WM_USER + 1
	WM_LBUTTONDBLCLK = 0x0203
	WM_RBUTTONUP     = 0x0205
	WM_LBUTTONUP     = 0x0202
	WM_COMMAND       = 0x0111
	WM_DESTROY       = 0x0002

	NIM_ADD     = uint32(0x00000000)
	NIM_DELETE  = uint32(0x00000002)
	NIF_ICON    = uint32(0x00000002)
	NIF_TIP     = uint32(0x00000004)
	NIF_MESSAGE = uint32(0x00000001)

	CS_HREDRAW    = 0x0002
	CS_VREDRAW    = 0x0001
	WS_OVERLAPPED = 0x00000000

	TPM_RIGHTBUTTON = 0x0002
	TPM_BOTTOMALIGN = 0x0020
	MF_STRING       = 0x00000000
	MF_SEPARATOR    = 0x00000800

	ID_TRAY_OPEN = 1001
	ID_TRAY_QUIT = 1002
)

var (
	shell32  = windows.NewLazySystemDLL("shell32.dll")
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procShellNotifyIconW        = shell32.NewProc("Shell_NotifyIconW")
	procCreateWindowExW         = user32.NewProc("CreateWindowExW")
	procRegisterClassExW        = user32.NewProc("RegisterClassExW")
	procDefWindowProcW          = user32.NewProc("DefWindowProcW")
	procGetMessageW             = user32.NewProc("GetMessageW")
	procTranslateMessage        = user32.NewProc("TranslateMessage")
	procDispatchMessageW        = user32.NewProc("DispatchMessageW")
	procPostQuitMessage         = user32.NewProc("PostQuitMessage")
	procGetCursorPos            = user32.NewProc("GetCursorPos")
	procCreatePopupMenu         = user32.NewProc("CreatePopupMenu")
	procAppendMenuW             = user32.NewProc("AppendMenuW")
	procTrackPopupMenu          = user32.NewProc("TrackPopupMenu")
	procDestroyMenu             = user32.NewProc("DestroyMenu")
	procSetForegroundWindow     = user32.NewProc("SetForegroundWindow")
	procCreateIconFromResourceEx = user32.NewProc("CreateIconFromResourceEx")
	procLookupIconIdFromDirEx   = user32.NewProc("LookupIconIdFromDirectoryEx")
	procGetModuleHandleW        = kernel32.NewProc("GetModuleHandleW")
)

type NOTIFYICONDATA struct {
	CbSize           uint32
	HWnd             windows.HWND
	UID              uint32
	UFlags           uint32
	UCallbackMessage uint32
	HIcon            windows.Handle
	SzTip            [128]uint16
	DwState          uint32
	DwStateMask      uint32
	SzInfo           [256]uint16
	UVersion         uint32
	SzInfoTitle      [64]uint16
	DwInfoFlags      uint32
	GuidItem         windows.GUID
	HBalloonIcon     windows.Handle
}

type WNDCLASSEX struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     windows.Handle
	HIcon         windows.Handle
	HCursor       windows.Handle
	HbrBackground windows.Handle
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       windows.Handle
}

type POINT struct{ X, Y int32 }

type MSG struct {
	HWnd    windows.HWND
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      POINT
}

// loadTrayIcon loads an .ico file from bytes.
// ICO format: 6-byte header, then ICONDIRENTRY[] pointing to image data.
func loadTrayIcon(icoData []byte) windows.Handle {
	if len(icoData) < 6 {
		return 0
	}
	// ICO header: reserved(2), type(2), count(2)
	count := int(binary.LittleEndian.Uint16(icoData[4:6]))
	if count == 0 || len(icoData) < 6+count*16 {
		return 0
	}
	// Pick the first image entry: offset=6, each entry is 16 bytes
	// Entry: width(1), height(1), colorCount(1), reserved(1),
	//        planes(2), bitCount(2), bytesInRes(4), imageOffset(4)
	entryOff := 6
	imgSize := int(binary.LittleEndian.Uint32(icoData[entryOff+8 : entryOff+12]))
	imgOffset := int(binary.LittleEndian.Uint32(icoData[entryOff+12 : entryOff+16]))
	if imgOffset+imgSize > len(icoData) {
		return 0
	}
	imgData := icoData[imgOffset : imgOffset+imgSize]
	// CreateIconFromResourceEx: lpPresbits, dwResSize, fIcon, dwVer, cxDesired, cyDesired, uFlags
	hIcon, _, _ := procCreateIconFromResourceEx.Call(
		uintptr(unsafe.Pointer(&imgData[0])),
		uintptr(imgSize),
		1,          // fIcon = TRUE
		0x00030000, // dwVer = 3.0
		32, 32, 0,
	)
	return windows.Handle(hIcon)
}

func shellNotifyIcon(dwMessage uint32, lpData *NOTIFYICONDATA) {
	procShellNotifyIconW.Call(uintptr(dwMessage), uintptr(unsafe.Pointer(lpData)))
}

var trayNID NOTIFYICONDATA // keep globally so we can delete on exit


func (a *App) startTray() {
	go a.runTrayLoop()
}

func (a *App) runTrayLoop() {
	hInst, _, _ := procGetModuleHandleW.Call(0)
	className, _ := syscall.UTF16PtrFromString("AwdTeleDriveTray")

	wndProc := syscall.NewCallback(func(hwnd windows.HWND, msg uint32, wParam, lParam uintptr) uintptr {
		switch msg {
		case WM_TRAYICON:
			lo := lParam & 0xFFFF
			switch lo {
			case WM_LBUTTONDBLCLK, WM_LBUTTONUP:
				a.ShowWindow()
			case WM_RBUTTONUP:
				a.showTrayMenu(hwnd)
			}
		case WM_COMMAND:
			id := wParam & 0xFFFF
			switch id {
			case ID_TRAY_OPEN:
				a.ShowWindow()
			case ID_TRAY_QUIT:
				shellNotifyIcon(NIM_DELETE, &trayNID)
				procPostQuitMessage.Call(0)
				a.QuitApp()
			}
		case WM_DESTROY:
			procPostQuitMessage.Call(0)
		}
		r, _, _ := procDefWindowProcW.Call(uintptr(hwnd), uintptr(msg), wParam, lParam)
		return r
	})

	wc := WNDCLASSEX{
		LpfnWndProc:   wndProc,
		HInstance:     windows.Handle(hInst),
		LpszClassName: className,
		Style:         CS_HREDRAW | CS_VREDRAW,
	}
	wc.CbSize = uint32(unsafe.Sizeof(wc))
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	titlePtr, _ := syscall.UTF16PtrFromString("AwdTeleDriveTrayWindow")
	hwndRaw, _, _ := procCreateWindowExW.Call(
		0, uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(titlePtr)),
		WS_OVERLAPPED, 0, 0, 0, 0, 0, 0, hInst, 0,
	)
	hwnd := windows.HWND(hwndRaw)

	// Load icon from embedded ICO bytes
	hIcon := loadTrayIcon(trayIconBytes)
	if hIcon == 0 {
		fmt.Println("[Tray] Warning: failed to load custom icon, using fallback")
		// Use the app's own icon as fallback via LoadIcon
		loadIconProc := user32.NewProc("LoadIconW")
		r, _, _ := loadIconProc.Call(0, 32512) // IDI_APPLICATION
		hIcon = windows.Handle(r)

	}

	// Build the NOTIFYICONDATA
	tip, _ := syscall.UTF16FromString("Awd TeleDrive")
	trayNID = NOTIFYICONDATA{
		HWnd:             hwnd,
		UID:              1,
		UFlags:           NIF_ICON | NIF_TIP | NIF_MESSAGE,
		UCallbackMessage: WM_TRAYICON,
		HIcon:            windows.Handle(hIcon),
	}
	trayNID.CbSize = uint32(unsafe.Sizeof(trayNID))
	copy(trayNID.SzTip[:], tip)
	shellNotifyIcon(NIM_ADD, &trayNID)
	fmt.Println("[Tray] System tray icon added")

	// Message loop
	var msg MSG
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if r == 0 || r == ^uintptr(0) {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
	}
	shellNotifyIcon(NIM_DELETE, &trayNID)
	fmt.Println("[Tray] System tray icon removed")
}

func (a *App) showTrayMenu(hwnd windows.HWND) {
	var pt POINT
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))

	hMenu, _, _ := procCreatePopupMenu.Call()
	openStr, _ := syscall.UTF16PtrFromString("Buka Awd TeleDrive")
	quitStr, _ := syscall.UTF16PtrFromString("Keluar")
	sepPtr, _ := syscall.UTF16PtrFromString("")

	procAppendMenuW.Call(hMenu, MF_STRING, ID_TRAY_OPEN, uintptr(unsafe.Pointer(openStr)))
	procAppendMenuW.Call(hMenu, MF_SEPARATOR, 0, uintptr(unsafe.Pointer(sepPtr)))
	procAppendMenuW.Call(hMenu, MF_STRING, ID_TRAY_QUIT, uintptr(unsafe.Pointer(quitStr)))

	procSetForegroundWindow.Call(uintptr(hwnd))
	procTrackPopupMenu.Call(
		hMenu, TPM_RIGHTBUTTON|TPM_BOTTOMALIGN,
		uintptr(pt.X), uintptr(pt.Y),
		0, uintptr(hwnd), 0,
	)
	procDestroyMenu.Call(hMenu)
}
