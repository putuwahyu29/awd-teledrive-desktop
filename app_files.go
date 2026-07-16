package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"mime"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gotd/td/telegram/downloader"
	"github.com/gotd/td/telegram/uploader"
	"github.com/gotd/td/tg"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type DriveItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
	ParentID string `json:"parentId"`
	Date     int64  `json:"date"`
}

type ProgressEvent struct {
	FileName  string  `json:"fileName"`
	Percent   float64 `json:"percent"`
	IsPreview bool    `json:"isPreview"`
}

type PageResult struct {
	Items   []DriveItem `json:"items"`
	HasMore bool        `json:"hasMore"`
}

type StorageStats struct {
	Images    int64 `json:"images"`
	Videos    int64 `json:"videos"`
	Audio     int64 `json:"audio"`
	Documents int64 `json:"documents"`
	Archives  int64 `json:"archives"`
	Others    int64 `json:"others"`
	Total     int64 `json:"total"`
}

type progressReader struct {
	r          *os.File
	total      int64
	fileName   string
	onProgress func(done, total int64)
	done       int64
}

func (pr *progressReader) Read(p []byte) (n int, err error) {
	n, err = pr.r.Read(p)
	pr.done += int64(n)
	if pr.onProgress != nil {
		pr.onProgress(pr.done, pr.total)
	}
	return
}

type progressWriter struct {
	w          io.Writer
	total      int64
	fileName   string
	onProgress func(done, total int64)
	done       int64
}

func (pw *progressWriter) Write(p []byte) (n int, err error) {
	n, err = pw.w.Write(p)
	pw.done += int64(n)
	if pw.onProgress != nil {
		pw.onProgress(pw.done, pw.total)
	}
	return n, err
}

func (a *App) getInputPeer(chatIdStr string) tg.InputPeerClass {
	if chatIdStr == "" || chatIdStr == "/" || chatIdStr == "0" {
		return &tg.InputPeerSelf{}
	}
	id, _ := strconv.ParseInt(chatIdStr, 10, 64)
	a.cacheMu.RLock()
	defer a.cacheMu.RUnlock()
	if channel, ok := a.channelCache[id]; ok {
		return channel
	}
	return &tg.InputPeerEmpty{}
}

func (a *App) getFolderSize(channelID string) int64 {
	subFiles := a.GetFiles(channelID)
	var size int64 = 0
	for _, sf := range subFiles {
		if sf.Type != "folder" {
			size += sf.Size
		}
	}
	return size
}

func (a *App) GetFiles(chatIdStr string) []DriveItem {
	api := a.getAPI()
	if api == nil {
		return []DriveItem{}
	}

	items := []DriveItem{}
	
	if chatIdStr == "" || chatIdStr == "/" || chatIdStr == "0" {
		dialogs, err := api.MessagesGetDialogs(a.ctx, &tg.MessagesGetDialogsRequest{
			OffsetPeer: &tg.InputPeerEmpty{},
			Limit:      100,
		})
		if err == nil {
			var channels []*tg.Channel
			a.cacheMu.Lock()
			if d, ok := dialogs.(interface{ GetChats() []tg.ChatClass }); ok {
				for _, chat := range d.GetChats() {
					if c, ok := chat.(*tg.Channel); ok {
						if !c.Megagroup && (c.Creator || c.AdminRights.EditMessages || c.AdminRights.DeleteMessages) {
							channels = append(channels, c)
							if c.AccessHash != 0 {
								a.channelCache[c.ID] = &tg.InputPeerChannel{
									ChannelID:  c.ID,
									AccessHash: c.AccessHash,
								}
								a.persistChannelCache(c.ID, c.AccessHash, c.Title)
							}
						}
					}
				}
			}
			a.cacheMu.Unlock()

			for _, c := range channels {
				items = append(items, DriveItem{
					ID:       fmt.Sprintf("%d", c.ID),
					Name:     c.Title,
					Type:     "folder",
					Size:     a.getFolderSize(fmt.Sprintf("%d", c.ID)),
					MimeType: "folder",
					Date:     int64(c.Date),
				})
			}
		}
	}

	peer := a.getInputPeer(chatIdStr)
	res, err := api.MessagesGetHistory(a.ctx, &tg.MessagesGetHistoryRequest{
		Peer:  peer,
		Limit: 100,
	})
	if err == nil {
		if msgs, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
			for _, m := range msgs.GetMessages() {
				if msg, ok := m.(*tg.Message); ok {
					_ = msg.PeerID
					if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
						if doc, ok := media.Document.(*tg.Document); ok {
							name := "document"
							for _, attr := range doc.Attributes {
								if filenameAttr, ok := attr.(*tg.DocumentAttributeFilename); ok {
									name = filenameAttr.FileName
								}
							}
							ext := "file"
							parts := strings.Split(name, ".")
							if len(parts) > 1 {
								ext = parts[len(parts)-1]
							}
							items = append(items, DriveItem{
								ID:       fmt.Sprintf("%d", msg.ID),
								Name:     name,
								Type:     ext,
								Size:     doc.Size,
								MimeType: doc.MimeType,
								ParentID: chatIdStr,
								Date:     int64(msg.Date),
							})
						}
					} else if mediaPhoto, ok := msg.Media.(*tg.MessageMediaPhoto); ok {
						if photo, ok := mediaPhoto.Photo.(*tg.Photo); ok {
							items = append(items, DriveItem{
								ID:       fmt.Sprintf("%d", msg.ID),
								Name:     fmt.Sprintf("Photo_%d.jpg", msg.ID),
								Type:     "jpg",
								Size:     0,
								MimeType: "image/jpeg",
								ParentID: chatIdStr,
								Date:     int64(msg.Date),
							})
							_ = photo
						}
					}
				}
			}
		}
	}

	return items
}

