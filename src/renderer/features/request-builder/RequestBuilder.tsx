import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Send, Save, X, Code2, ClipboardPaste, ChevronDown } from 'lucide-react'
import type { AuthType, BodyType, HttpRequestConfig, KeyValue } from '@shared/types'
import { useTabsStore, type TabState } from '@/stores/tabs'
import { useDataStore } from '@/stores/data'
import { useAppStore } from '@/stores/app'
import { Button, Input, Select, SubTabs, Label, Toggle, Kbd } from '@/components/ui'
import { KeyValueTable, useBulkPaste } from './KeyValueTable'
import { executeSend } from './send'
import { cn } from '@/lib/cn'
import { resolveVariables } from '@shared/vars'
import { SaveRequestDialog } from './SaveRequestDialog'
import { ImportCurlDialog } from './ImportCurlDialog'
import { RunTestsDialog } from './RunTestsDialog'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

type BuilderTab = 'params' | 'headers' | 'auth' | 'body' | 'scripts' | 'settings'

export function RequestBuilder({ tab }: { tab: TabState }) {
  const [builderTab, setBuilderTab] = useState<BuilderTab>('params')
  const [customMethod, setCustomMethod] = useState('')
  const [methodMenuOpen, setMethodMenuOpen] = useState(false)
  const methodMenuRef = useRef<HTMLDivElement>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [unresolved, setUnresolved] = useState<string[]>([])

  const update = useTabsStore((s) => s.updateConfig)
  const setLoading = useTabsStore((s) => s.setLoading)
  const setResponse = useTabsStore((s) => s.setResponse)
  const setScriptResults = useTabsStore((s) => s.setScriptResults)
  const activeEnvId = useDataStore((s) => s.activeEnvironmentId)

  const patch = (p: Partial<HttpRequestConfig>) => update(tab.id, p)

  // close method dropdown on outside click / Escape
  useEffect(() => {
    if (!methodMenuOpen) return
    const onPointerDown = (e: PointerEvent): void => {
      if (methodMenuRef.current && !methodMenuRef.current.contains(e.target as Node)) {
        setMethodMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMethodMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [methodMenuOpen])

  const paramsCount = tab.config.params.filter((p) => p.enabled && p.key).length
  const headersCount = tab.config.headers.filter((h) => h.enabled && h.key).length

  const onSend = async () => {
    setUnresolved([])
    await executeSend({
      tab,
      activeEnvId,
      setLoading,
      setResponse,
      setScriptResults,
      onUnresolved: setUnresolved
    })
  }

  const method = tab.config.method

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* URL row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="relative" ref={methodMenuRef}>
          <button
            className="btn-secondary !px-2 font-mono text-xs flex items-center gap-1 min-w-[92px]"
            onClick={() => setMethodMenuOpen((v) => !v)}
          >
            <span style={{ color: methodColor(method) }}>{method}</span>
            <ChevronDown size={11} className={cn('transition-transform', methodMenuOpen && 'rotate-180')} />
          </button>
          {methodMenuOpen && (
            <div className="absolute z-30 mt-1 w-40 panel shadow-lg py-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  className={cn(
                    'block w-full text-left px-3 py-1 text-xs font-mono hover:bg-hover',
                    method === m && 'bg-hover'
                  )}
                  onClick={() => {
                    patch({ method: m })
                    setCustomMethod('')
                    setMethodMenuOpen(false)
                    // body-carrying methods: open Body tab so data entry is discoverable
                    if (m === 'POST' || m === 'PUT' || m === 'PATCH') setBuilderTab('body')
                  }}
                >
                  <span style={{ color: methodColor(m) }}>{m}</span>
                </button>
              ))}
              <div className="border-t border-border my-1" />
              <div className="px-2 py-1">
                <Input
                  autoFocus
                  className="!py-0.5 text-xs font-mono"
                  placeholder="CUSTOM method"
                  value={customMethod}
                  onChange={(e) => setCustomMethod(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customMethod.trim()) {
                      patch({ method: customMethod.trim().toUpperCase() })
                      setMethodMenuOpen(false)
                      const cm = customMethod.trim().toUpperCase()
                      if (cm === 'POST' || cm === 'PUT' || cm === 'PATCH') setBuilderTab('body')
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <Input
            className="font-mono !text-[13px]"
            placeholder="https://api.example.com/users or {{baseUrl}}/users"
            value={tab.config.url}
            onChange={(e) => patch({ url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSend()
            }}
            spellCheck={false}
          />
          {unresolved.length > 0 && (
            <div className="absolute z-20 mt-0.5 left-0 right-0 panel border-warning/50 px-2 py-1 text-2xs text-warning shadow">
              Unresolved variables: {unresolved.join(', ')}
            </div>
          )}
        </div>

        {tab.loading ? (
          <Button variant="danger" onClick={() => void window.api.httpCancel('')}>
            <X size={13} /> Cancel
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void onSend()} disabled={!tab.config.url.trim()}>
            <Send size={13} /> Send <Kbd>⏎</Kbd>
          </Button>
        )}

        <Button variant="ghost" onClick={() => setSaveOpen(true)} title="Save request (Ctrl+S)">
          <Save size={14} />
        </Button>
        <Button variant="ghost" onClick={() => setImportOpen(true)} title="Import cURL">
          <ClipboardPaste size={14} />
        </Button>
        <Button variant="ghost" onClick={() => setRunOpen(true)} title="Run collection tests" disabled={!tab.savedRequestId}>
          <Code2 size={14} />
        </Button>
      </div>

      {/* sub tabs */}
      <SubTabs
        tabs={[
          { id: 'params', label: 'Params', badge: paramsCount || undefined },
          { id: 'headers', label: 'Headers', badge: headersCount || undefined },
          { id: 'auth', label: 'Auth' },
          { id: 'body', label: 'Body' },
          { id: 'scripts', label: 'Scripts' },
          { id: 'settings', label: 'Settings' }
        ]}
        active={builderTab}
        onChange={(id) => setBuilderTab(id as BuilderTab)}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {builderTab === 'params' && <ParamsTab tab={tab} />}
        {builderTab === 'headers' && <HeadersTab tab={tab} />}
        {builderTab === 'auth' && <AuthTab tab={tab} />}
        {builderTab === 'body' && <BodyTab tab={tab} />}
        {builderTab === 'scripts' && <ScriptsTab tab={tab} />}
        {builderTab === 'settings' && <SettingsTab tab={tab} />}
      </div>

      <SaveRequestDialog open={saveOpen} onClose={() => setSaveOpen(false)} tab={tab} />
      <ImportCurlDialog open={importOpen} onClose={() => setImportOpen(false)} tabId={tab.id} />
      <RunTestsDialog open={runOpen} onClose={() => setRunOpen(false)} collectionId={tab.collectionId} />
    </div>
  )
}

function ParamsTab({ tab }: { tab: TabState }) {
  const update = useTabsStore((s) => s.updateConfig)
  return (
    <KeyValueTable
      rows={tab.config.params}
      onChange={(params) => update(tab.id, { params })}
      keyPlaceholder="Parameter"
      valuePlaceholder="Value"
    />
  )
}

function HeadersTab({ tab }: { tab: TabState }) {
  const update = useTabsStore((s) => s.updateConfig)
  const bulk = useBulkPaste((rows) => update(tab.id, { headers: rows }))
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-end px-2 py-1 border-b border-border">
        <Button size="sm" variant="ghost" onClick={() => bulk.setOpen(true)}>
          Bulk edit
        </Button>
      </div>
      {bulk.pasteArea}
      <div className="flex-1 min-h-0">
        <KeyValueTable rows={tab.config.headers} onChange={(headers) => update(tab.id, { headers })} keyPlaceholder="Header" valuePlaceholder="Value" />
      </div>
    </div>
  )
}

