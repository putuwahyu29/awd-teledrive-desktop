Unicode true

####
## Please note: Template replacements don't work in this file. They are provided with default defines like
## mentioned underneath.
## If the keyword is not defined, "wails_tools.nsh" will populate them with the values from ProjectInfo.
## If they are defined here, "wails_tools.nsh" will not touch them. This allows to use this project.nsi manually
## from outside of Wails for debugging and development of the installer.
##
## For development first make a wails nsis build to populate the "wails_tools.nsh":
## > wails build --target windows/amd64 --nsis
## Then you can call makensis on this file with specifying the path to your binary:
## For a AMD64 only installer:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app.exe
## For a ARM64 only installer:
## > makensis -DARG_WAILS_ARM64_BINARY=..\..\bin\app.exe
## For a installer with both architectures:
## > makensis -DARG_WAILS_AMD64_BINARY=..\..\bin\app-amd64.exe -DARG_WAILS_ARM64_BINARY=..\..\bin\app-arm64.exe
####
## The following information is taken from the ProjectInfo file, but they can be overwritten here.
####
## !define INFO_PROJECTNAME    "MyProject" # Default "{{.Name}}"
## !define INFO_COMPANYNAME    "MyCompany" # Default "{{.Info.CompanyName}}"
## !define INFO_PRODUCTNAME    "MyProduct" # Default "{{.Info.ProductName}}"
## !define INFO_PRODUCTVERSION "1.0.0"     # Default "{{.Info.ProductVersion}}"
## !define INFO_COPYRIGHT      "Copyright" # Default "{{.Info.Copyright}}"
###
## !define PRODUCT_EXECUTABLE  "Application.exe"      # Default "${INFO_PROJECTNAME}.exe"
## !define UNINST_KEY_NAME     "UninstKeyInRegistry"  # Default "${INFO_COMPANYNAME}${INFO_PRODUCTNAME}"
####
## !define REQUEST_EXECUTION_LEVEL "admin"            # Default "admin"  see also https://nsis.sourceforge.io/Docs/Chapter4.html
####
## Include the wails tools
####
!include "wails_tools.nsh"

# The version information for this two must consist of 4 parts
VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion    "${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"     "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion"  "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"     "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"  "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"     "${INFO_PRODUCTNAME}"

# Enable HiDPI support. https://nsis.sourceforge.io/Reference/ManifestDPIAware
ManifestDPIAware true

!include "MUI.nsh"

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
# !define MUI_WELCOMEFINISHPAGE_BITMAP "resources\leftimage.bmp" #Include this to add a bitmap on the left side of the Welcome Page. Must be a size of 164x314
!define MUI_FINISHPAGE_NOAUTOCLOSE # Wait on the INSTFILES page so the user can take a look into the details of the installation steps
!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.

# Welcome page configuration
!define MUI_WELCOMEPAGE_TITLE "$(WELCOME_TITLE)"
!define MUI_WELCOMEPAGE_TEXT "$(WELCOME_TEXT)"

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
# !insertmacro MUI_PAGE_LICENSE "resources\eula.txt" # Adds a EULA page to the installer
!insertmacro MUI_PAGE_COMPONENTS # Pilihan komponen (shortcut, startup, dll)
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.

# Show run checkbox on finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXECUTABLE}"
!define MUI_FINISHPAGE_RUN_TEXT "$(RUN_TEXT)"
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_INSTFILES # Uinstalling page

!insertmacro MUI_LANGUAGE "Indonesian" # Set Language of the installer to Indonesian
!insertmacro MUI_LANGUAGE "English" # Set alternative Language of the installer to English

# Indonesian strings
LangString WELCOME_TITLE ${LANG_INDONESIAN} "Instalasi / Pembaruan ${INFO_PRODUCTNAME}"
LangString WELCOME_TEXT ${LANG_INDONESIAN} "Selamat datang di program instalasi ${INFO_PRODUCTNAME}.$\r$\n$\r$\nJika versi sebelumnya sudah terinstal di komputer Anda, installer akan memperbaruinya secara otomatis.$\r$\n$\r$\nKlik Lanjut untuk memulai."
LangString RUN_TEXT ${LANG_INDONESIAN} "Jalankan ${INFO_PRODUCTNAME} setelah selesai"
LangString APP_RUNNING_WARN ${LANG_INDONESIAN} "${INFO_PRODUCTNAME} sedang aktif berjalan. Apakah Anda ingin menutup aplikasi secara otomatis dan melanjutkan instalasi?"
LangString UNINSTALL_CONFIRM_TEXT ${LANG_INDONESIAN} "Apakah Anda ingin menghapus semua data aplikasi ${INFO_PRODUCTNAME} (file konfigurasi, sesi login, dan cache)?"
LangString COMP_SEC_APP ${LANG_INDONESIAN} "${INFO_PRODUCTNAME} (Utama)"
LangString COMP_SEC_APP_DESC ${LANG_INDONESIAN} "File inti dan resource utama aplikasi ${INFO_PRODUCTNAME}."
LangString COMP_SEC_DESKTOP ${LANG_INDONESIAN} "Shortcut Desktop"
LangString COMP_SEC_DESKTOP_DESC ${LANG_INDONESIAN} "Membuat ikon shortcut aplikasi ${INFO_PRODUCTNAME} di Desktop Anda."
LangString COMP_SEC_STARTMENU ${LANG_INDONESIAN} "Shortcut Start Menu"
LangString COMP_SEC_STARTMENU_DESC ${LANG_INDONESIAN} "Menambahkan pintasan aplikasi ${INFO_PRODUCTNAME} ke dalam Start Menu Windows."
LangString COMP_SEC_STARTUP ${LANG_INDONESIAN} "Jalankan saat Windows Startup"
LangString COMP_SEC_STARTUP_DESC ${LANG_INDONESIAN} "Menjalankan aplikasi secara otomatis di latar belakang saat komputer dinyalakan."
LangString UNINSTALL_OLD_VER_CONFIRM ${LANG_INDONESIAN} "Versi terdahulu dari ${INFO_PRODUCTNAME} terdeteksi di direktori berbeda: $OldInstallDir.$\r$\n$\r$\nApakah Anda ingin mencopot (uninstall) versi lama tersebut secara otomatis sebelum melanjutkan?"
LangString UNINSTALL_SHORTCUT_TEXT ${LANG_INDONESIAN} "Copot Pemasangan ${INFO_PRODUCTNAME}"

