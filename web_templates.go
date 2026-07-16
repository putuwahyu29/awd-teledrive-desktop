package main

import (
	"fmt"
	"html"
	"net/http"
	"path/filepath"
	"strings"
)

func getFileIconSVG(ext string) (string, string) {
	ext = strings.ToLower(ext)
	switch ext {
	case "jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "heic", "heif", "svg":
		return "#ea4335", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
	case "mp4", "webm", "ogg", "mov", "mkv", "avi", "flv":
		return "#ea4335", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
	case "mp3", "wav", "flac", "aac", "m4a", "wma":
		return "#1a73e8", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`
	case "pdf":
		return "#ea4335", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
	case "zip", "rar", "tar", "gz", "7z":
		return "#fabc05", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`
	case "doc", "docx", "txt", "rtf":
		return "#1a73e8", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
	case "xls", "xlsx", "csv":
		return "#34a853", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
	}
	return "#5f6368", `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`
}

func (ws *WebServer) servePasswordPage(w http.ResponseWriter, name string, id string, hasError bool) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	errorHTML := ""
	if hasError {
		errorHTML = `<p id="error-msg" style="color: #ff6b6b; font-weight: 500; font-size: 13px; margin-top: -12px; margin-bottom: 16px;">Sandi salah! Silakan coba lagi.</p>`
	}

	fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title id="page-title">Sandi Proteksi - Awd TeleDrive</title>
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
            --input-bg: #f1f3f4;
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
            --input-bg: rgba(0,0,0,0.2);
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
        p.desc { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px 0; word-break: break-all; }
        input {
            width: 100%%; padding: 14px 20px; border-radius: 100px; border: 1.5px solid var(--border);
            background: var(--input-bg); color: var(--on-surface); font-size: 15px; outline: none;
            box-sizing: border-box; text-align: center; margin-bottom: 20px;
            transition: border-color .2s;
        }
        input:focus { border-color: var(--primary); }
        .submit-btn {
            width: 100%%; padding: 14px; border-radius: 100px; border: none;
            background: var(--primary); color: #fff; font-size: 15px; font-weight: 600;
            cursor: pointer; transition: filter .2s;
        }
        .submit-btn:hover { filter: brightness(1.1); }
        .theme-toggle-btn {
            background: transparent; border: none; cursor: pointer; width: 32px; height: 32px; 
            border-radius: 50%%; display: flex; align-items: center; justify-content: center; 
            color: var(--on-surface); transition: background .15s;
        }
        .theme-toggle-btn:hover { background: var(--hover); }
        .top-right-actions {
            position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; align-items: center;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="top-right-actions">
            <button id="toggle-lang-btn" class="theme-toggle-btn" title="Ganti Bahasa" style="font-size: 13px; font-weight: 600; width: auto; padding: 0 10px; border-radius: 16px;">
                ID
            </button>
            <button id="toggle-theme-btn" class="theme-toggle-btn" title="Ganti Tema">
                <svg class="sun-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--sun-display);"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <svg class="moon-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--moon-display);"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
        </div>
        <div class="brand">
            <img src="/icon.webp" width="32" height="32" style="border-radius: 6px; object-fit: contain; vertical-align: middle;" />
            <span>Awd TeleDrive</span>
        </div>
        <h2 id="form-title">Tautan Terproteksi</h2>
        <p class="desc" id="form-desc">Masukkan kata sandi untuk mengakses:<br><b style="color: var(--on-surface);">%s</b></p>
        %s
        <form method="POST" action="/share/%s">
            <div style="position: relative; margin-bottom: 20px;">
                <input type="password" id="password-input" name="p" placeholder="Masukkan kata sandi" required autofocus style="margin-bottom: 0;">
                <button type="button" id="toggle-password-btn" style="position: absolute; right: 16px; top: 50%%; transform: translateY(-50%%); background: transparent; border: none; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;">
                    <svg id="eye-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg id="eye-off-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                </button>
            </div>
            <button type="submit" id="submit-btn" class="submit-btn">Akses File</button>
        </form>
    </div>

    <script>
        document.getElementById('toggle-theme-btn').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
        
        // Password visibility toggle
        const passwordInput = document.getElementById('password-input');
        const togglePasswordBtn = document.getElementById('toggle-password-btn');
        const eyeIcon = document.getElementById('eye-icon');
        const eyeOffIcon = document.getElementById('eye-off-icon');
        
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            if (type === 'text') {
                eyeIcon.style.display = 'none';
                eyeOffIcon.style.display = 'block';
            } else {
                eyeIcon.style.display = 'block';
                eyeOffIcon.style.display = 'none';
            }
        });

        // Translations
        const translations = {
            id: {
                title: "Sandi Proteksi - Awd TeleDrive",
                formTitle: "Tautan Terproteksi",
                formDesc: "Masukkan kata sandi untuk mengakses:<br><b style='color: var(--on-surface);'>%%s</b>",
                placeholder: "Masukkan kata sandi",
                submit: "Akses File",
                errorMsg: "Sandi salah! Silakan coba lagi.",
                langBtn: "ID"
            },
            en: {
                title: "Password Protection - Awd TeleDrive",
                formTitle: "Protected Link",
                formDesc: "Enter password to access:<br><b style='color: var(--on-surface);'>%%s</b>",
                placeholder: "Enter password",
                submit: "Access File",
                errorMsg: "Incorrect password! Please try again.",
                langBtn: "EN"
            }
        };

        const itemName = "%s"; // Used to inject name back into formDesc

        function applyLanguage(lang) {
            const t = translations[lang] || translations.id;
            document.getElementById('page-title').textContent = t.title;
            document.getElementById('form-title').textContent = t.formTitle;
            document.getElementById('form-desc').innerHTML = t.formDesc.replace('%%s', itemName);
            document.getElementById('password-input').placeholder = t.placeholder;
            document.getElementById('submit-btn').textContent = t.submit;
            document.getElementById('toggle-lang-btn').textContent = t.langBtn;
            
            const errorMsg = document.getElementById('error-msg');
            if (errorMsg) errorMsg.textContent = t.errorMsg;
        }

        let currentLang = localStorage.getItem('lang') || 'id';
        applyLanguage(currentLang);

        document.getElementById('toggle-lang-btn').addEventListener('click', () => {
            currentLang = currentLang === 'id' ? 'en' : 'id';
            localStorage.setItem('lang', currentLang);
            applyLanguage(currentLang);
        });
    </script>
