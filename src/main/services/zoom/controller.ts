import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import {
  normalizeAppZoom,
  stepAppZoom as nextZoomStep,
  zoomPercentToFactor,
  type ZoomDirection
} from '@shared/zoom'
import { getDb, persist } from '../db/store'

function safeBroadcast(win: BrowserWindow | null, level: number): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC.appZoomChanged, level)
}

function applyToWindow(win: BrowserWindow | null, level: number): void {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.setZoomFactor(zoomPercentToFactor(level))
  } catch (error) {
    console.error('[zoom] could not apply zoom factor', error)
  }
}

/** Read the persisted zoom and apply it to a freshly created window. */
export function applyStoredZoom(win: BrowserWindow): number {
  const level = normalizeAppZoom(getDb().settings.zoomLevel)
  applyToWindow(win, level)
  return level
}

export function getAppZoom(): number {
  return normalizeAppZoom(getDb().settings.zoomLevel)
}

/** Set an absolute zoom percentage, persist it and notify the renderer. */
export function setAppZoom(win: BrowserWindow | null, value: number): number {
  const level = normalizeAppZoom(value)
  const db = getDb()
  if (db.settings.zoomLevel !== level) {
    db.settings.zoomLevel = level
    persist()
  }
  applyToWindow(win, level)
  safeBroadcast(win, level)
  return level
}

export function stepAppZoom(win: BrowserWindow | null, direction: ZoomDirection): number {
  return setAppZoom(win, nextZoomStep(getAppZoom(), direction))
}

export function resetAppZoom(win: BrowserWindow | null): number {
  return setAppZoom(win, 100)
}
