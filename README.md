# awd-teledrive-desktop 💻☁️🚀

<p align="center">
  <img src="logo-drive.png" width="130" height="130" alt="awd-teledrive-desktop Logo" onerror="this.src='icon.webp'">
</p>

<p align="center">
  <a href="https://github.com/putuwahyu29/awd-teledrive-desktop/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License Badge">
  </a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platform Badge">
  <img src="https://img.shields.io/badge/Go-1.18%2B-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go Badge">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js Badge">
  <img src="https://img.shields.io/badge/Framework-Wails%20v2-red?style=flat-square&logo=wails&logoColor=white" alt="Wails Badge">
</p>

**awd-teledrive-desktop** is a feature-rich, high-performance cross-platform desktop application that turns your Telegram account into an unlimited, secure personal cloud storage drive. Built with the state-of-the-art **Wails (Go)** framework and **React/Vite (TypeScript)**, it provides a native desktop experience with modern aesthetics, advanced media handling, and background synchronization workflows.

---

## 🌐 Teledrive Ecosystem
This application is part of a cross-platform ecosystem designed to turn Telegram into your personal unlimited cloud storage:
*   **📱 [awd-teledrive-android](https://github.com/putuwahyu29/awd-teledrive-android)**: Secure Android file manager and backup tool.
*   **💻 [awd-teledrive-desktop](https://github.com/putuwahyu29/awd-teledrive-desktop)**: High-performance Wails (Go) + React desktop client with two-way sync, local decryption, and Cloudflare Web Sharing.
*   **📸 [awd-telephoto-android](https://github.com/putuwahyu29/awd-telephoto-android)**: Companion app for client-side encrypted photo/video backup.

---

## 🌐 Language / Bahasa
*   [English Version (Main)](README.md)
*   [Versi Bahasa Indonesia](README.id.md)

---

## 📌 Table of Contents
- [✨ Key Features](#-key-features)
- [📷 Screenshots](#-screenshots)
- [📊 Feature Comparison Matrix](#-feature-comparison-matrix)
- [📁 Storage & Paths](#-storage--paths)
- [🚀 Getting Started & User Guide](#-getting-started--user-guide)
  - [Prerequisites](#prerequisites)
  - [How to Obtain Telegram API Credentials](#how-to-obtain-telegram-api-credentials)
  - [Logging In](#logging-in)
  - [Web Sharing & Cloudflare Tunnel](#web-sharing--cloudflare-tunnel)
  - [Folder Synchronization (One-Way & Two-Way)](#folder-synchronization-one-way--two-way)
  - [Telephoto Encrypted Media Gallery](#telephoto-encrypted-media-gallery)
- [🛠️ Developer Guide](#️-developer-guide)
  - [Project Directory Structure](#project-directory-structure)
  - [Running in Development Mode](#running-in-development-mode)
  - [Building for Production](#building-for-production)
- [⚙️ Troubleshooting & Logs](#️-troubleshooting--logs)
- [⚠️ Disclaimer](#️-disclaimer)
- [📄 License](#-license)

---

## ✨ Key Features

*   **☁️ Unlimited Telegram Cloud Storage**: Store, manage, and retrieve files of any size without limits by leveraging Telegram's secure infrastructure.
*   **🔒 Native & Secure Authentication**: Connect directly using Telegram's API via your Phone Number, OTP Code, and Two-Factor Authentication (2FA) password.
*   **📁 Smart Folder Organization**: Create, browse, and organize folders. Folders are seamlessly mapped to Telegram channels or groups under the hood to ensure structure.
*   **🔄 Advanced Sync Manager**: Set up automated synchronization tasks linking local folders to designated Telegram chats.
    *   **One-Way Sync**: Safely backup local folders to the cloud (upload only).
    *   **Two-Way Sync**: Fully synchronize additions, modifications, and deletions bi-directionally between your PC and Telegram.
    *   **Real-time Progress & Activity Log**: Track running actions, throughput speeds, and sync events live.
*   **🌐 Public & Local Web Sharing**: Share files and folders with others easily.
    *   **Local Network Sharing**: Share links using your computer's local IP.
    *   **Public Tunneling**: Built-in, automated integration with **Cloudflare Tunnel (`trycloudflare.com`)** that allows secure, remote sharing without complex port forwarding.
    *   **Password Security**: Password-protect your public shares.
    *   **Zip Archiving**: Download folders as complete `.zip` archives on the fly.
*   **🖼️ Telephoto Encrypted Media Gallery**:
    *   Directly browse and search photos/videos grouped chronologically.
    *   Built-in decryption for AES-256-GCM encrypted media from companion apps (like `awd-telephoto-android`) using secure PBKDF2 key derivation.
*   **⚙️ Native Windows Integration**: System tray support, minimize-to-tray on close, and auto-launch on startup configured directly via the Windows Registry.

---

## 📷 Screenshots

| | |
|:---:|:---:|
| <img src="screenhots/home.png" width="400" alt="Main Dashboard / File Manager"/><br/>**Main Dashboard / File Manager** | <img src="screenhots/media.png" width="400" alt="Media Player & Gallery"/><br/>**Media Player & Gallery** |
| <img src="screenhots/recent.png" width="400" alt="Recent Files & Activities"/><br/>**Recent Files & Activities** | <img src="screenhots/storage.png" width="400" alt="Storage Usage Analytics"/><br/>**Storage Usage Analytics** |
| <img src="screenhots/sync.png" width="400" alt="Folder Synchronization Manager"/><br/>**Folder Synchronization Manager** | <img src="screenhots/websharing.png" width="400" alt="Web Sharing (Cloudflare Tunnel)"/><br/>**Web Sharing (Cloudflare Tunnel)** |

---

## 📊 Feature Comparison Matrix

| Feature | 📱 awd-teledrive-android | 💻 awd-teledrive-desktop | 📸 awd-telephoto-android |
| :--- | :---: | :---: | :---: |
| **Unlimited Cloud Storage** | Yes (Up to 2GB per file) | Yes (Any file size) | Yes (Photos & Videos) |
| **File & Folder Manager** | Yes | Yes | Gallery View only |
| **Sync / Backup Mode** | Local folder backup | One-Way & Two-Way Sync | Auto Photo/Video Backup |
| **Security / Encryption** | Master Password, Biometrics | AES-256 Decryption (Telephoto) | Client-side AES-256-GCM |
| **Web Sharing (Public/Local)** | No | Yes (Cloudflare Tunnel & Local IP) | No |
| **Native Integration** | Android WorkManager | System Tray, Auto-Launch (Registry) | Android WorkManager |
| **Multi-Language Support** | Yes (EN / ID) | Yes (EN / ID) | Yes (EN / ID) |

---

## 📁 Storage & Paths

All configuration files, cached data, and session keys are securely stored locally inside the platform-specific user configuration directory (resolved via `os.UserConfigDir()` to `%APPDATA%` on Windows, `~/.config` on Linux, and `~/Library/Application Support` on macOS):

*   **Configuration File**: `<UserConfigDir>/teledrive/config.json` (Stores API settings, sync tasks, startup options).
*   **Session State**: `<UserConfigDir>/teledrive/session.json` (Stores the active encrypted Telegram session).
*   **Web Sharing Registry**: `<UserConfigDir>/teledrive/web_shares.json` (Tracks shared links, passwords, and access counters).
*   **Telephoto Media Cache**: `<UserConfigDir>/teledrive/telephoto_cache/` (Holds temporary decrypted images/videos safely).
*   **Cloudflare Binary**: `<UserConfigDir>/teledrive/bin/cloudflared` (Appended with `.exe` on Windows; downloaded automatically when using public tunneling).

---

## 🚀 Getting Started & User Guide

### Prerequisites
To run the pre-built desktop application, simply double-click the `teledrive.exe` executable. No additional drivers are needed.

### How to Obtain Telegram API Credentials
awd-teledrive-desktop requires your own API credentials to connect with Telegram's servers. This is free and takes less than 2 minutes:
1. Go to [my.telegram.org](https://my.telegram.org/) and log in with your phone number.
2. Select **API development tools**.
3. Fill in the form (App title and short name of your choice).
4. Copy the **App api_id** and **App api_hash**.
5. Input these values into the settings panel when launching the application.

> [!NOTE]
> These credentials remain strictly local. The application communicates directly with Telegram's endpoints (`dcs.Prod()`) and does not send your data to any third-party servers.

### Logging In
1. Open the application and enter your **API ID** and **API Hash**.
2. Input your phone number in international format (e.g., `+628123456789`).
3. Press **Send Code**. You will receive an official login code from Telegram.
4. Input the OTP Code. If you have Two-Step Verification enabled, you will be prompted to enter your 2FA password.

### Web Sharing & Cloudflare Tunnel
To share a file or folder:
1. Right-click or select the share option next to a file/folder in the File Manager.
2. Configure optional password protection.
3. Click **Enable Public Sharing**. The app will automatically acquire a secure public URL (e.g. `https://xxx.trycloudflare.com/share/yyy`) via Cloudflare Tunnel.
4. Anyone with the link (and password, if set) can access the file, stream videos, or download folders as a `.zip` archive.

### Folder Synchronization (One-Way & Two-Way)
1. Go to the **Sync Manager** tab.
2. Click **Add Task** and select a folder on your local drive.
3. Choose the target destination Telegram Chat or Channel ID.
4. Set the mode:
   * **One-Way**: Files only go local ➡️ cloud.
   * **Two-Way**: Keeps folders matching exactly. If a file is uploaded to Telegram or downloaded locally, it syncs to both sides.
5. Set the sync interval (default is 60 seconds).
6. Enable the task. The background process will automatically run at intervals.

### Telephoto Encrypted Media Gallery
If you use encrypted mobile backups:
1. Navigate to the **Telephoto** tab.
2. Enter your decryption password.
3. Browse, search, and view your images or videos. Decrypted items are cached dynamically in the user cache directory and cleared automatically upon request.

---

## 🛠️ Developer Guide

### Project Directory Structure
```
awd-teledrive-desktop/
├── app.go                  # Main Wails application logic and lifecycle bindings
├── app_auth.go             # Telegram authentication flow (gotd: Phone, OTP, 2FA, QR Login)
├── app_config.go           # Application configuration persistence & Windows registry startup
├── app_files.go            # Core file and folder storage, uploads/downloads, progress trackers
├── app_sync.go             # Sync manager orchestration (One-Way / Two-Way background sync)
├── main.go                 # Go application entry point
├── telephoto.go            # Local PBKDF2 & AES-256-GCM media decryption and gallery helpers
├── tray.go                 # Windows system tray integration
├── web_server.go           # Local web server runner & Cloudflare Tunnel launcher
├── web_handlers.go         # HTTP handlers for public share links, streaming, and batch downloads
├── web_templates.go        # Embedded CSS/HTML templates for shared web pages
├── go.mod                  # Go module dependencies
├── go.sum                  # Go module checksums
├── icon.webp               # Application icon embedded in the web server
├── wails.json              # Wails project configuration file
├── build/                  # Wails build assets and output binaries
└── frontend/               # React + Vite + TypeScript frontend application
```

### Running in Development Mode
To run the project locally with live-reloading:

1. **Install dependencies**:
   Make sure you have [Go](https://go.dev) (1.18+), [Node.js](https://nodejs.org), and [Wails CLI](https://wails.io/docs/gettingstarted/installation) installed.
   ```bash
   # Install Wails CLI if you haven't already
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```
2. **Start Dev Server**:
   ```bash
   wails dev
   ```

### Building for Production
awd-teledrive-desktop is fully cross-platform and can be compiled into optimized binaries or installation packages for Windows, macOS, and Linux.

#### 1. Mapped Output Binaries
*   **Windows**: `build/bin/awd-teledrive.exe`
*   **macOS**: `build/bin/awd-teledrive.app` (App Bundle)
*   **Linux**: `build/bin/awd-teledrive`

#### 2. Compiling for Production
Compile optimized, clean production binaries for the current OS:
```bash
wails build -clean -ldflags "-s -w"
```

#### 3. Cross-Platform Compilation
```bash
# Build for Windows
wails build -platform windows/amd64

# Build for macOS (Darwin Universal/Intel/Apple Silicon)
wails build -platform darwin/universal

# Build for Linux
wails build -platform linux/amd64
```

#### 4. Generating Installer / Setup Files
*   **Windows Setup Installer (NSIS)**:
    Requires [NSIS](https://nsis.sourceforge.io/) installed on your Windows path. Run:
    ```bash
    wails build -nsis
    ```
    This generates a single setup installer executable `build/bin/awd-teledrive-setup.exe`.

---

## ⚙️ Troubleshooting & Logs

*   **Webview Errors**: Ensure your Windows has WebView2 runtime installed (installed by default on Windows 10/11).
*   **Connection Failures**: If your Telegram client fails to connect, check your internet connectivity, firewall settings, or verify if the `api_id` and `api_hash` values in `%APPDATA%\teledrive\config.json` are correct.
*   **Reset Application State**: To log out completely and reset the app, delete the `%APPDATA%\teledrive\` directory.

---

## ⚠️ Disclaimer

This project is an independent open-source development created solely for educational and learning purposes. It is not affiliated, associated, authorized, endorsed by, or in any way officially connected with Telegram Messenger or any other company or party.

Users are solely responsible for ensuring their usage of this application complies with Telegram's Terms of Service and any applicable local or international laws. The developers assume no liability for any misuse, policy violations, account actions, or legal consequences resulting from the use of this software.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full license text.

---

<p align="center">Made with ❤️ by <a href="mailto:aguswahyu@office.awd.my.id">I Putu Agus Wahyu Dupayana</a></p>
