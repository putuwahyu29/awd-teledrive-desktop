package main

import (
	"context"
	"errors"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/telegram/auth/qrlogin"
	"github.com/gotd/td/telegram/dcs"
	"github.com/gotd/td/tg"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	qrcode "github.com/skip2/go-qrcode"
)

type JSONSession struct {
	path string
}

func (s *JSONSession) LoadSession(ctx context.Context) ([]byte, error) {
	if _, err := os.Stat(s.path); os.IsNotExist(err) {
		return nil, session.ErrNotFound
	}
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, session.ErrNotFound
		}
		return nil, err
	}
	if len(data) == 0 {
		return nil, session.ErrNotFound
	}
	return data, nil
}

func (s *JSONSession) StoreSession(ctx context.Context, data []byte) error {
	return os.WriteFile(s.path, data, 0600)
}

func (a *App) buildClient() {
	// Priority 1: config.json (user-saved credentials)
	cfg := a.loadConfig()
	apiIDStr := cfg.APIID
	apiHashStr := cfg.APIHash

	// Priority 2: .env file
	if apiIDStr == "" || apiIDStr == "0" {
		if envData, err := os.ReadFile(".env"); err == nil {
			lines := strings.Split(string(envData), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 && os.Getenv(parts[0]) == "" {
					os.Setenv(parts[0], parts[1])
				}
			}
		}
		apiIDStr = os.Getenv("VITE_API_ID")
		apiHashStr = os.Getenv("VITE_API_HASH")
	}

	// Priority 3: build-time vars
	if apiIDStr == "" || apiIDStr == "0" {
		apiIDStr = buildAPIID
		apiHashStr = buildAPIHash
	}

	apiID := 0
	fmt.Sscanf(apiIDStr, "%d", &apiID)

	sessionStorage := &JSONSession{path: a.sessionPath}
	a.client = telegram.NewClient(apiID, apiHashStr, telegram.Options{
		SessionStorage: sessionStorage,
		DC:             2,
		DCList:         dcs.Prod(),
		UpdateHandler:  a.dispatcher,
	})
}

func (a *App) runClient() {
	a.apiMu.Lock()
	a.clientRunning = true
	a.lastClientErr = nil
	a.apiMu.Unlock()

	err := a.client.Run(a.clientCtx, func(ctx context.Context) error {
		a.apiMu.Lock()
		a.api = a.client.API()
		a.apiMu.Unlock()

		select {
		case <-a.connectedCh:
		default:
			close(a.connectedCh)
		}
		<-ctx.Done()
		return nil
	})

	a.apiMu.Lock()
	a.api = nil
	a.clientRunning = false
	if err != nil && err != context.Canceled {
		a.lastClientErr = err
	}
	a.apiMu.Unlock()

	if err != nil && err != context.Canceled {
		fmt.Println("[Teledrive] Client stopped:", err)
	}
}

func (a *App) ensureClientRunning() {
	a.apiMu.Lock()
	running := a.clientRunning
	a.apiMu.Unlock()

	if !running {
		fmt.Println("[Teledrive] Telegram client is stopped, starting...")
		if a.clientCancel != nil {
			a.clientCancel()
		}
		a.clientCtx, a.clientCancel = context.WithCancel(a.ctx)
		a.connectedCh = make(chan struct{})
		a.buildClient()
		a.apiMu.Lock()
		a.clientRunning = true
		a.apiMu.Unlock()
		go a.runClient()
	}
}

func (a *App) waitConnected(timeout time.Duration) error {
	a.ensureClientRunning()
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case <-a.connectedCh:
		if a.getAPI() == nil {
			return fmt.Errorf("Koneksi gagal terhubung ke server DC")
		}
		return nil
	case <-timer.C:
		a.apiMu.RLock()
		lastErr := a.lastClientErr
		a.apiMu.RUnlock()
		if lastErr != nil {
			return fmt.Errorf("Gagal terhubung ke server DC: %v", lastErr)
		}
		return fmt.Errorf("Gagal terhubung ke server penyimpanan (timeout). Periksa koneksi internet atau API ID/Hash Anda")
	case <-a.clientCtx.Done():
		a.apiMu.RLock()
		lastErr := a.lastClientErr
		a.apiMu.RUnlock()
		if lastErr != nil {
			return fmt.Errorf("Koneksi gagal: %v", lastErr)
		}
		return fmt.Errorf("Koneksi dibatalkan")
	}
}

func (a *App) getAPI() *tg.Client {
	a.apiMu.RLock()
	defer a.apiMu.RUnlock()
	return a.api
}

