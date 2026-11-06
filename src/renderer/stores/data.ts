import { create } from 'zustand'
import type { Collection, Environment, HistoryEntry } from '@shared/types'

interface DataState {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  history: HistoryEntry[]
  refreshCollections: () => Promise<void>
  refreshEnvironments: () => Promise<void>
  refreshHistory: () => Promise<void>
  setActiveEnvironment: (id: string | null) => Promise<void>
}

export const useDataStore = create<DataState>((set) => ({
  collections: [],
  environments: [],
  activeEnvironmentId: null,
  history: [],

  refreshCollections: async () => {
    const res = await window.api.collectionsList()
    if (res.ok) set({ collections: res.data })
  },

  refreshEnvironments: async () => {
    const [list, active] = await Promise.all([window.api.environmentsList(), window.api.environmentsActiveId()])
    if (list.ok) set({ environments: list.data })
    if (active.ok) set({ activeEnvironmentId: active.data })
  },

  refreshHistory: async () => {
    const res = await window.api.historyList({ limit: 300 })
    if (res.ok) set({ history: res.data })
  },

  setActiveEnvironment: async (id) => {
    const res = await window.api.environmentsSetActive(id)
    if (res.ok) set({ activeEnvironmentId: id })
  }
}))
