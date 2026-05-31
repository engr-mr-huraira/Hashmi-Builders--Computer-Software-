; --------------------------------------------------------------------
; Custom NSIS installer macros for Hashmi Real Estate Builders CRM
;
; Uninstaller is PIN-protected. Without the correct administrator PIN
; the uninstaller refuses to remove anything.
;
; The PIN check is implemented as a CUSTOM MUI UNPAGE (not in un.onInit)
; because nsDialogs::Create 1018 only works inside a proper MUI page
; callback - it returns "error" when invoked from un.onInit because no
; parent MUI dialog exists yet.
;
; PIN is baked into the uninstaller at build time. To change it, edit
; UNINSTALL_PIN below and rebuild the installer. Only installers built
; AFTER this change carry the protection.
; --------------------------------------------------------------------

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!macro preInit
  ; Default install location uses the electron-builder-derived
  ; ${PRODUCT_FILENAME}, which is the filesystem-safe version of
  ; productName from package.json ("Hashmi Real Estate Builders").
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES64\${PRODUCT_FILENAME}"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES64\${PRODUCT_FILENAME}"
  SetRegView 32
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES\${PRODUCT_FILENAME}"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES\${PRODUCT_FILENAME}"
!macroend

!macro customInstall
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\backups"
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\uploads"

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "Publisher" "Hashmi Real Estate Builders"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "HelpLink" "https://hashmibuilders.com/support"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "URLInfoAbout" "https://hashmibuilders.com"
!macroend

; --------------------------------------------------------------------
; UNINSTALLER-ONLY CODE BELOW
; electron-builder compiles NSIS in two passes; BUILD_UNINSTALLER is
; defined only during the uninstaller pass. Wrapping everything below
; in this guard avoids warnings 6001 (unused Var) and 6020 (un. code
; without WriteUninstaller) during the installer pass.
; --------------------------------------------------------------------
!ifdef BUILD_UNINSTALLER

!define UNINSTALL_PIN "Binnaseer@4300"
!define UNINSTALL_PIN_MAX_ATTEMPTS 3

Var UnPinDialog
Var UnPinInput
Var UnPinAttempts
Var UnPinValue

; ------------------------------------------------------------------
; customUnWelcomePage REPLACES the standard MUI un-welcome page with
; our PIN entry page. After a valid PIN is entered, the user proceeds
; to the standard confirm-uninstall / progress / finish pages.
; ------------------------------------------------------------------
!macro customUnWelcomePage
  UninstPage custom un.PinPageCreate un.PinPageLeave
!macroend

Function un.PinPageCreate
  !insertmacro MUI_HEADER_TEXT "Administrator PIN Required" "Authorise uninstall of Hashmi Real Estate Builders CRM"

  nsDialogs::Create 1018
  Pop $UnPinDialog
  ${If} $UnPinDialog == error
    ; Should not happen on a normal MUI page, but if it does, do NOT
    ; silently bypass the PIN. Force-abort the uninstaller for safety.
    MessageBox MB_ICONSTOP|MB_OK "The PIN entry control could not be created. Uninstall has been cancelled for safety. Please contact Hashmi Real Estate Builders support."
    Quit
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 36u "This application is protected by Hashmi Real Estate Builders.$\r$\nEnter the administrator PIN to authorise removal.$\r$\nContact your administrator if you do not have the PIN."

  ${NSD_CreateLabel} 0 44u 100% 10u "Administrator PIN:"

  ${NSD_CreatePassword} 0 56u 100% 14u ""
  Pop $UnPinInput
  ${NSD_SetFocus} $UnPinInput

  ${If} $UnPinAttempts > 0
    ${NSD_CreateLabel} 0 76u 100% 12u "Incorrect PIN. Attempts so far: $UnPinAttempts of ${UNINSTALL_PIN_MAX_ATTEMPTS}."
    Pop $0
    SetCtlColors $0 "C00000" "transparent"
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function un.PinPageLeave
  ${NSD_GetText} $UnPinInput $UnPinValue

  ${If} $UnPinValue == "${UNINSTALL_PIN}"
    ; Correct PIN - allow the page to be left so uninstall proceeds.
    Return
  ${EndIf}

  IntOp $UnPinAttempts $UnPinAttempts + 1
  ${If} $UnPinAttempts >= ${UNINSTALL_PIN_MAX_ATTEMPTS}
    MessageBox MB_ICONSTOP|MB_OK "Too many incorrect PIN attempts.$\r$\n$\r$\nUninstall has been cancelled. Contact Hashmi Real Estate Builders support if you need assistance."
    Quit
  ${EndIf}

  MessageBox MB_ICONEXCLAMATION|MB_OK "Incorrect administrator PIN.$\r$\n$\r$\nAttempt $UnPinAttempts of ${UNINSTALL_PIN_MAX_ATTEMPTS}. Please try again."
  ; Abort prevents the page from being left, keeping the user on the
  ; PIN entry page so they can retry.
  Abort
FunctionEnd

!endif ; BUILD_UNINSTALLER

!macro customUnInstall
  ; Keep user data by default; uncomment to remove on uninstall
  ; RMDir /r "$INSTDIR\data"
  ; RMDir /r "$INSTDIR\backups"
  ; RMDir /r "$INSTDIR\logs"
  ; RMDir /r "$INSTDIR\uploads"
!macroend
