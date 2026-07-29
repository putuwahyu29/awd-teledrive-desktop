package main

import (
	"archive/zip"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gotd/td/telegram/downloader"
)

func (ws *WebServer) generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)[:12]
}

func (ws *WebServer) handleLogoDrive(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write(logoDrivePngBytes)
}

func (ws *WebServer) handleIcon(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	if len(logoDrivePngBytes) > 0 {
		w.Write(logoDrivePngBytes)
	} else {
		w.Write(iconWebpBytes)
	}
}

func (ws *WebServer) handleShare(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/share/")
	id = strings.Split(id, "/")[0] // Extract first part of ID

	var item *WebShareItem
	ws.Mu.Lock()
	for i := range ws.SharedItems {
		if ws.SharedItems[i].ID == id {
			item = &ws.SharedItems[i]
			item.AccessCount++
			break
		}
	}
	ws.Mu.Unlock()

	if item == nil {
		http.Error(w, "Share link not found or expired", http.StatusNotFound)
		return
	}

	ws.SaveShares()

	// Check password
	if item.Password != "" {
		if r.Method == http.MethodPost {
			_ = r.ParseForm()
			passInput := r.FormValue("p")
			if passInput == item.Password {
				// Set authentication cookie
				http.SetCookie(w, &http.Cookie{
					Name:     "share_auth_" + id,
					Value:    item.Password,
					Path:     "/",
					MaxAge:   86400, // 24 hours
					HttpOnly: true,
				})
				// Redirect to GET to avoid form resubmission
				http.Redirect(w, r, "/share/"+id, http.StatusSeeOther)
				return
			} else {
				ws.servePasswordPage(w, item.Name, id, true)
				return
			}
		}

		// Check cookie
		cookie, err := r.Cookie("share_auth_" + id)
		if err != nil || cookie.Value != item.Password {
			ws.servePasswordPage(w, item.Name, id, false)
			return
		}
	}

	// Check sub-file preview request
	fileID := r.URL.Query().Get("file")
	if fileID != "" && item.Type == "folder" {
		subFiles := ws.App.GetFiles(item.TelegramID)
		var targetSubFile *DriveItem
		for i := range subFiles {
			if subFiles[i].ID == fileID {
				targetSubFile = &subFiles[i]
				break
			}
		}
		if targetSubFile != nil {
			mockItem := &WebShareItem{
				ID:         id + "/" + fileID,
				Name:       targetSubFile.Name,
				Size:       targetSubFile.Size,
				TelegramID: targetSubFile.ID,
				Type:       "file",
			}
			ws.serveFilePage(w, mockItem)
			return
		}
	}

	if item.Type == "folder" {
		ws.serveFolderPage(w, item)
	} else {
		ws.serveFilePage(w, item)
	}
}

