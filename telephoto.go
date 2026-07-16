package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	_ "image/gif"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gotd/td/telegram/downloader"
	"github.com/gotd/td/tg"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/pbkdf2"
)

type TelephotoMediaItem struct {
	LocalId           int64   `json:"localId"`
	LocalUri          string  `json:"localUri"`
	TelegramFileId    string  `json:"telegramFileId"`
	TelegramMessageId int64   `json:"telegramMessageId"`
	SyncStatus        string  `json:"syncStatus"`
	Timestamp         int64   `json:"timestamp"`
	MimeType          string  `json:"mimeType"`
	Size              int64   `json:"size"`
	Name              string  `json:"name"`
	IsVideo           bool    `json:"isVideo"`
	IsFavorite        bool    `json:"isFavorite"`
	IsEncrypted       bool    `json:"isEncrypted"`
	Latitude          float64 `json:"latitude"`
	Longitude         float64 `json:"longitude"`
	BucketName        string  `json:"bucketName"`
	CameraModel       string  `json:"cameraModel"`
	Resolution        string  `json:"resolution"`
}

type TelephotoGroup struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	HasBackup  bool   `json:"hasBackup"`
	AccessHash int64  `json:"accessHash"`
}

// deriveTelephotoKey derives key using PBKDF2 with HMAC-SHA256
func deriveTelephotoKey(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, 10000, 32, sha256.New)
}

// decryptTelephotoBytes decrypts AES-256-GCM encrypted bytes from awd-telephoto
func decryptTelephotoBytes(password string, data []byte) ([]byte, error) {
	if len(data) < 16+12 {
		return nil, fmt.Errorf("data too short for encrypted payload (salt + iv)")
	}
	salt := data[:16]
	iv := data[16 : 16+12]
	ciphertext := data[16+12:]

	key := deriveTelephotoKey(password, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := aesgcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed (wrong password?): %w", err)
	}

	return plaintext, nil
}

// GetTelephotoCacheDir returns the telephoto cache directory
func (a *App) GetTelephotoCacheDir() string {
	userDataDir, _ := os.UserConfigDir()
	cacheDir := filepath.Join(userDataDir, "teledrive", "telephoto_cache")
	_ = os.MkdirAll(cacheDir, 0755)
	return cacheDir
}

// ClearTelephotoCache clears all decrypted files in the telephoto cache directory
func (a *App) ClearTelephotoCache() map[string]interface{} {
	cacheDir := a.GetTelephotoCacheDir()
	err := os.RemoveAll(cacheDir)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	_ = os.MkdirAll(cacheDir, 0755)
	return map[string]interface{}{"success": true}
}

