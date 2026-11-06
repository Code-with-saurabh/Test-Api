import { useEffect, useState } from 'react'
import { CheckCircle2, Download, ExternalLink, Github, Linkedin, Minus, Moon, Plus, RefreshCw, RotateCcw, Sun } from 'lucide-react'
import { useAppStore, persistSettingsPatch } from '@/stores/app'
import { useUpdateStore, checkForUpdates, downloadUpdate, installUpdate } from '@/stores/update'
import { Button, Input, Select, Label, Toggle } from '@/components/ui'
import { MAX_APP_ZOOM, MIN_APP_ZOOM, formatZoomPercent } from '@shared/zoom'
import { MAX_EDITOR_FONT_SIZE, MIN_EDITOR_FONT_SIZE } from '@shared/types'
import {
  APP_NAME,
  AUTHOR,
  DOWNLOADS_PAGE_URL,
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_RELEASES_URL,
  GITHUB_URL,
  releaseAssetUrl
} from '@shared/branding'

export function SettingsView() {
  const settings = useAppStore((s) => s.settings)
  const updateStatus = useUpdateStore((s) => s.status)
  const [historyRetention, setHistoryRetention] = useState(settings.historyRetention)
  const [defaultTimeout, setDefaultTimeout] = useState(settings.defaultTimeoutMs)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    void window.api.ping().then((r) => {
      if (r.ok) setAppVersion(r.data.version)
    })
  }, [])

  useEffect(() => {
    setHistoryRetention(settings.historyRetention)
    setDefaultTimeout(settings.defaultTimeoutMs)
  }, [settings])

  const version = appVersion || '1.0.0'
  const updateBusy = updateStatus.state === 'checking' || updateStatus.state === 'downloading'

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-xl p-6 space-y-6">
        <div>
          <h1 className="text-base font-semibold mb-1">Settings</h1>
          <p className="text-xs text-txt-secondary">Preferences are stored locally. No data leaves this machine.</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Appearance</h2>
          <div className="flex items-center gap-3">
            <Button variant={settings.theme === 'dark' ? 'primary' : 'secondary'} size="sm" onClick={() => void persistSettingsPatch({ theme: 'dark' })}>
              <Moon size={13} /> Dark
            </Button>
            <Button variant={settings.theme === 'light' ? 'primary' : 'secondary'} size="sm" onClick={() => void persistSettingsPatch({ theme: 'light' })}>
              <Sun size={13} /> Light
            </Button>
          </div>
          <Toggle checked={settings.editorWordWrap} onChange={(v) => void persistSettingsPatch({ editorWordWrap: v })} label="Word wrap in editors" />

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label>App zoom — whole window</Label>
              <span className="text-xs tabular-nums text-txt-secondary">{formatZoomPercent(settings.zoomLevel)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label="Zoom out"
                title="Zoom out (Ctrl/Cmd + -)"
                disabled={settings.zoomLevel <= MIN_APP_ZOOM}
                onClick={() => void window.api.appZoomStep(-1)}
              >
                <Minus size={13} />
              </Button>
              <input
                type="range"
                min={MIN_APP_ZOOM}
                max={MAX_APP_ZOOM}
                step={10}
                value={settings.zoomLevel}
                onChange={(e) => void window.api.appZoomSet(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
                aria-label="App zoom percentage"
              />
              <Button
                size="sm"
                variant="secondary"
                aria-label="Zoom in"
                title="Zoom in (Ctrl/Cmd + =)"
                disabled={settings.zoomLevel >= MAX_APP_ZOOM}
                onClick={() => void window.api.appZoomStep(1)}
              >
                <Plus size={13} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                title="Reset to 100% (Ctrl/Cmd + 0)"
                disabled={settings.zoomLevel === 100}
                onClick={() => void window.api.appZoomReset()}
              >
                <RotateCcw size={13} /> Reset
              </Button>
            </div>
            <p className="text-2xs text-txt-muted">
              Zoom like Chrome: <strong>Ctrl/Cmd + mouse wheel</strong>, <strong>Ctrl/Cmd + + / -</strong>, <strong>Ctrl/Cmd + 0</strong> to reset.
              Every panel, field, table and code editor scales together from 50% to 300%.
            </p>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <Label>Code editor font size</Label>
              <span className="text-xs tabular-nums text-txt-secondary">{settings.editorFontSize}px</span>
            </div>
            <input
              type="range"
              min={MIN_EDITOR_FONT_SIZE}
              max={MAX_EDITOR_FONT_SIZE}
              step={1}
              value={settings.editorFontSize}
              onChange={(e) => void persistSettingsPatch({ editorFontSize: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
              aria-label="Editor font size"
            />
            <p className="text-2xs text-txt-muted">Only changes Monaco code editors (request body and scripts). App zoom affects everything.</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Requests</h2>
          <div>
            <Label>Default timeout (ms)</Label>
            <Input
              type="number"
              className="max-w-xs"
              value={defaultTimeout}
              onChange={(e) => setDefaultTimeout(Number(e.target.value) || 30000)}
              onBlur={() => void persistSettingsPatch({ defaultTimeoutMs: defaultTimeout })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">History</h2>
          <div>
            <Label>Retention (number of entries)</Label>
            <Select
              className="max-w-xs"
              value={String(historyRetention)}
              onChange={(e) => {
                const v = Number(e.target.value)
                setHistoryRetention(v)
                void persistSettingsPatch({ historyRetention: v })
              }}
            >
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
              <option value="2000">2000</option>
            </Select>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Updates</h2>
          <div className="panel border border-border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Version {updateStatus.currentVersion || version}</p>
                <p className="text-xs text-txt-secondary mt-0.5">{updateStatus.message ?? 'Updates are delivered through GitHub Releases — free, no server required.'}</p>
              </div>
              {updateStatus.state === 'downloaded' ? (
                <Button variant="primary" size="sm" onClick={() => void installUpdate()}>
                  <CheckCircle2 size={13} /> Restart & install
                </Button>
              ) : updateStatus.state === 'available' ? (
                <Button variant="primary" size="sm" onClick={() => void downloadUpdate()}>
                  <Download size={13} /> Download
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled={updateBusy} onClick={() => void checkForUpdates()}>
                  <RefreshCw size={13} className={updateStatus.state === 'checking' ? 'animate-spin' : ''} /> Check
                </Button>
              )}
            </div>
            {updateStatus.state === 'downloading' && (
              <div className="h-1.5 w-full rounded bg-elevated overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${updateStatus.percent ?? 0}%` }} />
              </div>
            )}
            <p className="text-2xs text-txt-muted">
              The installed app checks automatically at startup and every 6 hours. New versions install on restart. No account, no paid update
              server, no telemetry.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Download installers</h2>
          <div className="panel border border-border rounded-md p-4 space-y-3">
            <p className="text-xs text-txt-secondary">Direct links for every platform and architecture:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DownloadButton label="Windows 10/11 (x64) — .exe" url={releaseAssetUrl(version, 'win', 'x64', 'exe')} />
              <DownloadButton label="macOS Intel — .dmg" url={releaseAssetUrl(version, 'mac', 'x64', 'dmg')} />
              <DownloadButton label="macOS Apple Silicon — .dmg" url={releaseAssetUrl(version, 'mac', 'arm64', 'dmg')} />
              <DownloadButton label="Linux — .AppImage" url={releaseAssetUrl(version, 'linux', 'x64', 'AppImage')} />
              <DownloadButton label="Linux Debian/Ubuntu — .deb" url={releaseAssetUrl(version, 'linux', 'x64', 'deb')} />
              <DownloadButton label="Linux — .tar.gz" url={releaseAssetUrl(version, 'linux', 'x64', 'tar.gz')} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => void window.api.openExternal(GITHUB_LATEST_RELEASE_URL)}>
                <ExternalLink size={13} /> Latest release
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void window.api.openExternal(GITHUB_RELEASES_URL)}>
                All releases
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void window.api.openExternal(DOWNLOADS_PAGE_URL)}>
                Download page
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Data</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const tree = await window.api.collectionsList()
                if (!tree.ok || !tree.data.length) {
                  alert('No collections to export')
                  return
                }
                const id = prompt(`Export which collection? Enter number:\n${tree.data.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`)
                const idx = Number(id) - 1
                const col = tree.data[idx]
                if (!col) return
                const res = await window.api.exportPostman({ collectionId: col.id })
                if (res.ok) {
                  await window.api.saveFile(`${col.name}.postman_collection.json`, res.data.json)
                }
              }}
            >
              Export collection (Postman JSON)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const f = await window.api.chooseFile('Import Postman collection')
                if (!f.ok || !f.data) return
                const text = await readFileAsText()
                const res = await window.api.importPostman({ json: text })
                if (res.ok) {
                  alert(`Imported ${res.data.collections} collection(s), ${res.data.requests} request(s)`)
                  window.location.reload()
                } else {
                  alert('Import failed: ' + res.error.message)
                }
              }}
            >
              Import Postman collection
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">About</h2>
          <div className="panel border border-border rounded-md p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">
                {APP_NAME} <span className="text-txt-muted font-normal">by</span> <span className="text-warning">{AUTHOR.name}</span>
              </p>
              <p className="text-xs text-txt-secondary mt-1">
                Free, offline-first desktop API client. All data stored locally — no accounts, no telemetry.
              </p>
            </div>
            <div className="text-xs space-y-1 text-txt-secondary">
              <p>
                <span className="text-txt-muted w-16 inline-block">Built by</span>
                {AUTHOR.name} — {AUTHOR.role}
              </p>
              <p>
                <span className="text-txt-muted w-16 inline-block">Website</span>
                <button className="text-primary hover:underline" onClick={() => void window.api.openExternal(AUTHOR.website)}>
                  saurabhsharma.is-a.dev
                </button>
              </p>
              <p>
                <span className="text-txt-muted w-16 inline-block">GitHub</span>
                <button className="text-primary hover:underline" onClick={() => void window.api.openExternal(AUTHOR.github)}>
                  github.com/Code-with-saurabh
                </button>
              </p>
              <p>
                <span className="text-txt-muted w-16 inline-block">Repository</span>
                <button className="text-primary hover:underline" onClick={() => void window.api.openExternal(GITHUB_URL)}>
                  {GITHUB_URL.replace('https://', '')}
                </button>
              </p>
              <p>
                <span className="text-txt-muted w-16 inline-block">LinkedIn</span>
                <button className="text-primary hover:underline" onClick={() => void window.api.openExternal(AUTHOR.linkedin)}>
                  linkedin.com/in/saurabh-sharma
                </button>
              </p>
              <p>
                <span className="text-txt-muted w-16 inline-block">Email</span>
                <button className="text-primary hover:underline" onClick={() => void window.api.openExternal(`mailto:${AUTHOR.email}`)}>
                  {AUTHOR.email}
                </button>
              </p>
            </div>
            <div className="border-t border-border pt-2 text-2xs text-txt-muted flex items-center justify-between">
              <span>Version {version}</span>
              <span className="flex items-center gap-2">
                <Github size={11} />
                <Linkedin size={11} />
                MIT License · Open Source
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function DownloadButton({ label, url }: { label: string; url: string }) {
  return (
    <button
      className="flex items-center gap-2 rounded border border-border bg-elevated px-3 py-2 text-left text-xs text-txt-secondary hover:bg-hover hover:text-txt transition-colors"
      onClick={() => void window.api.openExternal(url)}
      title={url}
    >
      <Download size={13} className="shrink-0 text-primary" />
      <span>{label}</span>
    </button>
  )
}

async function readFileAsText(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('No file'))
        return
      }
      void file.text().then(resolve, reject)
    }
    input.click()
  })
}