func (a *App) GetFilesPage(chatIdStr string, offsetId int) PageResult {
	api := a.getAPI()
	if api == nil {
		return PageResult{Items: []DriveItem{}, HasMore: false}
	}

	limit := 50
	items := []DriveItem{}

	if (chatIdStr == "" || chatIdStr == "/" || chatIdStr == "0") && offsetId == 0 {
		dialogs, err := api.MessagesGetDialogs(a.ctx, &tg.MessagesGetDialogsRequest{
			OffsetPeer: &tg.InputPeerEmpty{},
			Limit:      100,
		})
		if err == nil {
			var channels []*tg.Channel
			a.cacheMu.Lock()
			if d, ok := dialogs.(interface{ GetChats() []tg.ChatClass }); ok {
				for _, chat := range d.GetChats() {
					if c, ok := chat.(*tg.Channel); ok {
						if !c.Megagroup && (c.Creator || c.AdminRights.EditMessages || c.AdminRights.DeleteMessages) {
							channels = append(channels, c)
							if c.AccessHash != 0 {
								a.channelCache[c.ID] = &tg.InputPeerChannel{
									ChannelID:  c.ID,
									AccessHash: c.AccessHash,
								}
							}
						}
					}
				}
			}
			a.cacheMu.Unlock()

			for _, c := range channels {
				items = append(items, DriveItem{
					ID:       fmt.Sprintf("%d", c.ID),
					Name:     c.Title,
					Type:     "folder",
					Size:     a.getFolderSize(fmt.Sprintf("%d", c.ID)),
					MimeType: "folder",
				})
			}
		}
	}

	peer := a.getInputPeer(chatIdStr)
	res, err := api.MessagesGetHistory(a.ctx, &tg.MessagesGetHistoryRequest{
		Peer:     peer,
		Limit:    limit,
		OffsetID: offsetId,
	})
	
	fileCount := 0
	if err == nil {
		if msgs, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
			for _, m := range msgs.GetMessages() {
				if msg, ok := m.(*tg.Message); ok {
					_ = msg.PeerID
					if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
						if doc, ok := media.Document.(*tg.Document); ok {
							name := "document"
							for _, attr := range doc.Attributes {
								if filenameAttr, ok := attr.(*tg.DocumentAttributeFilename); ok {
									name = filenameAttr.FileName
								}
							}
							ext := "file"
							parts := strings.Split(name, ".")
							if len(parts) > 1 {
								ext = parts[len(parts)-1]
							}
							items = append(items, DriveItem{
								ID:       fmt.Sprintf("%d", msg.ID),
								Name:     name,
								Type:     ext,
								Size:     doc.Size,
								MimeType: doc.MimeType,
								ParentID: chatIdStr,
								Date:     int64(msg.Date),
							})
							fileCount++
						}
					} else if mediaPhoto, ok := msg.Media.(*tg.MessageMediaPhoto); ok {
						if photo, ok := mediaPhoto.Photo.(*tg.Photo); ok {
							items = append(items, DriveItem{
								ID:       fmt.Sprintf("%d", msg.ID),
								Name:     fmt.Sprintf("Photo_%d.jpg", msg.ID),
								Type:     "jpg",
								Size:     0,
								MimeType: "image/jpeg",
								ParentID: chatIdStr,
								Date:     int64(msg.Date),
							})
							_ = photo
							fileCount++
						}
					}
				}
			}
		}
	}

	return PageResult{
		Items:   items,
		HasMore: fileCount >= limit,
	}
}

func (a *App) GetFolders() []DriveItem {
	api := a.getAPI()
	if api == nil {
		return []DriveItem{}
	}

	items := []DriveItem{
		{
			ID:       "0",
			Name:     "Root (Saved Messages)",
			Type:     "folder",
			Size:     0,
			MimeType: "folder",
		},
	}

	dialogs, err := api.MessagesGetDialogs(a.ctx, &tg.MessagesGetDialogsRequest{
		OffsetPeer: &tg.InputPeerEmpty{},
		Limit:      100,
	})
	if err == nil {
		a.cacheMu.Lock()
		if d, ok := dialogs.(interface{ GetChats() []tg.ChatClass }); ok {
			for _, chat := range d.GetChats() {
				if c, ok := chat.(*tg.Channel); ok {
					if !c.Megagroup && (c.Creator || c.AdminRights.EditMessages || c.AdminRights.DeleteMessages) {
						items = append(items, DriveItem{
							ID:       fmt.Sprintf("%d", c.ID),
							Name:     c.Title,
							Type:     "folder",
							Size:     0,
							MimeType: "folder",
						})
					}
				}
			}
		}
		a.cacheMu.Unlock()
	}

	seen := make(map[string]bool)
	for _, item := range items {
		seen[item.ID] = true
	}
	cfg := a.loadConfig()
	for idStr, cc := range cfg.ChannelCache {
		if !seen[idStr] {
			items = append(items, DriveItem{
				ID:       idStr,
				Name:     cc.Title,
				Type:     "folder",
				Size:     0,
				MimeType: "folder",
			})
		}
	}

	return items
}

func (a *App) CreateFolder(currentPath string, folderName string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}
	
	res, err := api.ChannelsCreateChannel(a.ctx, &tg.ChannelsCreateChannelRequest{
		Broadcast: true,
		Megagroup: false,
		Title:     folderName,
		About:     "TeleDrive Folder",
	})
	
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	
	if updates, ok := res.(*tg.Updates); ok {
		for _, chat := range updates.Chats {
			if c, ok := chat.(*tg.Channel); ok {
				a.cacheMu.Lock()
				a.channelCache[c.ID] = &tg.InputPeerChannel{
					ChannelID:  c.ID,
					AccessHash: c.AccessHash,
				}
				a.cacheMu.Unlock()
				a.persistChannelCache(c.ID, c.AccessHash, folderName)
			}
		}
	}

	return map[string]interface{}{"success": true}
}

func (a *App) DeleteFile(currentPath string, fileID string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	id, _ := strconv.ParseInt(fileID, 10, 64)
	
	a.cacheMu.RLock()
	channel, isFolder := a.channelCache[id]
	a.cacheMu.RUnlock()
	
	if isFolder {
		_, err := api.ChannelsDeleteChannel(a.ctx, &tg.InputChannel{
			ChannelID:  channel.ChannelID,
			AccessHash: channel.AccessHash,
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
		a.cacheMu.Lock()
		delete(a.channelCache, id)
		a.cacheMu.Unlock()
		return map[string]interface{}{"success": true}
	}
	
	peer := a.getInputPeer(currentPath)
	_, err := api.MessagesDeleteMessages(a.ctx, &tg.MessagesDeleteMessagesRequest{
		Revoke: true,
		ID:     []int{int(id)},
	})
	if err != nil {
		if channelPeer, ok := peer.(*tg.InputPeerChannel); ok {
			_, err = api.ChannelsDeleteMessages(a.ctx, &tg.ChannelsDeleteMessagesRequest{
				Channel: &tg.InputChannel{
					ChannelID:  channelPeer.ChannelID,
					AccessHash: channelPeer.AccessHash,
				},
				ID:      []int{int(id)},
			})
			if err != nil {
				return map[string]interface{}{"success": false, "error": err.Error()}
			}
		} else {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
	}

	return map[string]interface{}{"success": true}
}

func (a *App) GetTotalSize() int64 {
	var totalSize int64 = 0
	folders := a.GetFiles("")
	for _, f := range folders {
		if f.Type != "folder" {
			totalSize += f.Size
		} else {
			subFiles := a.GetFiles(f.ID)
			for _, sf := range subFiles {
				if sf.Type != "folder" {
					totalSize += sf.Size
				}
			}
		}
	}
	return totalSize
}

func (a *App) GetStorageStats() StorageStats {
	var stats StorageStats
	folders := a.GetFiles("")
	
	processFile := func(name string, size int64) {
		ext := strings.ToLower(filepath.Ext(name))
		if ext == "" {
			stats.Others += size
			return
		}
		ext = ext[1:]
		
		switch ext {
		case "jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "heic", "heif", "svg":
			stats.Images += size
		case "mp4", "webm", "ogg", "mov", "mkv", "avi", "flv":
			stats.Videos += size
		case "mp3", "wav", "flac", "aac", "m4a", "wma":
			stats.Audio += size
		case "pdf", "txt", "log", "json", "md", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx":
			stats.Documents += size
		case "zip", "rar", "7z", "tar", "gz":
			stats.Archives += size
		default:
			stats.Others += size
		}
	}

	for _, f := range folders {
		if f.Type != "folder" {
			processFile(f.Name, f.Size)
		} else {
			subFiles := a.GetFiles(f.ID)
			for _, sf := range subFiles {
				if sf.Type != "folder" {
					processFile(sf.Name, sf.Size)
				}
			}
		}
	}

	teleGroups := a.ScanTelephotoGroups()
	for _, tgGroup := range teleGroups {
		if tgGroup.HasBackup {
			tgFiles := a.GetFiles(tgGroup.ID)
			for _, tgFile := range tgFiles {
				if tgFile.Type != "folder" {
					processFile(tgFile.Name, tgFile.Size)
				}
			}
		}
	}
	
	stats.Total = stats.Images + stats.Videos + stats.Audio + stats.Documents + stats.Archives + stats.Others
	return stats
}

func (a *App) GetFolderInviteLink(chatIdStr string) (string, error) {
	api := a.getAPI()
	if api == nil {
		return "", fmt.Errorf("api not initialized")
	}

	peer := a.getInputPeer(chatIdStr)
	res, err := api.MessagesExportChatInvite(a.ctx, &tg.MessagesExportChatInviteRequest{
		Peer: peer,
	})
	if err != nil {
		return "", err
	}

	switch invite := res.(type) {
	case *tg.ChatInviteExported:
		return invite.Link, nil
	default:
		return "", fmt.Errorf("unexpected invite link result type")
	}
}

func (a *App) OpenFileDialog() string {
	path, _ := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select File to Upload",
	})
	return path
}

func (a *App) OpenMultiFileDialog() []string {
	paths, _ := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Files to Upload",
	})
	return paths
}