// ScanTelephotoGroups lists all groups and detects which contain telephoto backups
// Note: It only returns supergroups (megagroups) where the user is the author (creator).
func (a *App) ScanTelephotoGroups() []TelephotoGroup {
	api := a.getAPI()
	if api == nil {
		return []TelephotoGroup{}
	}

	groups := []TelephotoGroup{}
	seen := make(map[string]bool)

	// 1. Get user's dialogs
	dialogs, err := api.MessagesGetDialogs(a.ctx, &tg.MessagesGetDialogsRequest{
		OffsetPeer: &tg.InputPeerEmpty{},
		Limit:      100,
	})
	if err == nil {
		var chats []tg.ChatClass
		if d, ok := dialogs.(interface{ GetChats() []tg.ChatClass }); ok {
			chats = d.GetChats()
		}

		a.cacheMu.Lock()
		for _, chat := range chats {
			var id int64
			var title string
			var accessHash int64
			var isGroup bool

			switch c := chat.(type) {
			case *tg.Channel:
				// Only supergroup (Megagroup) where the user is the author (Creator)
				if c.Megagroup && c.Creator {
					id = c.ID
					title = c.Title
					accessHash = c.AccessHash
					isGroup = true
				}
			}

			if isGroup && id != 0 {
				idStr := fmt.Sprintf("%d", id)
				if accessHash != 0 {
					a.channelCache[id] = &tg.InputPeerChannel{
						ChannelID:  id,
						AccessHash: accessHash,
					}
					a.persistChannelCache(id, accessHash, title)
				}

				if !seen[idStr] {
					seen[idStr] = true
					groups = append(groups, TelephotoGroup{
						ID:         idStr,
						Title:      title,
						AccessHash: accessHash,
						HasBackup:  false,
					})
				}
			}
		}
		a.cacheMu.Unlock()
	}

	// 2. Global search for "telephoto_backup" to automatically mark groups with backup
	resDoc, err := api.MessagesSearchGlobal(a.ctx, &tg.MessagesSearchGlobalRequest{
		Q:      "telephoto_backup",
		Limit:  50,
		Filter: &tg.InputMessagesFilterDocument{},
	})
	if err == nil {
		var searchChats []tg.ChatClass
		if d, ok := resDoc.(interface{ GetChats() []tg.ChatClass }); ok {
			searchChats = d.GetChats()
		}

		backupGroupIDs := make(map[int64]bool)
		if msgs, ok := resDoc.(interface{ GetMessages() []tg.MessageClass }); ok {
			for _, m := range msgs.GetMessages() {
				if msg, ok := m.(*tg.Message); ok {
					if peer, ok := msg.PeerID.(*tg.PeerChannel); ok {
						backupGroupIDs[peer.ChannelID] = true
					} else if peer, ok := msg.PeerID.(*tg.PeerChat); ok {
						backupGroupIDs[peer.ChatID] = true
					}
				}
			}
		}

		a.cacheMu.Lock()
		for _, chat := range searchChats {
			var id int64
			var title string
			var accessHash int64
			var isChannel bool

			if c, ok := chat.(*tg.Channel); ok {
				// Only supergroup (Megagroup) where the user is the author (Creator)
				if c.Megagroup && c.Creator {
					id = c.ID
					title = c.Title
					accessHash = c.AccessHash
					isChannel = true
				}
			}

			if id != 0 && isChannel {
				idStr := fmt.Sprintf("%d", id)
				if accessHash != 0 {
					a.channelCache[id] = &tg.InputPeerChannel{
						ChannelID:  id,
						AccessHash: accessHash,
					}
					a.persistChannelCache(id, accessHash, title)
				}

				found := false
				for i, g := range groups {
					if g.ID == idStr {
						groups[i].HasBackup = backupGroupIDs[id]
						found = true
						break
					}
				}
				if !found {
					seen[idStr] = true
					groups = append(groups, TelephotoGroup{
						ID:         idStr,
						Title:      title,
						AccessHash: accessHash,
						HasBackup:  backupGroupIDs[id],
					})
				}
			}
		}
		a.cacheMu.Unlock()
	}

	return groups
}