function AuthTab({ tab }: { tab: TabState }) {
  const update = useTabsStore((s) => s.updateConfig)
  const auth = tab.config.auth

  const setType = (type: AuthType) => {
    update(tab.id, {
      auth: {
        type,
        apiKey: auth.apiKey ?? { key: 'X-Api-Key', value: '', in: 'header' },
        bearer: auth.bearer ?? { token: '' },
        basic: auth.basic ?? { username: '', password: '' },
        digest: auth.digest ?? { username: '', password: '' },
        oauth2: auth.oauth2 ?? { accessToken: '', tokenType: 'Bearer' }
      }
    })
  }

  return (
    <div className="p-3 space-y-3 overflow-auto h-full">
      <div className="max-w-xs">
        <Label>Auth Type</Label>
        <Select value={auth.type} onChange={(e) => setType(e.target.value as AuthType)} className="w-full">
          <option value="none">No Auth</option>
          <option value="apikey">API Key</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="digest">Digest Auth</option>
          <option value="oauth2">OAuth 2.0 (stored token)</option>
        </Select>
      </div>

      {auth.type === 'apikey' && (
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <div>
            <Label>Key</Label>
            <Input value={auth.apiKey?.key ?? ''} onChange={(e) => update(tab.id, { auth: { ...auth, apiKey: { ...auth.apiKey!, key: e.target.value } } })} placeholder="X-Api-Key" />
          </div>
          <div>
            <Label>Value</Label>
            <Input value={auth.apiKey?.value ?? ''} onChange={(e) => update(tab.id, { auth: { ...auth, apiKey: { ...auth.apiKey!, value: e.target.value } } })} placeholder="{{apiKey}}" />
          </div>
          <div>
            <Label>Add to</Label>
            <Select
              value={auth.apiKey?.in ?? 'header'}
              onChange={(e) => update(tab.id, { auth: { ...auth, apiKey: { ...auth.apiKey!, in: e.target.value as 'header' | 'query' } } })}
            >
              <option value="header">Header</option>
              <option value="query">Query Params</option>
            </Select>
          </div>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div className="max-w-xl">
          <Label>Token</Label>
          <Input
            className="font-mono"
            value={auth.bearer?.token ?? ''}
            onChange={(e) => update(tab.id, { auth: { ...auth, bearer: { token: e.target.value } } })}
            placeholder="{{token}} or eyJhbGciOi..."
          />
        </div>
      )}

      {(auth.type === 'basic' || auth.type === 'digest') && (
        <div className="grid grid-cols-2 gap-3 max-w-xl">
          <div>
            <Label>Username</Label>
            <Input
              value={(auth.type === 'basic' ? auth.basic?.username : auth.digest?.username) ?? ''}
              onChange={(e) =>
                update(tab.id, {
                  auth: auth.type === 'basic' ? { ...auth, basic: { ...auth.basic!, username: e.target.value } } : { ...auth, digest: { ...auth.digest!, username: e.target.value } }
                })
              }
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={(auth.type === 'basic' ? auth.basic?.password : auth.digest?.password) ?? ''}
              onChange={(e) =>
                update(tab.id, {
                  auth: auth.type === 'basic' ? { ...auth, basic: { ...auth.basic!, password: e.target.value } } : { ...auth, digest: { ...auth.digest!, password: e.target.value } }
                })
              }
            />
          </div>
        </div>
      )}

      {auth.type === 'oauth2' && (
        <div className="max-w-xl space-y-3">
          <div>
            <Label>Access Token</Label>
            <Input
              className="font-mono"
              value={auth.oauth2?.accessToken ?? ''}
              onChange={(e) => update(tab.id, { auth: { ...auth, oauth2: { ...auth.oauth2!, accessToken: e.target.value } } })}
              placeholder="{{accessToken}}"
            />
          </div>
          <div>
            <Label>Token Type / Header Prefix</Label>
            <Input
              value={auth.oauth2?.tokenType ?? 'Bearer'}
              onChange={(e) => update(tab.id, { auth: { ...auth, oauth2: { ...auth.oauth2!, tokenType: e.target.value } } })}
            />
          </div>
          <p className="text-2xs text-txt-muted">
            Paste an existing access token (e.g. from Authorization Code flow completed elsewhere). Full browser-based OAuth flows are planned in a later phase.
          </p>
        </div>
      )}

      {auth.type === 'none' && <p className="text-xs text-txt-muted">This request will be sent without authentication headers.</p>}
    </div>
  )
}

