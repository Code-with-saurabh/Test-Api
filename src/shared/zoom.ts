/**
 * App zoom model — shared by the main process, preload and renderer.
 *
 * Zoom behaves like a browser's page zoom: the whole window (every panel,
 * input, table and editor) is scaled together. Values are stored as integer
 * percentages so they survive JSON persistence and IPC without floating point
 * drift.
 */
export const MIN_APP_ZOOM = 50
export const MAX_APP_ZOOM = 300
export const DEFAULT_APP_ZOOM = 100
export const APP_ZOOM_STEP = 10

export type ZoomDirection = -1 | 1

/** True only for a supported integer percentage within range and on-step. */
export function isValidAppZoom(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_APP_ZOOM &&
    value <= MAX_APP_ZOOM &&
    (value - MIN_APP_ZOOM) % APP_ZOOM_STEP === 0
  )
}

/** Round any finite number to the nearest supported zoom step. */
export function clampAppZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_APP_ZOOM
  const stepped = Math.round(value / APP_ZOOM_STEP) * APP_ZOOM_STEP
  return Math.max(MIN_APP_ZOOM, Math.min(MAX_APP_ZOOM, stepped))
}

/** Coerce persisted/user input into a valid zoom value. */
export function normalizeAppZoom(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_APP_ZOOM
  return clampAppZoom(value)
}

/** Move one step up/down without crossing the limits. */
export function stepAppZoom(current: unknown, direction: ZoomDirection): number {
  const safe = normalizeAppZoom(current)
  const next = safe + (direction >= 0 ? 1 : -1) * APP_ZOOM_STEP
  return clampAppZoom(next)
}

/** Electron's webContents.setZoomFactor accepts 0.5 … 3.0 here. */
export function zoomPercentToFactor(percent: number): number {
  return normalizeAppZoom(percent) / 100
}

export function formatZoomPercent(percent: number): string {
  return `${normalizeAppZoom(percent)}%`
}
