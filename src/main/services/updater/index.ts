import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo, ProgressInfo } from 'electron-updater'
import { IPC } from '@shared/ipc'
import type { UpdateStatus } from '@shared/update'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 8_000

let status: UpdateStatus = { state: 'idle', currentVersion: app.getVersion() }
let initialized = false
let timer: NodeJS.Timeout | null = null

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.updateStatusChanged, status)
  }
}

function setStatus(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch, currentVersion: app.getVersion() }
  broadcast()
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

function promptRestart(version: string): void {
  const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const options = {
    type: 'info' as const,
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'TestApi update ready',
    message: `TestApi ${version} is ready to install.`,
    detail: 'Restart TestApi to finish the update. Your collections, environments and settings stay on this device.'
  }
  const show = focused ? dialog.showMessageBox(focused, options) : dialog.showMessageBox(options)
  void show.then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall(false, true)
  })
}

export function initAutoUpdater(): void {
  status.currentVersion = app.getVersion()
  if (!app.isPackaged) {
    setStatus({
      state: 'disabled',
      message: 'Auto-update is enabled in the installed app. In development you are already running the latest source.'
    })
    return
  }
  if (initialized) return
  initialized = true

  autoUpdater.logger = console
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', message: 'Checking for updates…', percent: undefined })
  })
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setStatus({
      state: 'available',
      version: info.version,
      percent: 0,
      message: `TestApi ${info.version} is available — downloading in the background.`
    })
  })
  autoUpdater.on('update-not-available', () => {
    setStatus({
      state: 'not-available',
      version: app.getVersion(),
      message: 'You are running the latest version.',
      checkedAt: Date.now()
    })
  })
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setStatus({
      state: 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      message: `Downloading update… ${Math.round(progress.percent)}%`
    })
  })
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    setStatus({
      state: 'downloaded',
      version: info.version,
      percent: 100,
      message: `TestApi ${info.version} is downloaded and will install on restart.`,
      checkedAt: Date.now()
    })
    promptRestart(info.version)
  })
  autoUpdater.on('error', (error: Error) => {
    setStatus({ state: 'error', message: `Update failed: ${errorMessage(error)}`, checkedAt: Date.now() })
  })

  setTimeout(() => void checkForUpdates(false), FIRST_CHECK_DELAY_MS)
  timer = setInterval(() => void checkForUpdates(false), CHECK_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
}

export async function checkForUpdates(manual = true): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    setStatus({
      state: 'disabled',
      message: 'Auto-update is enabled in the installed app. In development you are already running the latest source.'
    })
    return status
  }
  if (status.state === 'checking' || status.state === 'downloading') return status

  setStatus({ state: 'checking', message: manual ? 'Checking for updates…' : undefined })
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setStatus({ state: 'error', message: `Update check failed: ${errorMessage(error)}`, checkedAt: Date.now() })
  }
  return status
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!app.isPackaged) return checkForUpdates()
  if (status.state !== 'available' && status.state !== 'error') return status
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    setStatus({ state: 'error', message: `Download failed: ${errorMessage(error)}`, checkedAt: Date.now() })
  }
  return status
}

export function installUpdate(): boolean {
  if (!app.isPackaged || status.state !== 'downloaded') return false
  autoUpdater.quitAndInstall(false, true)
  return true
}

export function stopAutoUpdater(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