func (a *App) UploadMultipleFiles(filePaths []string, currentPath string) map[string]interface{} {
	total := len(filePaths)
	successCount := 0
	failCount := 0

	for i, fp := range filePaths {
		fileName := filepath.Base(fp)
		runtime.EventsEmit(a.ctx, "multi:progress", map[string]interface{}{
			"current":  i + 1,
			"total":    total,
			"fileName": fileName,
			"status":   "uploading",
		})

		r := a.UploadFile(fp, currentPath)
		if r["success"] == true {
			successCount++
		} else {
			failCount++
		}

		runtime.EventsEmit(a.ctx, "multi:progress", map[string]interface{}{
			"current":  i + 1,
			"total":    total,
			"fileName": fileName,
			"status":   func() string { if r["success"] == true { return "done" }; return "failed" }(),
		})
	}

	return map[string]interface{}{
		"success":      true,
		"successCount": successCount,
		"failCount":    failCount,
	}
}

func (a *App) UploadFile(filePath string, currentPath string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	fileName := filepath.Base(filePath)
	f, err := os.Open(filePath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	defer f.Close()

	info, _ := f.Stat()
	fileSize := info.Size()

	u := uploader.NewUploader(api).WithThreads(4)
	pr := &progressReader{
		r:        f,
		total:    fileSize,
		fileName: fileName,
		onProgress: func(done, total int64) {
			pct := float64(0)
			if total > 0 {
				pct = float64(done) / float64(total) * 100
			}
			runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
				FileName: fileName, Percent: pct,
			})
		},
	}

	upload, err := u.FromReader(a.ctx, fileName, pr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	peer := a.getInputPeer(currentPath)

	_, err = api.MessagesSendMedia(a.ctx, &tg.MessagesSendMediaRequest{
		Peer: peer,
		RandomID: rand.Int63(),
		Media: &tg.InputMediaUploadedDocument{
			File:     upload,
			MimeType: getMimeType(fileName),
			Attributes: []tg.DocumentAttributeClass{
				&tg.DocumentAttributeFilename{FileName: fileName},
			},
		},
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	return map[string]interface{}{"success": true}
}

func (a *App) getMessageLocation(chatIdStr string, messageIdStr string) (tg.InputFileLocationClass, error) {
	api := a.getAPI()
	if api == nil {
		return nil, fmt.Errorf("not connected")
	}

	id, _ := strconv.ParseInt(messageIdStr, 10, 64)
	peer := a.getInputPeer(chatIdStr)
	
	var msgs []tg.MessageClass
	if channel, ok := peer.(*tg.InputPeerChannel); ok {
		res, err := api.ChannelsGetMessages(a.ctx, &tg.ChannelsGetMessagesRequest{
			Channel: &tg.InputChannel{
				ChannelID:  channel.ChannelID,
				AccessHash: channel.AccessHash,
			},
			ID:      []tg.InputMessageClass{&tg.InputMessageID{ID: int(id)}},
		})
		if err != nil {
			return nil, err
		}
		if m, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
			msgs = m.GetMessages()
		}
	} else {
		res, err := api.MessagesGetMessages(a.ctx, []tg.InputMessageClass{&tg.InputMessageID{ID: int(id)}})
		if err != nil {
			return nil, err
		}
		if m, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
			msgs = m.GetMessages()
		}
	}

	if len(msgs) == 0 {
		return nil, fmt.Errorf("message not found")
	}

	msg, ok := msgs[0].(*tg.Message)
	if !ok {
		return nil, fmt.Errorf("invalid message type")
	}

	if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
		if doc, ok := media.Document.(*tg.Document); ok {
			return &tg.InputDocumentFileLocation{
				ID:            doc.ID,
				AccessHash:    doc.AccessHash,
				FileReference: doc.FileReference,
			}, nil
		}
	}

	if media, ok := msg.Media.(*tg.MessageMediaPhoto); ok {
		if photo, ok := media.Photo.(*tg.Photo); ok {
			thumbSize := "x"
			for _, size := range photo.Sizes {
				if s, ok := size.(*tg.PhotoSize); ok {
					if s.Type == "y" {
						thumbSize = "y"
					}
				}
			}
			return &tg.InputPhotoFileLocation{
				ID:            photo.ID,
				AccessHash:    photo.AccessHash,
				FileReference: photo.FileReference,
				ThumbSize:     thumbSize,
			}, nil
		}
	}

	return nil, fmt.Errorf("no document or photo found in message")
}

func (a *App) DownloadFile(currentPath string, fileID string, fileName string, fileSize int64) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	loc, err := a.getMessageLocation(currentPath, fileID)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	d := downloader.NewDownloader()
	savePath, _ := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: fileName,
		Title:           "Save File As",
	})
	if savePath == "" {
		return map[string]interface{}{"success": false, "error": "cancelled"}
	}

	f, err := os.Create(savePath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	defer f.Close()

	pw := &progressWriter{
		w: f,
		total: fileSize,
		fileName: fileName,
		onProgress: func(done, total int64) {
			pct := float64(0)
			if total > 0 {
				pct = float64(done) / float64(total) * 100
			}
			runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
				FileName: fileName, Percent: pct,
			})
		},
	}
	_, err = d.Download(api, loc).Stream(a.ctx, pw)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	return map[string]interface{}{"success": true}
}

