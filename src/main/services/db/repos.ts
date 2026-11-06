/* All data access goes through these repos — renderer never sees store directly */
import type {
  Collection,
  CollectionTree,
  Environment,
  Folder,
  HistoryEntry,
  SavedRequest,
  TestRunRecord,
  VariableRow,
  VarScope
} from '@shared/types'
import type { HttpRequestConfig } from '@shared/types'
import { getDb, historyRetention, now, persist, uid } from './store'

/* ---------- collections ---------- */

export function listCollections(workspaceId = 'default'): Collection[] {
  return getDb()
    .collections.filter((c) => c.workspaceId === workspaceId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function createCollection(name: string, description = ''): Collection {
  const db = getDb()
  const c: Collection = {
    id: uid(),
    workspaceId: 'default',
    name,
    description,
    auth: null,
    sortOrder: db.collections.length,
    createdAt: now(),
    updatedAt: now()
  }
  db.collections.push(c)
  persist()
  return c
}

export function updateCollection(id: string, patch: Partial<Pick<Collection, 'name' | 'description'>>): Collection {
  const c = getDb().collections.find((x) => x.id === id)
  if (!c) throw new Error('Collection not found')
  Object.assign(c, patch, { updatedAt: now() })
  persist()
  return c
}

export function deleteCollection(id: string): void {
  const db = getDb()
  db.collections = db.collections.filter((c) => c.id !== id)
  const folderIds = new Set(db.folders.filter((f) => f.collectionId === id).map((f) => f.id))
  db.folders = db.folders.filter((f) => f.collectionId !== id)
  db.requests = db.requests.filter((r) => r.collectionId !== id && !folderIds.has(r.folderId ?? ''))
  db.variables = db.variables.filter((v) => !(v.ownerType === 'collection' && v.ownerId === id))
  persist()
}

export function duplicateCollection(id: string): Collection {
  const db = getDb()
  const src = db.collections.find((c) => c.id === id)
  if (!src) throw new Error('Collection not found')
  const copy: Collection = { ...src, id: uid(), name: src.name + ' Copy', createdAt: now(), updatedAt: now() }
  db.collections.push(copy)

  const folderMap = new Map<string, string>()
  for (const f of db.folders.filter((f) => f.collectionId === id)) {
    const nid = uid()
    folderMap.set(f.id, nid)
    db.folders.push({ ...f, id: nid, collectionId: copy.id, parentFolderId: f.parentFolderId ? folderMap.get(f.parentFolderId) ?? null : null, createdAt: now(), updatedAt: now() })
  }
  for (const r of db.requests.filter((r) => r.collectionId === id)) {
    db.requests.push({
      ...structuredClone(r),
      id: uid(),
      collectionId: copy.id,
      folderId: r.folderId ? folderMap.get(r.folderId) ?? null : null,
      createdAt: now(),
      updatedAt: now()
    })
  }
  persist()
  return copy
}

export function getCollectionTree(collectionId: string): CollectionTree {
  const db = getDb()
  const collection = db.collections.find((c) => c.id === collectionId)
  if (!collection) throw new Error('Collection not found')
  return {
    collection,
    folders: db.folders.filter((f) => f.collectionId === collectionId).sort((a, b) => a.sortOrder - b.sortOrder),
    requests: db.requests.filter((r) => r.collectionId === collectionId).sort((a, b) => a.sortOrder - b.sortOrder)
  }
}

/* ---------- folders ---------- */

export function createFolder(collectionId: string, parentFolderId: string | null, name: string, description = ''): Folder {
  const db = getDb()
  const f: Folder = {
    id: uid(),
    collectionId,
    parentFolderId,
    name,
    description,
    sortOrder: db.folders.filter((x) => x.collectionId === collectionId).length,
    createdAt: now(),
    updatedAt: now()
  }
  db.folders.push(f)
  persist()
  return f
}

export function updateFolder(id: string, patch: Partial<Pick<Folder, 'name' | 'description'>>): Folder {
  const f = getDb().folders.find((x) => x.id === id)
  if (!f) throw new Error('Folder not found')
  Object.assign(f, patch, { updatedAt: now() })
  persist()
  return f
}

export function deleteFolder(id: string): void {
  const db = getDb()
  // collect subtree
  const toDelete = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const f of db.folders) {
      if (f.parentFolderId && toDelete.has(f.parentFolderId) && !toDelete.has(f.id)) {
        toDelete.add(f.id)
        grew = true
      }
    }
  }
  db.folders = db.folders.filter((f) => !toDelete.has(f.id))
  db.requests = db.requests.filter((r) => !toDelete.has(r.folderId ?? ''))
  persist()
}

/* ---------- requests ---------- */

export function createRequest(
  collectionId: string,
  folderId: string | null,
  name: string,
  description: string,
  config: HttpRequestConfig
): SavedRequest {
  const db = getDb()
  const r: SavedRequest = {
    id: uid(),
    collectionId,
    folderId,
    name,
    description,
    sortOrder: db.requests.filter((x) => x.collectionId === collectionId).length,
    config: structuredClone(config),
    createdAt: now(),
    updatedAt: now()
  }
  db.requests.push(r)
  persist()
  return r
}

export function updateRequest(
  id: string,
  patch: Partial<Pick<SavedRequest, 'name' | 'description' | 'config' | 'folderId'>>
): SavedRequest {
  const r = getDb().requests.find((x) => x.id === id)
  if (!r) throw new Error('Request not found')
  if (patch.config) patch.config = structuredClone(patch.config)
  Object.assign(r, patch, { updatedAt: now() })
  persist()
  return r
}

export function deleteRequest(id: string): void {
  const db = getDb()
  db.requests = db.requests.filter((r) => r.id !== id)
  persist()
}

