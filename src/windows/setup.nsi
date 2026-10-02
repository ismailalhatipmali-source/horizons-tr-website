Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "HORIZONS Arabic"
OutFile "HORIZONS-Arabic-Setup-1.5.0.exe"
InstallDir "$LOCALAPPDATA\Programs\HORIZONS Arabic Web"
InstallDirRegKey HKCU "Software\HORIZONS\ArabicWeb" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "HORIZONS · Digital Business Services & Solutions"
VIProductVersion "1.5.0.0"
VIAddVersionKey /LANG=1033 "ProductName" "HORIZONS Arabic"
VIAddVersionKey /LANG=1033 "CompanyName" "HORIZONS"
VIAddVersionKey /LANG=1033 "FileDescription" "HORIZONS Arabic Web Workbook Installer"
VIAddVersionKey /LANG=1033 "FileVersion" "1.5.0"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright 2026 HORIZONS"
!define MUI_ICON "app.ico"
!define MUI_UNICON "app.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "HORIZONS Arabic"
!define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\Horizons-Arabic.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro MUI_LANGUAGE "Turkish"
LangString WelcomeText ${LANG_ENGLISH} "Install the HORIZONS Arabic launcher to open the latest workbook in your default browser.$\r$\n$\r$\nSign in with your account. Save lessons inside the workbook for offline use.$\r$\n$\r$\nBrowser progress is preserved. An older standalone edition is not removed automatically."
LangString WelcomeText ${LANG_ARABIC} "ثبّت أيقونة HORIZONS لفتح أحدث نسخة من الكراسة في متصفحك.$\r$\n$\r$\nسجّل الدخول بحسابك. يمكنك حفظ الدروس داخل الكراسة لاستخدامها دون اتصال.$\r$\n$\r$\nيبقى تقدمك المحفوظ في المتصفح كما هو. لا تُحذف نسخة ويندوز القديمة تلقائيًا."
LangString WelcomeText ${LANG_TURKISH} "Çalışma kitabının en güncel sürümünü tarayıcınızda açmak için HORIZONS simgesini yükleyin.$\r$\n$\r$\nHesabınızla giriş yapın. Çevrimdışı kullanım için dersleri çalışma kitabından kaydedebilirsiniz.$\r$\n$\r$\nTarayıcıdaki ilerlemeniz korunur. Eski bağımsız Windows sürümü otomatik kaldırılmaz."
LangString MainLabel ${LANG_ENGLISH} "HORIZONS Arabic (required)"
LangString MainLabel ${LANG_ARABIC} "HORIZONS Arabic (مطلوب)"
LangString MainLabel ${LANG_TURKISH} "HORIZONS Arabic (gerekli)"
LangString DesktopLabel ${LANG_ENGLISH} "Desktop shortcut"
LangString DesktopLabel ${LANG_ARABIC} "اختصار على سطح المكتب"
LangString DesktopLabel ${LANG_TURKISH} "Masaüstü kısayolu"
Function .onInit
 ${IfNot} ${RunningX64}
 ${OrIfNot} ${AtLeastWin10}
  MessageBox MB_ICONSTOP "This installer requires 64-bit Windows 10 or later. You can use https://horizons-tr.com/learn/ in your browser."
  Abort
 ${EndIf}
 !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd
Section "$(MainLabel)" Main
 SectionIn RO
 SetShellVarContext current
 SetOutPath "$INSTDIR"
 File "Horizons-Arabic.exe"
 File "app.ico"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\HORIZONS Arabic"
 CreateShortcut "$SMPROGRAMS\HORIZONS Arabic\HORIZONS Arabic.lnk" "$INSTDIR\Horizons-Arabic.exe" "" "$INSTDIR\app.ico"
 CreateShortcut "$SMPROGRAMS\HORIZONS Arabic\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "Software\HORIZONS\ArabicWeb" "InstallDir" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "DisplayName" "HORIZONS Arabic"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "DisplayVersion" "1.5.0"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "Publisher" "HORIZONS"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "DisplayIcon" "$INSTDIR\Horizons-Arabic.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "URLInfoAbout" "https://horizons-tr.com/"
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb" "NoRepair" 1
SectionEnd
Section "$(DesktopLabel)" Desktop
 CreateShortcut "$DESKTOP\HORIZONS Arabic.lnk" "$INSTDIR\Horizons-Arabic.exe" "" "$INSTDIR\app.ico"
SectionEnd
Section "Uninstall"
 SetShellVarContext current
 Delete "$DESKTOP\HORIZONS Arabic.lnk"
 Delete "$SMPROGRAMS\HORIZONS Arabic\HORIZONS Arabic.lnk"
 Delete "$SMPROGRAMS\HORIZONS Arabic\Uninstall.lnk"
 RMDir "$SMPROGRAMS\HORIZONS Arabic"
 Delete "$INSTDIR\Horizons-Arabic.exe"
 Delete "$INSTDIR\app.ico"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "Software\HORIZONS\ArabicWeb"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HorizonsArabicWeb"
SectionEnd