func (a *App) DownloadFolder(folderChatId string, folderName string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	savePath, _ := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: folderName + ".zip",
		Title:           "Save Folder As ZIP",
		Filters:         []runtime.FileFilter{{DisplayName: "ZIP Archive", Pattern: "*.zip"}},
	})
	if savePath == "" {
		return map[string]interface{}{"success": false, "error": "cancelled"}
	}

	f, err := os.Create(savePath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	defer zw.Close()

	peer := a.getInputPeer(folderChatId)
	var allMsgs []tg.Message
	offsetId := 0

	for {
		res, err := api.MessagesGetHistory(a.ctx, &tg.MessagesGetHistoryRequest{
			Peer:     peer,
			Limit:    100,
			OffsetID: offsetId,
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}

		msgs, ok := res.(interface{ GetMessages() []tg.MessageClass })
		if !ok || len(msgs.GetMessages()) == 0 {
			break
		}

		messages := msgs.GetMessages()
		count := 0
		for _, m := range messages {
			if msg, ok := m.(*tg.Message); ok {
				if _, okMedia := msg.Media.(*tg.MessageMediaDocument); okMedia {
					allMsgs = append(allMsgs, *msg)
					offsetId = msg.ID
					count++
				} else if _, okMedia := msg.Media.(*tg.MessageMediaPhoto); okMedia {
					allMsgs = append(allMsgs, *msg)
					offsetId = msg.ID
					count++
				}
			}
		}
		if count == 0 {
			break
		}
	}

	d := downloader.NewDownloader()
	totalFiles := len(allMsgs)
	for i, msg := range allMsgs {
		loc, _ := a.getMessageLocation(folderChatId, fmt.Sprintf("%d", msg.ID))
		if loc == nil {
			continue
		}

		name := fmt.Sprintf("file_%d", msg.ID)
		if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
			if doc, ok := media.Document.(*tg.Document); ok {
				for _, attr := range doc.Attributes {
					if filenameAttr, ok := attr.(*tg.DocumentAttributeFilename); ok {
						name = filenameAttr.FileName
					}
				}
			}
		} else if _, ok := msg.Media.(*tg.MessageMediaPhoto); ok {
			name = fmt.Sprintf("Photo_%d.jpg", msg.ID)
		}

		ze, err := zw.Create(name)
		if err != nil {
			continue
		}

		pw := &progressWriter{
			w:        ze,
			total:    0,
			fileName: fmt.Sprintf("[%d/%d] %s", i+1, totalFiles, name),
			onProgress: func(done, total int64) {
				pct := float64(done)
				if total > 0 {
					pct = float64(done) / float64(total) * 100
				}
				runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
					FileName: fmt.Sprintf("Zipping %d/%d: %s", i+1, totalFiles, name),
					Percent:  pct,
				})
			},
		}

		d.Download(api, loc).Stream(a.ctx, pw)
	}

	return map[string]interface{}{"success": true}
}

func (a *App) PreviewFile(currentPath string, fileID string, fileName string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	loc, err := a.getMessageLocation(currentPath, fileID)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}

	tmpPath := filepath.Join(os.TempDir(), fileName)
	outFile, err := os.Create(tmpPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	defer outFile.Close()

	d := downloader.NewDownloader()
	_, err = d.Download(api, loc).Stream(a.ctx, outFile)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	outFile.Close()

	info, err := os.Stat(tmpPath)
	if err == nil {
		ext := strings.ToLower(filepath.Ext(fileName))
		isImage := ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp" || ext == ".heic" || ext == ".heif"
		if isImage && info.Size() < 10*1024*1024 {
			data, err := os.ReadFile(tmpPath)
			if err == nil {
				b64 := base64.StdEncoding.EncodeToString(data)
				mime := "image/jpeg"
				if ext == ".png" { mime = "image/png" }
				if ext == ".gif" { mime = "image/gif" }
				if ext == ".webp" { mime = "image/webp" }
				if ext == ".heic" || ext == ".heif" { mime = "image/heic" }
				return map[string]interface{}{
					"success":  true,
					"filePath": tmpPath,
					"base64":   "data:" + mime + ";base64," + b64,
				}
			}
		}
	}

	return map[string]interface{}{"success": true, "filePath": tmpPath}
}

func (a *App) getInputChannel(chatIdStr string) tg.InputChannelClass {
	id, _ := strconv.ParseInt(chatIdStr, 10, 64)
	a.cacheMu.RLock()
	defer a.cacheMu.RUnlock()
	if channel, ok := a.channelCache[id]; ok {
		return &tg.InputChannel{
			ChannelID:  channel.ChannelID,
			AccessHash: channel.AccessHash,
		}
	}
	return &tg.InputChannelEmpty{}
}

func (a *App) SearchFiles(query string) []DriveItem {
	api := a.getAPI()
	if api == nil || query == "" {
		return []DriveItem{}
	}
	items := []DriveItem{}
	queryLower := strings.ToLower(query)
	dialogs, dErr := api.MessagesGetDialogs(a.ctx, &tg.MessagesGetDialogsRequest{
		OffsetPeer: &tg.InputPeerEmpty{},
		Limit:      100,
	})
	if dErr == nil {
		if d, ok := dialogs.(interface{ GetChats() []tg.ChatClass }); ok {
			for _, chat := range d.GetChats() {
				if c, ok := chat.(*tg.Channel); ok {
					if !c.Megagroup && (c.Creator || c.AdminRights.EditMessages || c.AdminRights.DeleteMessages) {
						if strings.Contains(strings.ToLower(c.Title), queryLower) {
							items = append(items, DriveItem{
								ID:       fmt.Sprintf("%d", c.ID),
								Name:     c.Title,
								Type:     "folder",
								Size:     0,
								MimeType: "folder",
								Date:     int64(c.Date),
							})
						}
					}
				}
			}
		}
	}

	resEmpty, _ := api.MessagesSearchGlobal(a.ctx, &tg.MessagesSearchGlobalRequest{
		Q: query, Limit: 50, Filter: &tg.InputMessagesFilterEmpty{},
	})
	
	resDoc, _ := api.MessagesSearchGlobal(a.ctx, &tg.MessagesSearchGlobalRequest{
		Q: query, Limit: 50, Filter: &tg.InputMessagesFilterDocument{},
	})

	seen := make(map[string]bool)
	
	processResult := func(res tg.MessagesMessagesClass) {
		if res == nil { return }
		if msgs, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
			for _, m := range msgs.GetMessages() {
				if msg, ok := m.(*tg.Message); ok {
					peerID := ""
					if peer, ok := msg.PeerID.(*tg.PeerChannel); ok {
						peerID = fmt.Sprintf("%d", peer.ChannelID)
					} else if peer, ok := msg.PeerID.(*tg.PeerUser); ok {
						peerID = fmt.Sprintf("%d", peer.UserID)
					}
					if media, ok := msg.Media.(*tg.MessageMediaDocument); ok {
						if doc, ok := media.Document.(*tg.Document); ok {
							name := "document"
							for _, attr := range doc.Attributes {
								if filenameAttr, ok := attr.(*tg.DocumentAttributeFilename); ok {
									name = filenameAttr.FileName
								}
							}
							ext := "file"
							parts := strings.Split(name, ".")
							if len(parts) > 1 {
								ext = parts[len(parts)-1]
							}
							
							idStr := fmt.Sprintf("%d", msg.ID)
							if !seen[idStr] {
								seen[idStr] = true
								items = append(items, DriveItem{
									ID:       idStr,
									Name:     name,
									Type:     ext,
									Size:     doc.Size,
									MimeType: doc.MimeType,
									ParentID: peerID,
									Date:     int64(msg.Date),
								})
							}
						}
					} else if _, ok := msg.Media.(*tg.MessageMediaPhoto); ok {
						idStr := fmt.Sprintf("%d", msg.ID)
						if !seen[idStr] {
							seen[idStr] = true
							items = append(items, DriveItem{
								ID:       idStr,
								Name:     fmt.Sprintf("Photo_%s.jpg", idStr),
								Type:     "jpg",
								Size:     0,
								MimeType: "image/jpeg",
								ParentID: peerID,
								Date:     int64(msg.Date),
							})
						}
					}
				}
			}
		}
	}

	processResult(resEmpty)
	processResult(resDoc)

	return items
}