func (a *App) CheckAuth() bool {
	if err := a.waitConnected(3 * time.Second); err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(a.clientCtx, 2*time.Second)
	defer cancel()
	status, err := a.client.Auth().Status(ctx)
	if err != nil {
		return false
	}

	return status.Authorized
}

func translateTelegramError(errStr string) string {
	upper := strings.ToUpper(errStr)
	if strings.Contains(upper, "PHONE_CODE_INVALID") {
		return "Kode OTP yang Anda masukkan salah. Silakan periksa kembali."
	}
	if strings.Contains(upper, "PHONE_CODE_EXPIRED") {
		return "Kode OTP sudah kadaluwarsa. Silakan kirim ulang kode baru."
	}
	if strings.Contains(upper, "PHONE_NUMBER_INVALID") {
		return "Nomor telepon tidak valid. Pastikan format nomor benar (contoh: 628123456789)."
	}
	if strings.Contains(upper, "PHONE_NUMBER_UNOCCUPIED") {
		return "Nomor telepon belum terdaftar."
	}
	if strings.Contains(upper, "PHONE_NUMBER_FLOOD") || strings.Contains(upper, "FLOOD_WAIT") {
		return "Terlalu banyak percobaan. Silakan tunggu beberapa menit sebelum mencoba lagi."
	}
	if strings.Contains(upper, "API_ID_INVALID") || strings.Contains(upper, "API_ID_PUBLISHED_FLOOD") {
		return "API ID atau API Hash tidak valid. Silakan periksa kembali pengaturan Anda."
	}
	if strings.Contains(upper, "PASSWORD_HASH_INVALID") {
		return "Password verifikasi 2 langkah (2FA) yang Anda masukkan salah."
	}
	if strings.Contains(upper, "MIGRATE") || strings.Contains(upper, "MIGRATION") {
		return "Sistem sedang menyesuaikan lokasi server (DC). Silakan coba lagi."
	}
	clean := errStr
	if idx := strings.Index(clean, "rpc error code"); idx >= 0 {
		clean = strings.TrimSpace(clean[idx:])
	}
	return clean
}

func (a *App) SendCode(phone string) map[string]interface{} {
	if err := a.waitConnected(10 * time.Second); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	cleanPhone := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)

	a.authPhone = cleanPhone
	ctx, cancel := context.WithTimeout(a.clientCtx, 15*time.Second)
	defer cancel()
	res, err := a.client.Auth().SendCode(ctx, cleanPhone, auth.SendCodeOptions{})
	if err != nil {
		return map[string]interface{}{"success": false, "error": translateTelegramError(err.Error())}
	}
	sentCode, ok := res.(*tg.AuthSentCode)
	if !ok {
		return map[string]interface{}{"success": false, "error": "respon server tidak dikenal"}
	}
	a.authHash = sentCode.PhoneCodeHash
	return map[string]interface{}{"success": true, "phoneCodeHash": sentCode.PhoneCodeHash}
}

func (a *App) Login(phoneCode string, password string) map[string]interface{} {
	if err := a.waitConnected(10 * time.Second); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	ctx, cancel := context.WithTimeout(a.clientCtx, 15*time.Second)
	defer cancel()
	if password != "" {
		_, err := a.client.Auth().Password(ctx, password)
		if err != nil {
			return map[string]interface{}{"success": false, "error": translateTelegramError(err.Error())}
		}
		return map[string]interface{}{"success": true}
	}
	code := strings.TrimSpace(phoneCode)
	_, err := a.client.Auth().SignIn(ctx, a.authPhone, code, a.authHash)
	if err != nil {
		errStr := err.Error()
		if errors.Is(err, auth.ErrPasswordAuthNeeded) || 
			strings.Contains(errStr, "SESSION_PASSWORD_NEEDED") || 
			strings.Contains(strings.ToLower(errStr), "2fa required") || 
			strings.Contains(strings.ToLower(errStr), "password auth needed") || 
			strings.Contains(strings.ToLower(errStr), "password") {
			return map[string]interface{}{"success": false, "error": "PASSWORD_REQUIRED"}
		}
		return map[string]interface{}{"success": false, "error": translateTelegramError(errStr)}
	}
	return map[string]interface{}{"success": true}
}

