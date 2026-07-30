package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/gif"
	_ "image/png"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gotd/td/telegram/downloader"
	"github.com/gotd/td/telegram/uploader"
	"github.com/gotd/td/tg"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/pbkdf2"
)

type SecureFolderItem struct {
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

type SecureFolderGroup struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	HasBackup  bool   `json:"hasBackup"`
	AccessHash int64  `json:"accessHash"`
}

// Backwards compatibility aliases for types
type TelephotoMediaItem = SecureFolderItem
type TelephotoGroup = SecureFolderGroup

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

// deriveSecureFolderKey derives key using PBKDF2 with HMAC-SHA256
func deriveSecureFolderKey(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, 10000, 32, sha256.New)
}

// decryptSecureFolderBytes decrypts AES-256-GCM encrypted bytes from secure folder payload
func decryptSecureFolderBytes(password string, data []byte) ([]byte, error) {
	if len(data) < 16+12 {
		return nil, fmt.Errorf("data too short for encrypted payload (salt + iv)")
	}
	salt := data[:16]
	iv := data[16 : 16+12]
	ciphertext := data[16+12:]

	key := deriveSecureFolderKey(password, salt)
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

// GetSecureFolderCacheDir returns the secure folder cache directory
func (a *App) GetSecureFolderCacheDir() string {
	userDataDir, _ := os.UserConfigDir()
	cacheDir := filepath.Join(userDataDir, "teledrive", "secure_folder_cache")
	_ = os.MkdirAll(cacheDir, 0755)
	return cacheDir
}

func (a *App) GetTelephotoCacheDir() string {
	return a.GetSecureFolderCacheDir()
}

// ClearSecureFolderCache clears all decrypted files in the secure folder cache directory
func (a *App) ClearSecureFolderCache() map[string]interface{} {
	cacheDir := a.GetSecureFolderCacheDir()
	err := os.RemoveAll(cacheDir)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	_ = os.MkdirAll(cacheDir, 0755)
	return map[string]interface{}{"success": true}
}

func (a *App) ClearTelephotoCache() map[string]interface{} {
	return a.ClearSecureFolderCache()
}

// ScanSecureFolderGroups lists all supergroups and detects which contain secure folder backups
func (a *App) ScanSecureFolderGroups() []SecureFolderGroup {
	api := a.getAPI()
	if api == nil {
		return []SecureFolderGroup{}
	}

	groups := []SecureFolderGroup{}
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
				// Only Groups/Supergroups (Megagroup == true, Broadcast == false) owned by user or admin
				if c.Megagroup && !c.Broadcast && (c.Creator || c.AdminRights.EditMessages) {
					id = c.ID
					title = c.Title
					accessHash = c.AccessHash
					isGroup = true
				}
			case *tg.Chat:
				if c.Creator || !c.Deactivated {
					id = c.ID
					title = c.Title
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
					groups = append(groups, SecureFolderGroup{
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

	// 2. Global search for "telephoto_backup" or "backup" to automatically mark groups with backup
	for _, query := range []string{"telephoto_backup", "secure_folder_backup", "backup"} {
		resDoc, err := api.MessagesSearchGlobal(a.ctx, &tg.MessagesSearchGlobalRequest{
			Q:      query,
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

				switch c := chat.(type) {
				case *tg.Channel:
					if c.Megagroup && !c.Broadcast && (c.Creator || c.AdminRights.EditMessages) {
						id = c.ID
						title = c.Title
						accessHash = c.AccessHash
						isChannel = true
					}
				case *tg.Chat:
					if c.Creator || !c.Deactivated {
						id = c.ID
						title = c.Title
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
							if backupGroupIDs[id] {
								groups[i].HasBackup = true
							}
							found = true
							break
						}
					}
					if !found {
						seen[idStr] = true
						groups = append(groups, SecureFolderGroup{
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
	}

	// Final Deduplication by ID and Title
	uniqueGroups := []SecureFolderGroup{}
	seenIDs := make(map[string]bool)
	seenTitles := make(map[string]bool)

	for _, g := range groups {
		if g.ID == "" {
			continue
		}
		cleanTitle := strings.TrimSpace(g.Title)
		titleKey := strings.ToLower(cleanTitle)

		if seenIDs[g.ID] {
			continue
		}
		if cleanTitle != "" && seenTitles[titleKey] {
			for i, existing := range uniqueGroups {
				if strings.EqualFold(strings.TrimSpace(existing.Title), cleanTitle) {
					if g.HasBackup {
						uniqueGroups[i].HasBackup = true
					}
					break
				}
			}
			continue
		}

		seenIDs[g.ID] = true
		if cleanTitle != "" {
			seenTitles[titleKey] = true
		}
		uniqueGroups = append(uniqueGroups, g)
	}

	return uniqueGroups
}

func (a *App) ScanTelephotoGroups() []SecureFolderGroup {
	return a.ScanSecureFolderGroups()
}

// CreateSecureFolderGroup creates a new private supergroup / channel for Secure Folder and initializes an encrypted backup manifest.
func (a *App) CreateSecureFolderGroup(groupName string, password string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected to Telegram"}
	}
	name := strings.TrimSpace(groupName)
	if name == "" {
		return map[string]interface{}{"success": false, "error": "folder name is required"}
	}

	// Create private group (Megagroup == true, Broadcast == false)
	res, err := api.ChannelsCreateChannel(a.ctx, &tg.ChannelsCreateChannelRequest{
		Broadcast: false,
		Megagroup: true,
		Title:     name,
		About:     "Awd TeleDrive - Secure Folder Group",
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("Gagal membuat grup privat di Telegram: %v", err)}
	}

	var newChannelID int64
	var accessHash int64
	var channelTitle string = name

	if updates, ok := res.(*tg.Updates); ok {
		for _, chat := range updates.Chats {
			if c, ok := chat.(*tg.Channel); ok {
				newChannelID = c.ID
				accessHash = c.AccessHash
				if c.Title != "" {
					channelTitle = c.Title
				}
				a.cacheMu.Lock()
				a.channelCache[c.ID] = &tg.InputPeerChannel{
					ChannelID:  c.ID,
					AccessHash: c.AccessHash,
				}
				a.cacheMu.Unlock()
				a.persistChannelCache(c.ID, c.AccessHash, channelTitle)
			}
		}
	}

	if newChannelID == 0 {
		return map[string]interface{}{"success": false, "error": "failed to extract channel ID from Telegram response"}
	}

	idStr := fmt.Sprintf("%d", newChannelID)

	// If password provided, initialize empty encrypted backup manifest enc_secure_folder_backup.json
	if password != "" {
		emptyItems := []SecureFolderItem{}
		jsonBytes, _ := json.Marshal(emptyItems)

		salt := make([]byte, 16)
		cryptorand.Read(salt)
		iv := make([]byte, 12)
		cryptorand.Read(iv)

		key := deriveSecureFolderKey(password, salt)
		block, _ := aes.NewCipher(key)
		aesgcm, _ := cipher.NewGCM(block)
		ciphertext := aesgcm.Seal(nil, iv, jsonBytes, nil)

		var encManifestPayload bytes.Buffer
		encManifestPayload.Write(salt)
		encManifestPayload.Write(iv)
		encManifestPayload.Write(ciphertext)

		peer := a.getInputPeer(idStr)
		u := uploader.NewUploader(api).WithThreads(4)

		manifestUpload, err := u.FromReader(a.ctx, "enc_telephoto_backup.json", bytes.NewReader(encManifestPayload.Bytes()))
		if err == nil {
			var mRandomID int64
			_ = binary.Read(cryptorand.Reader, binary.BigEndian, &mRandomID)
			_, _ = api.MessagesSendMedia(a.ctx, &tg.MessagesSendMediaRequest{
				Peer:     peer,
				RandomID: mRandomID,
				Message:  "enc_telephoto_backup.json",
				Media: &tg.InputMediaUploadedDocument{
					File:     manifestUpload,
					MimeType: "application/json",
					Attributes: []tg.DocumentAttributeClass{
						&tg.DocumentAttributeFilename{FileName: "enc_telephoto_backup.json"},
					},
				},
			})
		}
	}

	return map[string]interface{}{
		"success": true,
		"group": SecureFolderGroup{
			ID:         idStr,
			Title:      channelTitle,
			AccessHash: accessHash,
			HasBackup:  true,
		},
	}
}

func (a *App) CreateTelephotoGroup(groupName string, password string) map[string]interface{} {
	return a.CreateSecureFolderGroup(groupName, password)
}

// RenameSecureFolderGroup renames the specified Telegram group/channel for Secure Folder
func (a *App) RenameSecureFolderGroup(chatIdStr string, newTitle string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected to Telegram"}
	}
	title := strings.TrimSpace(newTitle)
	if title == "" {
		return map[string]interface{}{"success": false, "error": "nama folder tidak boleh kosong"}
	}

	peer := a.getInputPeer(chatIdStr)
	if channel, ok := peer.(*tg.InputPeerChannel); ok {
		_, err := api.ChannelsEditTitle(a.ctx, &tg.ChannelsEditTitleRequest{
			Channel: &tg.InputChannel{
				ChannelID:  channel.ChannelID,
				AccessHash: channel.AccessHash,
			},
			Title: title,
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("gagal mengubah nama folder: %v", err)}
		}
	} else if chat, ok := peer.(*tg.InputPeerChat); ok {
		_, err := api.MessagesEditChatTitle(a.ctx, &tg.MessagesEditChatTitleRequest{
			ChatID: chat.ChatID,
			Title:  title,
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("gagal mengubah nama chat: %v", err)}
		}
	} else {
		return map[string]interface{}{"success": false, "error": "tipe peer tidak valid untuk rename"}
	}

	return map[string]interface{}{"success": true, "title": title}
}

// DeleteSecureFolderGroup deletes the specified Telegram group/channel for Secure Folder
func (a *App) DeleteSecureFolderGroup(chatIdStr string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected to Telegram"}
	}

	peer := a.getInputPeer(chatIdStr)
	if channel, ok := peer.(*tg.InputPeerChannel); ok {
		_, err := api.ChannelsDeleteChannel(a.ctx, &tg.InputChannel{
			ChannelID:  channel.ChannelID,
			AccessHash: channel.AccessHash,
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("gagal menghapus folder: %v", err)}
		}
	} else if chat, ok := peer.(*tg.InputPeerChat); ok {
		_, err := api.MessagesDeleteChatUser(a.ctx, &tg.MessagesDeleteChatUserRequest{
			ChatID: chat.ChatID,
			UserID: &tg.InputUserSelf{},
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("gagal keluar dari folder: %v", err)}
		}
	} else {
		return map[string]interface{}{"success": false, "error": "tipe peer tidak valid untuk delete"}
	}

	return map[string]interface{}{"success": true}
}

// ImportSecureFolderBackup finds, downloads and parses the secure folder backup JSON from the specified group, AND scans history messages to ensure ALL files in the group are returned.
func (a *App) ImportSecureFolderBackup(chatIdStr string, password string) ([]SecureFolderItem, error) {
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

	itemsMap := make(map[int64]SecureFolderItem)

	// 1. Search for backup manifest document if present
	var backupMsg *tg.Message
	var isEncryptedBackup bool

	for _, q := range []string{"telephoto_backup", "secure_folder_backup", "backup.json"} {
		res, err := api.MessagesSearch(a.ctx, &tg.MessagesSearchRequest{
			Peer:   inputPeer,
			Q:      q,
			Filter: &tg.InputMessagesFilterDocument{},
			Limit:  20,
		})
		if err == nil {
			var msgs []tg.MessageClass
			if m, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
				msgs = m.GetMessages()
			}

			for _, m := range msgs {
				if msg, ok := m.(*tg.Message); ok {
					if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
						if doc, ok := media.Document.(*tg.Document); ok {
							for _, attr := range doc.Attributes {
								if filenameAttr, ok := attr.(*tg.DocumentAttributeFilename); ok {
									fname := filenameAttr.FileName
									if strings.Contains(fname, "telephoto_backup.json") || strings.Contains(fname, "secure_folder_backup.json") || strings.HasSuffix(fname, "backup.json") {
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
		}
		if backupMsg != nil {
			break
		}
	}

	if backupMsg != nil {
		loc, err := a.getMessageLocation(chatIdStr, fmt.Sprintf("%d", backupMsg.ID))
		if err == nil {
			d := downloader.NewDownloader()
			var buf bytes.Buffer
			_, err = d.Download(api, loc).Stream(a.ctx, &buf)
			if err == nil {
				jsonBytes := buf.Bytes()
				if isEncryptedBackup && password != "" {
					decrypted, err := decryptSecureFolderBytes(password, jsonBytes)
					if err == nil {
						jsonBytes = decrypted
					}
				}

				var manifestItems []SecureFolderItem
				if json.Unmarshal(jsonBytes, &manifestItems) == nil {
					for idx, item := range manifestItems {
						key := item.TelegramMessageId
						if key == 0 {
							key = item.LocalId
						}
						if key == 0 {
							key = int64(idx + 1000000)
						}
						itemsMap[key] = item
					}
				}
			}
		}
	}

	// 2. Fetch history messages directly from Telegram in small, safe batches (chunk by chunk)
	// to prevent API timeouts or FloodWait while ensuring ALL messages are fetched until the end.
	offsetID := 0
	batchSize := 50
	maxPages := 200 // Up to 10,000 messages (200 x 50)
	retryCount := 0

	for page := 0; page < maxPages; page++ {
		resHist, err := api.MessagesGetHistory(a.ctx, &tg.MessagesGetHistoryRequest{
			Peer:     inputPeer,
			OffsetID: offsetID,
			Limit:    batchSize,
		})
		if err != nil {
			if retryCount < 3 {
				retryCount++
				time.Sleep(300 * time.Millisecond)
				continue
			}
			break
		}
		retryCount = 0

		var msgs []tg.MessageClass
		if slice, ok := resHist.(*tg.MessagesMessagesSlice); ok {
			msgs = slice.Messages
		} else if channelMsgs, ok := resHist.(*tg.MessagesChannelMessages); ok {
			msgs = channelMsgs.Messages
		} else if directMsgs, ok := resHist.(*tg.MessagesMessages); ok {
			msgs = directMsgs.Messages
		} else {
			break
		}

		if len(msgs) == 0 {
			break
		}

		lastMsgID := 0
		for _, m := range msgs {
			msg, ok := m.(*tg.Message)
			if !ok {
				continue
			}
			lastMsgID = msg.ID

			if msg.Media != nil {
				switch media := msg.Media.(type) {
				case *tg.MessageMediaDocument:
					if doc, ok := media.Document.(*tg.Document); ok {
						fileName := "file"
						var isVideo bool
						for _, attr := range doc.Attributes {
							if fn, ok := attr.(*tg.DocumentAttributeFilename); ok {
								fileName = fn.FileName
							}
							if _, ok := attr.(*tg.DocumentAttributeVideo); ok {
								isVideo = true
							}
						}
						if strings.Contains(fileName, "backup.json") || strings.Contains(fileName, "secure_folder") {
							continue
						}

						msgID64 := int64(msg.ID)
						if existing, found := itemsMap[msgID64]; found {
							if existing.Name == "" {
								existing.Name = fileName
							}
							itemsMap[msgID64] = existing
						} else {
							isEncrypted := strings.HasPrefix(strings.ToLower(fileName), "enc_")
							itemsMap[msgID64] = SecureFolderItem{
								LocalId:           msgID64,
								TelegramFileId:    fmt.Sprintf("%d", doc.ID),
								TelegramMessageId: msgID64,
								SyncStatus:        "synced",
								Timestamp:         int64(msg.Date),
								MimeType:          doc.MimeType,
								Size:              doc.Size,
								Name:              fileName,
								IsVideo:           isVideo,
								IsEncrypted:       isEncrypted,
							}
						}
					}
				case *tg.MessageMediaPhoto:
					if photo, ok := media.Photo.(*tg.Photo); ok {
						fileName := fmt.Sprintf("photo_%d.jpg", photo.ID)
						msgID64 := int64(msg.ID)
						if _, found := itemsMap[msgID64]; !found {
							itemsMap[msgID64] = SecureFolderItem{
								LocalId:           msgID64,
								TelegramFileId:    fmt.Sprintf("%d", photo.ID),
								TelegramMessageId: msgID64,
								SyncStatus:        "synced",
								Timestamp:         int64(msg.Date),
								MimeType:          "image/jpeg",
								Size:              0,
								Name:              fileName,
								IsVideo:           false,
								IsEncrypted:       false,
							}
						}
					}
				}
			}
		}

		if lastMsgID <= 1 || len(msgs) < batchSize {
			break
		}
		offsetID = lastMsgID

		// Short courteous delay between chunk requests to avoid Telegram server rate-limits
		time.Sleep(30 * time.Millisecond)
	}

	resultList := make([]SecureFolderItem, 0, len(itemsMap))
	for _, item := range itemsMap {
		resultList = append(resultList, item)
	}

	return resultList, nil
}

func (a *App) ImportTelephotoBackup(chatIdStr string, password string) ([]TelephotoMediaItem, error) {
	return a.ImportSecureFolderBackup(chatIdStr, password)
}

// UploadSecureFolderFile encrypts local file using master password (AES-256-GCM + PBKDF2) and uploads it to Telegram target chat/group, then updates the backup JSON manifest in that group.
func (a *App) UploadSecureFolderFile(chatIdStr string, localFilePath string, password string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected to Telegram"}
	}
	if password == "" {
		return map[string]interface{}{"success": false, "error": "master password is required to encrypt file"}
	}

	plainBytes, err := os.ReadFile(localFilePath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to read local file: %v", err)}
	}

	originalFileName := filepath.Base(localFilePath)
	encFileName := originalFileName
	if !strings.HasPrefix(strings.ToLower(encFileName), "enc_") {
		encFileName = "enc_" + encFileName
	}

	ext := strings.ToLower(filepath.Ext(originalFileName))
	isVideo := (ext == ".mp4" || ext == ".mkv" || ext == ".webm" || ext == ".mov")
	mimeType := "application/octet-stream"
	if isVideo {
		mimeType = "video/mp4"
	} else if ext == ".jpg" || ext == ".jpeg" {
		mimeType = "image/jpeg"
	} else if ext == ".png" {
		mimeType = "image/png"
	} else if ext == ".gif" {
		mimeType = "image/gif"
	} else if ext == ".pdf" {
		mimeType = "application/pdf"
	}

	salt := make([]byte, 16)
	if _, err := cryptorand.Read(salt); err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to generate salt: %v", err)}
	}

	iv := make([]byte, 12)
	if _, err := cryptorand.Read(iv); err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to generate IV: %v", err)}
	}

	key := deriveSecureFolderKey(password, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("cipher error: %v", err)}
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("GCM error: %v", err)}
	}

	ciphertext := aesgcm.Seal(nil, iv, plainBytes, nil)

	// Encrypted Payload: salt (16) + iv (12) + ciphertext
	var encryptedPayload bytes.Buffer
	encryptedPayload.Write(salt)
	encryptedPayload.Write(iv)
	encryptedPayload.Write(ciphertext)

	encryptedBytes := encryptedPayload.Bytes()

	// Upload encrypted file stream to Telegram
	peer := a.getInputPeer(chatIdStr)
	u := uploader.NewUploader(api).WithThreads(4)

	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: encFileName, Percent: 10,
	})

	upload, err := u.FromReader(a.ctx, encFileName, bytes.NewReader(encryptedBytes))
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to upload encrypted file stream: %v", err)}
	}

	var randomID int64
	_ = binary.Read(cryptorand.Reader, binary.BigEndian, &randomID)

	resMedia, err := api.MessagesSendMedia(a.ctx, &tg.MessagesSendMediaRequest{
		Peer:     peer,
		RandomID: randomID,
		Message:  encFileName,
		Media: &tg.InputMediaUploadedDocument{
			File:     upload,
			MimeType: mimeType,
			Attributes: []tg.DocumentAttributeClass{
				&tg.DocumentAttributeFilename{FileName: encFileName},
			},
		},
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to send media to Telegram: %v", err)}
	}

	sentMsgID := extractMessageID(resMedia)
	if sentMsgID <= 0 {
		return map[string]interface{}{"success": false, "error": "failed to extract message ID after upload"}
	}

	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: encFileName, Percent: 80,
	})

	// Fetch existing backup items from group (if any)
	existingItems, _ := a.ImportSecureFolderBackup(chatIdStr, password)
	if existingItems == nil {
		existingItems = []SecureFolderItem{}
	}

	newItem := SecureFolderItem{
		LocalId:           time.Now().UnixNano(),
		TelegramMessageId: int64(sentMsgID),
		Timestamp:         time.Now().Unix(),
		MimeType:          mimeType,
		Size:              int64(len(plainBytes)),
		Name:              encFileName,
		IsVideo:           isVideo,
		IsEncrypted:       true,
	}

	// Filter out duplicate message ID if exists, then append
	updatedItems := []SecureFolderItem{}
	for _, item := range existingItems {
		if item.TelegramMessageId != int64(sentMsgID) {
			updatedItems = append(updatedItems, item)
		}
	}
	updatedItems = append(updatedItems, newItem)

	// Serialize updated manifest
	jsonBytes, err := json.Marshal(updatedItems)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to serialize backup json: %v", err)}
	}

	// Encrypt manifest with master password
	manifestSalt := make([]byte, 16)
	cryptorand.Read(manifestSalt)
	manifestIV := make([]byte, 12)
	cryptorand.Read(manifestIV)

	mKey := deriveSecureFolderKey(password, manifestSalt)
	mBlock, _ := aes.NewCipher(mKey)
	mGCM, _ := cipher.NewGCM(mBlock)
	mCiphertext := mGCM.Seal(nil, manifestIV, jsonBytes, nil)

	var encManifestPayload bytes.Buffer
	encManifestPayload.Write(manifestSalt)
	encManifestPayload.Write(manifestIV)
	encManifestPayload.Write(mCiphertext)

	manifestUpload, err := u.FromReader(a.ctx, "enc_telephoto_backup.json", bytes.NewReader(encManifestPayload.Bytes()))
	if err == nil {
		var mRandomID int64
		_ = binary.Read(cryptorand.Reader, binary.BigEndian, &mRandomID)
		_, _ = api.MessagesSendMedia(a.ctx, &tg.MessagesSendMediaRequest{
			Peer:     peer,
			RandomID: mRandomID,
			Message:  "enc_telephoto_backup.json",
			Media: &tg.InputMediaUploadedDocument{
				File:     manifestUpload,
				MimeType: "application/json",
				Attributes: []tg.DocumentAttributeClass{
					&tg.DocumentAttributeFilename{FileName: "enc_telephoto_backup.json"},
				},
			},
		})
	}

	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: encFileName, Percent: 100,
	})

	return map[string]interface{}{
		"success":   true,
		"messageId": sentMsgID,
		"fileName":  encFileName,
	}
}