func (a *App) GetThumbnail(chatIdStr string, messageIdStr string) string {
	fmt.Printf("GetThumbnail called for %s / %s\n", chatIdStr, messageIdStr)
	api := a.getAPI()
	if api == nil {
		return ""
	}
	msgId, err := strconv.Atoi(messageIdStr)
	if err != nil {
		return ""
	}

	var message *tg.Message
	
	if chatIdStr != "" && chatIdStr != "0" && chatIdStr != "/" {
		channel := a.getInputChannel(chatIdStr)
		res, err := api.ChannelsGetMessages(a.ctx, &tg.ChannelsGetMessagesRequest{
			Channel: channel,
			ID: []tg.InputMessageClass{&tg.InputMessageID{ID: msgId}},
		})
		if err == nil {
			if msgs, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
				for _, m := range msgs.GetMessages() {
					if msg, ok := m.(*tg.Message); ok {
						message = msg
						break
					}
				}
			}
		}
	} else {
		res, err := api.MessagesGetMessages(a.ctx, []tg.InputMessageClass{&tg.InputMessageID{ID: msgId}})
		if err == nil {
			if msgs, ok := res.(interface{ GetMessages() []tg.MessageClass }); ok {
				for _, m := range msgs.GetMessages() {
					if msg, ok := m.(*tg.Message); ok {
						message = msg
						break
					}
				}
			}
		}
	}

	if message == nil {
		return ""
	}

	var loc tg.InputFileLocationClass
	if media, ok := message.Media.(*tg.MessageMediaDocument); ok {
		if doc, ok := media.Document.(*tg.Document); ok {
			hasThumb := false
			thumbSize := "m"
			fmt.Printf("GetThumbnail: doc.Thumbs has %d items\n", len(doc.Thumbs))
			for _, thumb := range doc.Thumbs {
				fmt.Printf("GetThumbnail: thumb type: %T\n", thumb)
				if _, ok := thumb.AsNotEmpty(); ok {
					hasThumb = true
					if thumb.GetType() != "" {
						thumbSize = thumb.GetType()
					}
					fmt.Printf("GetThumbnail: found thumb with type %s\n", thumbSize)
					if thumbSize == "m" {
						break
					}
				}
			}
			if hasThumb {
				fmt.Printf("GetThumbnail: selecting thumbSize %s\n", thumbSize)
				loc = &tg.InputDocumentFileLocation{
					ID:            doc.ID,
					AccessHash:    doc.AccessHash,
					FileReference: doc.FileReference,
					ThumbSize:     thumbSize,
				}
			} else {
			    if doc.Size < 10000000 && !strings.HasPrefix(doc.MimeType, "video/") {
			        loc = &tg.InputDocumentFileLocation{
					    ID:            doc.ID,
					    AccessHash:    doc.AccessHash,
					    FileReference: doc.FileReference,
					    ThumbSize:     "",
				    }
			    }
			}
		}
	} else if media, ok := message.Media.(*tg.MessageMediaPhoto); ok {
		if photo, ok := media.Photo.(*tg.Photo); ok {
			hasThumb := false
			thumbSize := "m"
			for _, thumb := range photo.Sizes {
				if _, ok := thumb.AsNotEmpty(); ok {
					hasThumb = true
					if thumb.GetType() != "" {
						thumbSize = thumb.GetType()
					}
					if thumbSize == "m" {
						break
					}
				}
			}
			if hasThumb {
				loc = &tg.InputPhotoFileLocation{
					ID:            photo.ID,
					AccessHash:    photo.AccessHash,
					FileReference: photo.FileReference,
					ThumbSize:     thumbSize,
				}
			} else {
			    loc = &tg.InputPhotoFileLocation{
					ID:            photo.ID,
					AccessHash:    photo.AccessHash,
					FileReference: photo.FileReference,
					ThumbSize:     "",
				}
			}
		}
	}

	if loc == nil {
		return ""
	}

	d := downloader.NewDownloader()
	buf := new(bytes.Buffer)
	fmt.Println("Downloading full thumbnail/image...")
	_, err = d.Download(api, loc).Stream(a.ctx, buf)
	if err != nil {
		return ""
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

type Favorites struct {
	Items map[string]DriveItem `json:"items"`
}

func (a *App) getFavoritesPath() string {
	userDataDir, _ := os.UserConfigDir()
	return filepath.Join(userDataDir, "teledrive", "favorites.json")
}

func (a *App) GetStarredFiles() []DriveItem {
	path := a.getFavoritesPath()
	b, err := os.ReadFile(path)
	if err != nil {
		return []DriveItem{}
	}
	var fav Favorites
	if err := json.Unmarshal(b, &fav); err != nil {
		return []DriveItem{}
	}
	items := []DriveItem{}
	for _, item := range fav.Items {
		items = append(items, item)
	}
	return items
}

func (a *App) ToggleStar(item DriveItem) bool {
	path := a.getFavoritesPath()
	var fav Favorites
	b, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(b, &fav)
	}
	if fav.Items == nil {
		fav.Items = make(map[string]DriveItem)
	}
	
	isStarred := false
	if _, exists := fav.Items[item.ID]; exists {
		delete(fav.Items, item.ID)
	} else {
		fav.Items[item.ID] = item
		isStarred = true
	}
	
	b, _ = json.Marshal(fav)
	os.WriteFile(path, b, 0644)
	return isStarred
}