func (ws *WebServer) handleDownload(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/download/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, "Invalid parameters", http.StatusBadRequest)
		return
	}
	shareID := parts[0]

	var item *WebShareItem
	ws.Mu.Lock()
	for i := range ws.SharedItems {
		if ws.SharedItems[i].ID == shareID {
			item = &ws.SharedItems[i]
			break
		}
	}
	ws.Mu.Unlock()

	if item == nil {
		http.Error(w, "Link expired", http.StatusNotFound)
		return
	}

	// Check password via cookie
	if item.Password != "" {
		cookie, err := r.Cookie("share_auth_" + shareID)
		if err != nil || cookie.Value != item.Password {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	api := ws.App.getAPI()
	if api == nil {
		http.Error(w, "TeleDrive server disconnected from storage server", http.StatusInternalServerError)
		return
	}

	// Determine file parameters
	var fileID string
	var fileName string
	var fileSize int64
	var parentID string

	if item.Type == "folder" {
		// Inside folder share, downloading subfile
		if len(parts) < 2 {
			http.Error(w, "Subfile not specified", http.StatusBadRequest)
			return
		}
		subfileID := parts[1]
		// Retrieve files inside channel to find match
		subFiles := ws.App.GetFiles(item.TelegramID)
		var matchedSub *DriveItem
		for _, sf := range subFiles {
			if sf.ID == subfileID {
				matchedSub = &sf
				break
			}
		}
		if matchedSub == nil {
			http.Error(w, "Subfile not found", http.StatusNotFound)
			return
		}
		fileID = matchedSub.ID
		fileName = matchedSub.Name
		fileSize = matchedSub.Size
		parentID = item.TelegramID
	} else {
		fileID = item.TelegramID
		fileName = item.Name
		fileSize = item.Size
		parentID = item.ParentID
	}

	loc, err := ws.App.getMessageLocation(parentID, fileID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to locate file message: %v", err), http.StatusInternalServerError)
		return
	}

	// Set HTTP stream headers
	contentType := "application/octet-stream"
	if ext := filepath.Ext(fileName); ext != "" {
		if t := mime.TypeByExtension(ext); t != "" {
			contentType = t
		} else {
			switch strings.ToLower(ext) {
			case ".pdf":
				contentType = "application/pdf"
			case ".png":
				contentType = "image/png"
			case ".jpg", ".jpeg":
				contentType = "image/jpeg"
			case ".gif":
				contentType = "image/gif"
			case ".webp":
				contentType = "image/webp"
			case ".svg":
				contentType = "image/svg+xml"
			case ".mp4":
				contentType = "video/mp4"
			case ".webm":
				contentType = "video/webm"
			case ".ogg":
				contentType = "video/ogg"
			case ".mp3":
				contentType = "audio/mpeg"
			case ".wav":
				contentType = "audio/wav"
			case ".txt":
				contentType = "text/plain"
			}
		}
	}

	disposition := "attachment"
	if r.URL.Query().Get("inline") == "1" {
		disposition = "inline"
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, fileName))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileSize))
	w.Header().Set("Content-Type", contentType)

	d := downloader.NewDownloader()
	_, err = d.Download(api, loc).Stream(ws.App.ctx, w)
	if err != nil {
		fmt.Printf("File streaming error: %v\n", err)
	}
}

