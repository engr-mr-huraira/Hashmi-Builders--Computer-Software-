/**
 * Hashmi Real Estate Builders - Electron Main Process (Production)
 *
 * - Splash + first-run setup wizard with branded logo
 * - DB auto-create + admin password seed/repair
 * - Embedded backend, frontend via file://
 * - Tray, single-instance lock, auto-updater, logging
 * - App-launch lock: every time the window is hidden (or "Lock now" is
 *   selected from the tray menu), the renderer is sent an "app:lock" IPC
 *   so it returns to the LockScreen on next show.
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const Store = require('electron-store')
const { Client } = require('pg')
const bcrypt = require('bcryptjs')

let autoUpdater = null
try { autoUpdater = require('electron-updater').autoUpdater } catch (_) { /* optional */ }

const isDev = !app.isPackaged && process.env.NODE_ENV === 'development'

// Paths --------------------------------------------------------------------
const APP_DATA_DIR = path.join(app.getPath('userData'))
const LOGS_DIR = path.join(APP_DATA_DIR, 'logs')
const BACKUPS_DIR = path.join(APP_DATA_DIR, 'backups')
const UPLOADS_DIR = path.join(APP_DATA_DIR, 'uploads')
const LOG_FILE = path.join(LOGS_DIR, 'app.log')
const CRASH_FILE = path.join(LOGS_DIR, 'crash.log')

for (const dir of [APP_DATA_DIR, LOGS_DIR, BACKUPS_DIR, UPLOADS_DIR]) {
  try { fs.mkdirSync(dir, { recursive: true }) } catch (_) {}
}

function resolveResource(...segments) {
  if (app.isPackaged) return path.join(process.resourcesPath, 'app.asar.unpacked', ...segments)
  return path.join(__dirname, '..', '..', ...segments)
}

const BACKEND_ENTRY = resolveResource('backend', 'dist', 'server.js')
const FRONTEND_INDEX = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'frontend', 'dist', 'index.html')
  : path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html')
const SCHEMA_SQL_PATH = resolveResource('backend', 'database', 'schema.sql')

const store = new Store({ name: 'realestate-crm-config' })

