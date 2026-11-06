# TestApi — Installation & Setup Guide

**App:** TestApi
**License:** MIT
**Author:** Saurabh Sharma — Full Stack MERN Developer
**Website:** https://saurabhsharma.is-a.dev/
**Source:** https://github.com/Code-with-saurabh/Test-Api

This guide covers installing TestApi on every supported OS, building installers from source, where your data lives, uninstalling, and troubleshooting.

---

## Contents

1. [System requirements](#1-system-requirements)
2. [Download installers](#2-download-installers)
3. [Install on Windows](#3-install-on-windows)
4. [Install on macOS](#4-install-on-macos)
5. [Install on Linux](#5-install-on-linux)
6. [First launch](#6-first-launch)
7. [Zoom and editor size](#7-zoom-and-editor-size)
8. [Automatic updates](#8-automatic-updates)
9. [Where your data lives](#9-where-your-data-lives)
10. [Uninstall](#10-uninstall)
11. [Build from source](#11-build-from-source)
12. [Release an update](#12-release-an-update)
13. [Troubleshooting](#13-troubleshooting)
14. [Credits](#14-credits)

---

## 1. System requirements

| | Minimum |
|---|---|
| **Windows** | Windows 10 or 11, 64-bit |
| **macOS** | macOS 11 Big Sur or newer (Intel or Apple Silicon) |
| **Linux** | Ubuntu 20.04+ / Fedora 36+ / any glibc-based 64-bit distro |
| **RAM** | 4 GB |
| **Disk** | ~300 MB free (app + local data) |
| **Internet** | Not required to run. Needed only to send API requests, check for updates, or download installers. |
| **Accounts** | None. No sign-up, no telemetry. |

---

## 2. Download installers

**Download page:** https://Code-with-saurabh.github.io/Test-Api/

**Latest release:** https://github.com/Code-with-saurabh/Test-Api/releases/latest

| Platform | File |
|---|---|
| Windows 10/11 x64 | `TestApi-<version>-win-x64.exe` |
| macOS Apple Silicon | `TestApi-<version>-mac-arm64.dmg` |
| macOS Intel | `TestApi-<version>-mac-x64.dmg` |
| macOS portable | `TestApi-<version>-mac-<arch>.zip` |
| Linux AppImage | `TestApi-<version>-linux-x64.AppImage` |
| Debian / Ubuntu | `TestApi-<version>-linux-x64.deb` |
| Linux archive | `TestApi-<version>-linux-x64.tar.gz` |

Inside the app, open **Settings → Download installers** for direct links to every platform based on the installed version.

---

## 3. Install on Windows

1. Download `TestApi-<version>-win-x64.exe`.
2. Double-click it. The installer is one-click and installs per-user by default.
3. TestApi launches automatically and creates Desktop + Start Menu shortcuts.

**SmartScreen:** Windows may show *“Windows protected your PC”*. Click **More info → Run anyway**. This is normal for free, unsigned apps. Removing the warning permanently requires a paid code-signing certificate.

**Firewall:** Windows Firewall may ask for network access. Allow it if you want to send API requests to remote servers.

Default install location: `%LOCALAPPDATA%\Programs\TestApi`

---

## 4. Install on macOS

1. Download the correct `.dmg`:
   - **Apple Silicon (M1/M2/M3/M4):** `TestApi-<version>-mac-arm64.dmg`
   - **Intel Mac:** `TestApi-<version>-mac-x64.dmg`
2. Open the `.dmg`, drag **TestApi** into **Applications**.
3. First launch: right-click **TestApi → Open** (unsigned builds are blocked by Gatekeeper on double-click).
4. Confirm **Open** in the dialog.

Alternatively use the `.zip` build if you prefer a portable app.

> macOS builds are unsigned by default because Apple code signing/notarisation requires a paid developer account. Auto-update uses the ZIP artifact published by CI. If you own an Apple Developer certificate, configure signing secrets in the release workflow.

---

## 5. Install on Linux

### AppImage (recommended, works everywhere)

```bash
chmod +x TestApi-<version>-linux-x64.AppImage
./TestApi-<version>-linux-x64.AppImage
```

Move it to `~/Applications/` or `/opt/` and create a desktop shortcut if you like.

### Debian / Ubuntu (.deb)

```bash
sudo apt install ./TestApi-<version>-linux-x64.deb
```

Then launch **TestApi** from your applications menu, or run `testapi` in a terminal.

### Tarball (.tar.gz)

```bash
tar -xzf TestApi-<version>-linux-x64.tar.gz
cd TestApi-<version>-linux-x64
./testapi
```

> Auto-update works for AppImage installs. `.deb` and `.tar.gz` installs should be updated by downloading a new package.

---

## 6. First launch

- No login, onboarding or cloud setup is required.
- TestApi creates its local store on first run.
- The default workspace is called **My Workspace**.
- Press **Ctrl/Cmd + T** for a new request tab, and **Ctrl/Cmd + W** to close the current tab.

---

## 7. Zoom and editor size

TestApi supports browser-style zoom across the entire window:

| Action | Shortcut |
|---|---|
| Zoom in | `Ctrl/Cmd` + mouse wheel up |
| Zoom out | `Ctrl/Cmd` + mouse wheel down |
| Zoom in | `Ctrl/Cmd` + `+` (or `=`) |
| Zoom out | `Ctrl/Cmd` + `-` |
| Reset to 100% | `Ctrl/Cmd` + `0` |

- Range: **50% to 300%**, in 10% steps.
- The zoom level is saved and restored on next launch.
- A short HUD appears when zoom changes.
- Use the zoom controls in the bottom status bar, or **Settings → Appearance → App zoom**.
- **Code editor font size** (10–24px) is a separate control for Monaco editors.
- Zoom works while focus is inside inputs, tables, the JSON viewer and code editors.

---

## 8. Automatic updates

TestApi uses **electron-updater** with **GitHub Releases** as the update feed.

- On startup (after a short delay) and every **6 hours**, the installed app checks for a newer release.
- If an update exists, it downloads in the background.
- When the download finishes, TestApi asks you to restart. You can also just quit normally — the update installs automatically.
- Update status is visible in the status bar and in **Settings → Updates**.
- This costs nothing: GitHub Releases and GitHub Actions are free for public repositories.

### Requirements for auto-update

1. The app must be installed from a packaged build (not `npm run dev`).
2. A GitHub Release must exist for the new version.
3. The release must contain the platform updater metadata:
   - Windows: `latest.yml`
   - macOS: `latest-mac.yml`
   - Linux: `latest-linux.yml`
4. The repository must be public (or the release reachable with the configured token — public is recommended for free distribution).

`electron-builder` generates the metadata automatically. The included release workflow publishes it with the installers.

### Manual update check

Open **Settings → Updates → Check**, or the **Help → Check for Updates…** menu item.

---

## 9. Where your data lives

| OS | Path |
|----|------|
| Windows | `%APPDATA%\testapi\testapi-store.json` |
| macOS | `~/Library/Application Support/testapi/testapi-store.json` |
| Linux | `~/.config/testapi/testapi-store.json` |

The file is human-readable JSON with atomic writes and a corrupt-file backup. Copy it to back up or migrate your workspace. Earlier APIFORGE data is migrated automatically on first run when found.

---

## 10. Uninstall

- **Windows:** Settings → Apps → TestApi → Uninstall. Local data is kept unless you delete `%APPDATA%\testapi`.
- **macOS:** Move TestApi from Applications to Trash. Remove `~/Library/Application Support/testapi` to delete data.
- **Linux (deb):** `sudo apt remove testapi`. Remove `~/.config/testapi` to delete data.
- **AppImage:** delete the file. Remove `~/.config/testapi` to delete data.

---

## 11. Build from source

Requirements: **Node.js ≥ 20** and npm.

```bash
git clone https://github.com/Code-with-saurabh/Test-Api.git
cd Test-Api
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Installers:

```bash
npm run dist:win     # Windows .exe (NSIS)
npm run dist:mac     # macOS .dmg + .zip (run on macOS)
npm run dist:linux   # AppImage + .deb + .tar.gz (run on Linux)
```

Output: `release/`.

### Build matrix

| OS | Command | Artifacts | Must run on |
|----|---------|-----------|-------------|
| Windows | `npm run dist:win` | NSIS one-click `.exe` | Windows |
| macOS | `npm run dist:mac` | `.dmg` + `.zip` (x64, arm64) | macOS |
| Linux | `npm run dist:linux` | `.AppImage`, `.deb`, `.tar.gz` | Linux (best) |

GitHub Actions runs all three for free — you do not need a Mac or Linux machine to publish releases.

---

## 12. Release an update

1. Change `version` in `package.json` (for example `1.0.1`).
2. Commit and push to `main`.
3. Tag and push:

   ```bash
   git tag v1.0.1
   git push origin main --tags
   ```

4. The **Release installers** workflow builds all platforms and publishes the release.
5. Installed apps auto-update within 6 hours (or immediately on next launch check).

The release workflow points the publish target at whichever repository runs it, so forks work without editing `package.json`.

---

## 13. Troubleshooting

### Zoom

- Press **Ctrl/Cmd + 0** to reset.
- Click the zoom percentage in the status bar.
- If a devtool or Monaco has focus, the main-process shortcut still works. Mouse-wheel zoom needs `Ctrl/Cmd` held.

### Windows build errors

- “File is being used by another process”: close TestApi, delete `release/`, rebuild.
- Symlink privilege error for `winCodeSign`: enable Windows **Developer Mode**, then rebuild.

### macOS

- “App is damaged” or blocked: right-click → Open. Unsigned builds are not notarised.
- Auto-update on unsigned macOS builds may be restricted by Gatekeeper. Signing is required for fully seamless updates.

### Linux

- AppImage permission error: `chmod +x`.
- Missing FUSE: install `libfuse2` (Ubuntu: `sudo apt install libfuse2`).

### Updates

- “Auto-update is enabled in the installed app” means you are running development mode.
- `Cannot find latest.yml` means the release is missing updater metadata or the publish repo is wrong. Check `package.json → build.publish`.

---

## 14. Credits

**TestApi** is designed and built by **Saurabh Sharma**.

- Website: https://saurabhsharma.is-a.dev/
- GitHub: https://github.com/Code-with-saurabh
- LinkedIn: https://www.linkedin.com/in/saurabh-sharma-64643128b/
- Email: saurabhsharma12166@gmail.com

Open-source under the MIT License.
