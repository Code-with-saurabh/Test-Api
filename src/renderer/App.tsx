import { useEffect, useRef, useState } from 'react'
import { Folder, Clock, Layers, Wrench, Settings as SettingsIcon, Zap, Minus, Plus } from 'lucide-react'
import { useAppStore, loadSettingsIntoStore, type SidebarView } from '@/stores/app'
import { useDataStore } from '@/stores/data'
import { useTabsStore } from '@/stores/tabs'
import { useUpdateStore, loadUpdateStatus, installUpdate } from '@/stores/update'
import { CollectionsView } from '@/features/collections/CollectionsView'
import { HistoryView } from '@/features/history/HistoryView'
import { EnvironmentsView } from '@/features/environments/EnvironmentsView'
import { ToolkitView } from '@/features/toolkit/ToolkitView'
import { SettingsView } from '@/features/settings/SettingsView'
import { RequestBuilder } from '@/features/request-builder/RequestBuilder'
import { ResponsePanel } from '@/features/response-viewer/ResponsePanel'
import { RunTestsDialog } from '@/features/request-builder/RunTestsDialog'
import { Tabs, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MAX_APP_ZOOM, MIN_APP_ZOOM, formatZoomPercent } from '@shared/zoom'
import { APP_NAME } from '@shared/branding'

const SIDEBAR_ITEMS: Array<{ id: SidebarView; label: string; icon: typeof Folder }> = [
  { id: 'collections', label: 'Collections', icon: Folder },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'environments', label: 'Envs', icon: Layers },
  { id: 'toolkit', label: 'Toolkit', icon: Wrench },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
]