export function moveRequest(id: string, collectionId: string, folderId: string | null, sortOrder?: number): SavedRequest {
  const r = getDb().requests.find((x) => x.id === id)
  if (!r) throw new Error('Request not found')
  r.collectionId = collectionId
  r.folderId = folderId
  if (sortOrder !== undefined) r.sortOrder = sortOrder
  r.updatedAt = now()
  persist()
  return r
}

/* ---------- environments ---------- */

export function listEnvironments(workspaceId = 'default'): Environment[] {
  return getDb()
    .environments.filter((e) => e.workspaceId === workspaceId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function createEnvironment(name: string): Environment {
  const db = getDb()
  const e: Environment = { id: uid(), workspaceId: 'default', name, sortOrder: db.environments.length, createdAt: now(), updatedAt: now() }
  db.environments.push(e)
  persist()
  return e
}

export function updateEnvironment(id: string, patch: Partial<Pick<Environment, 'name'>>): Environment {
  const e = getDb().environments.find((x) => x.id === id)
  if (!e) throw new Error('Environment not found')
  Object.assign(e, patch, { updatedAt: now() })
  persist()
  return e
}

export function deleteEnvironment(id: string): void {
  const db = getDb()
  db.environments = db.environments.filter((e) => e.id !== id)
  db.variables = db.variables.filter((v) => !(v.ownerType === 'environment' && v.ownerId === id))
  if (db.activeEnvironmentId === id) db.activeEnvironmentId = null
  persist()
}

export function setActiveEnvironment(id: string | null): void {
  getDb().activeEnvironmentId = id
  persist()
}

export function getActiveEnvironmentId(): string | null {
  return getDb().activeEnvironmentId
}

/* ---------- variables ---------- */

export function listVariables(ownerType: VarScope, ownerId: string): VariableRow[] {
  return getDb()
    .variables.filter((v) => v.ownerType === ownerType && v.ownerId === ownerId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function upsertVariable(
  ownerType: VarScope,
  ownerId: string,
  key: string,
  value: string,
  enabled: boolean,
  isSecret: boolean
): VariableRow {
  const db = getDb()
  const existing = db.variables.find((v) => v.ownerType === ownerType && v.ownerId === ownerId && v.key === key)
  if (existing) {
    existing.value = value
    existing.enabled = enabled
    existing.isSecret = isSecret
    persist()
    return existing
  }
  const v: VariableRow = {
    id: uid(),
    ownerType,
    ownerId,
    key,
    value,
    enabled,
    isSecret,
    sortOrder: db.variables.filter((x) => x.ownerType === ownerType && x.ownerId === ownerId).length
  }
  db.variables.push(v)
  persist()
  return v
}

export function deleteVariable(id: string): void {
  const db = getDb()
  db.variables = db.variables.filter((v) => v.id !== id)
  persist()
}

export function variablesToMap(ownerType: VarScope, ownerId: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of listVariables(ownerType, ownerId)) {
    if (v.enabled) out[v.key] = v.value
  }
  return out
}

/* ---------- history ---------- */

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const db = getDb()
  // redact secrets in snapshot
  const snapshot = redactSecrets(structuredClone(entry.snapshot))
  const h: HistoryEntry = { ...entry, snapshot, id: uid(), createdAt: now() }
  db.history.unshift(h)
  const cap = historyRetention()
  if (db.history.length > cap) db.history.length = cap
  persist()
  return h
}

function redactSecrets(config: HttpRequestConfig): HttpRequestConfig {
  // mask obvious secret-ish header values and auth tokens in snapshots
  const secretKey = /auth|token|secret|key|password|cookie/i
  for (const h of config.headers) {
    if (secretKey.test(h.key)) h.value = '«redacted»'
  }
  if (config.auth.bearer) config.auth = { type: 'bearer', bearer: { token: '«redacted»' } }
  if (config.auth.basic) config.auth = { type: 'basic', basic: { username: config.auth.basic.username, password: '«redacted»' } }
  if (config.auth.digest) config.auth = { type: 'digest', digest: { username: config.auth.digest.username, password: '«redacted»' } }
  if (config.auth.oauth2) config.auth = { type: 'oauth2', oauth2: { accessToken: '«redacted»', tokenType: config.auth.oauth2.tokenType } }
  if (config.auth.apiKey) config.auth = { ...config.auth, apiKey: { ...config.auth.apiKey, value: '«redacted»' } }
  return config
}

export function listHistory(limit = 200, method?: string, search?: string): HistoryEntry[] {
  let rows = getDb().history
  if (method && method !== 'ALL') rows = rows.filter((h) => h.method === method)
  if (search) {
    const s = search.toLowerCase()
    rows = rows.filter((h) => h.url.toLowerCase().includes(s) || h.name.toLowerCase().includes(s))
  }
  return rows.slice(0, limit)
}

export function clearHistory(): void {
  getDb().history = []
  persist()
}

export function deleteHistory(id: string): void {
  const db = getDb()
  db.history = db.history.filter((h) => h.id !== id)
  persist()
}

/* ---------- test runs ---------- */

export function saveTestRun(run: TestRunRecord): void {
  const db = getDb()
  db.testRuns.unshift(run)
  if (db.testRuns.length > 100) db.testRuns.length = 100
  persist()
}

export function listTestRuns(): TestRunRecord[] {
  return getDb().testRuns
}

export function getTestRun(id: string): TestRunRecord | null {
  return getDb().testRuns.find((t) => t.id === id) ?? null
}

export function deleteTestRun(id: string): void {
  const db = getDb()
  db.testRuns = db.testRuns.filter((t) => t.id !== id)
  persist()
}