// ImportTelephotoBackup finds, downloads and parses the telephoto_backup.json from the specified group.
// It will decrypt the backup JSON using the provided master password if the backup filename starts with 'enc_'.
func (a *App) ImportTelephotoBackup(chatIdStr string, password string) ([]TelephotoMediaItem, error) {
	api := a.getAPI()
	if api == nil {
		return nil, fmt.Errorf("not connected")
	}

	peer := a.getInputPeer(chatIdStr)
	var inputPeer tg.InputPeerClass

	if channel, ok := peer.(*tg.InputPeerChannel); ok {
		inputPeer = &tg.InputPeerChannel{
			ChannelID:  channel.ChannelID,
			AccessHash: channel.AccessHash,
		}
	} else if _, ok := peer.(*tg.InputPeerSelf); ok {
		inputPeer = &tg.InputPeerSelf{}
	} else {
		id, _ := strconv.ParseInt(chatIdStr, 10, 64)
		inputPeer = &tg.InputPeerChat{ChatID: id}
	}

	// Search specifically inside this peer for "telephoto_backup" documents
	res, err := api.MessagesSearch(a.ctx, &tg.MessagesSearchRequest{
		Peer:   inputPeer,
		Q:      "telephoto_backup",
		Filter: &tg.InputMessagesFilterDocument{},
		Limit:  20,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to search backup in group: %w", err)
	}

	var msgs []tg.MessageClass
	if m, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
		msgs = m.GetMessages()
	}

	var backupMsg *tg.Message
	var isEncryptedBackup bool
	for _, m := range msgs {
		if msg, ok := m.(*tg.Message); ok {
			if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
				if doc, ok := media.Document.(*tg.Document); ok {
					for _, attr := range doc.Attributes {
						if filenameAttr, ok := attr.(*tg.DocumentAttributeFilename); ok {
							fname := filenameAttr.FileName
							if strings.Contains(fname, "telephoto_backup.json") {
								backupMsg = msg
								isEncryptedBackup = strings.HasPrefix(fname, "enc_")
								break
							}
						}
					}
				}
			}
		}
		if backupMsg != nil {
			break
		}
	}

	if backupMsg == nil {
		return nil, fmt.Errorf("backup file 'telephoto_backup.json' or 'enc_telephoto_backup.json' not found in this group")
	}

	// Download backup file
	loc, err := a.getMessageLocation(chatIdStr, fmt.Sprintf("%d", backupMsg.ID))
	if err != nil {
		return nil, fmt.Errorf("failed to get file location: %w", err)
	}

	d := downloader.NewDownloader()
	var buf bytes.Buffer
	_, err = d.Download(api, loc).Stream(a.ctx, &buf)
	if err != nil {
		return nil, fmt.Errorf("failed to download backup stream: %w", err)
	}

	jsonBytes := buf.Bytes()
	if isEncryptedBackup {
		if password == "" {
			return nil, fmt.Errorf("master password is required to decrypt the encrypted backup file")
		}
		decrypted, err := decryptTelephotoBytes(password, jsonBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt backup file (wrong password?): %w", err)
		}
		jsonBytes = decrypted
	}

	var items []TelephotoMediaItem
	err = json.Unmarshal(jsonBytes, &items)
	if err != nil {
		return nil, fmt.Errorf("failed to parse backup JSON: %w", err)
	}

	return items, nil
}

// PreviewTelephotoFile downloads a Telephoto file, decrypts it if necessary, and returns its local path
func (a *App) PreviewTelephotoFile(chatIdStr string, messageIdStr string, fileName string, isEncrypted bool, password string) map[string]interface{} {
	fmt.Printf("[Telephoto] PreviewTelephotoFile called. ChatID: %s, MessageID: %s, File: %s, Encrypted: %t\n", chatIdStr, messageIdStr, fileName, isEncrypted)
	
	api := a.getAPI()
	if api == nil {
		fmt.Println("[Telephoto] Error: Telegram client not connected")
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	cacheDir := a.GetTelephotoCacheDir()
	cachedName := fmt.Sprintf("dec_%s_%s", messageIdStr, fileName)
	cachedPath := filepath.Join(cacheDir, cachedName)

	// If already in cache, return immediately
	if _, err := os.Stat(cachedPath); err == nil {
		fmt.Printf("[Telephoto] Preview file found in cache: %s\n", cachedPath)
		return map[string]interface{}{"success": true, "filePath": cachedPath}
	}

	// Download encrypted/raw file first
	fmt.Println("[Telephoto] Retrieving message location from Telegram...")
	loc, err := a.getMessageLocation(chatIdStr, messageIdStr)
	if err != nil {
		fmt.Printf("[Telephoto] Error getting message location: %v\n", err)
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to get location: %v", err)}
	}

	tempPath := filepath.Join(os.TempDir(), fmt.Sprintf("temp_tele_%s", messageIdStr))
	tempFile, err := os.Create(tempPath)
	if err != nil {
		fmt.Printf("[Telephoto] Error creating temp file: %v\n", err)
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to create temp file: %v", err)}
	}
	defer tempFile.Close()
	defer os.Remove(tempPath)

	fmt.Println("[Telephoto] Downloading file stream from Telegram...")
	d := downloader.NewDownloader()
	_, err = d.Download(api, loc).Stream(a.ctx, tempFile)
	if err != nil {
		fmt.Printf("[Telephoto] Error downloading stream: %v\n", err)
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to download: %v", err)}
	}
	_ = tempFile.Close()

	// Read downloaded bytes
	fmt.Println("[Telephoto] Reading downloaded temporary file bytes...")
	data, err := os.ReadFile(tempPath)
	if err != nil {
		fmt.Printf("[Telephoto] Error reading temp file: %v\n", err)
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to read downloaded file: %v", err)}
	}

	var finalData []byte
	if isEncrypted {
		if password == "" {
			fmt.Println("[Telephoto] Error: Master password is empty")
			return map[string]interface{}{"success": false, "error": "master password is required to decrypt this file"}
		}
		fmt.Println("[Telephoto] Decrypting file bytes...")
		decrypted, err := decryptTelephotoBytes(password, data)
		if err != nil {
			fmt.Printf("[Telephoto] Error decrypting file: %v\n", err)
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("decryption failed: %v", err)}
		}
		finalData = decrypted
		fmt.Println("[Telephoto] Decryption successful!")
	} else {
		finalData = data
	}

	// Save to cache
	fmt.Printf("[Telephoto] Writing decrypted file to cache: %s\n", cachedPath)
	err = os.WriteFile(cachedPath, finalData, 0644)
	if err != nil {
		fmt.Printf("[Telephoto] Error saving cache file: %v\n", err)
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to save to cache: %v", err)}
	}

	return map[string]interface{}{"success": true, "filePath": cachedPath}
}