export default function App() {
  const sidebarView = useAppStore((s) => s.sidebarView)
  const setSidebarView = useAppStore((s) => s.setSidebarView)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const responseHeight = useAppStore((s) => s.responseHeight)
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth)
  const setResponseHeight = useAppStore((s) => s.setResponseHeight)

  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const setActive = useTabsStore((s) => s.setActive)
  const closeTab = useTabsStore((s) => s.closeTab)
  const newTab = useTabsStore((s) => s.newTab)

  const activeEnvId = useDataStore((s) => s.activeEnvironmentId)
  const environments = useDataStore((s) => s.environments)
  const refreshEnvironments = useDataStore((s) => s.refreshEnvironments)

  const [runnerOpen, setRunnerOpen] = useState(false)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const [resizingResponse, setResizingResponse] = useState(false)
  const [zoomHudVisible, setZoomHudVisible] = useState(false)
  const zoomHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const zoomLevel = useAppStore((s) => s.settings.zoomLevel)
  const updateStatus = useUpdateStore((s) => s.status)

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  useEffect(() => {
    void loadSettingsIntoStore()
    void refreshEnvironments()
  }, [refreshEnvironments])

  // Keep the renderer in sync when zoom changes from the menu, keyboard or wheel.
  useEffect(() => {
    const unsubscribe = window.api.onAppZoomChanged((level) => {
      useAppStore.getState().patchSettings({ zoomLevel: level })
      setZoomHudVisible(true)
      if (zoomHudTimer.current) clearTimeout(zoomHudTimer.current)
      zoomHudTimer.current = setTimeout(() => setZoomHudVisible(false), 1200)
    })
    return () => {
      unsubscribe()
      if (zoomHudTimer.current) clearTimeout(zoomHudTimer.current)
    }
  }, [])

  // Auto-update status is pushed from the main process.
  useEffect(() => {
    void loadUpdateStatus()
    return window.api.onUpdateStatus((status) => useUpdateStore.getState().setStatus(status))
  }, [])

  // Chrome-style Ctrl/Cmd + mouse wheel zoom. Capture phase makes it work even
  // over Monaco editors, inputs and scrollable panels. Throttled so a fast wheel
  // gesture produces clean 10% steps instead of dozens of IPC calls.
  useEffect(() => {
    let lastStepAt = 0
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.deltaY === 0) return
      e.preventDefault()
      e.stopPropagation()
      const now = Date.now()
      if (now - lastStepAt < 90) return
      lastStepAt = now
      void window.api.appZoomStep(e.deltaY < 0 ? 1 : -1)
    }
    window.addEventListener('wheel', handler, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', handler, true)
  }, [])

  // global keyboard shortcuts (zoom keys are handled in the main process)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        newTab()
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (active) closeTab(active.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, closeTab, newTab])

  // sidebar resize
  useEffect(() => {
    if (!resizingSidebar) return
    const onMove = (e: MouseEvent) => setSidebarWidth(Math.max(200, Math.min(480, e.clientX)))
    const onUp = () => setResizingSidebar(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizingSidebar, setSidebarWidth])

  // response panel resize
  useEffect(() => {
    if (!resizingResponse) return
    const onMove = (e: MouseEvent) => {
      const h = window.innerHeight - e.clientY - 28
      setResponseHeight(Math.max(140, Math.min(window.innerHeight - 200, h)))
    }
    const onUp = () => setResizingResponse(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizingResponse, setResponseHeight])

  const activeEnv = environments.find((e) => e.id === activeEnvId)

  return (
    <div className="flex flex-col h-screen overflow-hidden text-txt">
      {/* Top bar */}
      <div className="flex items-center gap-3 h-9 px-3 bg-sidebar border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <Zap size={15} className="text-primary" />
          <span className="font-bold text-[13px] tracking-tight">{APP_NAME}</span>
          <span className="text-[10px] text-txt-muted hidden md:inline">by Saurabh Sharma</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <select
          className="bg-transparent text-xs text-txt-secondary outline-none cursor-pointer max-w-[160px]"
          value={activeEnvId ?? ''}
          onChange={(e) => void useDataStore.getState().setActiveEnvironment(e.target.value || null)}
          title="Active environment"
        >
          <option value="">No Environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setRunnerOpen(true)} title="Collection Runner">
          Runner
        </Button>
        <span className="text-2xs text-txt-muted" title="Local-only, offline-first">
          offline
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Icon rail */}
        <div className="w-11 bg-sidebar border-r border-border flex flex-col items-center py-2 gap-1 shrink-0">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={cn(
                  'w-8 h-8 rounded flex items-center justify-center transition-colors',
                  sidebarView === item.id ? 'bg-elevated text-primary' : 'text-txt-muted hover:text-txt hover:bg-hover'
                )}
                title={item.label}
                onClick={() => setSidebarView(item.id)}
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>

        {/* Sidebar panel */}
        <div className="bg-sidebar border-r border-border flex flex-col shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
          {sidebarView === 'collections' && <CollectionsView />}
          {sidebarView === 'history' && <HistoryView />}
          {sidebarView === 'environments' && <EnvironmentsView />}
          {sidebarView === 'toolkit' && <ToolkitView />}
          {sidebarView === 'settings' && <SettingsView />}
        </div>

        {/* resize handle */}
        <div className="w-1 cursor-col-resize hover:bg-primary/40 shrink-0" onMouseDown={() => setResizingSidebar(true)} />

        {/* Main workspace */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* tabs */}
          <Tabs
            tabs={tabs.map((t) => ({ id: t.id, label: t.title, dirty: t.dirty }))}
            active={active?.id ?? ''}
            onChange={setActive}
            onClose={closeTab}
          />

          {/* request builder */}
          <div className="flex-1 min-h-0 bg-panel" style={{ height: `calc(100% - ${responseHeight}px)` }}>
            {active && <RequestBuilder key={active.id} tab={active} />}
          </div>

          {/* resize handle horizontal */}
          <div className="h-1 cursor-row-resize hover:bg-primary/40 shrink-0" onMouseDown={() => setResizingResponse(true)} />

          {/* response */}
          <div className="bg-panel border-t border-border shrink-0 overflow-hidden" style={{ height: responseHeight }}>
            {active && <ResponsePanel tab={active} />}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="h-7 shrink-0 bg-sidebar border-t border-border flex items-center gap-4 px-3 text-2xs text-txt-muted">
        <span>{activeEnv ? `env: ${activeEnv.name}` : 'no environment'}</span>
        <span>{tabs.length} tab(s)</span>
        {updateStatus.state === 'downloaded' && (
          <button className="text-success hover:underline" onClick={() => void installUpdate()} title="Restart to install the downloaded update">
            Restart to update {updateStatus.version}
          </button>
        )}
        {(updateStatus.state === 'available' || updateStatus.state === 'downloading') && (
          <span className="text-info" title={updateStatus.message}>
            Update {updateStatus.percent != null ? `${updateStatus.percent}%` : 'available'}
          </span>
        )}
        {updateStatus.state === 'error' && (
          <span className="text-error" title={updateStatus.message}>
            update failed
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5" aria-label="App zoom controls">
          <button
            className="px-1 py-0.5 rounded hover:bg-hover disabled:opacity-40"
            disabled={zoomLevel <= MIN_APP_ZOOM}
            onClick={() => void window.api.appZoomStep(-1)}
            title="Zoom out (Ctrl/Cmd + -)"
            aria-label="Zoom out"
          >
            <Minus size={11} />
          </button>
          <button
            className="px-1.5 py-0.5 rounded hover:bg-hover tabular-nums"
            onClick={() => void window.api.appZoomReset()}
            title="Reset zoom to 100% (Ctrl/Cmd + 0)"
            aria-label={`App zoom ${formatZoomPercent(zoomLevel)}. Reset to 100%`}
          >
            {formatZoomPercent(zoomLevel)}
          </button>
          <button
            className="px-1 py-0.5 rounded hover:bg-hover disabled:opacity-40"
            disabled={zoomLevel >= MAX_APP_ZOOM}
            onClick={() => void window.api.appZoomStep(1)}
            title="Zoom in (Ctrl/Cmd + =)"
            aria-label="Zoom in"
          >
            <Plus size={11} />
          </button>
        </div>
        <span>{active?.loading ? 'sending…' : 'ready'}</span>
      </div>

      {zoomHudVisible && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-elevated px-4 py-2 shadow-lg pointer-events-none select-none">
          <span className="text-2xs text-txt-muted mr-2">Zoom</span>
          <span className="text-sm font-semibold tabular-nums text-txt" aria-live="polite">
            {formatZoomPercent(zoomLevel)}
          </span>
        </div>
      )}

      <RunTestsDialog open={runnerOpen} onClose={() => setRunnerOpen(false)} collectionId={active?.collectionId} />
    </div>
  )
}