# English strings
LangString WELCOME_TITLE ${LANG_ENGLISH} "Install / Update ${INFO_PRODUCTNAME}"
LangString WELCOME_TEXT ${LANG_ENGLISH} "Welcome to the ${INFO_PRODUCTNAME} setup.$\r$\n$\r$\nIf a previous version is already installed on your computer, the installer will update it automatically.$\r$\n$\r$\nClick Next to continue."
LangString RUN_TEXT ${LANG_ENGLISH} "Run ${INFO_PRODUCTNAME} after finishing"
LangString APP_RUNNING_WARN ${LANG_ENGLISH} "${INFO_PRODUCTNAME} is currently running. Do you want to automatically close the application and continue the installation?"
LangString UNINSTALL_CONFIRM_TEXT ${LANG_ENGLISH} "Do you want to delete all ${INFO_PRODUCTNAME} application data (configuration files, login sessions, and cache)?"
LangString COMP_SEC_APP ${LANG_ENGLISH} "${INFO_PRODUCTNAME} (Core)"
LangString COMP_SEC_APP_DESC ${LANG_ENGLISH} "Core binary files and main resources of ${INFO_PRODUCTNAME}."
LangString COMP_SEC_DESKTOP ${LANG_ENGLISH} "Desktop Shortcut"
LangString COMP_SEC_DESKTOP_DESC ${LANG_ENGLISH} "Create a shortcut icon for ${INFO_PRODUCTNAME} on your Desktop."
LangString COMP_SEC_STARTMENU ${LANG_ENGLISH} "Start Menu Shortcut"
LangString COMP_SEC_STARTMENU_DESC ${LANG_ENGLISH} "Add ${INFO_PRODUCTNAME} shortcut to your Windows Start Menu."
LangString COMP_SEC_STARTUP ${LANG_ENGLISH} "Run at Windows Startup"
LangString COMP_SEC_STARTUP_DESC ${LANG_ENGLISH} "Automatically launch the application in the background when the computer starts."
LangString UNINSTALL_OLD_VER_CONFIRM ${LANG_ENGLISH} "A previous version of ${INFO_PRODUCTNAME} was detected in a different directory: $OldInstallDir.$\r$\n$\r$\nDo you want to automatically uninstall the old version before continuing?"
LangString UNINSTALL_SHORTCUT_TEXT ${LANG_ENGLISH} "Uninstall ${INFO_PRODUCTNAME}"

## The following two statements can be used to sign the installer and the uninstaller. The path to the binaries are provided in %1
#!uninstfinalize 'signtool --file "%1"'
#!finalize 'signtool --file "%1"'

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\bin\awd-teledrive-${ARCH}-installer.exe" # Name of the installer's file.
!ifdef WAILS_INSTALL_SCOPE
  !if "${WAILS_INSTALL_SCOPE}" == "user"
    InstallDir "$LOCALAPPDATA\Programs\${INFO_PRODUCTNAME}"
  !else
    InstallDir "$PROGRAMFILES64\${INFO_COMPANYNAME}\${INFO_PRODUCTNAME}"
  !endif
!else
  InstallDir "$PROGRAMFILES64\${INFO_COMPANYNAME}\${INFO_PRODUCTNAME}"
!endif # Default installing folder ($PROGRAMFILES is Program Files folder).
ShowInstDetails show # This will always show the installation details.

Var OldInstallDir
Var OldUninstallPath

Function checkAppRunning
  loop:
  ClearErrors
  FileOpen $0 "$INSTDIR\${PRODUCT_EXECUTABLE}" "a"
  FileClose $0
  IfErrors running not_running
  running:
    # Tampilkan prompt menawarkan untuk menutup aplikasi otomatis
    MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION "$(APP_RUNNING_WARN)" IDYES auto_close IDNO loop
    Abort
  auto_close:
    # Jalankan taskkill secara silent
    nsExec::Exec 'taskkill /f /im "${PRODUCT_EXECUTABLE}"'
    Sleep 1000 # Tunggu 1 detik agar proses benar-benar mati
    Goto loop
  cancel:
    Abort
  not_running:
