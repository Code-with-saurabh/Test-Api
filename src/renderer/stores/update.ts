import { create } from 'zustand'
import type { UpdateStatus } from '@shared/update'
import { IDLE_UPDATE_STATUS } from '@shared/update'

interface UpdateStore {
  status: UpdateStatus
  setStatus: (status: UpdateStatus) => void
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  status: { ...IDLE_UPDATE_STATUS },
  setStatus: (status) => set({ status })
}))

export async function loadUpdateStatus(): Promise<void> {
  const res = await window.api.updateStatus()
  if (res.ok) useUpdateStore.getState().setStatus(res.data)
}

export async function checkForUpdates(): Promise<void> {
  const res = await window.api.updateCheck()
  if (res.ok) useUpdateStore.getState().setStatus(res.data)
}

export async function downloadUpdate(): Promise<void> {
  const res = await window.api.updateDownload()
  if (res.ok) useUpdateStore.getState().setStatus(res.data)
}

export async function installUpdate(): Promise<void> {
  await window.api.updateInstall()
}