func (a *App) MoveFile(fileIdStr string, sourceChatId string, destChatId string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}
	
	msgId, err := strconv.Atoi(fileIdStr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "invalid file ID"}
	}

	fromPeer := a.getInputPeer(sourceChatId)
	toPeer := a.getInputPeer(destChatId)
	
	randomId := int64(time.Now().UnixNano())
	_, err = api.MessagesForwardMessages(a.ctx, &tg.MessagesForwardMessagesRequest{
		FromPeer: fromPeer,
		ToPeer:   toPeer,
		ID:       []int{msgId},
		RandomID: []int64{randomId},
	})
	
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	
	if sourceChatId == "" || sourceChatId == "0" {
		api.MessagesDeleteMessages(a.ctx, &tg.MessagesDeleteMessagesRequest{
			ID: []int{msgId},
			Revoke: true,
		})
	} else {
		channel := a.getInputChannel(sourceChatId)
		api.ChannelsDeleteMessages(a.ctx, &tg.ChannelsDeleteMessagesRequest{
			Channel: channel,
			ID: []int{msgId},
		})
	}
	
	return map[string]interface{}{"success": true}
}

func (a *App) MoveFolder(folderChatId string, destChatId string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}
	
	peer := a.getInputPeer(folderChatId)
	
	var allIds []int
	offsetId := 0
	for {
		res, err := api.MessagesGetHistory(a.ctx, &tg.MessagesGetHistoryRequest{
			Peer:     peer,
			Limit:    100,
			OffsetID: offsetId,
		})
		if err != nil {
			return map[string]interface{}{"success": false, "error": err.Error()}
		}
		
		msgs, ok := res.(interface{ GetMessages() []tg.MessageClass })
		if !ok || len(msgs.GetMessages()) == 0 {
			break
		}
		
		messages := msgs.GetMessages()
		count := 0
		for _, m := range messages {
			if msg, ok := m.(*tg.Message); ok {
				if _, okMedia := msg.Media.(*tg.MessageMediaDocument); okMedia {
					allIds = append(allIds, msg.ID)
					offsetId = msg.ID
					count++
				} else if _, okMedia := msg.Media.(*tg.MessageMediaPhoto); okMedia {
					allIds = append(allIds, msg.ID)
					offsetId = msg.ID
					count++
				}
			}
		}
		if count == 0 {
			break
		}
	}
	
	if len(allIds) > 0 {
		fromPeer := a.getInputPeer(folderChatId)
		toPeer := a.getInputPeer(destChatId)
		
		chunkSize := 100
		for i := 0; i < len(allIds); i += chunkSize {
			end := i + chunkSize
			if end > len(allIds) {
				end = len(allIds)
			}
			chunk := allIds[i:end]
			randomIds := make([]int64, len(chunk))
			for j := range randomIds {
				randomIds[j] = int64(time.Now().UnixNano()) + int64(j)
			}
			
			_, err := api.MessagesForwardMessages(a.ctx, &tg.MessagesForwardMessagesRequest{
				FromPeer: fromPeer,
				ToPeer:   toPeer,
				ID:       chunk,
				RandomID: randomIds,
			})
			if err != nil {
				return map[string]interface{}{"success": false, "error": err.Error()}
			}
			time.Sleep(200 * time.Millisecond)
		}
	}
	
	return a.DeleteFile("", folderChatId)
}

func (a *App) ClearCache() map[string]interface{} {
	userDataDir, _ := os.UserConfigDir()
	cacheDir := filepath.Join(userDataDir, "teledrive", "cache")
	var deletedCount int
	if entries, err := os.ReadDir(cacheDir); err == nil {
		for _, e := range entries {
			if err2 := os.Remove(filepath.Join(cacheDir, e.Name())); err2 == nil {
				deletedCount++
			}
		}
	}
	telephotoCacheDir := filepath.Join(userDataDir, "teledrive", "telephoto_cache")
	if entries, err := os.ReadDir(telephotoCacheDir); err == nil {
		for _, e := range entries {
			if err2 := os.Remove(filepath.Join(telephotoCacheDir, e.Name())); err2 == nil {
				deletedCount++
			}
		}
	}
	a.cacheMu.Lock()
	a.channelCache = make(map[int64]*tg.InputPeerChannel)
	a.cacheMu.Unlock()

	msg := fmt.Sprintf("Cache dihapus (%d file cache/thumbnail)", deletedCount)
	if deletedCount == 0 {
		msg = "Cache sudah bersih"
	}
	return map[string]interface{}{"success": true, "message": msg}
}