func (a *App) Logout() map[string]interface{} {
	api := a.getAPI()
	if api != nil {
		// Try to log out from Telegram server (best effort, synchronous with 2s timeout)
		func() {
			defer func() {
				if r := recover(); r != nil {
					fmt.Printf("[Teledrive] Recovered from AuthLogOut panic: %v\n", r)
				}
			}()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_, _ = api.AuthLogOut(ctx)
		}()
	}

	// Cancel the client context
	if a.clientCancel != nil {
		a.clientCancel()
	}

	// Wait for the client goroutine to finish (max 2 seconds) to avoid file locks
	for i := 0; i < 20; i++ {
		a.apiMu.RLock()
		running := a.clientRunning
		a.apiMu.RUnlock()
		if !running {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	// Stop web server to release cloudflared executable lock
	if a.webServer != nil {
		a.webServer.Stop()
	}

	userDataDir, _ := os.UserConfigDir()
	teledriveDir := filepath.Join(userDataDir, "teledrive")
	if err := os.RemoveAll(teledriveDir); err != nil {
		fmt.Printf("[Teledrive] Warning: could not delete teledrive directory: %v\n", err)
	}
	_ = os.MkdirAll(teledriveDir, 0755)

	// Restart the web server
	if a.webServer != nil {
		_ = a.webServer.Start()
	}

	// Recreate client context and channel cache
	a.clientCtx, a.clientCancel = context.WithCancel(a.ctx)
	a.connectedCh = make(chan struct{})
	a.channelCache = make(map[int64]*tg.InputPeerChannel)
	
	a.buildClient()
	go a.runClient()

	return map[string]interface{}{"success": true}
}

func (a *App) StartQRLogin() map[string]interface{} {
	if err := a.waitConnected(10 * time.Second); err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	a.qrMu.Lock()
	if a.qrCancel != nil {
		a.qrCancel()
	}
	qrCtx, cancel := context.WithCancel(a.ctx)
	a.qrCancel = cancel
	a.qrMu.Unlock()

	go func() {
		cfg := a.loadConfig()
		apiIDStr := cfg.APIID
		apiHashStr := cfg.APIHash

		if apiIDStr == "" || apiIDStr == "0" {
			apiIDStr = os.Getenv("VITE_API_ID")
			apiHashStr = os.Getenv("VITE_API_HASH")
		}
		if apiIDStr == "" || apiIDStr == "0" {
			apiIDStr = buildAPIID
			apiHashStr = buildAPIHash
		}

		apiID := 0
		fmt.Sscanf(apiIDStr, "%d", &apiID)

		api := a.getAPI()
		if api == nil {
			runtime.EventsEmit(a.ctx, "auth_error", "Koneksi tidak siap. Silakan klik Reset Sesi atau coba lagi.")
			return
		}

		q := qrlogin.NewQR(api, apiID, apiHashStr, qrlogin.Options{
			Migrate: func(ctx context.Context, dcID int) error {
				fmt.Printf("[Teledrive] QR Login migrating to DC %d\n", dcID)
				return a.client.MigrateTo(ctx, dcID)
			},
		})
		loggedIn := qrlogin.OnLoginToken(a.dispatcher)

		authRes, err := q.Auth(qrCtx, loggedIn, func(ctx context.Context, token qrlogin.Token) error {
			pngBytes, qrErr := qrcode.Encode(token.URL(), qrcode.Medium, 256)
			if qrErr != nil {
				runtime.EventsEmit(a.ctx, "auth_error", "Gagal menghasilkan QR Code internal: "+qrErr.Error())
				return qrErr
			}
			base64Img := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)

			runtime.EventsEmit(a.ctx, "qr_token", map[string]interface{}{
				"url":     base64Img,
				"expires": token.Expires().Unix(),
			})
			return nil
		})

		if err != nil {
			if err == context.Canceled {
				fmt.Println("[Teledrive] QR Login loop canceled")
				return
			}
			errStr := err.Error()
			if errors.Is(err, auth.ErrPasswordAuthNeeded) ||
				strings.Contains(errStr, "SESSION_PASSWORD_NEEDED") ||
				strings.Contains(strings.ToLower(errStr), "2fa required") ||
				strings.Contains(strings.ToLower(errStr), "password auth needed") ||
				strings.Contains(strings.ToLower(errStr), "password") {
				runtime.EventsEmit(a.ctx, "auth_password_required")
				return
			}
			runtime.EventsEmit(a.ctx, "auth_error", translateTelegramError(errStr))
			return
		}

		if authRes != nil {
			runtime.EventsEmit(a.ctx, "auth_success")
		}
	}()

	return map[string]interface{}{"success": true}
}

func (a *App) CancelQRLogin() {
	a.qrMu.Lock()
	if a.qrCancel != nil {
		a.qrCancel()
		a.qrCancel = nil
	}
	a.qrMu.Unlock()
}