// Logging ------------------------------------------------------------------
function logToFile(line, file = LOG_FILE) {
  try { fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`) } catch (_) {}
}
function logInfo(msg)  { logToFile(`INFO  ${msg}`) }
function logWarn(msg)  { logToFile(`WARN  ${msg}`) }
function logError(msg) { logToFile(`ERROR ${msg}`) }

// Security logging -------------------------------------------------------
const SECURITY_LOG_FILE = path.join(APP_DATA_DIR, 'security.log')
function securityLog(event, details = {}) {
  try {
    const entry = `[${new Date().toISOString()}] SEC ${event} | ${JSON.stringify(details)}\n`
    fs.appendFileSync(SECURITY_LOG_FILE, entry)
  } catch (_) {}
}

// Uninstall password helpers -----------------------------------------------
const PROGRAM_DATA_DIR = process.env.ALLUSERSPROFILE || path.join(process.env.ProgramData || 'C:\\ProgramData')
const SHARED_CONFIG_DIR = path.join(PROGRAM_DATA_DIR, 'HashmiBuilders')
const UNINSTALL_HASH_FILE = path.join(SHARED_CONFIG_DIR, 'uninstall-hash.json')

function getBundledUninstallHash() {
  try {
    const bundled = path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'resources', 'uninstall-hash.json')
    if (fs.existsSync(bundled)) return JSON.parse(fs.readFileSync(bundled, 'utf8'))
  } catch (_) {}
  return null
}

function getActiveUninstallHash() {
  try {
    if (fs.existsSync(UNINSTALL_HASH_FILE)) return JSON.parse(fs.readFileSync(UNINSTALL_HASH_FILE, 'utf8'))
  } catch (_) {}
  return getBundledUninstallHash()
}

function verifyUninstallPassword(inputPassword) {
  const record = getActiveUninstallHash()
  if (!record || !record.hash) return false
  return bcrypt.compareSync(inputPassword, record.hash)
}

// Tamper detection ---------------------------------------------------------
function verifyInstallation() {
  if (!app.isPackaged) return
  const checks = [
    { path: BACKEND_ENTRY, name: 'backend server' },
    { path: FRONTEND_INDEX, name: 'frontend index' },
    { path: path.join(__dirname, '..', 'preload', 'preload.js'), name: 'preload script' },
  ]
  let tampered = false
  for (const check of checks) {
    if (!fs.existsSync(check.path)) {
      tampered = true
      securityLog('TAMPER_MISSING_FILE', { file: check.name, path: check.path })
      logError(`Tamper: missing ${check.name} at ${check.path}`)
    }
  }
  if (tampered) {
    try {
      dialog.showErrorBox(
        'Application Integrity Check Failed',
        'One or more required application files are missing. This may indicate tampering or an incomplete installation.\n\nPlease reinstall the application.'
      )
    } catch (_) {}
  }
}

// Permission hardening (Windows ACLs) --------------------------------------
function hardenPermissions() {
  if (!app.isPackaged || process.platform !== 'win32') return
  try {
    const { execSync } = require('child_process')
    const installDir = path.dirname(process.execPath)
    // Remove inherited permissions and set strict ACLs
    execSync(`icacls "${installDir}" /inheritance:r`, { windowsHide: true, timeout: 10000 })
    execSync(`icacls "${installDir}" /grant:r "Users:(RX)" /grant "Administrators:(F)" /grant "SYSTEM:(F)"`, { windowsHide: true, timeout: 10000 })
    logInfo('Permissions hardened on install directory')
    securityLog('PERMISSIONS_HARDENED', { dir: installDir })
  } catch (e) {
    logWarn(`Permission hardening skipped: ${e.message}`)
  }
}

process.on('uncaughtException', (err) => { logToFile(`UNCAUGHT ${err.stack || err.message}`, CRASH_FILE); logError(`uncaughtException: ${err.message}`) })
process.on('unhandledRejection', (err) => { logToFile(`UNHANDLED ${(err && err.stack) || err}`, CRASH_FILE); logError(`unhandledRejection: ${err}`) })

// Globals ------------------------------------------------------------------
let splashWindow = null
let setupWindow = null
let mainWindow = null
let tray = null
let backendProcess = null
let backendRestartCount = 0
let backendPort = 5000
let mainWindowReady = false

// Windows ------------------------------------------------------------------
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480, height: 320, frame: false, alwaysOnTop: true,
    resizable: false, show: false, skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
  splashWindow.once('ready-to-show', () => splashWindow.show())
}
function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.close() } catch (_) {}
  }
  splashWindow = null
}

function createSetupWindow() {
  return new Promise((resolve) => {
    setupWindow = new BrowserWindow({
      width: 800, height: 620, resizable: false, minimizable: false,
      maximizable: false, title: 'Hashmi Real Estate Builders - Setup', autoHideMenuBar: true,
      icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true, nodeIntegration: false,
      },
    })
    setupWindow.removeMenu()
    setupWindow.loadFile(path.join(__dirname, 'setup.html'))
    closeSplash()

    ipcMain.once('setup:complete', (_, cfg) => {
      store.set('dbConfig', cfg)
      store.set('setupCompleted', true)
      logInfo('Setup wizard completed')
      if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close()
      resolve(cfg)
    })

    setupWindow.on('closed', () => {
      setupWindow = null
      if (!store.get('setupCompleted')) { logWarn('Setup window closed before completion - quitting'); app.quit() }
    })
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 700,
    show: false, title: 'Hashmi Real Estate Builders',
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
    autoHideMenuBar: true, backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      devTools: isDev, webSecurity: true,
    },
  })

  if (!isDev) mainWindow.removeMenu()

  logInfo(`Loading frontend: ${FRONTEND_INDEX}`)
  if (!fs.existsSync(FRONTEND_INDEX)) {
    logError(`Frontend index.html not found at ${FRONTEND_INDEX}`)
    dialog.showErrorBox('Frontend Missing', `The application UI bundle could not be found:\n\n${FRONTEND_INDEX}\n\nPlease reinstall the application.`)
    app.quit(); return
  }

  mainWindow.loadFile(FRONTEND_INDEX).catch((err) => logError(`loadFile failed: ${err.message}`))

  mainWindow.once('ready-to-show', () => {
    mainWindowReady = true
    closeSplash()
    mainWindow.show()
    mainWindow.focus()
    setTimeout(checkForUpdatesSilently, 4000)
  })

  setTimeout(() => {
    if (!mainWindowReady && mainWindow && !mainWindow.isDestroyed()) {
      logError('Renderer did not become ready within 20s')
      mainWindow.show()
    }
  }, 20000)

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    logError(`Renderer gone: ${details.reason}`)
    if (details.reason !== 'clean-exit') {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'error', title: 'Application Crashed',
        message: 'The application window crashed.',
        detail: `Reason: ${details.reason}\n\nWould you like to reload?`,
        buttons: ['Reload', 'Open Logs', 'Quit'], defaultId: 0,
      })
      if (choice === 0) mainWindow.reload()
      else if (choice === 1) shell.openPath(LOG_FILE)
      else { app.isQuiting = true; app.quit() }
    }
  })

  mainWindow.on('unresponsive', () => logWarn('Window became unresponsive'))
  mainWindow.on('responsive', () => logInfo('Window became responsive again'))
  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => logError(`did-fail-load: ${code} ${desc} ${url}`))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) { event.preventDefault(); shell.openExternal(url) }
  })

  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const blocked = (input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12'
      if (blocked) event.preventDefault()
    })
  }

  // App-launch lock: hide-to-tray closes the visual window. We tell the
  // renderer to re-lock so the next time it is shown, the LockScreen is
  // displayed and the system password is required again.
  mainWindow.on('hide', () => {
    try { mainWindow.webContents.send('app:lock') } catch (_) {}
    logInfo('Window hidden - sent app:lock to renderer')
  })

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); mainWindow.hide() }
  })
}

function lockNow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send('app:lock') } catch (_) {}
    logInfo('Manual lock triggered')
  }
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'resources', 'icon.ico')
    const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('Hashmi Real Estate Builders')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Hashmi Real Estate Builders', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
      { label: 'Lock Now', click: lockNow },
      { label: 'Check for Updates...', click: () => triggerUpdateCheck(true) },
      { label: 'Sync Now', click: () => mainWindow && mainWindow.webContents.send('sync:trigger') },
      { type: 'separator' },
      {
        label: 'Start with Windows', type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: 'Open Logs', click: () => shell.openPath(LOG_FILE) },
      { label: 'Quit', click: () => { app.isQuiting = true; app.quit() } },
    ]))
    tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
  } catch (err) { logError(`Tray init failed: ${err.message}`) }
}

// Database -----------------------------------------------------------------
async function ensureDatabase(cfg) {
  const adminClient = new Client({ host: cfg.host, port: parseInt(cfg.port, 10), user: cfg.user, password: cfg.password, database: 'postgres' })
  await adminClient.connect()
  const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [cfg.database])
  if (exists.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${cfg.database.replace(/"/g, '""')}"`)
    logInfo(`Database "${cfg.database}" created`)
  }
  await adminClient.end()

  const appClient = new Client({ host: cfg.host, port: parseInt(cfg.port, 10), user: cfg.user, password: cfg.password, database: cfg.database })
  await appClient.connect()
  if (fs.existsSync(SCHEMA_SQL_PATH)) {
    const sql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8')
    try { await appClient.query(sql) } catch (e) { logWarn(`Schema execution: ${e.message}`) }
  } else { logWarn(`Schema file not found at ${SCHEMA_SQL_PATH}`) }

  // Idempotent admin seed/repair
  try {
    // Force-reset the admin password on every boot to the configured value.
    // This makes the admin login predictable for the operator and recovers
    // automatically if the row is missing or corrupted.
    const adminPassword = 'Bin@naseer$4300'
    const hash = await bcrypt.hash(adminPassword, 10)
    await appClient.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
       VALUES ('admin', 'admin@hashmibuilders.com', $1, 'System Administrator', 1, true)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             is_active = true`,
      [hash],
    )
    logInfo('Admin user verified / reset to configured password')
  } catch (e) { logWarn(`Admin seed: ${e.message}`) }

  await appClient.end()
}

// Backend ------------------------------------------------------------------
function startBackend(cfg) {
  if (!fs.existsSync(BACKEND_ENTRY)) throw new Error(`Backend bundle missing: ${BACKEND_ENTRY}. Reinstall the application.`)

  const unpackedNodeModules = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    : path.join(__dirname, '..', '..', 'node_modules')
  const asarNodeModules = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'node_modules')
    : path.join(__dirname, '..', '..', 'node_modules')
  const extraNodePath = [unpackedNodeModules, asarNodeModules]
    .filter((p) => { try { return fs.existsSync(p) } catch (_) { return false } })
    .join(path.delimiter)

  const env = {
    ...process.env, NODE_ENV: 'production', PORT: String(backendPort),
    DB_HOST: cfg.host, DB_PORT: String(cfg.port), DB_NAME: cfg.database,
    DB_USER: cfg.user, DB_PASSWORD: cfg.password,
    JWT_SECRET: store.get('jwtSecret') || generateAndStoreSecret(),
    JWT_EXPIRE: '7d',
    UPLOAD_PATH: UPLOADS_DIR, BACKUP_PATH: BACKUPS_DIR,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_PATH: extraNodePath,
  }
  logInfo(`Backend NODE_PATH=${extraNodePath}`)
  backendProcess = spawn(process.execPath, [BACKEND_ENTRY], {
    env, cwd: path.dirname(BACKEND_ENTRY), stdio: ['ignore', 'pipe', 'pipe'],
  })
  backendProcess.stdout.on('data', (d) => logToFile(`[backend] ${d.toString().trim()}`))
  backendProcess.stderr.on('data', (d) => logToFile(`[backend:err] ${d.toString().trim()}`))
  backendProcess.on('exit', (code) => {
    logWarn(`Backend exited with code ${code}`)
    if (!app.isQuiting && code !== 0) {
      backendRestartCount += 1
      if (backendRestartCount <= 3) {
        logInfo(`Restarting backend (attempt ${backendRestartCount})`)
        setTimeout(() => startBackend(cfg), 1000 * backendRestartCount)
      }
    }
  })
  logInfo(`Backend spawned (pid ${backendProcess.pid}) on port ${backendPort}`)
}
function generateAndStoreSecret() {
  const secret = require('crypto').randomBytes(48).toString('hex')
  store.set('jwtSecret', secret)
  return secret
}
async function waitForBackend(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(`http://127.0.0.1:${backendPort}/api/health`); if (res.ok) return true } catch (_) {}
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

// ============================================================================
// AUTO-UPDATER (GitHub Releases)
// ============================================================================
//
// VERSION MANAGEMENT RULES
// ------------------------
// 1. Every release MUST increase the version number in package.json.
//    Valid sequences: 1.0.0 -> 1.0.1 -> 1.0.2 -> 1.1.0 -> 1.1.1 -> 2.0.0
// 2. The version in package.json is the SINGLE SOURCE OF TRUTH.
// 3. GitHub Releases tag MUST match the package.json version prefixed with 'v'.
//    Example: package.json = 1.0.2  ->  GitHub Tag = v1.0.2
// 4. If the version is NOT increased, installed clients will NOT detect an update.
//    electron-updater compares semver; equal or lower versions are ignored.
//
// RELEASE PROCESS (Step-by-Step)
// -------------------------------
// Step 1: Bump version in package.json (e.g., 1.0.0 -> 1.0.1)
// Step 2: Run  npm run build:exe  (validates version, builds, packages NSIS)
// Step 3: GitHub Release: create a new release with tag matching version
//         Example tag: v1.0.1
// Step 4: Upload to that GitHub Release:
//         - Hashmi Real Estate Builders-1.0.1-Setup.exe
//         - latest.yml
//         - *.exe.blockmap
// Step 5: Publish the GitHub Release
// Step 6: Installed clients click "Check for Updates"
// Step 7: App auto-downloads the new version in background
// Step 8: User clicks "Restart and Install" -> app quits and new version starts
//
// UPDATE PROVIDER CONFIGURATION
// -----------------------------
// The update feed is configured in package.json under "build.publish".
// Provider: "github"
// electron-updater reads this automatically from the bundled app metadata.
// No manual setFeedURL() is required for GitHub provider.
//
// OFFLINE-FIRST PRINCIPLE
// -----------------------
// Internet is ONLY required for update checking and downloading.
// All business logic, database, and file storage work 100% offline.
//
// ============================================================================

function broadcastUpdate(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:event', payload)
}

let pendingUpdateInfo = null
let updatePhase = 'idle' // idle | checking | available | downloading | downloaded | installing | error

function maybeAnnouncePostUpdate() {
  try {
    const flag = store.get('updateInProgress')
    if (!flag) return
    const currentVersion = app.getVersion()
    if (flag.fromVersion && flag.fromVersion !== currentVersion) {
      logInfo(`Post-update detected: ${flag.fromVersion} -> ${currentVersion}`)
      const announce = () => broadcastUpdate({
        type: 'installed',
        fromVersion: flag.fromVersion,
        toVersion: currentVersion,
      })
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', () => setTimeout(announce, 1500))
        } else {
          setTimeout(announce, 1500)
        }
      }
    }
    store.delete('updateInProgress')
  } catch (e) { logWarn(`Post-update announce failed: ${e.message}`) }
}

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = { info: logInfo, warn: logWarn, error: logError, debug: () => {} }

  // GitHub provider is auto-configured from package.json build.publish.
  // Do NOT call setFeedURL() for GitHub provider — electron-updater
  // resolves the feed automatically from the bundled app metadata.
  logInfo(`Auto-updater initialized (GitHub provider). Current version: ${app.getVersion()}`)

  autoUpdater.on('checking-for-update', () => {
    updatePhase = 'checking'
    logInfo('[updater] Phase: checking-for-update')
    broadcastUpdate({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    updatePhase = 'available'
    logInfo(`[updater] Phase: update-available | version=${info?.version || '?'} | date=${info?.releaseDate || '?'}`)
    broadcastUpdate({ type: 'available', info })
  })

  autoUpdater.on('update-not-available', (info) => {
    updatePhase = 'idle'
    logInfo(`[updater] Phase: update-not-available | current=${app.getVersion()}`)
    broadcastUpdate({ type: 'not-available', info })
  })

  autoUpdater.on('download-progress', (p) => {
    updatePhase = 'downloading'
    const percent = Math.round(p.percent || 0)
    if (percent % 10 === 0) {
      logInfo(`[updater] Phase: download-progress | ${percent}% | transferred=${p.transferred} / total=${p.total}`)
    }
    broadcastUpdate({ type: 'progress', percent, transferred: p.transferred, total: p.total })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updatePhase = 'downloaded'
    pendingUpdateInfo = info
    // Log downloaded file details for debugging installation failures
    try {
      const dlCache = autoUpdater.downloadedUpdateHelper && autoUpdater.downloadedUpdateHelper.cacheDir
      logInfo(`[updater] Phase: update-downloaded | version=${info?.version || '?'} | cacheDir=${dlCache || 'unknown'}`)
    } catch (_) {
      logInfo(`[updater] Phase: update-downloaded | version=${info?.version || '?'}`)
    }
    broadcastUpdate({ type: 'downloaded', info })
  })

  autoUpdater.on('error', (err) => {
    const phaseAtError = updatePhase
    updatePhase = 'error'

    // Build a comprehensive diagnostic payload
    const diagnostic = {
      phase: phaseAtError,
      message: err?.message || '',
      stack: err?.stack || '',
      code: err?.code || '',
      statusCode: err?.statusCode || '',
      cause: err?.cause?.message || '',
    }
    const fullError = [
      diagnostic.message,
      diagnostic.stack,
      diagnostic.cause,
      diagnostic.code,
      diagnostic.statusCode,
    ].filter(Boolean).join(' ')

    // Translate ONLY for known network errors. For everything else, preserve
    // the original error so we can see the real root cause (installer spawn,
    // checksum, permissions, etc.).
    let userMessage = diagnostic.message || 'Update failed'
    const raw = fullError.toLowerCase()

    if (raw.includes('err_name_not_resolved') || raw.includes('enotfound') || raw.includes('getaddrinfo')) {
      userMessage = 'Cannot reach GitHub. Please check your internet connection or try Manual Update.'
    } else if (raw.includes('err_internet_disconnected') || raw.includes('econnrefused') || raw.includes('etimedout') || raw.includes('ehostunreach')) {
      userMessage = 'No internet connection. The application works fully offline. Connect to the internet to check for updates.'
    } else if (raw.includes('err_cert')) {
      userMessage = 'SSL certificate error when connecting to GitHub. Please contact your administrator.'
    } else if (raw.includes('404') || raw.includes('not found')) {
      userMessage = 'No update release found on GitHub. Make sure the release tag matches the version (e.g., v1.0.1).'
    } else if (raw.includes('403') || raw.includes('rate limit')) {
      userMessage = 'GitHub API rate limit exceeded. Please try again later or use Manual Update.'
    } else if (raw.includes('401') || raw.includes('unauthorized')) {
      userMessage = 'Authentication failed with GitHub. The repository may be private or your token may be invalid.'
    } else if (raw.includes('check update first')) {
      userMessage = 'Please click "Check for Updates" first before downloading.'
    } else if (raw.includes('sha') || raw.includes('checksum') || raw.includes('hash')) {
      userMessage = 'Update file integrity check failed. The downloaded file may be corrupted. Please try again or use Manual Update.'
    }
    // NOTE: removed the overly broad `raw.includes('err_')` fallback that was
    // hiding real installation errors behind "GitHub connection failed".

    logError(`[updater] ERROR in phase "${phaseAtError}" | userMessage="${userMessage}" | diagnostic=${JSON.stringify(diagnostic)}`)
    broadcastUpdate({ type: 'error', message: userMessage, raw: diagnostic.message, phase: phaseAtError })
  })
}

function checkForUpdatesSilently() {
  try { if (autoUpdater && app.isPackaged) autoUpdater.checkForUpdates().catch((e) => logWarn(`Silent update check: ${e.message}`)) } catch (_) {}
}

function triggerUpdateCheck(showDialog = false) {
  if (!autoUpdater || !app.isPackaged) {
    if (showDialog) dialog.showMessageBox({ type: 'info', title: 'Updates', message: 'Update checking is only available in installed builds.' })
    return
  }
  autoUpdater.checkForUpdates().catch((e) => logError(`Update check: ${e.message}`))
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

ipcMain.handle('config:get', (_, key) => store.get(key))
ipcMain.handle('config:set', (_, key, value) => store.set(key, value))
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:backendPort', () => backendPort)
ipcMain.handle('app:paths', () => ({ data: APP_DATA_DIR, logs: LOGS_DIR, backups: BACKUPS_DIR, uploads: UPLOADS_DIR }))
ipcMain.handle('app:quit', () => { app.isQuiting = true; app.quit() })

ipcMain.handle('db:test', async (_, cfg) => {
  try {
    const c = new Client({ host: cfg.host, port: parseInt(cfg.port, 10), user: cfg.user, password: cfg.password, database: 'postgres' })
    await c.connect(); await c.end()
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('autostart:get', () => app.getLoginItemSettings().openAtLogin)
ipcMain.handle('autostart:set', (_, enabled) => { app.setLoginItemSettings({ openAtLogin: !!enabled }); return true })

ipcMain.handle('logs:open', () => shell.openPath(LOG_FILE))
ipcMain.on('crash:report', (_, payload) => logToFile(`RENDERER ${JSON.stringify(payload)}`, CRASH_FILE))

// --- Update IPC handlers ----------------------------------------------------

// Check for updates on GitHub Releases.
// If the current package.json version is already the latest published
// version, electron-updater returns "update-not-available".
// If the GitHub release tag does not match (e.g., v1.0.1 vs 1.0.1),
// the updater will 404 and report "No update release found".
ipcMain.handle('updates:check', async () => {
  try {
    if (!autoUpdater || !app.isPackaged) return { error: 'Updates only available in installed builds.' }
    const r = await autoUpdater.checkForUpdates()
    return { ok: true, version: r && r.updateInfo && r.updateInfo.version }
  } catch (e) {
    const fullError = [
      e && e.message,
      e && e.stack,
      e && e.cause && e.cause.message,
      typeof e === 'string' ? e : null,
      e && e.code,
      e && e.statusCode,
    ].filter(Boolean).join(' ')

    let message = e.message || 'Update check failed'
    const raw = fullError.toLowerCase()
    if (raw.includes('err_name_not_resolved') || raw.includes('enotfound') || raw.includes('getaddrinfo')) {
      message = 'Cannot reach GitHub. Please check your internet connection or try Manual Update.'
    } else if (raw.includes('err_internet_disconnected') || raw.includes('econnrefused') || raw.includes('etimedout') || raw.includes('ehostunreach')) {
      message = 'No internet connection. The application works fully offline. Connect to the internet to check for updates.'
    } else if (raw.includes('err_cert')) {
      message = 'SSL certificate error when connecting to GitHub. Please contact your administrator.'
    } else if (raw.includes('404') || raw.includes('not found')) {
      message = 'No update release found on GitHub. Make sure the release tag matches the version (e.g., v1.0.1).'
    } else if (raw.includes('403') || raw.includes('rate limit')) {
      message = 'GitHub API rate limit exceeded. Please try again later or use Manual Update.'
    } else if (raw.includes('401') || raw.includes('unauthorized')) {
      message = 'Authentication failed with GitHub. The repository may be private or your token may be invalid.'
    }
    return { error: message }
  }
})

// Download the update that was discovered by checkForUpdates().
// This must be called AFTER the autoUpdater has emitted 'update-available'.
// The UI enforces this by only showing the Download button after
// the 'available' event is received.
ipcMain.handle('updates:download', async () => {
  try {
    if (!autoUpdater) return { error: 'Updater unavailable' }
    logInfo('[updater] Starting downloadUpdate()')
    updatePhase = 'downloading'
    await autoUpdater.downloadUpdate()
    logInfo('[updater] downloadUpdate() completed successfully')
    return { ok: true }
  } catch (e) {
    const diag = { message: e?.message, code: e?.code, stack: e?.stack }
    logError(`[updater] downloadUpdate failed: ${JSON.stringify(diag)}`)
    return { error: (e && e.message) || 'Download failed. Please try again or use Manual Update.' }
  }
})

// Quit the app and install the downloaded update.
// This triggers the NSIS install flow.
ipcMain.handle('updates:install', async () => {
  try {
    if (!autoUpdater) return { error: 'Updater unavailable' }
    const targetVersion = (pendingUpdateInfo && pendingUpdateInfo.version) || null
    if (!targetVersion) {
      logWarn('[updater] install called but no pendingUpdateInfo')
      return { error: 'No downloaded update available. Please download first.' }
    }

    // Verify the downloaded file exists before trying to install
    let downloadedFilePath = null
    try {
      const dlCache = autoUpdater.downloadedUpdateHelper && autoUpdater.downloadedUpdateHelper.cacheDir
      if (dlCache && fs.existsSync(dlCache)) {
        const files = fs.readdirSync(dlCache)
        logInfo(`[updater] Cache dir contents before install: ${JSON.stringify(files)}`)
        const exeFile = files.find((f) => f.endsWith('.exe'))
        if (exeFile) downloadedFilePath = path.join(dlCache, exeFile)
      }
    } catch (cacheErr) {
      logWarn(`[updater] Could not inspect cache dir: ${cacheErr.message}`)
    }
    if (downloadedFilePath) {
      logInfo(`[updater] Downloaded installer verified: ${downloadedFilePath}`)
    } else {
      logWarn('[updater] Could not verify downloaded installer file path')
    }

    store.set('updateInProgress', {
      fromVersion: app.getVersion(),
      toVersion: targetVersion,
      at: new Date().toISOString(),
    })
    logInfo(`[updater] Quit-and-install requested: ${app.getVersion()} -> ${targetVersion}`)

    // Close the main window cleanly before quitting to avoid race conditions
    // where the renderer prevents close or the backend stays alive.
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.removeAllListeners('close')
        mainWindow.close()
        logInfo('[updater] Main window closed in preparation for install')
      } catch (winErr) {
        logWarn(`[updater] Could not close mainWindow: ${winErr.message}`)
      }
    }

    // Kill backend process so it doesn't block the installer
    if (backendProcess) {
      try {
        backendProcess.kill()
        logInfo('[updater] Backend process killed before install')
      } catch (beErr) {
        logWarn(`[updater] Could not kill backend: ${beErr.message}`)
      }
    }

    app.isQuiting = true
    updatePhase = 'installing'

    // Give the window/backend a brief moment to tear down before triggering quitAndInstall.
    // This helps avoid "file in use" errors during NSIS replace on Windows.
    await new Promise((resolve) => setTimeout(resolve, 500))

    logInfo('[updater] Calling autoUpdater.quitAndInstall(false, true)')
    autoUpdater.quitAndInstall(false, true)
    return { ok: true }
  } catch (e) {
    const diag = { message: e?.message, code: e?.code, stack: e?.stack }
    logError(`[updater] quitAndInstall failed: ${JSON.stringify(diag)}`)
    return { error: e.message || 'Installation failed. Please use Manual Update.' }
  }
})

// Manual update fallback: let the user select an installer file and run it.
// This bypasses GitHub entirely and is the offline/air-gapped update path.
ipcMain.handle('updates:manual', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { error: 'Window not available' }
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Update Installer',
      filters: [
        { name: 'Windows Installer', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }
    const installerPath = result.filePaths[0]
    logInfo(`Manual update selected: ${installerPath}`)
    return { ok: true, path: installerPath }
  } catch (e) { return { error: e.message } }
})

// Run the selected manual installer and quit the app.
ipcMain.handle('updates:run-manual', async (_, installerPath) => {
  try {
    logInfo(`Launching manual installer: ${installerPath}`)
    shell.openPath(installerPath)
    return { ok: true }
  } catch (e) { return { error: e.message } }
})

// Deprecated: these were used for the old generic update server.
// They are kept for backward compatibility but do nothing since
// GitHub provider is configured statically via package.json.
ipcMain.handle('updates:configure', async (_, url) => {
  logWarn(`updates:configure called with "${url}" but GitHub provider is statically configured in package.json. Ignored.`)
  return { ok: true, note: 'GitHub provider is configured in package.json. This call is ignored.' }
})
ipcMain.handle('updates:get-config', async () => {
  return { url: 'github', note: 'GitHub provider is configured in package.json build.publish' }
})

// --- Security IPC handlers ------------------------------------------------

ipcMain.handle('security:change-uninstall-password', async (_, currentPassword, newPassword) => {
  try {
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      return { error: 'Password must be at least 4 characters.' }
    }
    if (!verifyUninstallPassword(currentPassword)) {
      securityLog('PASSWORD_CHANGE_FAIL', { reason: 'incorrect_current' })
      return { error: 'Current password is incorrect.' }
    }
    const hash = bcrypt.hashSync(newPassword, 10)
    if (!fs.existsSync(SHARED_CONFIG_DIR)) {
      fs.mkdirSync(SHARED_CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(UNINSTALL_HASH_FILE, JSON.stringify({ hash, updatedAt: new Date().toISOString(), version: 1 }, null, 2), 'utf8')
    securityLog('PASSWORD_CHANGE_SUCCESS', {})
    return { ok: true }
  } catch (e) {
    securityLog('PASSWORD_CHANGE_ERROR', { message: e.message })
    return { error: e.message }
  }
})

ipcMain.handle('security:get-logs', async () => {
  try {
    if (!fs.existsSync(SECURITY_LOG_FILE)) return { logs: [] }
    const raw = fs.readFileSync(SECURITY_LOG_FILE, 'utf8')
    const lines = raw.split('\n').filter(Boolean).reverse().slice(0, 500)
    return { logs: lines }
  } catch (e) {
    return { error: e.message }
  }
})

ipcMain.handle('security:open-logs', () => {
  try { shell.openPath(SECURITY_LOG_FILE) } catch (_) {}
})

// Uninstall password CLI verification --------------------------------------
// This runs BEFORE app.requestSingleInstanceLock() so that a second
// instance launched by the NSIS uninstaller can verify the password even
// when the app is already running.
const uninstallPwdIdx = process.argv.indexOf('--verify-uninstall-password')
if (uninstallPwdIdx !== -1) {
  const inputPassword = process.argv[uninstallPwdIdx + 1] || ''
  const valid = verifyUninstallPassword(inputPassword)
  securityLog('UNINSTALL_VERIFY', { success: valid, source: 'nsis_cli', pid: process.pid })
  process.exit(valid ? 0 : 1)
}

// Lifecycle ----------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit() } else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus() } })

  app.whenReady().then(async () => {
    logInfo(`App start v${app.getVersion()} (packaged=${app.isPackaged})`)
    verifyInstallation()
    hardenPermissions()
    setupAutoUpdater()
    createSplashWindow()

    let cfg = store.get('dbConfig')
    if (!store.get('setupCompleted') || !cfg) cfg = await createSetupWindow()

    try { await ensureDatabase(cfg) } catch (err) {
      logError(`DB init failed: ${err.message}`)
      const choice = dialog.showMessageBoxSync({
        type: 'error', title: 'Database Initialization Failed',
        message: 'Could not initialize the database.',
        detail: `${err.message}\n\nWould you like to reconfigure the database?`,
        buttons: ['Reconfigure', 'Open Logs', 'Quit'], defaultId: 0,
      })
      if (choice === 0) { store.set('setupCompleted', false); app.relaunch(); app.exit(0); return }
      if (choice === 1) shell.openPath(LOG_FILE)
      app.quit(); return
    }

    try {
      startBackend(cfg)
      const ready = await waitForBackend()
      if (!ready) logWarn('Backend health check timed out, continuing anyway')
      else logInfo('Backend health OK')
    } catch (err) {
      logError(`Backend start failed: ${err.message}`)
      dialog.showErrorBox('Backend Failed to Start', err.message)
      app.quit(); return
    }

    createMainWindow()
    createTray()
    maybeAnnouncePostUpdate()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
  })

  app.on('before-quit', () => { app.isQuiting = true; if (backendProcess) { try { backendProcess.kill() } catch (_) {} } })
  app.on('window-all-closed', () => { if (process.platform === 'darwin') app.quit() })
}
