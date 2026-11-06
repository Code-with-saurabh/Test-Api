import { create } from 'zustand'
import type { HttpRequestConfig, TestAssertionResult } from '@shared/types'
import { emptyConfig } from '@shared/curl'

export interface ResponseState {
  status: number | null
  statusText: string
  headers: Record<string, string>
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>
  bodyText: string
  bodyEncoding: 'utf8' | 'base64'
  sizeBytes: number
  timeMs: number
  contentType: string
}

export interface TabState {
  id: string
  title: string
  config: HttpRequestConfig
  dirty: boolean
  savedRequestId?: string
  collectionId?: string | null
  folderId?: string | null
  response: ResponseState | null
  responseError: { code: string; message: string } | null
  loading: boolean
  preResult?: { logs: string[]; assertions: TestAssertionResult[]; error?: string }
  postResult?: { logs: string[]; assertions: TestAssertionResult[]; error?: string }
}

interface TabsState {
  tabs: TabState[]
  activeTabId: string
  newTab: (config?: Partial<HttpRequestConfig>, opts?: { title?: string; savedRequestId?: string; collectionId?: string | null; folderId?: string | null }) => string
  closeTab: (id: string) => void
  setActive: (id: string) => void
  updateConfig: (id: string, patch: Partial<HttpRequestConfig> | ((c: HttpRequestConfig) => HttpRequestConfig)) => void
  setTitle: (id: string, title: string) => void
  markSaved: (id: string, savedRequestId: string, collectionId: string | null, folderId: string | null, title: string) => void
  setLoading: (id: string, loading: boolean) => void
  setResponse: (id: string, response: ResponseState | null, error: { code: string; message: string } | null) => void
  setScriptResults: (
    id: string,
    pre?: TabState['preResult'],
    post?: TabState['postResult']
  ) => void
}

let seq = 0

function makeTab(partial?: Partial<TabState>): TabState {
  return {
    id: `tab-${++seq}-${Date.now()}`,
    title: 'New Request',
    config: emptyConfig(),
    dirty: false,
    response: null,
    responseError: null,
    loading: false,
    collectionId: null,
    folderId: null,
    ...partial
  }
}

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [makeTab()],
  activeTabId: '',

  newTab: (config, opts) => {
    const tab = makeTab({
      config: { ...emptyConfig(), ...config },
      title: opts?.title ?? 'New Request',
      savedRequestId: opts?.savedRequestId,
      collectionId: opts?.collectionId ?? null,
      folderId: opts?.folderId ?? null,
      dirty: !opts?.savedRequestId
    })
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    return tab.id
  },

  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      if (tabs.length === 0) {
        const t = makeTab()
        return { tabs: [t], activeTabId: t.id }
      }
      const activeTabId = s.activeTabId === id ? tabs[tabs.length - 1]!.id : s.activeTabId
      return { tabs, activeTabId }
    }),

  setActive: (activeTabId) => set({ activeTabId }),

  updateConfig: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              dirty: true,
              config: typeof patch === 'function' ? patch(t.config) : { ...t.config, ...patch }
            }
          : t
      )
    })),

  setTitle: (id, title) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)) })),

  markSaved: (id, savedRequestId, collectionId, folderId, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, savedRequestId, collectionId, folderId, title, dirty: false } : t))
    })),

  setLoading: (id, loading) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, loading } : t)) })),

  setResponse: (id, response, error) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, response, responseError: error, loading: false } : t)) })),

  setScriptResults: (id, pre, post) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, preResult: pre, postResult: post } : t)) }))
}))

export function activeTab(): TabState | null {
  const { tabs, activeTabId } = useTabsStore.getState()
  return tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null
}
