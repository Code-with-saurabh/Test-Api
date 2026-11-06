# TestApi

**Free, offline-first desktop API development & testing client for Windows, macOS and Linux.**
Build. Test. Debug. Automate.

TestApi is a complete desktop API client — collections, environments, variables, authentication, scripts, tests, a collection runner, WebSocket support and a developer toolkit. Everything is stored locally on your machine. No account, no cloud, no telemetry, no paid update server.

Built by **Saurabh Sharma** · [Website](https://saurabhsharma.is-a.dev/) · [GitHub](https://github.com/Code-with-saurabh) · [LinkedIn](https://www.linkedin.com/in/saurabh-sharma-64643128b/)

[![CI](https://github.com/Code-with-saurabh/Test-Api/actions/workflows/ci.yml/badge.svg)](https://github.com/Code-with-saurabh/Test-Api/actions/workflows/ci.yml)
[![Release installers](https://github.com/Code-with-saurabh/Test-Api/actions/workflows/release.yml/badge.svg)](https://github.com/Code-with-saurabh/Test-Api/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-6c8cff.svg)](LICENSE)

---

## Download

The easiest way is the download page:

**→ [TestApi downloads](https://Code-with-saurabh.github.io/Test-Api/)**

> **First-time download-page setup:** in GitHub open **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**, then run the **Deploy download page** workflow once. This is a one-time action; the page is served from [`docs/index.html`](docs/index.html). The release asset links below work immediately.

| Platform | Installer | Direct download |
|----------|-----------|-----------------|
| Windows 10/11 (x64) | One-click `.exe` | [TestApi-1.0.1-win-x64.exe](https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.0.1/TestApi-1.0.1-win-x64.exe) |
| macOS Apple Silicon | `.dmg` | [TestApi-1.0.1-mac-arm64.dmg](https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.0.1/TestApi-1.0.1-mac-arm64.dmg) |
| macOS Intel | `.dmg` | [TestApi-1.0.1-mac-x64.dmg](https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.0.1/TestApi-1.0.1-mac-x64.dmg) |
| Linux (portable) | `.AppImage` | [TestApi-1.0.1-linux-x86_64.AppImage](https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.0.1/TestApi-1.0.1-linux-x86_64.AppImage) |
| Debian / Ubuntu | `.deb` | [TestApi-1.0.1-linux-amd64.deb](https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.0.1/TestApi-1.0.1-linux-amd64.deb) |
| Linux archive | `.tar.gz` | [TestApi-1.0.1-linux-x64.tar.gz](https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.0.1/TestApi-1.0.1-linux-x64.tar.gz) |

> Older/newer releases are always listed at [github.com/Code-with-saurabh/Test-Api/releases](https://github.com/Code-with-saurabh/Test-Api/releases).
> The in-app **Settings → Download installers** section also contains direct links for every OS.

### First-run notes (unsigned builds)

- **Windows:** SmartScreen may show *“Windows protected your PC”* → click **More info → Run anyway**. The app is free and not code-signed.
- **macOS:** If macOS blocks the app, right-click the app → **Open** the first time. Unsigned `.dmg` builds cannot be notarised without a paid Apple Developer certificate.
- **Linux:** `chmod +x TestApi-*.AppImage` then run it. For `.deb`: `sudo apt install ./TestApi-*.deb`.

---

## Highlights

### Chrome-style zoom (new)
- **Ctrl/Cmd + mouse wheel** to zoom in/out anywhere — fields, tables, JSON viewer, Monaco editor, the whole window.
- **Ctrl/Cmd + `+` / `-`** and **Ctrl/Cmd + `0`** to reset to 100%.
- Zoom range **50% → 300%** in 10% steps, persisted across restarts.
- Live zoom HUD, status-bar controls, and a full slider in **Settings → Appearance**.
- Separate **code editor font size** control (10–24px) for Monaco.
- Works even when focus is inside an input, a JSON tree or the code editor.

### Free automatic updates
- Installed apps check **GitHub Releases** on startup and every 6 hours.
- New versions download in the background and install on restart.
- No paid update infrastructure, no accounts — GitHub Releases is free.
- Status is shown in the status bar and in **Settings → Updates**.
- Release metadata (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`) is generated automatically by `electron-builder` in CI.

### API client
- **HTTP request builder** — GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS + custom, query params, headers, body types (JSON, XML, HTML, text, form-data, urlencoded, binary), file upload, timeout/redirect/SSL controls, request cancellation.
- **Response viewer** — collapsible JSON tree with search, raw view, headers, cookies, sandboxed HTML preview, image preview, save/copy, status/time/size.
- **Collections** — nested folders, search, context menus, save/duplicate/move, Postman v2.1 and cURL import/export.
- **Environments & variables** — `{{baseUrl}}` substitution with scope chain (global → environment → collection → folder → request), secret masking, dynamic vars (`{{$guid}}`, `{{$timestamp}}`).
- **Authentication** — API Key (header/query), Bearer, Basic, Digest (stored), OAuth 2.0 stored token.
- **Scripts & tests** — pre-request and post-response JavaScript in a hardened `node:vm` sandbox (5s timeout, no fs/net/process), `pm.test` / `pm.expect`, variable extraction and chaining.
- **Collection runner** — iterations, delay, JSON data-driven rows, pass/fail report persisted locally.
- **History** — every send recorded (secrets redacted), filters, reopen as request, configurable retention.
- **WebSocket client** — connect/send/receive with message log.
- **GraphQL** — query + variables editor.
- **Developer toolkit** — JSON formatter/TS converter, JWT decoder, Base64/URL codec, UUID, MD5/SHA hashes, timestamp converter, regex tester, XML↔JSON.
- **Themes** — complete dark and light UI.

---

## Tech stack

Electron · React 18 · TypeScript (strict) · Vite (electron-vite) · Tailwind CSS · Zustand · undici · Monaco Editor · `node:vm` sandbox · Vitest · electron-builder · electron-updater

**Storage:** atomic JSON store in the OS user-data directory (`testapi-store.json`) — zero native dependencies, corrupt-file auto-backup, and automatic migration from earlier APIFORGE builds.

---

## Development

Requirements: **Node.js ≥ 20** and npm.

```bash
npm install
npm run dev          # launch with HMR
```

Quality gates:

```bash
npm run lint         # ESLint
npm run typecheck    # tsc (main + renderer configs)
npm test             # Vitest unit tests
npm run build        # production bundle (out/)
```

IPC smoke test (build first, then launch, verify main↔preload↔renderer and auto-quit):

```powershell
# Windows PowerShell
npm run build
$env:TESTAPI_SMOKE = '1'; npx electron .
```

```bash
# macOS / Linux
npm run build
TESTAPI_SMOKE=1 npx electron .
```

---

## Build installers

```bash
npm run dist:win     # Windows NSIS one-click .exe
npm run dist:mac     # macOS .dmg + .zip (x64 + arm64)
npm run dist:linux   # Linux AppImage + .deb + .tar.gz
npm run dist         # default targets for the current OS
```

Output directory: `release/`. Build output is git-ignored — installers belong on GitHub Releases, not in the repository.

> macOS `.dmg` must be produced on macOS. Linux AppImage is best produced on Linux. The included GitHub Actions workflow does all three on GitHub-hosted runners for free.

### Release an update (creates installers + triggers auto-update)

1. Bump the version in `package.json` (for example `1.0.0` → `1.0.1`).
2. Commit the change and push to `main`.
3. Create and push a matching tag:

   ```bash
   git tag v1.0.1
   git push origin main --tags
   ```

4. The **Release installers** GitHub Actions workflow builds Windows, macOS and Linux in parallel, then publishes one GitHub Release containing:
   - `TestApi-1.0.1-win-x64.exe`
   - `TestApi-1.0.1-mac-arm64.dmg` / `TestApi-1.0.1-mac-x64.dmg`
   - `TestApi-1.0.1-mac-*.zip`
   - `TestApi-1.0.1-linux-x86_64.AppImage` / `linux-amd64.deb` / `linux-x64.tar.gz`
   - `latest.yml`, `latest-mac.yml`, `latest-linux.yml`

5. Every installed TestApi app checks GitHub Releases and updates itself automatically — **no server cost, no extra service**.

The workflow uses `GITHUB_TOKEN` (built into GitHub Actions) and automatically points publishing at the repository that runs it, so forks work without editing config. Unsigned macOS builds update via the ZIP artifact; if you own an Apple Developer certificate, remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from the workflow and add signing secrets.

---

## Project structure

```
TestApi/
├── src/
│   ├── main/                 Electron main process
│   │   ├── index.ts          Window, single-instance lock, global zoom keys
│   │   ├── menu.ts           Native app menu (zoom, update, links)
│   │   ├── ipc/index.ts      Typed IPC handlers
│   │   └── services/
│   │       ├── db/           Atomic JSON store + repositories
│   │       ├── http/         undici HTTP engine
│   │       ├── importexport/ Postman import/export
│   │       ├── runner/       Collection runner
│   │       ├── scripts/      Hardened node:vm sandbox
│   │       ├── updater/      electron-updater + GitHub Releases
│   │       ├── ws/           WebSocket manager
│   │       └── zoom/         Whole-window zoom controller
│   ├── preload/              contextBridge API (no node in renderer)
│   ├── renderer/             React UI (features, stores, styles)
│   └── shared/               Types, IPC contract, zoom model, branding
├── tests/                    Unit + integration tests (Vitest)
├── resources/                App icons
├── scripts/                  Icon + CI helper scripts
├── docs/                     Installation guide + download landing page
├── .github/workflows/        CI + 3-OS release pipeline
├── electron.vite.config.ts
├── package.json              Scripts, deps, electron-builder config
└── README.md
```

---

## Data, privacy & security

- Renderer is sandboxed: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP.
- All IPC validated with Zod at the boundary; the renderer never touches the filesystem or network directly.
- Scripts run in `node:vm` with a hard timeout and no privileged globals.
- Secrets are masked in the UI and redacted in history snapshots.
- SSL verification is on by default.
- External navigation is blocked; links open in the system browser only.
- No telemetry, no accounts, no analytics. The only network calls are the API requests you send, update checks, and downloads you request.

**Where data lives**

| OS | Path |
|----|------|
| Windows | `%APPDATA%\testapi\testapi-store.json` |
| macOS | `~/Library/Application Support/testapi/testapi-store.json` |
| Linux | `~/.config/testapi/testapi-store.json` |

Back up that file to move or restore your collections, environments and settings.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Zoom feels stuck | Press **Ctrl/Cmd + 0**, or click the zoom percentage in the status bar. |
| Windows build fails with “file is being used by another process” | Close the running app, delete `release/`, rebuild. Windows Search/Defender can briefly lock `app.asar`. |
| AppImage will not run on Linux | `chmod +x TestApi-*.AppImage`, then run it. |
| Auto-update says “disabled” | Auto-update only runs in an installed/packaged build, not in `npm run dev`. |
| Update check fails | Make sure a GitHub Release with `latest.yml` exists for your platform, and that the repository is public. |
| macOS blocks the app | Right-click → **Open** the first time (unsigned build). |
| Reset all local data | Quit TestApi, delete `testapi-store.json`, relaunch. |

More detail: [`docs/INSTALLATION.md`](docs/INSTALLATION.md)

---

## Contributing

Contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md), run `npm run lint && npm run typecheck && npm test`, and open a pull request against `main`.

- Report bugs: [GitHub Issues](https://github.com/Code-with-saurabh/Test-Api/issues)
- Feature requests: use the issue template
- Security issues: email **saurabhsharma12166@gmail.com** instead of opening a public issue

---

## License

[MIT](LICENSE) © 2026 Saurabh Sharma

TestApi is a free and open-source alternative to Postman/Insomnia for developers who want their API workspace to stay on their own machine.
