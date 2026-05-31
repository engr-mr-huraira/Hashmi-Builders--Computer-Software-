; --------------------------------------------------------------------
; Hashmi Real Estate Builders CRM - Enhanced NSIS Installer Macros
;
; Security features:
;   1. Uninstaller password verification via Electron bcrypt hash check
;   2. Silent-mode protection (blocks silent uninstall without password)
;   3. Command-line protection (blocks WMIC/PowerShell silent uninstall)
;   4. Permission hardening during install (icacls)
;   5. Data preservation during uninstall
; --------------------------------------------------------------------

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ------------------------------------------------------------------
; INSTALLER-SIDE MACROS
; ------------------------------------------------------------------

!macro preInit
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

  ; Create shared ProgramData config directory for uninstall hash
  CreateDirectory "$APPDATA\HashmiBuilders"

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "Publisher" "Hashmi Real Estate Builders"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "HelpLink" "https://hashmibuilders.com/support"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "URLInfoAbout" "https://hashmibuilders.com"

  ; Harden permissions: remove inheritance, grant Users Read+Execute only,
  ; Administrators and SYSTEM full control.
  DetailPrint "Hardening install directory permissions..."
  nsExec::ExecToStack `icacls "$INSTDIR" /inheritance:r`
  nsExec::ExecToStack `icacls "$INSTDIR" /grant:r "Users:(RX)" /grant "Administrators:(F)" /grant "SYSTEM:(F)"`
!macroend

; --------------------------------------------------------------------
; UNINSTALLER-ONLY CODE BELOW
; --------------------------------------------------------------------
!ifdef BUILD_UNINSTALLER

!define UNINSTALL_PIN_MAX_ATTEMPTS 5

Var UnPinDialog
Var UnPinInput
Var UnPinAttempts
Var UnPinValue
Var UnPinVerifyResult

; ------------------------------------------------------------------
; un.onInit runs BEFORE any pages. We use it to block silent/clean
; command-line uninstalls (WMIC, PowerShell, msiexec /x, etc.).
; ------------------------------------------------------------------
Function un.onInit
  ; If running silently (e.g. WMIC, PowerShell Get-Package), block it.
  ; The only way to silent-uninstall is with the /PASSWORD= flag which
  ; we verify via the Electron app.
  ${If} ${SilentInstall}
    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/PASSWORD=" $R1
    ${If} ${Errors}
      MessageBox MB_ICONSTOP|MB_OK "Silent uninstall is not permitted. Use the uninstall shortcut or Control Panel to authenticate."
      Abort
    ${EndIf}
    ; Validate the password via Electron CLI
    nsExec::ExecToStack `"$INSTDIR\${PRODUCT_FILENAME}.exe" --verify-uninstall-password "$R1"`
    Pop $R2
    ${If} $R2 != "0"
      MessageBox MB_ICONSTOP|MB_OK "Incorrect uninstall password. Silent uninstall aborted."
      Abort
    ${EndIf}
  ${EndIf}
FunctionEnd

; ------------------------------------------------------------------
; customUnWelcomePage replaces the standard welcome page with a
; password entry dialog. The password is verified against a bcrypt
; hash by calling the Electron executable.
; ------------------------------------------------------------------
!macro customUnWelcomePage
  UninstPage custom un.PinPageCreate un.PinPageLeave
!macroend

Function un.PinPageCreate
  !insertmacro MUI_HEADER_TEXT "Administrator Password Required" "Authorise uninstall of Hashmi Real Estate Builders CRM"

  nsDialogs::Create 1018
  Pop $UnPinDialog
  ${If} $UnPinDialog == error
    MessageBox MB_ICONSTOP|MB_OK "The password entry control could not be created. Uninstall has been cancelled for safety. Please contact Hashmi Real Estate Builders support."
    Quit
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 40u "This application is protected by Hashmi Real Estate Builders.$\r$\nEnter the administrator uninstall password to authorise removal.$\r$\nContact your administrator if you do not have the password."

  ${NSD_CreateLabel} 0 48u 100% 10u "Administrator Password:"

  ${NSD_CreatePassword} 0 60u 100% 14u ""
  Pop $UnPinInput
  ${NSD_SetFocus} $UnPinInput

  ${If} $UnPinAttempts > 0
    ${NSD_CreateLabel} 0 80u 100% 12u "Incorrect password. Attempts so far: $UnPinAttempts of ${UNINSTALL_PIN_MAX_ATTEMPTS}."
    Pop $0
    SetCtlColors $0 "C00000" "transparent"
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function un.PinPageLeave
  ${NSD_GetText} $UnPinInput $UnPinValue

  ; Verify password by calling the Electron app with the CLI flag.
  ; The Electron main process uses bcrypt to compare against the stored hash.
  nsExec::ExecToStack `"$INSTDIR\${PRODUCT_FILENAME}.exe" --verify-uninstall-password "$UnPinValue"`
  Pop $UnPinVerifyResult

  ${If} $UnPinVerifyResult == "0"
    ; Correct password - allow uninstall to proceed.
    Return
  ${EndIf}

  IntOp $UnPinAttempts $UnPinAttempts + 1
  ${If} $UnPinAttempts >= ${UNINSTALL_PIN_MAX_ATTEMPTS}
    MessageBox MB_ICONSTOP|MB_OK "Too many incorrect password attempts.$\r$\n$\r$\nUninstall has been cancelled. Contact Hashmi Real Estate Builders support if you need assistance."
    Quit
  ${EndIf}

  MessageBox MB_ICONEXCLAMATION|MB_OK "Incorrect administrator password.$\r$\n$\r$\nAttempt $UnPinAttempts of ${UNINSTALL_PIN_MAX_ATTEMPTS}. Please try again."
  Abort
FunctionEnd

!endif ; BUILD_UNINSTALLER

; ------------------------------------------------------------------
; customUnInstall runs at the end of uninstall. Preserve user data
; by copying it to the user's profile before the final cleanup.
; ------------------------------------------------------------------
!macro customUnInstall
  ${If} ${FileExists} "$INSTDIR\data\*.*"
    CreateDirectory "$PROFILE\HashmiBuilders_Preserved"
    CopyFiles /SILENT "$INSTDIR\data\*.*" "$PROFILE\HashmiBuilders_Preserved\data\"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\backups\*.*"
    CreateDirectory "$PROFILE\HashmiBuilders_Preserved"
    CopyFiles /SILENT "$INSTDIR\backups\*.*" "$PROFILE\HashmiBuilders_Preserved\backups\"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\uploads\*.*"
    CreateDirectory "$PROFILE\HashmiBuilders_Preserved"
    CopyFiles /SILENT "$INSTDIR\uploads\*.*" "$PROFILE\HashmiBuilders_Preserved\uploads\"
  ${EndIf}
!macroend