// DownloadTelephotoFile downloads, decrypts (if necessary), and saves a file to the user's selected folder
func (a *App) DownloadTelephotoFile(chatIdStr string, messageIdStr string, fileName string, fileSize int64, isEncrypted bool, password string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	// Trigger progress at 0%
	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: fileName, Percent: 0,
	})

	// 1. Get file destination
	destFolder := a.OpenDirectoryDialog()
	if destFolder == "" {
		return map[string]interface{}{"success": false, "error": "cancelled"}
	}

	// If already in cache, just copy it!
	cacheDir := a.GetTelephotoCacheDir()
	cachedName := fmt.Sprintf("dec_%s_%s", messageIdStr, fileName)
	cachedPath := filepath.Join(cacheDir, cachedName)
	savePath := filepath.Join(destFolder, fileName)

	if _, err := os.Stat(cachedPath); err == nil {
		err = copyFile(cachedPath, savePath)
		if err == nil {
			runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
				FileName: fileName, Percent: 100,
			})
			return map[string]interface{}{"success": true, "filePath": savePath}
		}
	}

	// 2. Otherwise download and decrypt
	loc, err := a.getMessageLocation(chatIdStr, messageIdStr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to get location: %v", err)}
	}

	tempPath := filepath.Join(os.TempDir(), fmt.Sprintf("temp_dl_%s", messageIdStr))
	tempFile, err := os.Create(tempPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to create temp: %v", err)}
	}
	defer tempFile.Close()
	defer os.Remove(tempPath)

	d := downloader.NewDownloader()
	pw := &progressWriter{
		w:        tempFile,
		total:    fileSize,
		fileName: fileName,
		onProgress: func(done, total int64) {
			pct := float64(0)
			if total > 0 {
				// Fill up to 90% during download, last 10% is decryption
				pct = float64(done) / float64(total) * 90
			}
			runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
				FileName: fileName, Percent: pct,
			})
		},
	}

	_, err = d.Download(api, loc).Stream(a.ctx, pw)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("download failed: %v", err)}
	}
	_ = tempFile.Close()

	// Read downloaded bytes
	data, err := os.ReadFile(tempPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to read temp file: %v", err)}
	}

	var finalData []byte
	if isEncrypted {
		if password == "" {
			return map[string]interface{}{"success": false, "error": "master password is required"}
		}
		decrypted, err := decryptTelephotoBytes(password, data)
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("decryption failed: %v", err)}
		}
		finalData = decrypted
	} else {
		finalData = data
	}

	// Save to final location
	err = os.WriteFile(savePath, finalData, 0644)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to save file: %v", err)}
	}

	// Also write to cache for future preview
	_ = os.WriteFile(cachedPath, finalData, 0644)

	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: fileName, Percent: 100,
	})

	return map[string]interface{}{"success": true, "filePath": savePath}
}

