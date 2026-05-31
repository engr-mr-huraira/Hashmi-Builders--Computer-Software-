# Release Guide — Hashmi Real Estate Builders (Electron Auto-Update)

## Overview

This document explains how to create and publish new releases of the application using **GitHub Releases** and **electron-updater**. Follow these steps exactly for every release.

---

## Version Management Rules

1. **Every release MUST increase the version number.**
   - Valid sequences: `1.0.0` → `1.0.1` → `1.0.2` → `1.1.0` → `1.1.1` → `2.0.0`
2. **The version in `package.json` is the SINGLE SOURCE OF TRUTH.**
3. **GitHub Releases tag MUST match the package.json version prefixed with `v`.**
   - Example: `package.json = 1.0.2` → GitHub Tag = `v1.0.2`
4. **If the version is NOT increased, installed clients will NOT detect an update.**
   - `electron-updater` compares semver; equal or lower versions are ignored.

---

## Prerequisites

- Node.js 20+
- npm 10+
- Windows 10/11 (for building the Windows installer)
- A **GitHub repository** with the application code
- The repository **must be public** OR you must configure a GitHub personal access token for private repos

---

## Step 1: Configure GitHub Repository

Before your first release, update `package.json` with your actual GitHub owner and repository name:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git"
  },
  "build": {
    "publish": [
      {
        "provider": "github",
        "owner": "YOUR_GITHUB_USERNAME",
        "repo": "YOUR_REPO_NAME",
        "channel": "latest",
        "releaseType": "release"
      }
    ]
  }
}
```

> **Important:** Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

---

## Step 2: Bump the Version

Open `package.json` and increase the `version` field:

```json
{
  "version": "1.0.1"
}
```

> **Do NOT skip this step.** The build script will abort if the version was not increased.

---

## Step 3: Build the Installer

Run the build command from the project root:

```bash
npm run build:exe
```

This command:
1. Runs `scripts/validate-version.js` to confirm the version was bumped
2. Builds the frontend (`npm run build:frontend`)
3. Builds the backend (`npm run build:backend`)
4. Packages the Electron app with `electron-builder --win nsis --x64`

### Expected Output Files

After a successful build, the following files will be generated in the `dist/` folder:

| File | Description |
|------|-------------|
| `Hashmi Real Estate Builders-X.Y.Z-Setup.exe` | Windows NSIS installer |
| `Hashmi Real Estate Builders-X.Y.Z-Setup.exe.blockmap` | Delta update blockmap |
| `latest.yml` | Update metadata for electron-updater |

> **Note:** Only NSIS installer builds are supported. Portable builds have been removed.

---

## Step 4: Create a GitHub Release

1. Go to your GitHub repository page
2. Click **Releases** → **Draft a new release**
3. Click **Choose a tag** and create a new tag matching your version with `v` prefix
   - Example: if `package.json` version is `1.0.1`, create tag `v1.0.1`
4. Set the **Release title** (e.g., `v1.0.1`)
5. Add release notes describing what changed
6. **DO NOT publish yet** — first upload the files (Step 5)

---

## Step 5: Upload Release Assets

Upload these files from the `dist/` folder to the GitHub Release:

1. `Hashmi Real Estate Builders-X.Y.Z-Setup.exe`
2. `latest.yml`
3. `Hashmi Real Estate Builders-X.Y.Z-Setup.exe.blockmap`

> **Important:** All three files are required. The `.exe.blockmap` file enables delta updates (faster downloads). The `latest.yml` file tells electron-updater which version is available.

---

## Step 6: Publish the Release

Click **Publish release**.

Once published, installed clients can detect the update.

---

## Step 7: Client Update Flow

On installed client machines:

1. User opens the application
2. (Optional) User clicks **Settings** → **Check for Updates**
3. App connects to GitHub Releases and checks `latest.yml`
4. If a newer version exists:
   - UI shows: "Version X.Y.Z is available"
   - User clicks **Download Update**
   - Progress bar shows download percentage
   - When complete: "Update ready. Click Install & Restart"
   - User clicks **Install & Restart**
   - App quits, NSIS installer runs silently, new version starts
5. If no update exists:
   - UI shows: "You are on the latest version"
6. If internet is unavailable:
   - UI shows friendly error with a **Manual Update** option

---

## Error Handling

The application handles these update scenarios gracefully:

| Scenario | User Message |
|----------|-------------|
| No updates available | "You are on the latest version." |
| No internet connection | "No internet connection. The application works fully offline. Connect to the internet to check for updates." |
| GitHub unreachable (DNS) | "Cannot reach GitHub. Please check your internet connection or try Manual Update." |
| GitHub 404 | "No update release found on GitHub. Make sure the release tag matches the version (e.g., v1.0.1)." |
| GitHub 403 rate limit | "GitHub API rate limit exceeded. Please try again later or use Manual Update." |
| GitHub 401 unauthorized | "Authentication failed with GitHub. The repository may be private or your token may be invalid." |
| Download failed | "Download failed. Please try again or use Manual Update." |
| Checksum mismatch | "Update file integrity check failed. The downloaded file may be corrupted. Please try again or use Manual Update." |
| Manual Update | User selects a `.exe` installer file and clicks "Run Installer & Quit" |

---

## Manual Update (Offline / Air-Gapped)

If the client machine has no internet access:

1. Build the installer on a machine with internet (Step 3)
2. Copy `Hashmi Real Estate Builders-X.Y.Z-Setup.exe` to the client machine via USB/network
3. On the client machine, open the app → **Settings**
4. Click **Manual Update**
5. Select the copied `.exe` installer file
6. Click **Run Installer & Quit**
7. The installer launches and the app closes automatically

---

## Private GitHub Repository

If your repository is **private**, you need a GitHub personal access token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate a token with `repo` scope
3. On the client machine, create or edit `%LOCALAPPDATA%\Hashmi_Real_Estate_Builders\updater.env`:

```env
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

> **Warning:** Never commit the token to the repository. Distribute it securely to clients.

---

## Troubleshooting

### Build fails with "VERSION NOT INCREASED"
- You forgot to bump the version in `package.json`
- Increase the version and run `npm run build:exe` again

### Clients don't detect the update
- Verify the GitHub release tag matches the version: `vX.Y.Z`
- Verify `latest.yml` was uploaded to the release
- Verify the client has internet access
- Check the app logs: `%APPDATA%\Hashmi Real Estate Builders\logs\app.log`

### "No update release found on GitHub" error
- The GitHub release tag does not match the expected format
- Ensure tag is `v1.0.1` (with `v` prefix) when package.json version is `1.0.1`

### Download is very slow
- GitHub may throttle large file downloads
- The `.blockmap` file enables delta updates; ensure it was uploaded
- For urgent updates, use Manual Update

---

## File Reference

| File | Purpose |
|------|---------|
| `package.json` | Version, build config, GitHub provider settings |
| `electron/main/main.js` | Auto-updater setup, IPC handlers, error translation |
| `electron/preload/preload.js` | Bridge between main process and renderer |
| `frontend/src/pages/Settings.jsx` | Update UI: check, download, install, manual, errors |
| `scripts/validate-version.js` | Pre-build version validation |
| `RELEASE_GUIDE.md` | This document |

---

## Summary Checklist for Every Release

- [ ] Bump version in `package.json`
- [ ] Run `npm run build:exe`
- [ ] Verify `dist/` contains: `.exe`, `.exe.blockmap`, `latest.yml`
- [ ] Create GitHub Release with tag `vX.Y.Z`
- [ ] Upload all three files to the release
- [ ] Publish the release
- [ ] Test on a client machine: Settings → Check for Updates
