/* JSON file-backed store with atomic writes. Interface mirrors a future SQLite swap. */
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type {
  AppSettings,
  Collection,
  Environment,
  Folder,
  HistoryEntry,
  SavedRequest,
  TestRunRecord,
  VariableRow,
  Workspace
} from '@shared/types'
import { DEFAULT_SETTINGS, normalizeEditorFontSize } from '@shared/types'
import { isValidAppZoom, normalizeAppZoom } from '@shared/zoom'

export interface DbShape {
  version: number
  workspaces: Workspace[]
  collections: Collection[]
  folders: Folder[]
  requests: SavedRequest[]
  environments: Environment[]
  variables: VariableRow[]
  history: HistoryEntry[]
  testRuns: TestRunRecord[]
  settings: AppSettings
  activeEnvironmentId: string | null
}

const DEFAULT_DB: DbShape = {
  version: 1,
  workspaces: [],
  collections: [],
  folders: [],
  requests: [],
  environments: [],
  variables: [],
  history: [],
  testRuns: [],
  settings: { ...DEFAULT_SETTINGS },
  activeEnvironmentId: null
}

let db: DbShape | null = null
let dbPath = ''
let writeTimer: NodeJS.Timeout | null = null
let dirty = false

export function dbFile(): string {
  return path.join(app.getPath('userData'), 'testapi-store.json')
}

/**
 * Best-effort migration from the earlier APIFORGE builds so existing
 * collections/history/settings are not lost after the rebrand.
 */
function migrateLegacyDb(): void {
  if (fs.existsSync(dbPath)) return
  const appData = app.getPath('appData')
  const candidates = [
    path.join(path.dirname(dbPath), 'apiforge-store.json'),
    path.join(appData, 'apiforge', 'apiforge-store.json'),
    path.join(appData, 'APIFORGE', 'apiforge-store.json'),
    path.join(appData, 'testapi', 'apiforge-store.json')
  ]
  for (const candidate of candidates) {
    if (candidate === dbPath || !fs.existsSync(candidate)) continue
    try {
      fs.copyFileSync(candidate, dbPath)
      return
    } catch {
      /* try the next candidate */
    }
  }
}

export function initDb(): DbShape {
  dbPath = dbFile()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  migrateLegacyDb()

  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<DbShape>
      db = {
        ...DEFAULT_DB,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
      }
      if (!isValidAppZoom(db.settings.zoomLevel)) {
        db.settings.zoomLevel = DEFAULT_SETTINGS.zoomLevel
        persist()
      }
      db.settings.zoomLevel = normalizeAppZoom(db.settings.zoomLevel)
      db.settings.editorFontSize = normalizeEditorFontSize(db.settings.editorFontSize)
      // backup every init if migrations might run later
    } catch {
      // corrupt file → backup and reset
      try {
        fs.copyFileSync(dbPath, dbPath + `.corrupt.${Date.now()}`)
      } catch {
        /* ignore */
      }
      db = structuredClone(DEFAULT_DB)
      persistNow()
    }
  } else {
    db = structuredClone(DEFAULT_DB)
    persistNow()
  }

  // ensure default workspace
  if (!db.workspaces.length) {
    db.workspaces.push({ id: 'default', name: 'My Workspace', createdAt: Date.now() })
  }
  return db
}

export function getDb(): DbShape {
  if (!db) return initDb()
  return db
}

/** Debounced persist (100ms) — coalesces bursts of mutations */
export function persist(): void {
  dirty = true
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (dirty) persistNow()
  }, 100)
}

export function persistNow(): void {
  if (!db) return
  dirty = false
  const tmp = dbPath + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1), 'utf8')
    fs.renameSync(tmp, dbPath)
  } catch (e) {
    console.error('persist failed', e)
  }
}

export function flushOnExit(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (dirty) persistNow()
}

/* ---------- helpers ---------- */

export function now(): number {
  return Date.now()
}

export function uid(): string {
  return crypto.randomUUID()
}

export function historyRetention(): number {
  const n = getDb().settings.historyRetention
  return Number.isFinite(n) && n > 0 ? n : 500
}