// helper to copy file
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	return out.Close()
}

// resizeNearestNeighbor scales an image to the given dimensions using nearest-neighbor interpolation.
func resizeNearestNeighbor(src image.Image, newW, newH int) *image.RGBA {
	bounds := src.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcX := bounds.Min.X + x*bounds.Dx()/newW
			srcY := bounds.Min.Y + y*bounds.Dy()/newH
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}
	return dst
}

// generateThumbnailBase64 creates a small 200px max thumbnail from a cached image file.
// Thumbnails are disk-cached as thumb_<msgId>.jpg for instant retrieval on subsequent calls.
func (a *App) generateThumbnailBase64(cachedPath string, fileName string, messageIdStr string) string {
	// Check if small thumbnail is already cached on disk
	cacheDir := a.GetTelephotoCacheDir()
	thumbName := fmt.Sprintf("thumb_%s.jpg", messageIdStr)
	thumbPath := filepath.Join(cacheDir, thumbName)

	if thumbData, err := os.ReadFile(thumbPath); err == nil {
		b64 := base64.StdEncoding.EncodeToString(thumbData)
		return "data:image/jpeg;base64," + b64
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	// Only process formats Go can decode natively
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" {
		return ""
	}

	f, err := os.Open(cachedPath)
	if err != nil {
		return ""
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return ""
	}

	bounds := img.Bounds()
	origW := bounds.Dx()
	origH := bounds.Dy()

	// Calculate thumbnail dimensions (max 200px on longest side)
	maxDim := 200
	newW, newH := origW, origH
	if origW > maxDim || origH > maxDim {
		if origW > origH {
			newW = maxDim
			newH = origH * maxDim / origW
		} else {
			newH = maxDim
			newW = origW * maxDim / origH
		}
	}
	if newW < 1 { newW = 1 }
	if newH < 1 { newH = 1 }

	thumb := resizeNearestNeighbor(img, newW, newH)

	var buf bytes.Buffer
	jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 70})

	// Cache thumbnail on disk for instant retrieval next time
	_ = os.WriteFile(thumbPath, buf.Bytes(), 0644)

	b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	return "data:image/jpeg;base64," + b64
}

// ReadCachedImageBase64 reads a decrypted cached image file and returns its full base64 data URL.
// Used only for lightbox preview (one image at a time).
func (a *App) ReadCachedImageBase64(messageIdStr string, fileName string) string {
	cacheDir := a.GetTelephotoCacheDir()
	cachedName := fmt.Sprintf("dec_%s_%s", messageIdStr, fileName)
	cachedPath := filepath.Join(cacheDir, cachedName)

	data, err := os.ReadFile(cachedPath)
	if err != nil {
		return ""
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	mime := "image/jpeg"
	if ext == ".png" { mime = "image/png" }
	if ext == ".gif" { mime = "image/gif" }
	if ext == ".webp" { mime = "image/webp" }
	if ext == ".heic" || ext == ".heif" { mime = "image/heic" }

	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
}

// GetTelephotoThumbnail returns a small 200px thumbnail for a Telephoto item.
// For encrypted items: generates a resized thumbnail from the cached decrypted file.
// For non-encrypted items: calls the existing GetThumbnail logic.
func (a *App) GetTelephotoThumbnail(chatIdStr string, messageIdStr string, fileName string, isEncrypted bool) string {
	if isEncrypted {
		cacheDir := a.GetTelephotoCacheDir()
		cachedName := fmt.Sprintf("dec_%s_%s", messageIdStr, fileName)
		cachedPath := filepath.Join(cacheDir, cachedName)

		if _, err := os.Stat(cachedPath); err == nil {
			return a.generateThumbnailBase64(cachedPath, fileName, messageIdStr)
		}
		return ""
	}

	return a.GetThumbnail(chatIdStr, messageIdStr)
}
