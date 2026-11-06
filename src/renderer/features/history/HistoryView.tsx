import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, Search } from 'lucide-react'
import { useDataStore } from '@/stores/data'
import { useTabsStore } from '@/stores/tabs'
import { Button, Input, Select, EmptyState } from '@/components/ui'
import { methodColor, statusColor, formatTime, formatMs, formatBytes } from '@shared/utils'

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function HistoryView() {
  const { history, refreshHistory } = useDataStore()
  const newTab = useTabsStore((s) => s.newTab)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('ALL')

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    const t = setTimeout(() => void refreshHistory(), 200)
    return () => clearTimeout(t)
  }, [search, method, refreshHistory])

  const filtered = history.filter(
    (h) => (method === 'ALL' || h.method === method) && (!search || h.url.toLowerCase().includes(search.toLowerCase()) || h.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">History</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm('Clear all history?')) void refreshHistory().then(() => window.api.historyClear()).then(() => refreshHistory())
          }}
        >
          <Trash2 size={12} /> Clear
        </Button>
      </div>

      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-txt-muted" />
          <Input className="!pl-6 !py-1 text-xs" placeholder="Search history…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="!py-1 text-xs w-24" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 && <EmptyState title="No history" description="Requests you send will appear here." />}
        {filtered.map((h) => (
          <div
            key={h.id}
            className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-hover cursor-pointer text-xs group"
            onClick={() =>
              newTab(h.snapshot, {
                title: h.name,
                collectionId: null,
                folderId: null
              })
            }
            title="Open in new tab"
          >
            <span className="font-mono text-2xs font-bold w-11 shrink-0" style={{ color: methodColor(h.method) }}>
              {h.method}
            </span>
            <span
              className="font-mono font-semibold w-10 shrink-0"
              style={{ color: h.status ? statusColor(h.status) : 'var(--text-muted)' }}
            >
              {h.status ?? (h.outcome === 'cancelled' ? 'CANCEL' : 'ERR')}
            </span>
            <span className="truncate flex-1 font-mono">{h.url}</span>
            <span className="text-txt-muted shrink-0 w-16 text-right">{h.timeMs != null ? formatMs(h.timeMs) : ''}</span>
            <span className="text-txt-muted shrink-0 w-16 text-right">{h.sizeBytes != null ? formatBytes(h.sizeBytes) : ''}</span>
            <span className="text-txt-muted shrink-0 w-32 text-right">{formatTime(h.createdAt)}</span>
            <button
              className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                void window.api.historyDelete(h.id).then(() => refreshHistory())
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function useHistoryRefresh(): void {
  const refreshHistory = useDataStore((s) => s.refreshHistory)
  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])
}

export { RotateCcw }