func (a *App) GetShareLink(chatIdStr string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	channel := a.getInputChannel(chatIdStr)
	if _, ok := channel.(*tg.InputChannelEmpty); ok {
		return map[string]interface{}{"success": false, "error": "channel not found"}
	}

	fullChat, err := api.ChannelsGetFullChannel(a.ctx, channel)
	if err == nil {
		if full, ok := fullChat.FullChat.(*tg.ChannelFull); ok {
			if invite, ok := full.ExportedInvite.(*tg.ChatInviteExported); ok && invite.Link != "" {
				return map[string]interface{}{"success": true, "link": invite.Link}
			}
		}
	}

	res, err := api.MessagesExportChatInvite(a.ctx, &tg.MessagesExportChatInviteRequest{
		Peer: a.getInputPeer(chatIdStr),
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	if invite, ok := res.(*tg.ChatInviteExported); ok {
		return map[string]interface{}{"success": true, "link": invite.Link}
	}
	return map[string]interface{}{"success": false, "error": "unexpected response"}
}

func (a *App) downloadFileDirect(currentPath string, fileID string, fileName string, fileSize int64, destFolder string) error {
	api := a.getAPI()
	if api == nil {
		return fmt.Errorf("not connected")
	}

	loc, err := a.getMessageLocation(currentPath, fileID)
	if err != nil {
		return err
	}

	d := downloader.NewDownloader()
	savePath := filepath.Join(destFolder, fileName)
	f, err := os.Create(savePath)
	if err != nil {
		return err
	}
	defer f.Close()

	pw := &progressWriter{
		w: f,
		total: fileSize,
		fileName: fileName,
		onProgress: func(done, total int64) {
			pct := float64(0)
			if total > 0 {
				pct = float64(done) / float64(total) * 100
			}
			runtime.EventsEmit(a.ctx, "transfer:progress", ProgressEvent{
				FileName: fileName, Percent: pct,
			})
		},
	}
	_, err = d.Download(api, loc).Stream(a.ctx, pw)
	return err
}

type RecentItem struct {
	File   DriveItem `json:"file"`
	Action string    `json:"action"`
	Time   int64     `json:"time"`
}

type RecentData struct {
	Items []RecentItem `json:"items"`
}

func (a *App) getRecentPath() string {
	userDataDir, _ := os.UserConfigDir()
	return filepath.Join(userDataDir, "teledrive", "recent.json")
}

func (a *App) AddRecentFile(file DriveItem, action string) {
	path := a.getRecentPath()
	var data RecentData
	if b, err := os.ReadFile(path); err == nil {
		json.Unmarshal(b, &data)
	}
	data.Items = append([]RecentItem{{
		File:   file,
		Action: action,
		Time:   time.Now().Unix(),
	}}, data.Items...)
	if len(data.Items) > 50 {
		data.Items = data.Items[:50]
	}
	if b, err := json.Marshal(data); err == nil {
		os.WriteFile(path, b, 0644)
	}
}

func (a *App) GetRecentFiles() []RecentItem {
	path := a.getRecentPath()
	var data RecentData
	if b, err := os.ReadFile(path); err == nil {
		json.Unmarshal(b, &data)
	}
	if data.Items == nil {
		return []RecentItem{}
	}
	return data.Items
}

func (a *App) ClearRecentFiles() map[string]interface{} {
	path := a.getRecentPath()
	os.Remove(path)
	return map[string]interface{}{"success": true}
}

func (a *App) ShowNotification(title string, message string) {
	runtime.EventsEmit(a.ctx, "notification", map[string]interface{}{
		"title":   title,
		"message": message,
	})
}

func (a *App) GetMediaFiles() []DriveItem {
	fmt.Println("GetMediaFiles started")
	folders := a.GetFiles("")
	fmt.Println("Root items found:", len(folders))
	items := []DriveItem{}
	
	isMedia := func(ext string) bool {
		ext = strings.ToLower(ext)
		for _, e := range []string{"jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "ogg", "mov", "heic", "heif"} {
			if ext == e {
				return true
			}
		}
		return false
	}

	for _, f := range folders {
		if f.Type != "folder" && isMedia(f.Type) {
			items = append(items, f)
		}
	}

	for _, f := range folders {
		if f.Type == "folder" {
			subFiles := a.GetFiles(f.ID)
			fmt.Printf("Folder %s has %d items\n", f.Name, len(subFiles))
			for _, sf := range subFiles {
				if sf.Type != "folder" && isMedia(sf.Type) {
					items = append(items, sf)
				}
			}
		}
	}

	// De-duplicate items by ID, and also by Name + Size to prevent display duplication
	seenID := make(map[string]bool)
	seenNameSize := make(map[string]bool)
	unique := []DriveItem{}
	for _, item := range items {
		if item.ID == "" {
			continue
		}
		nameSizeKey := fmt.Sprintf("%s_%d", item.Name, item.Size)
		if !seenID[item.ID] && !seenNameSize[nameSizeKey] {
			seenID[item.ID] = true
			seenNameSize[nameSizeKey] = true
			unique = append(unique, item)
		}
	}

	fmt.Println("Total unique media found:", len(unique))
	return unique
}

func (a *App) RenameFolder(chatIdStr string, newName string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}
	if newName == "" {
		return map[string]interface{}{"success": false, "error": "name cannot be empty"}
	}

	channel := a.getInputChannel(chatIdStr)
	if _, ok := channel.(*tg.InputChannelEmpty); ok {
		return map[string]interface{}{"success": false, "error": "channel not found"}
	}

	_, err := api.ChannelsEditTitle(a.ctx, &tg.ChannelsEditTitleRequest{
		Channel: channel,
		Title:   newName,
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}
	}
	return map[string]interface{}{"success": true}
}

func (a *App) RenameFile(chatIdStr string, fileIdStr string, newName string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}
	if newName == "" {
		return map[string]interface{}{"success": false, "error": "name cannot be empty"}
	}

	loc, err := a.getMessageLocation(chatIdStr, fileIdStr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "file not found: " + err.Error()}
	}

	runtime.EventsEmit(a.ctx, "rename:progress", map[string]interface{}{
		"fileName": newName,
		"status":   "downloading",
		"percent":  float64(0),
	})

	tmpPath := filepath.Join(os.TempDir(), "teledrive_rename_"+fmt.Sprintf("%d", time.Now().UnixNano()))
	tmpFile, err := os.Create(tmpPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "temp file error: " + err.Error()}
	}
	defer os.Remove(tmpPath)

	d := downloader.NewDownloader()
	_, err = d.Download(api, loc).Stream(a.ctx, tmpFile)
	tmpFile.Close()
	if err != nil {
		return map[string]interface{}{"success": false, "error": "download failed: " + err.Error()}
	}

	runtime.EventsEmit(a.ctx, "rename:progress", map[string]interface{}{
		"fileName": newName,
		"status":   "uploading",
		"percent":  float64(50),
	})

	f, err := os.Open(tmpPath)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "reopen failed: " + err.Error()}
	}
	defer f.Close()

	info, _ := f.Stat()
	fileSize := info.Size()

	u := uploader.NewUploader(api).WithThreads(4)
	pr := &progressReader{
		r:        f,
		total:    fileSize,
		fileName: newName,
		onProgress: func(done, total int64) {
			pct := float64(50)
			if total > 0 {
				pct = 50 + float64(done)/float64(total)*50
			}
			runtime.EventsEmit(a.ctx, "rename:progress", map[string]interface{}{
				"fileName": newName,
				"status":   "uploading",
				"percent":  pct,
			})
		},
	}

	upload, err := u.FromReader(a.ctx, newName, pr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "upload failed: " + err.Error()}
	}

	peer := a.getInputPeer(chatIdStr)
	_, err = api.MessagesSendMedia(a.ctx, &tg.MessagesSendMediaRequest{
		Peer:     peer,
		RandomID: rand.Int63(),
		Media: &tg.InputMediaUploadedDocument{
			File:     upload,
			MimeType: getMimeType(newName),
			Attributes: []tg.DocumentAttributeClass{
				&tg.DocumentAttributeFilename{FileName: newName},
			},
		},
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": "send failed: " + err.Error()}
	}

	msgId, _ := strconv.Atoi(fileIdStr)
	if channelPeer, ok := peer.(*tg.InputPeerChannel); ok {
		api.ChannelsDeleteMessages(a.ctx, &tg.ChannelsDeleteMessagesRequest{
			Channel: &tg.InputChannel{
				ChannelID:  channelPeer.ChannelID,
				AccessHash: channelPeer.AccessHash,
			},
			ID: []int{msgId},
		})
	} else {
		api.MessagesDeleteMessages(a.ctx, &tg.MessagesDeleteMessagesRequest{
			ID:     []int{msgId},
			Revoke: true,
		})
	}

	runtime.EventsEmit(a.ctx, "rename:progress", map[string]interface{}{
		"fileName": newName,
		"status":   "done",
		"percent":  float64(100),
	})

	return map[string]interface{}{"success": true}
}

func (a *App) GetWebShares() []WebShareItem {
	if a.webServer == nil {
		return []WebShareItem{}
	}
	a.webServer.LoadShares()
	return a.webServer.SharedItems
}

