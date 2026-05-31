# RealEstateCRM Installation Guide

RealEstateCRM is a Windows desktop application built with Electron.
In production it runs **fully offline** and does **not** use any
browser or `http://localhost` URL. The React frontend is loaded from
local `file://` build files inside the installed application.

---

## 1. Build Requirements (developer machine only)

- Windows 10 / 11 x64
- Node.js 20+
- npm 10+
- PostgreSQL 15+ (only needed at runtime, not for building)

End users do **not** need Node.js. They only need PostgreSQL installed
on their machine (or accessible on the local network).

---

## 2. First-Time Project Setup

Open PowerShell and run:

```powershell
cd "d:\A , B , C , D\React Projects\Hashmi Builders (Computer Software)\RealEstateCRM"
npm install
```

This installs the root, frontend, backend, electron, and sync-engine
dependencies in one shot (via the `postinstall` hook).

---

## 3. Build the Windows Installer (Setup.exe + Portable.exe)

The build process needs permission to create symlinks during the
internal `winCodeSign` extraction step. The easiest way is to use the
provided batch script:

1. Open the project folder in File Explorer
2. **Right-click** `build-installer.bat`
3. Choose **Run as administrator**

The script will:

1. Build the React frontend (production, relative paths, file:// safe)
2. Compile the TypeScript backend
3. Run `electron-builder` to package both targets

When finished you will find:

```text
RealEstateCRM\dist\RealEstateCRM-1.0.0-Setup.exe
RealEstateCRM\dist\RealEstateCRM-1.0.0-Portable.exe
```

> Admin rights are only required at build time, on the developer's
> machine, for the symlink-extraction step. End users do **not** need
> admin rights to use the application (apart from accepting the
> standard NSIS UAC prompt during installation).

### Manual build (alternative)

If you prefer to run commands manually from an Administrator PowerShell:

```powershell
npm --prefix frontend run build
npm --prefix backend run build
npx electron-builder --win nsis portable --x64
```

You can also build just one target:

```powershell
npm run build:installer    # Setup.exe only
npm run build:portable     # Portable.exe only
```

---

## 4. End-User Installation (Setup.exe)

When a user double-clicks `RealEstateCRM-1.0.0-Setup.exe`:

1. **Welcome** screen
2. **License agreement** (must accept)
3. **Installation directory selection** (default `C:\Program Files\RealEstateCRM`)
4. **Installation progress** screen
5. **Finish** screen with auto-launch option

The installer:

- Creates Desktop and Start Menu shortcuts
- Registers an entry in Windows Add/Remove Programs
- Creates runtime folders inside the install directory:
  `data`, `backups`, `logs`, `uploads`
- Records publisher info (`Hashmi Builders`) and uninstall metadata

### First launch (Setup Wizard)

The first time the user opens RealEstateCRM, an in-app **Setup Wizard**
appears with four steps:

1. **Welcome** - product overview
2. **License** - in-app EULA acceptance
3. **Database Configuration**
   - Host, Port, Database name, User, Password
   - "Test Connection" button to verify PostgreSQL is reachable
4. **Finish** - launches the main app

When the user clicks **Install**, the app will:

- Connect to the PostgreSQL admin database
- **Create the database if it does not exist**
- **Create all tables/schema automatically**
- Start the embedded backend on `127.0.0.1:5000`
- Load the local React build via `file://`

All subsequent launches go straight to the application; the wizard
runs only once.

---

## 5. Portable Version

`RealEstateCRM-1.0.0-Portable.exe` is a single-file portable launcher.

- No installation required
- Stores user data under `%LOCALAPPDATA%\RealEstateCRM`
- Same first-launch Setup Wizard for database configuration
- Can be carried on a USB drive

---

## 6. Production Architecture (post-install)

```text
RealEstateCRM (Electron desktop window)
   |
   |- Loads:  file://.../resources/app.asar/frontend/dist/index.html
   |
   |- Spawns: Embedded backend (Node mode via Electron binary)
   |          listens on http://127.0.0.1:5000 (loopback only)
   |
   |- Stores: User data in %APPDATA%\RealEstateCRM
   |          - config.json    (db credentials, JWT secret)
   |          - logs\app.log
   |          - backups\
   |          - uploads\
```

Key production properties:

- No live URL, no browser, no `localhost:3000`
- DevTools disabled in production builds
- `Ctrl+Shift+I` and `F12` blocked
- External links open in the user's default browser only
- Single-instance lock (clicking the shortcut twice focuses the existing window)
- System tray icon with quick actions and auto-start toggle
- Closing the window minimizes to tray; quit from tray menu

---

## 7. Offline & Sync Behavior

- All records are written locally to PostgreSQL first
- Operations are queued in the `sync_queue` table
- The background sync engine processes queued records when the
  cloud database is reachable
- Conflicts are resolved by latest timestamp
- Failed records are retried automatically
- Sync status is exposed in the topbar indicator

To enable cloud sync, add the cloud credentials to the user's runtime
configuration (Settings page) or pre-bake them into the `.env` of a
custom-branded build:

```env
CLOUD_DB_HOST=
CLOUD_DB_PORT=5432
CLOUD_DB_NAME=
CLOUD_DB_USER=
CLOUD_DB_PASSWORD=
```

---

## 8. Uninstallation

- Windows Settings ▸ Apps ▸ RealEstateCRM ▸ Uninstall
- Or Control Panel ▸ Programs and Features ▸ RealEstateCRM

By default the uninstaller **keeps** user data (`data/`, `backups/`,
`uploads/`, `logs/`). Edit `electron/resources/installer.nsh` if you
want the uninstaller to remove these too.

---

## 9. Development Mode (for developers only)

```powershell
npm run dev
```

This starts:

- Vite dev server on `http://localhost:3000`
- Backend on `http://localhost:5000`
- Electron pointing at the dev server

This mode is intended only for editing the UI/API. Production builds
never touch localhost.

---

## 10. Default Demo Login

```text
Username: admin
Password: admin123
```

Change this immediately on a real deployment.