</body>
</html>
`, name, errorHTML, id, name)
}

func (ws *WebServer) serveFilePage(w http.ResponseWriter, item *WebShareItem) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	ext := strings.ToLower(filepath.Ext(item.Name))
	if len(ext) > 0 {
		ext = ext[1:]
	}

	isImage := false
	isVideo := false
	isAudio := false
	isPdf := ext == "pdf"

	switch ext {
	case "jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "heic", "heif", "svg":
		isImage = true
	case "mp4", "webm", "ogg", "mov", "mkv", "avi", "flv":
		isVideo = true
	case "mp3", "wav", "flac", "aac", "m4a", "wma":
		isAudio = true
	}

	sizeStr := fmt.Sprintf("%.2f MB", float64(item.Size)/(1024*1024))
	if item.Size >= 1024*1024*1024 {
		sizeStr = fmt.Sprintf("%.2f GB", float64(item.Size)/(1024*1024*1024))
	}

	previewHTML := ""
	if isImage {
		previewHTML = fmt.Sprintf(`<img src="/download/%s?inline=1" style="max-width: 100%%; max-height: 85vh; object-fit: contain; border-radius: 6px; box-shadow: 0 12px 48px rgba(0,0,0,0.7);" />`, item.ID)
	} else if isVideo {
		previewHTML = fmt.Sprintf(`<video src="/download/%s?inline=1" controls autoPlay style="max-width: 100%%; max-height: 85vh; border-radius: 8px; box-shadow: 0 12px 48px rgba(0,0,0,0.7); outline: none;"></video>`, item.ID)
	} else if isAudio {
		previewHTML = fmt.Sprintf(`
        <div style="background: var(--surface-preview); padding: 40px 32px; border-radius: 24px; border: 1px solid var(--border-preview); text-align: center; width: 100%%; max-width: 420px; box-shadow: 0 24px 64px var(--shadow-preview); display: flex; flex-direction: column; align-items: center; gap: 24px; backdrop-filter: blur(20px); position: relative; margin: auto;">
            <!-- Hidden Audio -->
            <audio id="web-audio" src="/download/%s?inline=1" autoPlay></audio>
            
            <!-- Vinyl cover -->
            <div id="vinyl-disc" style="width: 130px; height: 130px; border-radius: 50%%; background: linear-gradient(135deg, rgba(66,133,244,0.2) 0%%, rgba(66,133,244,0.05) 100%%); border: 3px solid rgba(66, 133, 244, 0.3); display: flex; align-items: center; justify-content: center; position: relative; transition: transform 0.5s ease; box-shadow: 0 8px 32px rgba(66,133,244,0.15);">
                <div style="width: 30px; height: 30px; border-radius: 50%%; background: var(--bg-preview); border: 2px solid var(--border-preview); position: absolute; z-index: 2;"></div>
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="var(--primary-preview)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8; position: relative; z-index: 1;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>

            <!-- Title & Size -->
            <div style="width: 100%%;">
                <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--on-surface-preview); width: 100%%;" title="%s">%s</h3>
                <p style="font-size: 12px; color: var(--text-secondary-preview); margin: 0;">Berkas Audio • %s</p>
            </div>

            <!-- Seekbar -->
            <div style="width: 100%%; display: flex; flex-direction: column; gap: 4px;">
                <input type="range" id="audio-seek" min="0" max="100" value="0" style="width: 100%%; height: 4px; border-radius: 2px; outline: none; background: rgba(255,255,255,0.12); cursor: pointer; -webkit-appearance: none; margin: 0;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary-preview);">
                    <span id="current-time">0:00</span>
                    <span id="total-time">0:00</span>
                </div>
            </div>

            <!-- Controls Panel -->
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%%; gap: 16px;">
                <!-- Volume icon-btn -->
                <button id="volume-btn" style="background: transparent; border: none; color: var(--on-surface-preview); cursor: pointer; padding: 8px; display: flex; align-items: center;">
                    <svg id="volume-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
                
                <input type="range" id="volume-seek" min="0" max="1" step="0.01" value="1" style="width: 70px; height: 3px; border-radius: 1.5px; outline: none; background: var(--primary-preview); cursor: pointer; -webkit-appearance: none; margin-right: auto;">

                <!-- Play/Pause Button -->
                <button id="play-btn" style="width: 48px; height: 48px; border-radius: 50%%; background: var(--primary-preview); border: none; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3); transition: transform 0.1s;">
                    <svg id="play-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="display: none; margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <svg id="pause-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                </button>
            </div>
            
            <script>
                (function() {
                    const audio = document.getElementById('web-audio');
                    const playBtn = document.getElementById('play-btn');
                    const playIcon = document.getElementById('play-icon');
                    const pauseIcon = document.getElementById('pause-icon');
                    const audioSeek = document.getElementById('audio-seek');
                    const volumeSeek = document.getElementById('volume-seek');
                    const volumeBtn = document.getElementById('volume-btn');
                    const volumeIcon = document.getElementById('volume-icon');
                    const vinyl = document.getElementById('vinyl-disc');
                    const currentTimeText = document.getElementById('current-time');
                    const totalTimeText = document.getElementById('total-time');

                    let isMuted = false;
                    let userVolume = 1;

                    function formatTime(seconds) {
                        if (isNaN(seconds)) return '0:00';
                        const mins = Math.floor(seconds / 60);
                        const secs = Math.floor(seconds %% 60);
                        return mins + ':' + (secs < 10 ? '0' : '') + secs;
                    }

                    // Play / Pause Toggle
                    playBtn.addEventListener('click', () => {
                        if (audio.paused) {
                            audio.play();
                        } else {
                            audio.pause();
                        }
                    });

                    audio.addEventListener('play', () => {
                        playIcon.style.display = 'none';
                        pauseIcon.style.display = 'block';
                        vinyl.style.animation = 'spin 12s linear infinite';
                    });

                    audio.addEventListener('pause', () => {
                        playIcon.style.display = 'block';
                        pauseIcon.style.display = 'none';
                        vinyl.style.animation = 'none';
                    });

                    // Update Duration on load
                    audio.addEventListener('loadedmetadata', () => {
                        audioSeek.max = Math.floor(audio.duration);
                        totalTimeText.textContent = formatTime(audio.duration);
                    });

                    let isSeeking = false;
                    audioSeek.addEventListener('mousedown', () => { isSeeking = true; });
                    audioSeek.addEventListener('mouseup', () => { isSeeking = false; });
                    audioSeek.addEventListener('input', () => {
                        audio.currentTime = audioSeek.value;
                        currentTimeText.textContent = formatTime(audioSeek.value);
                    });

                    // Update Progress Seeker
                    audio.addEventListener('timeupdate', () => {
                        if (!isSeeking) {
                            audioSeek.value = Math.floor(audio.currentTime);
                            currentTimeText.textContent = formatTime(audio.currentTime);
                            
                            // Update track background color dynamically
                            const pct = (audio.currentTime / (audio.duration || 1)) * 100;
                            audioSeek.style.background = 'linear-gradient(to right, var(--primary-preview) 0%%, var(--primary-preview) ' + pct + '%%, rgba(255,255,255,0.12) ' + pct + '%%, rgba(255,255,255,0.12) 100%%)';
                        }
                    });

                    // Volume slider control
                    volumeSeek.addEventListener('input', () => {
                        audio.volume = volumeSeek.value;
                        userVolume = volumeSeek.value;
                        isMuted = (userVolume === 0);
                        updateVolumeIcon();
                    });

                    volumeBtn.addEventListener('click', () => {
                        isMuted = !isMuted;
                        audio.muted = isMuted;
                        updateVolumeIcon();
                    });

                    function updateVolumeIcon() {
                        const activeVol = isMuted ? 0 : userVolume;
                        volumeSeek.value = activeVol;
                        volumeSeek.style.background = 'linear-gradient(to right, var(--primary-preview) 0%%, var(--primary-preview) ' + (activeVol * 100) + '%%, rgba(255,255,255,0.12) ' + (activeVol * 100) + '%%, rgba(255,255,255,0.12) 100%%)';
                        
                        if (isMuted || activeVol === 0) {
                            volumeIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
                        } else if (activeVol < 0.5) {
                            volumeIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
                        } else {
                            volumeIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
                        }
                    }

                    // Vinyl rotate animation css
                    const style = document.createElement('style');
                    style.innerHTML = '@keyframes spin { to { transform: rotate(360deg); } }';
                    document.head.appendChild(style);

                    // Initial run
                    if (!audio.paused) {
                        vinyl.style.animation = 'spin 12s linear infinite';
                    }
                })();
            </script>
        </div>`, item.ID, item.Name, item.Name, sizeStr)
	} else if isPdf {
		previewHTML = fmt.Sprintf(`<iframe src="/download/%s?inline=1" style="width: 100%%; max-width: 1000px; height: 85vh; border: none; background: #fff; border-radius: 8px; box-shadow: 0 12px 48px rgba(0,0,0,0.6);"></iframe>`, item.ID)
	} else {
		previewHTML = fmt.Sprintf(`
        <div style="background: var(--surface-preview); padding: 48px; border-radius: 24px; border: 1px solid var(--border-preview); text-align: center; width: 100%%; max-width: 400px; box-shadow: 0 12px 48px var(--shadow-preview); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="var(--text-secondary-preview)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 24px;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            <h3 style="font-size: 18px; font-weight: 500; margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--on-surface-preview); width: 100%%;" title="%s">%s</h3>
            <p style="font-size: 13px; color: var(--text-secondary-preview); margin-top: 0; margin-bottom: 32px;">Pratinjau tidak tersedia • %s</p>
            <a href="/download/%s" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 12px 32px; border-radius: 100px; background: var(--primary-preview); color: #fff; font-size: 14px; font-weight: 600; box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3); transition: filter .15s;">Download</a>
        </div>`, item.Name, item.Name, sizeStr, item.ID)
	}

	backBtnHTML := ""
	if strings.Contains(item.ID, "/") {
		parentID := strings.Split(item.ID, "/")[0]
		backBtnHTML = fmt.Sprintf(`<a href="/share/%s" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-preview); color: var(--on-surface-preview); font-size: 13px; font-weight: 500; background: var(--surface-preview); margin-right: 16px; transition: background .15s;" onmouseover="this.style.background='var(--hover-preview)'" onmouseout="this.style.background='var(--surface-preview)'"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Kembali</a>`, parentID)
	}

	fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title>%s — Awd TeleDrive Preview</title>
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
            --bg-preview: #ffffff;
            --surface-preview: #f8f9fa;
            --border-preview: #e0e0e0;
            --on-surface-preview: #202124;
            --text-secondary-preview: #5f6368;
            --shadow-preview: rgba(0,0,0,0.06);
            --primary-preview: #1a73e8;
            --hover-preview: rgba(0,0,0,0.04);
            --sun-display: none;
            --moon-display: block;
        }
        .dark-theme {
            --bg-preview: #111115;
            --surface-preview: rgba(255, 255, 255, 0.05);
            --border-preview: rgba(255, 255, 255, 0.08);
            --on-surface-preview: #ffffff;
            --text-secondary-preview: #9aa0a6;
            --shadow-preview: rgba(0,0,0,0.6);
            --primary-preview: #8ab4f8;
            --hover-preview: rgba(255,255,255,0.08);
            --sun-display: block;
            --moon-display: none;
        }
        body {
            margin: 0; background: var(--bg-preview); color: var(--on-surface-preview); font-family: 'Roboto', sans-serif;
            display: flex; flex-direction: column; height: 100vh; overflow: hidden;
        }
        header {
            height: 64px; display: flex; align-items: center; justify-content: space-between;
            padding: 0 20px; background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-preview);
            z-index: 100;
        }
        .header-left { display: flex; align-items: center; }
        .file-title {
            font-size: 16px; font-weight: 500; max-width: 480px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: var(--on-surface-preview); display: flex; align-items: center; gap: 8px;
        }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .icon-btn {
            width: 40px; height: 40px; border-radius: 50%%; border: none;
            background: transparent; color: var(--on-surface-preview); display: flex; align-items: center;
            justify-content: center; cursor: pointer; transition: background .15s;
            text-decoration: none; font-size: 18px;
        }
        .icon-btn:hover { background: var(--hover-preview); }
        .main-container {
            flex: 1; display: flex; align-items: center; justify-content: center;
            padding: 20px; position: relative; overflow: hidden;
        }
        
        @media (max-width: 768px) {
            header { padding: 0 12px; }
            .file-title { max-width: 180px; font-size: 14px; }
            .main-container { padding: 12px; }
        }
    </style>