func (a *App) CreateWebShare(name string, itemType string, telegramId string, parentId string, size int64, mimeType string, password string) (WebShareItem, error) {
	if a.webServer == nil {
		return WebShareItem{}, fmt.Errorf("web server not initialized")
	}

	ws := a.webServer
	ws.Mu.Lock()
	for _, item := range ws.SharedItems {
		if item.TelegramID == telegramId && item.Type == itemType {
			ws.Mu.Unlock()
			return item, nil
		}
	}
	ws.Mu.Unlock()

	newItem := WebShareItem{
		ID:          ws.generateID(),
		Name:        name,
		Type:        itemType,
		TelegramID:  telegramId,
		ParentID:    parentId,
		Size:        size,
		MimeType:    mimeType,
		Date:        time.Now().Unix(),
		Password:    password,
		AccessCount: 0,
	}

	ws.Mu.Lock()
	ws.SharedItems = append(ws.SharedItems, newItem)
	ws.Mu.Unlock()

	ws.SaveShares()
	return newItem, nil
}

func (a *App) DeleteWebShare(id string) bool {
	if a.webServer == nil {
		return false
	}
	ws := a.webServer
	ws.Mu.Lock()
	found := false
	newItems := []WebShareItem{}
	for _, item := range ws.SharedItems {
		if item.ID == id {
			found = true
		} else {
			newItems = append(newItems, item)
		}
	}
	if found {
		ws.SharedItems = newItems
	}
	ws.Mu.Unlock()

	if found {
		ws.SaveShares()
	}
	return found
}

func (a *App) GetLocalIPAddress() string {
	if a.webServer == nil {
		return "127.0.0.1"
	}
	return a.webServer.GetLocalIP()
}

func (a *App) TogglePublicTunnel(enable bool) (string, error) {
	if a.webServer == nil {
		return "", fmt.Errorf("web server not active")
	}
	if enable {
		return a.webServer.StartTunnel()
	}
	a.webServer.StopTunnel()
	return "", nil
}

func (a *App) GetTunnelPublicUrl() string {
	if a.webServer == nil {
		return ""
	}
	a.webServer.Mu.Lock()
	defer a.webServer.Mu.Unlock()
	return a.webServer.PublicUrl
}

func (a *App) IsTunnelRunning() bool {
	if a.webServer == nil {
		return false
	}
	a.webServer.Mu.Lock()
	defer a.webServer.Mu.Unlock()
	return a.webServer.Tunneling
}

func (a *App) GetWebServerPort() int {
	if a.webServer == nil {
		return 0
	}
	return a.webServer.Port
}

func (a *App) GetChannelParticipants(chatIdStr string) []map[string]interface{} {
	var result []map[string]interface{}

	api := a.getAPI()
	if api == nil {
		return result
	}

	peer := a.getInputPeer(chatIdStr)
	channelPeer, ok := peer.(*tg.InputPeerChannel)
	if !ok {
		return result
	}

	inputChannel := &tg.InputChannel{
		ChannelID:  channelPeer.ChannelID,
		AccessHash: channelPeer.AccessHash,
	}

	res, err := api.ChannelsGetParticipants(a.ctx, &tg.ChannelsGetParticipantsRequest{
		Channel: inputChannel,
		Filter:  &tg.ChannelParticipantsRecent{},
		Offset:  0,
		Limit:   100,
	})

	if err == nil {
		switch participantsRes := res.(type) {
		case *tg.ChannelsChannelParticipants:
			for _, uClass := range participantsRes.Users {
				if u, ok := uClass.(*tg.User); ok {
					name := u.FirstName
					if u.LastName != "" {
						name += " " + u.LastName
					}
					result = append(result, map[string]interface{}{
						"id":       fmt.Sprintf("%d", u.ID),
						"name":     name,
						"username": u.Username,
						"isSelf":   u.Self,
					})
				}
			}
		}
	}

	hasSelf := false
	for _, item := range result {
		if val, ok := item["isSelf"].(bool); ok && val {
			hasSelf = true
			break
		}
	}

	if !hasSelf {
		result = append([]map[string]interface{}{{
			"id":       "self",
			"name":     "Anda",
			"username": "me",
			"isSelf":   true,
		}}, result...)
	}

	return result
}

func (a *App) SendFileDirectly(currentPath string, fileIdStr string, phone string) map[string]interface{} {
	api := a.getAPI()
	if api == nil {
		return map[string]interface{}{"success": false, "error": "not connected"}
	}

	msgId, err := strconv.Atoi(fileIdStr)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "invalid file ID"}
	}

	cleanPhone := strings.TrimSpace(phone)
	if !strings.HasPrefix(cleanPhone, "+") {
		cleanPhone = "+" + cleanPhone
	}

	res, err := api.ContactsResolvePhone(a.ctx, cleanPhone)
	if err != nil {
		return map[string]interface{}{"success": false, "error": "gagal menemukan pengguna: " + err.Error()}
	}

	var toPeer tg.InputPeerClass
	switch resolvedPeer := res.Peer.(type) {
	case *tg.PeerUser:
		var targetUser *tg.User
		for _, uClass := range res.Users {
			if u, ok := uClass.(*tg.User); ok && u.ID == resolvedPeer.UserID {
				targetUser = u
				break
			}
		}
		if targetUser == nil {
			return map[string]interface{}{"success": false, "error": "detail pengguna tidak ditemukan"}
		}
		toPeer = &tg.InputPeerUser{
			UserID:     targetUser.ID,
			AccessHash: targetUser.AccessHash,
		}
	default:
		return map[string]interface{}{"success": false, "error": "peer bukan merupakan pengguna"}
	}

	fromPeer := a.getInputPeer(currentPath)
	randomId := int64(time.Now().UnixNano())
	_, err = api.MessagesForwardMessages(a.ctx, &tg.MessagesForwardMessagesRequest{
		FromPeer: fromPeer,
		ToPeer:   toPeer,
		ID:       []int{msgId},
		RandomID: []int64{randomId},
	})
	if err != nil {
		return map[string]interface{}{"success": false, "error": "gagal mengirim file: " + err.Error()}
	}

	return map[string]interface{}{"success": true}
}

func getMimeType(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".mkv", ".mov", ".avi":
		return "video/x-matroska"
	case ".mp3", ".wav", ".ogg", ".m4a":
		return "audio/mpeg"
	case ".json":
		return "application/json"
	case ".txt", ".log", ".md":
		return "text/plain"
	case ".zip":
		return "application/zip"
	case ".rar":
		return "application/x-rar-compressed"
	case ".7z":
		return "application/x-7z-compressed"
	case ".doc", ".docx":
		return "application/msword"
	case ".xls", ".xlsx":
		return "application/vnd.ms-excel"
	case ".ppt", ".pptx":
		return "application/vnd.ms-powerpoint"
	case ".apk":
		return "application/vnd.android.package-archive"
	default:
		t := mime.TypeByExtension(ext)
		if t != "" {
			return t
		}
		return "application/octet-stream"
	}
}