func (a *App) UploadMultipleSecureFolderFiles(chatIdStr string, filePaths []string, password string) map[string]interface{} {
	total := len(filePaths)
	successCount := 0
	failCount := 0

	for i, fp := range filePaths {
		fileName := filepath.Base(fp)
		runtime.EventsEmit(a.ctx, "multi:progress", map[string]interface{}{
			"current":  i + 1,
			"total":    total,
			"fileName": fileName,
			"status":   "encrypting & uploading",
		})

		r := a.UploadSecureFolderFile(chatIdStr, fp, password)
		if r["success"] == true {
			successCount++
		} else {
			failCount++
		}
	}

	return map[string]interface{}{
		"success":      true,
		"successCount": successCount,
		"failCount":    failCount,
	}
}

// PreviewSecureFolderFile downloads a SecureFolder file, decrypts it if necessary, and returns its local path
func (a *App) PreviewSecureFolderFile(chatIdStr string, messageIdStr string, fileName string, isEncrypted bool, password string) map[string]interface{} {
	fmt.Printf("[SecureFolder] PreviewSecureFolderFile called. ChatID: %s, MessageID: %s, File: %s, Encrypted: %t\n", chatIdStr, messageIdStr, fileName, isEncrypted)

	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	cacheDir := a.GetSecureFolderCacheDir()
	cachedName := fmt.Sprintf("dec_%s_%s", messageIdStr, fileName)
	cachedPath := filepath.Join(cacheDir, cachedName)

	if _, err := os.Stat(cachedPath); err == nil {
		return map[string]interface{}{"success": true, "filePath": cachedPath}
	}

	loc, err := a.getMessageLocation(chatIdStr, messageIdStr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to get location: %v", err)}
	}

	tempPath := filepath.Join(os.TempDir(), fmt.Sprintf("temp_sf_%s", messageIdStr))
	tempFile, err := os.Create(tempPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to create temp file: %v", err)}
	}
	defer tempFile.Close()
	defer os.Remove(tempPath)

	d := downloader.NewDownloader()
	_, err = d.Download(api, loc).Stream(a.ctx, tempFile)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to download: %v", err)}
	}
	_ = tempFile.Close()

	data, err := os.ReadFile(tempPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to read downloaded file: %v", err)}
	}

	var finalData []byte
	if isEncrypted {
		if password == "" {
			return map[string]interface{}{"success": false, "error": "master password is required to decrypt this file"}
		}
		decrypted, err := decryptSecureFolderBytes(password, data)
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("decryption failed: %v", err)}
		}
		finalData = decrypted
	} else {
		finalData = data
	}

	err = os.WriteFile(cachedPath, finalData, 0644)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to save to cache: %v", err)}
	}

	return map[string]interface{}{"success": true, "filePath": cachedPath}
}