</head>
<body>
    <header>
        <div class="header-left">
            %s
            <div class="file-title">
                <img src="/icon.webp" width="22" height="22" style="border-radius: 4px; object-fit: contain; vertical-align: middle;" />
                <span style="margin-left: 4px;">%s</span>
            </div>
        </div>
        <div class="header-actions">
            <button id="toggle-theme-btn" class="icon-btn" title="Ganti Tema">
                <svg class="sun-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--sun-display);"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <svg class="moon-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--moon-display);"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
            <a href="/download/%s" class="icon-btn" title="Download">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                     <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                </svg>
            </a>
        </div>
    </header>
    <div class="main-container">
        %s
    </div>

    <script>
        document.getElementById('toggle-theme-btn').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    </script>
</body>
</html>
`, item.Name, backBtnHTML, item.Name, item.ID, previewHTML)
}

func (ws *WebServer) serveFolderPage(w http.ResponseWriter, item *WebShareItem) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	subFiles := ws.App.GetFiles(item.TelegramID)

	var listRows strings.Builder
	for _, sf := range subFiles {
		if sf.Type == "folder" {
			continue // Web shares stream only files in the target folder
		}
		
		sizeStr := fmt.Sprintf("%.1f MB", float64(sf.Size)/(1024*1024))
		if sf.Size >= 1024*1024*1024 {
			sizeStr = fmt.Sprintf("%.1f GB", float64(sf.Size)/(1024*1024*1024))
		} else if sf.Size < 1024*1024 {
			sizeStr = fmt.Sprintf("%.1f KB", float64(sf.Size)/1024)
		}

		ext := strings.ToLower(filepath.Ext(sf.Name))
		if len(ext) > 0 {
			ext = ext[1:]
		}
		iconCol, iconSVG := getFileIconSVG(ext)

		isImage := false
		switch ext {
		case "jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "svg":
			isImage = true
		}

		var iconHTML string
		if isImage {
			iconHTML = fmt.Sprintf(`<img src="/download/%s/%s" alt="" loading="lazy" />`, item.ID, sf.ID)
		} else {
			iconHTML = iconSVG
		}

		// Escape single quotes for JavaScript string parameters safety
		jsEscapedName := strings.ReplaceAll(sf.Name, "'", "\\'")
		jsEscapedName = html.EscapeString(jsEscapedName)

		listRows.WriteString(fmt.Sprintf(`
        <div class="row" onclick="openPreview('%s', '%s', '%s', '%s', '%s')">
            <input type="checkbox" class="file-checkbox row-checkbox" value="%s" onclick="event.stopPropagation(); handleCheck()" />
            <div class="file-info">
                <span class="file-icon" style="color: %s;">%s</span>
                <span class="file-name" title="%s">%s</span>
            </div>
            <div class="file-size">%s</div>
            <a href="/download/%s/%s" class="row-action-btn" title="Unduh" onclick="event.stopPropagation()">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </a>
        </div>
        `, item.ID, sf.ID, jsEscapedName, sizeStr, ext, sf.ID, iconCol, iconHTML, sf.Name, sf.Name, sizeStr, item.ID, sf.ID))
	}

	fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title>%s — Awd TeleDrive</title>
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
            --bg: #ffffff;
            --on-bg: #202124;
            --border: #e0e0e0;
            --text-secondary: #5f6368;
            --hover: #f1f3f4;
            --primary: #1a73e8;
            --surface-card: #f8f9fa;
            --shadow: rgba(0,0,0,0.05);
            --sun-display: none;
            --moon-display: block;
            --grid-display: block;
            --list-display: none;
        }
        .dark-theme {
            --bg: #18191c;
            --on-bg: #e8eaed;
            --border: #3c4043;
            --text-secondary: #9aa0a6;
            --hover: #2d2e30;
            --primary: #8ab4f8;
            --surface-card: #202124;
            --shadow: rgba(0,0,0,0.4);
            --sun-display: block;
            --moon-display: none;
        }
        body {
            margin: 0; background: var(--bg); color: var(--on-bg);
            font-family: 'Roboto', sans-serif; display: flex; flex-direction: column; min-height: 100vh;
        }
        header {
            height: 64px; border-bottom: 1px solid var(--border);
            display: flex; align-items: center; padding: 0 24px;
            box-sizing: border-box; justify-content: space-between;
        }
        .brand { display: flex; align-items: center; text-decoration: none; }
        .logo-text { font-size: 18px; font-weight: 600; color: var(--on-bg); margin-left: 2px; }
        .container { width: 100%%; max-width: 1100px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
        .folder-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 24px;
        }
        .folder-title { font-size: 24px; font-weight: 400; color: var(--on-bg); margin: 0; }
        .table-header {
            display: grid; grid-template-columns: 32px 2fr 100px 32px; gap: 16px;
            padding: 8px 20px; border-bottom: 1px solid var(--border);
            font-size: 13px; font-weight: 700; color: var(--text-secondary); align-items: center;
        }
        .list { display: flex; flex-direction: column; }
        
        /* List Mode styling */
        .row {
            display: grid; grid-template-columns: 32px 2fr 100px 32px; gap: 16px;
            padding: 16px 20px; border-bottom: 1px solid var(--border);
            align-items: center; cursor: pointer; transition: background .15s; position: relative;
        }
        .row:hover { background: var(--hover); }
        .file-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary); margin: 0; }
        .row-action-btn {
            background: transparent; border: none; color: var(--text-secondary); cursor: pointer; 
            display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
            border-radius: 50%%; transition: background .15s; text-decoration: none;
        }
        .row-action-btn:hover { background: var(--hover); color: var(--on-bg); }
        .file-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .file-icon { font-size: 20px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 4px; }
        .file-icon img { width: 100%%; height: 100%%; object-fit: cover; }
        .file-name {
            font-size: 14px; font-weight: 400; white-space: nowrap; overflow: hidden;
            text-overflow: ellipsis; color: var(--on-bg);
        }
        .file-date, .file-size { font-size: 13px; color: var(--text-secondary); }
        
        /* Grid Mode styling override */
        .list.grid-mode {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 10px 0;
        }
        .list.grid-mode .row {
            display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
            padding: 24px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-card);
            box-shadow: 0 4px 12px var(--shadow); height: 160px; box-sizing: border-box; position: relative;
        }
        .list.grid-mode .file-checkbox { position: absolute; top: 12px; left: 12px; }
        .list.grid-mode .row-action-btn { position: absolute; top: 8px; right: 8px; }
        .list.grid-mode .file-info { flex-direction: column; align-items: center; gap: 12px; width: 100%%; text-align: center; }
        .list.grid-mode .file-icon { font-size: 40px; width: 80px; height: 60px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 6px; margin-bottom: 8px; background: rgba(0,0,0,0.03); }
        .list.grid-mode .file-icon svg { width: 36px; height: 36px; }
        .list.grid-mode .file-icon img { width: 100%%; height: 100%%; object-fit: cover; }
        .list.grid-mode .file-name {
            white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
            text-align: center; font-size: 13px; font-weight: 500; width: 100%%; word-break: break-all;
        }
        .list.grid-mode .file-owner, .list.grid-mode .file-date, .list.grid-mode .file-size { display: none; }

        .header-actions { display: flex; align-items: center; gap: 8px; }
        .icon-btn {
            background: transparent; border: none; cursor: pointer;
            width: 36px; height: 36px; border-radius: 50%%;
            display: inline-flex; align-items: center; justify-content: center;
            color: var(--on-bg); transition: background .15s;
        }
        .icon-btn:hover { background: var(--hover); }

        .download-all-btn {
            background: transparent; border: 1px solid var(--border); border-radius: 4px;
            color: var(--primary); padding: 8px 16px; font-size: 13px; font-weight: 500;
            cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: background .15s;
            text-decoration: none;
        }
        .download-all-btn:hover { background: var(--hover); }

        /* SPA Preview Modal styles */
        .preview-modal {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #111115; color: #ffffff; z-index: 1000;
            display: flex; flex-direction: column; box-sizing: border-box;
        }
        .preview-header {
            height: 64px; display: flex; align-items: center; justify-content: space-between;
            padding: 0 20px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.08);
            box-sizing: border-box;
        }
        .preview-header-left { display: flex; align-items: center; gap: 12px; }
        .preview-title-container { display: flex; align-items: center; font-size: 16px; color: #fff; }
        .preview-header-right { display: flex; align-items: center; }
        .preview-content-area {
            flex: 1; display: flex; align-items: center; justify-content: center;
            padding: 20px; box-sizing: border-box;
        }
        .preview-modal .icon-btn { color: #ffffff; }
        .preview-modal .icon-btn:hover { background: rgba(255,255,255,0.08); }
        .preview-image { max-width: 90%%; max-height: 80vh; object-fit: contain; border-radius: 4px; box-shadow: 0 12px 48px rgba(0,0,0,0.7); }
        .preview-video { max-width: 90%%; max-height: 80vh; border-radius: 8px; box-shadow: 0 12px 48px rgba(0,0,0,0.7); outline: none; }
        .preview-iframe { width: 80%%; height: 82vh; border: none; background: #fff; border-radius: 8px; box-shadow: 0 12px 48px rgba(0,0,0,0.6); }
        .preview-box-generic {
            background: rgba(255,255,255,0.05); padding: 48px; border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.08); text-align: center; width: 100%%;
            max-width: 400px; box-shadow: 0 12px 48px rgba(0,0,0,0.6);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .preview-box-generic h3 { font-size: 18px; font-weight: 500; margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; width: 100%%; }
        .preview-box-generic p { font-size: 13px; color: #9aa0a6; margin-top: 0; margin-bottom: 32px; }
        .preview-box-generic a {
            display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
            padding: 12px 32px; border-radius: 100px; background: #1a73e8; color: #fff;
            font-size: 14px; font-weight: 600; box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3); transition: filter .15s;
        }
        .preview-box-generic a:hover { filter: brightness(1.1); }
        .preview-audio-container {
            background: rgba(255,255,255,0.06); padding: 48px 40px; border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.1); text-align: center; width: 100%%;
            max-width: 400px; box-shadow: 0 12px 48px rgba(0,0,0,0.6);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .preview-audio-container h3 { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; width: 100%%; }
        .preview-audio-container p { font-size: 13px; color: #9aa0a6; margin-top: 0; margin-bottom: 24px; }
        .preview-audio-container audio { width: 100%%; outline: none; }

        @media (max-width: 768px) {
            .container { padding: 16px; }
            .folder-header { flex-direction: column; align-items: flex-start; gap: 12px; }
            .header-actions { width: 100%%; justify-content: flex-end; }
            .table-header { display: none; }
            
            /* Responsive List Mode */
            .row { 
                grid-template-columns: 24px 1fr auto 32px; gap: 8px;
                padding: 12px 10px; 
            }
            .file-owner, .file-date { display: none; }
            
            /* Responsive Grid Mode */
            .list.grid-mode { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
            .list.grid-mode .row { height: 140px; }
            .list.grid-mode .file-icon { width: 60px; height: 50px; font-size: 32px; }
            
            .preview-iframe { width: 95%%; height: 75vh; }
        }
    </style>
</head>
<body>
    <header>
        <a href="#" class="brand">
            <img src="/icon.webp" width="26" height="26" style="border-radius: 6px; object-fit: contain; margin-right: 8px; vertical-align: middle;" />
            <span class="logo-text">Awd TeleDrive</span>
        </a>
        <div class="header-actions">
            <button id="toggle-lang-btn" class="icon-btn" title="Ganti Bahasa" style="font-size: 13px; font-weight: 600;">ID</button>
            <button id="toggle-layout-btn" class="icon-btn" title="Ganti Tampilan">
                <svg class="grid-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--grid-display);"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <svg class="list-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--list-display);"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button id="toggle-theme-btn" class="icon-btn" title="Ganti Tema">
                <svg class="sun-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--sun-display);"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                <svg class="moon-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: var(--moon-display);"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
        </div>
    </header>
    <div class="container">
        <div class="folder-header">
            <h2 class="folder-title" style="display: flex; align-items: center; gap: 10px;">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="var(--primary)" style="vertical-align: middle;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                %s
            </h2>
            <button class="download-all-btn" id="batch-download-btn" onclick="downloadSelected('%s')">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                <span id="batch-download-text">Unduh Semua</span>
            </button>
        </div>
        <div class="table-header">
            <input type="checkbox" class="file-checkbox" id="selectAllCheckbox" onclick="toggleSelectAll(this.checked)" title="Pilih Semua" />
            <span id="th-name">Nama</span>
            <span id="th-size">Ukuran file</span>
            <span></span>
        </div>
        <div class="list">
            %s
        </div>
    </div>

    <!-- SPA Preview Modal -->
    <div id="preview-modal" class="preview-modal" style="display: none;">
        <header class="preview-header">
            <div class="preview-header-left">
                <button id="close-preview-btn" class="icon-btn" title="Tutup">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div class="preview-title-container">
                    <img src="/icon.webp" width="22" height="22" style="border-radius: 4px; object-fit: contain; vertical-align: middle;" />
                    <span id="preview-filename" style="margin-left: 8px; font-weight: 500;">Filename</span>
                </div>
            </div>
            <div class="preview-header-right">
                <a id="preview-download-btn" href="#" class="icon-btn" title="Download">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
                    </svg>
                </a>
            </div>
        </header>
        <div id="preview-content-area" class="preview-content-area"></div>
    </div>

    <script>
        // Convert unix timestamp to relative local dates
        document.querySelectorAll('.file-date').forEach(el => {
            const ts = parseInt(el.getAttribute('data-ts'), 10);
            if (ts) {
                const d = new Date(ts * 1000);
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const formatted = d.getDate() + ' ' + months[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
                el.textContent = formatted;
            } else {
                el.textContent = '—';
            }
        });

        // Theme switching handler
        document.getElementById('toggle-theme-btn').addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });

        // Layout switching handler
        const layoutBtn = document.getElementById('toggle-layout-btn');
        const listContainer = document.querySelector('.list');
        const tableHeader = document.querySelector('.table-header');

        function updateLayoutUI(isGrid) {
            if (isGrid) {
                listContainer.classList.add('grid-mode');
                tableHeader.style.display = 'none';
                layoutBtn.style.setProperty('--grid-display', 'none');
                layoutBtn.style.setProperty('--list-display', 'block');
            } else {
                listContainer.classList.remove('grid-mode');
                tableHeader.style.display = 'grid';
                layoutBtn.style.setProperty('--grid-display', 'block');
                layoutBtn.style.setProperty('--list-display', 'none');
            }
        }

        if (localStorage.getItem('folder_layout') === 'grid') {
            updateLayoutUI(true);
        }

        layoutBtn.addEventListener('click', () => {
            const isGrid = listContainer.classList.toggle('grid-mode');
            localStorage.setItem('folder_layout', isGrid ? 'grid' : 'list');
            updateLayoutUI(isGrid);
        });

        // SPA Preview Modal Logic
        const previewModal = document.getElementById('preview-modal');
        const previewFilename = document.getElementById('preview-filename');
        const previewDownloadBtn = document.getElementById('preview-download-btn');
        const previewContentArea = document.getElementById('preview-content-area');
        const closePreviewBtn = document.getElementById('close-preview-btn');

        function openPreview(shareID, fileID, name, sizeStr, ext) {
            previewFilename.textContent = name;
            const downloadUrl = '/download/' + shareID + '/' + fileID;
            previewDownloadBtn.href = downloadUrl;

            // Clear previous content
            previewContentArea.innerHTML = '';
            let contentHTML = '';
            ext = ext.toLowerCase();

            const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "heic", "heif", "svg"].includes(ext);
            const isVideo = ["mp4", "webm", "ogg", "mov", "mkv", "avi", "flv"].includes(ext);
            const isAudio = ["mp3", "wav", "flac", "aac", "m4a", "wma"].includes(ext);
            const isPdf = ext === "pdf";

            if (isImage) {
                contentHTML = '<img class="preview-image" src="' + downloadUrl + '?inline=1" alt="" />';
            } else if (isVideo) {
                contentHTML = '<video class="preview-video" src="' + downloadUrl + '?inline=1" controls autoplay></video>';
            } else if (isAudio) {
                const t = folderTranslations[currentLang] || folderTranslations.id;
                contentHTML = '<div class="preview-audio-container">' +
                    '<div style="width: 80px; height: 80px; border-radius: 50%%; background: rgba(66, 133, 244, 0.1); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">' +
                        '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#8ab4f8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
                    '</div>' +
                    '<h3>' + name + '</h3>' +
                    '<p>' + t.audioPreview + ' • ' + sizeStr + '</p>' +
                    '<audio src="' + downloadUrl + '?inline=1" controls autoplay style="width: 100%%; outline: none;"></audio>' +
                '</div>';
            } else if (isPdf) {
                contentHTML = '<iframe class="preview-iframe" src="' + downloadUrl + '?inline=1"></iframe>';
            } else {
                const t = folderTranslations[currentLang] || folderTranslations.id;
                contentHTML = '<div class="preview-box-generic">' +
                    '<svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="#9aa0a6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 24px;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>' +
                    '<h3>' + name + '</h3>' +
                    '<p>' + t.noPreview + ' • ' + sizeStr + '</p>' +
                    '<a href="' + downloadUrl + '">' + t.downloadPreview + '</a>' +
                '</div>';
            }

            previewContentArea.innerHTML = contentHTML;
            previewModal.style.display = 'flex';

            // Push history state to intercept the back button
            history.pushState({previewOpen: true}, '');
        }

        function closePreview() {
            previewModal.style.display = 'none';
            // Stop media elements
            const video = previewContentArea.querySelector('video');
            if (video) video.pause();
            const audio = previewContentArea.querySelector('audio');
            if (audio) audio.pause();
            previewContentArea.innerHTML = '';
        }

        closePreviewBtn.addEventListener('click', () => {
            closePreview();
            history.back(); // Remove the fake history state
        });

        // Close on browser back
        window.addEventListener('popstate', (event) => {
            closePreview();
        });

        // Batch Download Logic
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const rowCheckboxes = document.querySelectorAll('.row-checkbox');
        const batchDownloadText = document.getElementById('batch-download-text');

        function updateBatchDownloadBtn() {
            const t = folderTranslations[currentLang] || folderTranslations.id;
            const selected = Array.from(rowCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
            if (selected.length > 0) {
                batchDownloadText.textContent = t.downloadSelected + ' (' + selected.length + ')';
            } else {
                batchDownloadText.textContent = t.downloadAll;
            }
        }

        // Checklist check handler
        window.handleCheck = function() {
            const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
            if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
            updateBatchDownloadBtn();
        }

        window.toggleSelectAll = function(checked) {
            rowCheckboxes.forEach(cb => { cb.checked = checked; });
            updateBatchDownloadBtn();
        }

        window.downloadSelected = function(shareID) {
            let selected = Array.from(rowCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
            if (selected.length === 0) {
                selected = Array.from(rowCheckboxes).map(cb => cb.value);
            }
            if (selected.length === 0) return;
            
            const url = '/download_batch/' + shareID + '?f=' + selected.join(',');
            window.location.href = url;
        }

        // Folder Language Logic
        const folderTranslations = {
            id: {
                langBtn: "ID",
                title: "%%s — Awd TeleDrive",
                downloadSelected: "Unduh Terpilih",
                downloadAll: "Unduh Semua",
                thName: "Nama",
                thDate: "Tanggal diubah",
                thSize: "Ukuran file",
                selectAll: "Pilih Semua",
                audioPreview: "Berkas Audio",
                noPreview: "Pratinjau tidak tersedia",
                downloadPreview: "Download"
            },
            en: {
                langBtn: "EN",
                title: "%%s — Awd TeleDrive",
                downloadSelected: "Download Selected",
                downloadAll: "Download All",
                thName: "Name",
                thDate: "Date Modified",
                thSize: "File Size",
                selectAll: "Select All",
                audioPreview: "Audio File",
                noPreview: "Preview not available",
                downloadPreview: "Download"
            }
        };

        const folderName = "%s";
        let currentLang = localStorage.getItem('lang') || 'id';

        function applyFolderLanguage(lang) {
            const t = folderTranslations[lang] || folderTranslations.id;
            document.title = t.title.replace('%%s', folderName);
            document.getElementById('toggle-lang-btn').textContent = t.langBtn;
            
            if (document.getElementById('th-name')) document.getElementById('th-name').textContent = t.thName;
            if (document.getElementById('th-date')) document.getElementById('th-date').textContent = t.thDate;
            if (document.getElementById('th-size')) document.getElementById('th-size').textContent = t.thSize;
            if (document.getElementById('selectAllCheckbox')) document.getElementById('selectAllCheckbox').title = t.selectAll;

            updateBatchDownloadBtn(); // Will use correct translation
        }

        applyFolderLanguage(currentLang);

        document.getElementById('toggle-lang-btn').addEventListener('click', () => {
            currentLang = currentLang === 'id' ? 'en' : 'id';
            localStorage.setItem('lang', currentLang);
            applyFolderLanguage(currentLang);
        });
    </script>
</body>
</html>
`, item.Name, item.Name, item.ID, listRows.String(), item.Name)
}