function BodyTab({ tab }: { tab: TabState }) {
  const update = useTabsStore((s) => s.updateConfig)
  const editorFontSize = useAppStore((s) => s.settings.editorFontSize)
  const bodyType = tab.config.bodyType

  const setType = (t: BodyType) => update(tab.id, { bodyType: t })

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <Select value={bodyType} onChange={(e) => setType(e.target.value as BodyType)} className="!py-0.5 text-xs w-36">
          <option value="none">None</option>
          <option value="json">JSON</option>
          <option value="text">Text</option>
          <option value="xml">XML</option>
          <option value="html">HTML</option>
          <option value="form-data">Form Data</option>
          <option value="urlencoded">URL Encoded</option>
          <option value="binary">Binary File</option>
          <option value="raw">Raw</option>
        </Select>
        {bodyType === 'json' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              try {
                const formatted = JSON.stringify(JSON.parse(tab.config.body.content ?? ''), null, 2)
                update(tab.id, { body: { ...tab.config.body, content: formatted } })
              } catch {
                /* invalid json — leave as is */
              }
            }}
          >
            Format
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {bodyType === 'none' && <div className="p-4 text-xs text-txt-muted">This request has no body.</div>}

        {(bodyType === 'json' || bodyType === 'text' || bodyType === 'xml' || bodyType === 'html' || bodyType === 'raw') && (
          <Suspense fallback={<div className="p-3 text-xs text-txt-muted">Loading editor…</div>}>
            <MonacoEditor
              height="100%"
              language={bodyType === 'json' ? 'json' : bodyType === 'xml' ? 'xml' : bodyType === 'html' ? 'html' : 'plaintext'}
              theme="vs-dark"
              value={tab.config.body.content ?? ''}
              onChange={(v) => update(tab.id, { body: { ...tab.config.body, content: v ?? '' } })}
              options={{
                minimap: { enabled: false },
                fontSize: editorFontSize,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                renderWhitespace: 'none',
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
              }}
            />
          </Suspense>
        )}

        {(bodyType === 'form-data' || bodyType === 'urlencoded') && (
          <KeyValueTable
            rows={tab.config.body.form ?? []}
            onChange={(form) => update(tab.id, { body: { ...tab.config.body, form } })}
            keyPlaceholder="Name"
            valuePlaceholder="Value"
            withFile={bodyType === 'form-data'}
          />
        )}

        {bodyType === 'binary' && (
          <div className="p-4 flex items-center gap-3">
            <Input className="max-w-md" readOnly value={tab.config.body.filePath ?? ''} placeholder="No file selected" />
            <Button
              variant="secondary"
              onClick={async () => {
                const f = await window.api.chooseFile()
                if (f.ok && f.data) update(tab.id, { body: { ...tab.config.body, filePath: f.data } })
              }}
            >
              Choose File
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ScriptsTab({ tab }: { tab: TabState }) {
  const update = useTabsStore((s) => s.updateConfig)
  const editorFontSize = useAppStore((s) => s.settings.editorFontSize)
  const [view, setView] = useState<'pre' | 'post'>('pre')
  const script = view === 'pre' ? (tab.config.preScript ?? '') : (tab.config.postScript ?? '')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <div className="flex rounded overflow-hidden border border-border text-2xs">
          <button className={cn('px-2 py-0.5', view === 'pre' ? 'bg-primary text-primary-fg' : 'bg-elevated text-txt-secondary')} onClick={() => setView('pre')}>
            Pre-request
          </button>
          <button className={cn('px-2 py-0.5', view === 'post' ? 'bg-primary text-primary-fg' : 'bg-elevated text-txt-secondary')} onClick={() => setView('post')}>
            Tests (post-response)
          </button>
        </div>
        <span className="text-2xs text-txt-muted">
          JavaScript · pm.test / pm.expect / pm.environment / pm.response · 5s timeout
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-3 text-xs text-txt-muted">Loading editor…</div>}>
          <MonacoEditor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={script}
            onChange={(v) =>
              update(tab.id, view === 'pre' ? { preScript: v ?? '' } : { postScript: v ?? '' })
            }
            options={{
              minimap: { enabled: false },
              fontSize: editorFontSize,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              scrollbar: { verticalScrollbarSize: 8 }
            }}
          />
        </Suspense>
      </div>
    </div>
  )
}

function SettingsTab({ tab }: { tab: TabState }) {
  const update = useTabsStore((s) => s.updateConfig)
  const s = tab.config.settings
  return (
    <div className="p-3 space-y-4 overflow-auto h-full max-w-lg">
      <div>
        <Label>Request Timeout (ms)</Label>
        <Input
          type="number"
          min={100}
          max={600000}
          value={s.timeoutMs}
          onChange={(e) => update(tab.id, { settings: { ...s, timeoutMs: Number(e.target.value) || 30000 } })}
        />
      </div>
      <Toggle
        checked={s.followRedirects}
        onChange={(v) => update(tab.id, { settings: { ...s, followRedirects: v } })}
        label="Follow redirects"
      />
      {s.followRedirects && (
        <div>
          <Label>Max Redirects</Label>
          <Input
            type="number"
            min={0}
            max={20}
            value={s.maxRedirects}
            onChange={(e) => update(tab.id, { settings: { ...s, maxRedirects: Number(e.target.value) || 0 } })}
          />
        </div>
      )}
      <div>
        <Toggle
          checked={s.verifySsl}
          onChange={(v) => update(tab.id, { settings: { ...s, verifySsl: v } })}
          label="Verify SSL certificates (recommended)"
        />
        {!s.verifySsl && (
          <p className="mt-2 text-2xs text-warning border border-warning/40 rounded p-2 bg-warning/5">
            ⚠ SSL verification is disabled. Only use this for local development servers with self-signed certificates.
          </p>
        )}
      </div>
    </div>
  )
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#36B37E'
    case 'POST':
      return '#E6AD50'
    case 'PUT':
      return '#6C8CFF'
    case 'PATCH':
      return '#9B7BFF'
    case 'DELETE':
      return '#E45B63'
    default:
      return '#9AA1B2'
  }
}

export function resolvePreview(config: HttpRequestConfig, vars: Record<string, string>): string {
  return resolveVariables(config.url, [vars]).result
}

export type { KeyValue }