func (ws *WebServer) handleBatchDownload(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/download_batch/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, "Invalid parameters", http.StatusBadRequest)
		return
	}
	shareID := parts[0]
	
	filesQuery := r.URL.Query().Get("f")
	if filesQuery == "" {
		http.Error(w, "No files specified", http.StatusBadRequest)
		return
	}
	fileIDs := strings.Split(filesQuery, ",")

	var item *WebShareItem
	ws.Mu.Lock()
	for i := range ws.SharedItems {
		if ws.SharedItems[i].ID == shareID {
			item = &ws.SharedItems[i]
			break
		}
	}
	ws.Mu.Unlock()

	if item == nil || item.Type != "folder" {
		http.Error(w, "Folder share not found", http.StatusNotFound)
		return
	}

	if item.Password != "" {
		cookie, err := r.Cookie("share_auth_" + shareID)
		if err != nil || cookie.Value != item.Password {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	api := ws.App.getAPI()
	if api == nil {
		http.Error(w, "TeleDrive server disconnected from storage server", http.StatusInternalServerError)
		return
	}

	subFiles := ws.App.GetFiles(item.TelegramID)
	
	var filesToZip []*DriveItem
	for _, reqID := range fileIDs {
		for _, sf := range subFiles {
			if sf.ID == reqID {
				copySf := sf
				filesToZip = append(filesToZip, &copySf)
				break
			}
		}
	}

	if len(filesToZip) == 0 {
		http.Error(w, "No matching files found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="Download.zip"`)

	zw := zip.NewWriter(w)
	
	for _, f := range filesToZip {
		loc, err := ws.App.getMessageLocation(item.TelegramID, f.ID)
		if err != nil {
			fmt.Printf("Skipping file %s, error finding location: %v\n", f.Name, err)
			continue
		}
		
		fw, err := zw.Create(f.Name)
		if err != nil {
			fmt.Printf("Failed to create zip entry for %s: %v\n", f.Name, err)
			continue
		}
		
		d := downloader.NewDownloader()
		_, err = d.Download(api, loc).Stream(ws.App.ctx, fw)
		if err != nil {
			fmt.Printf("Failed to stream %s into zip: %v\n", f.Name, err)
		}
	}
	
	if err := zw.Close(); err != nil {
		fmt.Printf("Failed to close zip: %v\n", err)
	}
}

func (ws *WebServer) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		w.WriteHeader(http.StatusNotFound)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title>Awd TeleDrive - Web Share</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/webp" href="/icon.webp">
    <script>
        (function() {
            const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            if (theme === 'dark') document.documentElement.classList.add('dark-theme');
        })();
    </script>
    <style>
        :root {
            --bg: #f8f9fa;
            --surface: #ffffff;
            --border: #e0e0e0;
            --primary: #1a73e8;
            --on-surface: #202124;
            --text-secondary: #5f6368;
            --card-shadow: rgba(0,0,0,0.06);
            --hover: rgba(0,0,0,0.04);
            --sun-display: none;
            --moon-display: block;
        }
        .dark-theme {
            --bg: #0b0f19;
            --surface: rgba(255, 255, 255, 0.05);
            --border: rgba(255, 255, 255, 0.08);
            --primary: #1a73e8;
            --on-surface: #f1f3f4;
            --text-secondary: #9aa0a6;
            --card-shadow: rgba(0,0,0,0.4);
            --hover: rgba(255,255,255,0.08);
            --sun-display: block;
            --moon-display: none;
        }
        body {
            margin: 0; background: var(--bg); color: var(--on-surface);
            font-family: 'Roboto', sans-serif; display: flex; align-items: center;
            justify-content: center; height: 100vh;
        }
        .card {
            background: var(--surface); border: 1px solid var(--border);
            border-radius: 24px; padding: 40px 32px; width: 100%%; max-width: 400px;
            box-shadow: 0 16px 48px var(--card-shadow); text-align: center;
            backdrop-filter: blur(12px); position: relative;
        }
        .brand { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 24px; }
        .brand span { font-size: 18px; font-weight: 700; color: var(--on-surface); }
        h2 { font-size: 20px; font-weight: 500; margin: 0 0 10px 0; }
        p.desc { font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
        .theme-toggle-btn {
            background: transparent; border: none; cursor: pointer; width: 32px; height: 32px; 
            border-radius: 50%%; display: flex; align-items: center; justify-content: center; 
            color: var(--on-surface); transition: background .15s; position: absolute; top: 16px; right: 16px;
        }
        .theme-toggle-btn:hover { background: var(--hover); }
    </style>
</head>
<body>
    <div class="card">
        <button id="toggle-theme-btn" class="theme-toggle-btn" title="Ganti Tema">
            <svg class="sun-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--sun-display);"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--moon-display);"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <div class="brand">
            <img src="/icon.webp" width="32" height="32" style="border-radius: 6px; object-fit: contain; vertical-align: middle;" />
            <span>Awd TeleDrive</span>
        </div>
        <h2 id="page-heading">Awd TeleDrive</h2>
        <p class="desc" id="page-desc">Gunakan tautan spesifik untuk mengakses berkas yang dibagikan.</p>
    </div>
    <script>
        document.getElementById('toggle-theme-btn').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });

        if (window.location.pathname !== "/") {
            document.getElementById('page-heading').textContent = "404 Not Found";
            document.getElementById('page-desc').textContent = "Halaman atau berkas yang Anda cari tidak ditemukan.";
        }
    </script>
</body>
</html>
`)
}

func (ws *WebServer) handleLocalTemp(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	if r.Method == http.MethodOptions {
		return
	}

	fileName := strings.TrimPrefix(r.URL.Path, "/local-temp/")
	fileName = filepath.Base(fileName)
	tmpPath := filepath.Join(os.TempDir(), fileName)
	
	if _, err := os.Stat(tmpPath); err == nil {
		if strings.HasSuffix(strings.ToLower(fileName), ".pdf") {
			w.Header().Set("Content-Type", "application/pdf")
		}
		http.ServeFile(w, r, tmpPath)
		return
	}
	http.Error(w, "File not found", http.StatusNotFound)
}
