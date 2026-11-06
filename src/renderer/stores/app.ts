import { create } from 'zustand'
import type { AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

export type SidebarView = 'collections' | 'history' | 'environments' | 'toolkit' | 'settings' | 'runner'

interface AppState {
  sidebarView: SidebarView
  sidebarWidth: number
  responseHeight: number
  settings: AppSettings
  setSidebarView: (v: SidebarView) => void
  setSidebarWidth: (w: number) => void
  setResponseHeight: (h: number) => void
  setSettings: (s: AppSettings) => void
  patchSettings: (patch: Partial<AppSettings>) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarView: 'collections',
  sidebarWidth: 280,
  responseHeight: 340,
  settings: { ...DEFAULT_SETTINGS },
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setResponseHeight: (responseHeight) => set({ responseHeight }),
  setSettings: (settings) => set({ settings }),
  patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } }))
}))

export async function loadSettingsIntoStore(): Promise<void> {
  const res = await window.api.getSettings()
  if (res.ok) {
    useAppStore.getState().setSettings(res.data)
    document.documentElement.setAttribute('data-theme', res.data.theme)
  }
}

export async function persistSettingsPatch(patch: Partial<AppSettings>): Promise<void> {
  useAppStore.getState().patchSettings(patch)
  const res = await window.api.updateSettings(patch)
  if (res.ok) {
    useAppStore.getState().setSettings(res.data)
    document.documentElement.setAttribute('data-theme', res.data.theme)
  }
}