FunctionEnd

Function checkAndUninstallOldVersion
  # Jika ada versi lama terdeteksi di direktori yang berbeda dari $INSTDIR
  ${If} $OldUninstallPath != ""
  ${AndIf} $OldInstallDir != $INSTDIR
    MessageBox MB_YESNO|MB_ICONQUESTION "$(UNINSTALL_OLD_VER_CONFIRM)" IDNO skip
      # Jalankan uninstall lama secara silent
      DetailPrint "Mencopot versi lama di: $OldInstallDir"
      ExecWait '$\"$OldUninstallPath$\" /S _?=$OldInstallDir'
      # Hapus sisa-sisa folder jika ada
      RMDir /r "$OldInstallDir"
    skip:
  ${EndIf}
FunctionEnd

Function .onInit
   !insertmacro wails.checkArchitecture
   
   # Cek apakah aplikasi sudah terinstal sebelumnya via registry
   SetRegView 64
   
   # Cek di registry HKCU
   ReadRegStr $0 HKCU "${UNINST_KEY}" "UninstallString"
   ReadRegStr $1 HKCU "${UNINST_KEY}" "DisplayVersion"
   ReadRegStr $2 HKCU "${UNINST_KEY}" "InstallLocation"
   
   # Cek di registry HKLM jika HKCU kosong
   ${If} $0 == ""
     ReadRegStr $0 HKLM "${UNINST_KEY}" "UninstallString"
     ReadRegStr $1 HKLM "${UNINST_KEY}" "DisplayVersion"
     ReadRegStr $2 HKLM "${UNINST_KEY}" "InstallLocation"
   ${EndIf}

   # Jika terdeteksi sudah terinstal, gunakan direktori instalasi yang sudah ada
   ${If} $0 != ""
     StrCpy $OldUninstallPath $0
     StrCpy $OldInstallDir $2
     
     ${If} $2 != ""
       StrCpy $INSTDIR $2
     ${EndIf}
   ${EndIf}
FunctionEnd

# Komponen 1: Aplikasi Utama (Mandatori)
Section "$(COMP_SEC_APP)" SecApp
    SectionIn RO # Read-only
    !insertmacro wails.setShellContext

    # Cek apakah aplikasi sedang aktif berjalan sebelum mengcopy file biner
    Call checkAppRunning

    # Cek dan copot versi lama jika berada di direktori yang berbeda
    Call checkAndUninstallOldVersion

    !insertmacro wails.webview2runtime

    SetOutPath $INSTDIR

    !insertmacro wails.files

    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols

    !insertmacro wails.writeUninstaller
SectionEnd

# Komponen 2: Shortcut di Desktop (Opsional)
Section "$(COMP_SEC_DESKTOP)" SecDesktop
    !insertmacro wails.setShellContext
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
SectionEnd

# Komponen 3: Shortcut di Start Menu (Opsional)
Section "$(COMP_SEC_STARTMENU)" SecStartMenu
    !insertmacro wails.setShellContext
    CreateDirectory "$SMPROGRAMS\${INFO_PRODUCTNAME}"
    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}\$(UNINSTALL_SHORTCUT_TEXT).lnk" "$INSTDIR\uninstall.exe"
SectionEnd

# Komponen 4: Jalankan Otomatis saat Windows Startup (Opsional)
Section "$(COMP_SEC_STARTUP)" SecStartup
    !insertmacro wails.setShellContext
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${INFO_PRODUCTNAME}" "$\"$INSTDIR\${PRODUCT_EXECUTABLE}$\""
SectionEnd

# Deskripsi Komponen
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} "$(COMP_SEC_APP_DESC)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "$(COMP_SEC_DESKTOP_DESC)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "$(COMP_SEC_STARTMENU_DESC)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartup} "$(COMP_SEC_STARTUP_DESC)"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "uninstall"
    !insertmacro wails.setShellContext

    # Tanyakan apakah ingin menghapus data konfigurasi, sesi login, dan cache
    MessageBox MB_YESNO|MB_ICONQUESTION "$(UNINSTALL_CONFIRM_TEXT)" IDNO skip_data_deletion
        # Hapus data konfigurasi dan sesi Telegram (Go backend)
        RMDir /r "$AppData\teledrive"
        # Hapus data cache WebView2
        RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"
        RMDir /r "$AppData\${INFO_PRODUCTNAME}"
        RMDir /r "$AppData\${INFO_PROJECTNAME}"
    skip_data_deletion:

    RMDir /r $INSTDIR

    # Hapus folder khusus Start Menu dan pintasannya
    RMDir /r "$SMPROGRAMS\${INFO_PRODUCTNAME}"
    # Hapus pintasan lama jika ada (legacy cleanup)
    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"
    
    # Hapus startup registry value
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${INFO_PRODUCTNAME}"

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols

    !insertmacro wails.deleteUninstaller
SectionEnd