func (a *App) PreviewTelephotoFile(chatIdStr string, messageIdStr string, fileName string, isEncrypted bool, password string) map[string]interface{} {
	return a.PreviewSecureFolderFile(chatIdStr, messageIdStr, fileName, isEncrypted, password)
}

// DownloadSecureFolderFile downloads, decrypts (if necessary), and saves a file to the user's selected folder
func (a *App) DownloadSecureFolderFile(chatIdStr string, messageIdStr string, fileName string, fileSize int64, isEncrypted bool, password string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: fileName, Percent: 0,
	})

	destFolder := a.OpenDirectoryDialog()
	if destFolder == "" {
		return map[string]interface{}{"success": false, "error": "cancelled"}
	}

	cacheDir := a.GetSecureFolderCacheDir()
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

	loc, err := a.getMessageLocation(chatIdStr, messageIdStr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to get location: %v", err)}
	}

	tempPath := filepath.Join(os.TempDir(), fmt.Sprintf("temp_sf_dl_%s", messageIdStr))
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

	data, err := os.ReadFile(tempPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to read temp file: %v", err)}
	}

	var finalData []byte
	if isEncrypted {
		if password == "" {
			return map[string]interface{}{"success": false, "error": "master password is required"}
		}
		decrypted, err := decryptSecureFolderBytes(password, data)
		if err != nil {
			return map[string]interface{}{"success": false, "error": fmt.Sprintf("decryption failed: %v", err)}
		}
		finalData = decrypted
	} else {
		finalData = data
	}

	err = os.WriteFile(savePath, finalData, 0644)
	if err != nil {
		return map[string]interface{}{"success": false, "error": fmt.Sprintf("failed to save file: %v", err)}
	}

	_ = os.WriteFile(cachedPath, finalData, 0644)

	runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
		FileName: fileName, Percent: 100,
	})

	return map[string]interface{}{"success": true, "filePath": savePath}
}

