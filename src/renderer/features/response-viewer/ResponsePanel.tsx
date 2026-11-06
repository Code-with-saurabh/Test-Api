import { useMemo, useState } from 'react'
import { Download, Copy, Search, CheckCircle2, XCircle, FileText, Clock, ArrowUpDown } from 'lucide-react'
import type { TabState } from '@/stores/tabs'
import { SubTabs, Button, Input } from '@/components/ui'
import { JsonTree, jsonMatchCount } from './JsonTree'
import { formatBytes, formatMs, statusColor, tryFormatJson } from '@shared/utils'
import { cn } from '@/lib/cn'

type RespTab = 'body' | 'headers' | 'cookies' | 'tests' | 'preview'

export function ResponsePanel({ tab }: { tab: TabState }) {
  const [respTab, setRespTab] = useState<RespTab>('body')
  const [bodyView, setBodyView] = useState<'pretty' | 'raw'>('pretty')
  const [search, setSearch] = useState('')
  const [wrap, setWrap] = useState(true)

  const response = tab.response
  const error = tab.responseError

  const contentType = response?.headers['content-type'] ?? ''
  const isImage = /image\//i.test(contentType)
  const isHtml = /text\/html/i.test(contentType)
  const isJson = /json/i.test(contentType) || looksLikeJson(response?.bodyText ?? '')

  const prettyBody = useMemo(() => {
    if (!response || response.bodyEncoding === 'base64') return response?.bodyText ?? ''
    if (bodyView === 'pretty' && isJson) return tryFormatJson(response.bodyText) ?? response.bodyText
    if (bodyView === 'pretty' && /xml/i.test(contentType)) return tryFormatXml(response.bodyText)
    return response.bodyText
  }, [response, bodyView, isJson, contentType])

  const matches = useMemo(() => jsonMatchCount(prettyBody, search), [prettyBody, search])

  if (tab.loading) {
    return (
      <div className="flex items-center justify-center h-full text-txt-secondary text-xs gap-2">
        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
        Sending request…
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 h-full overflow-auto">
        <div className="panel border-error/40 p-4 max-w-xl">
          <div className="flex items-center gap-2 text-error font-medium text-sm mb-1">
            <XCircle size={16} /> {errorCodeLabel(error.code)}
          </div>
          <div className="text-xs text-txt-secondary mb-2">{error.message}</div>
          <pre className="code text-2xs text-txt-muted bg-app rounded p-2 border border-border overflow-auto">{error.code}</pre>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-txt-muted text-xs">
        Send a request to see the response here
      </div>
    )
  }

  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers', badge: Object.keys(response.headers).length },
    { id: 'cookies', label: 'Cookies', badge: response.cookies.length || undefined },
    { id: 'tests', label: 'Tests', badge: testBadge(tab) },
    { ...(isHtml || isImage ? [{ id: 'preview', label: 'Preview' }] : [])
    }
  ].filter(Boolean) as Array<{ id: string; label: string; badge?: number | undefined }>

  return (
    <div className="flex flex-col h-full">
      {/* meta bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-sidebar text-xs">
        <span className="font-semibold" style={{ color: statusColor(response.status ?? 0) }}>
          {response.status} {response.statusText}
        </span>
        <span className="text-txt-secondary flex items-center gap-1">
          <Clock size={11} /> {formatMs(response.timeMs)}
        </span>
        <span className="text-txt-secondary flex items-center gap-1">
          <ArrowUpDown size={11} /> {formatBytes(response.sizeBytes)}
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => void copyText(prettyBody)} title="Copy body">
          <Copy size={12} /> Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void downloadBody(response)}
          disabled={response.bodyEncoding === 'base64' && false}
          title="Save body to file"
        >
          <Download size={12} /> Save
        </Button>
      </div>

      <SubTabs tabs={tabs} active={respTab} onChange={(id) => setRespTab(id as RespTab)} />

      {respTab === 'body' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-3 py-1 border-b border-border">
            <div className="flex rounded overflow-hidden border border-border text-2xs">
              <button className={cn('px-2 py-0.5', bodyView === 'pretty' ? 'bg-primary text-primary-fg' : 'bg-elevated text-txt-secondary')} onClick={() => setBodyView('pretty')}>
                Pretty
              </button>
              <button className={cn('px-2 py-0.5', bodyView === 'raw' ? 'bg-primary text-primary-fg' : 'bg-elevated text-txt-secondary')} onClick={() => setBodyView('raw')}>
                Raw
              </button>
            </div>
            <div className="flex-1" />
            <div className="relative w-56">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-txt-muted" />
              <Input
                className="!pl-6 !py-0.5 text-xs"
                placeholder="Search in response…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-txt-muted">{matches} hits</span>}
            </div>
            <label className="flex items-center gap-1 text-2xs text-txt-secondary cursor-pointer">
              <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} /> Wrap
            </label>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {response.bodyEncoding === 'base64' ? (
              <div className="p-3 text-xs text-txt-secondary">
                Binary response ({formatBytes(response.sizeBytes)}) — saved via Save button.
                <pre className="code mt-2 text-2xs text-txt-muted overflow-auto max-h-40">{response.bodyText.slice(0, 500)}…</pre>
              </div>
            ) : bodyView === 'pretty' && isJson ? (
              <JsonTree text={prettyBody} />
            ) : (
              <pre className={cn('code p-3 h-full overflow-auto', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')} style={{ maxHeight: '100%' }}>
                {highlightSearch(prettyBody, search)}
              </pre>
            )}
          </div>
        </div>
      )}

      {respTab === 'headers' && (
        <div className="flex-1 overflow-auto p-3">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k} className="border-b border-border/50">
                  <td className="py-1 pr-4 font-mono text-json-key align-top whitespace-nowrap">{k}</td>
                  <td className="py-1 font-mono text-txt break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {respTab === 'cookies' && (
        <div className="flex-1 overflow-auto p-3">
          {response.cookies.length === 0 ? (
            <div className="text-xs text-txt-muted">No cookies in response</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-txt-secondary text-left border-b border-border">
                  <th className="py-1 pr-3 font-medium">Name</th>
                  <th className="py-1 pr-3 font-medium">Value</th>
                  <th className="py-1 pr-3 font-medium">Domain</th>
                  <th className="py-1 font-medium">Path</th>
                </tr>
              </thead>
              <tbody>
                {response.cookies.map((c, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1 pr-3 font-mono">{c.name}</td>
                    <td className="py-1 pr-3 font-mono break-all">{c.value}</td>
                    <td className="py-1 pr-3">{c.domain ?? '—'}</td>
                    <td className="py-1">{c.path ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {respTab === 'tests' && <TestsResultView tab={tab} />}

      {respTab === 'preview' && isImage && (
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <img src={`data:${contentType};base64,${response.bodyText}`} alt="response" className="max-w-full max-h-full object-contain" />
        </div>
      )}
      {respTab === 'preview' && isHtml && (
        <div className="flex-1 min-h-0">
          <iframe
            sandbox=""
            srcDoc={response.bodyText}
            title="HTML preview"
            className="w-full h-full bg-white"
            style={{ border: 'none' }}
          />
        </div>
      )}
    </div>
  )
}

function TestsResultView({ tab }: { tab: TabState }) {
  const pre = tab.preResult
  const post = tab.postResult
  if (!pre && !post) {
    return <div className="p-3 text-xs text-txt-muted">No scripts ran for this request. Add scripts in the Scripts tab.</div>
  }
  const all = [...(pre?.assertions ?? []), ...(post?.assertions ?? [])]
  return (
    <div className="flex-1 overflow-auto p-3 space-y-3">
      {pre?.error && <div className="text-xs text-error">Pre-request script error: {pre.error}</div>}
      {post?.error && <div className="text-xs text-error">Test script error: {post.error}</div>}
      {all.length === 0 && !pre?.error && !post?.error && (
        <div className="text-xs text-txt-muted">Scripts ran but no assertions were recorded.</div>
      )}
      {all.map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          {a.passed ? <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" /> : <XCircle size={14} className="text-error mt-0.5 shrink-0" />}
          <div>
            <div className={a.passed ? 'text-txt' : 'text-error font-medium'}>{a.name}</div>
            {a.message && <div className="text-txt-secondary mt-0.5">{a.message}</div>}
          </div>
        </div>
      ))}
      {[...(pre?.logs ?? []), ...(post?.logs ?? [])].length > 0 && (
        <div className="border-t border-border pt-2">
          <div className="text-2xs text-txt-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
            <FileText size={11} /> Console
          </div>
          <pre className="code text-2xs text-txt-secondary bg-app rounded p-2 border border-border">
            {[...(pre?.logs ?? []), ...(post?.logs ?? [])].join('\n')}
          </pre>
        </div>
      )}
    </div>
  )
}

function testBadge(tab: TabState): number | undefined {
  const n = (tab.postResult?.assertions.length ?? 0) + (tab.preResult?.assertions.length ?? 0)
  return n || undefined
}

function errorCodeLabel(code: string): string {
  const map: Record<string, string> = {
    DNS_ERROR: 'DNS Resolution Failed',
    CONN_REFUSED: 'Connection Refused',
    CONN_RESET: 'Connection Reset',
    TIMEOUT: 'Request Timed Out',
    TLS_ERROR: 'SSL/TLS Certificate Error',
    INVALID_URL: 'Invalid URL',
    ABORTED: 'Request Cancelled',
    UNREACHABLE: 'Host Unreachable',
    NETWORK_ERROR: 'Network Error',
    INTERNAL: 'Internal Error',
    VALIDATION: 'Validation Error'
  }
  return map[code] ?? 'Request Failed'
}

function looksLikeJson(s: string): boolean {
  const t = s.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

function tryFormatXml(xml: string): string {
  try {
    const parsed = new DOMParser().parseFromString(xml, 'text/xml')
    const serializer = new XMLSerializer()
    let out = serializer.serializeToString(parsed)
    // basic indent
    let indent = 0
    out = out
      .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
      .split('\n')
      .map((line) => {
        if (/^<\/[^>]+>/.test(line)) indent = Math.max(0, indent - 1)
        const s = '  '.repeat(indent) + line
        if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) indent++
        return s
      })
      .join('\n')
    return out
  } catch {
    return xml
  }
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let idx = 0
  let start = 0
  let key = 0
  while ((idx = lower.indexOf(q, start)) !== -1) {
    if (idx > start) parts.push(text.slice(start, idx))
    parts.push(
      <mark key={key++} className="bg-warning/40 text-txt">
        {text.slice(idx, idx + query.length)}
      </mark>
    )
    start = idx + query.length
  }
  parts.push(text.slice(start))
  return parts
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

async function downloadBody(response: NonNullable<TabState['response']>): Promise<void> {
  const ext = /json/i.test(response.headers['content-type'] ?? '')
    ? '.json'
    : /xml/i.test(response.headers['content-type'] ?? '')
      ? '.xml'
      : /html/i.test(response.headers['content-type'] ?? '')
        ? '.html'
        : '.txt'
  await window.api.saveFile(`response${ext}`, response.bodyText, response.bodyEncoding)
}