func (a *App) DownloadTelephotoFile(chatIdStr string, messageIdStr string, fileName string, fileSize int64, isEncrypted bool, password string) map[string]interface{} {
	return a.DownloadSecureFolderFile(chatIdStr, messageIdStr, fileName, fileSize, isEncrypted, password)
}

func (a *App) resizeNearestNeighbor(src image.Image, newW, newH int) *image.RGBA {
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

func (a *App) generateThumbnailBase64(cachedPath string, fileName string, messageIdStr string) string {
	cacheDir := a.GetSecureFolderCacheDir()
	thumbName := fmt.Sprintf("thumb_%s.jpg", messageIdStr)
	thumbPath := filepath.Join(cacheDir, thumbName)

	if thumbData, err := os.ReadFile(thumbPath); err == nil {
		b64 := base64.StdEncoding.EncodeToString(thumbData)
		return "data:image/jpeg;base64," + b64
	}

	ext := strings.ToLower(filepath.Ext(fileName))
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

	thumb := a.resizeNearestNeighbor(img, newW, newH)

	var buf bytes.Buffer
	jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 70})

	_ = os.WriteFile(thumbPath, buf.Bytes(), 0644)

	b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	return "data:image/jpeg;base64," + b64
}

func (a *App) ReadCachedImageBase64(messageIdStr string, fileName string) string {
	cacheDir := a.GetSecureFolderCacheDir()
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

func (a *App) GetSecureFolderThumbnail(chatIdStr string, messageIdStr string, fileName string, isEncrypted bool) string {
	if isEncrypted {
		cacheDir := a.GetSecureFolderCacheDir()
		cachedName := fmt.Sprintf("dec_%s_%s", messageIdStr, fileName)
		cachedPath := filepath.Join(cacheDir, cachedName)

		if _, err := os.Stat(cachedPath); err == nil {
			return a.generateThumbnailBase64(cachedPath, fileName, messageIdStr)
		}
		return ""
	}

	return a.GetThumbnail(chatIdStr, messageIdStr)
}

func (a *App) GetTelephotoThumbnail(chatIdStr string, messageIdStr string, fileName string, isEncrypted bool) string {
	return a.GetSecureFolderThumbnail(chatIdStr, messageIdStr, fileName, isEncrypted)
}
