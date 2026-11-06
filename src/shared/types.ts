export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | (string & {})

export type BodyType =
  | 'none'
  | 'json'
  | 'text'
  | 'xml'
  | 'html'
  | 'form-data'
  | 'urlencoded'
  | 'binary'
  | 'raw'

export type AuthType =
  | 'none'
  | 'apikey'
  | 'bearer'
  | 'basic'
  | 'digest'
  | 'oauth2'

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
  description?: string
  /** for form-data file parts */
  type?: 'text' | 'file'
  filePath?: string
}

export interface RequestSettings {
  timeoutMs: number
  followRedirects: boolean
  maxRedirects: number
  verifySsl: boolean
}

export interface AuthConfig {
  type: AuthType
  /** apikey */
  apiKey?: { key: string; value: string; in: 'header' | 'query'; addTo?: string }
  /** bearer */
  bearer?: { token: string }
  /** basic */
  basic?: { username: string; password: string }
  /** digest */
  digest?: { username: string; password: string }
  /** oauth2 (stored token) */
  oauth2?: {
    accessToken: string
    tokenType?: string
    headerPrefix?: string
  }
}

export type VarScope = 'global' | 'environment' | 'collection' | 'folder' | 'request' | 'local'

export interface VariableRow {
  id: string
  ownerType: VarScope
  ownerId: string
  key: string
  value: string
  enabled: boolean
  isSecret: boolean
  sortOrder: number
}

export interface HttpRequestConfig {
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  bodyType: BodyType
  body: {
    /** raw/json/text/xml/html content */
    content?: string
    /** binary: absolute path */
    filePath?: string
    /** form-data / urlencoded */
    form?: KeyValue[]
  }
  auth: AuthConfig
  settings: RequestSettings
  preScript?: string
  postScript?: string
}

export interface ResolvedHttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body:
    | { kind: 'none' }
    | { kind: 'text'; content: string; contentType?: string }
    | { kind: 'binary'; filePath: string }
    | { kind: 'multipart'; fields: Array<{ name: string; value?: string; filePath?: string; fileName?: string; contentType?: string }> }
  timeoutMs: number
  followRedirects: boolean
  maxRedirects: number
  verifySsl: boolean
}

export interface HttpResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  cookies: Array<{ name: string; value: string; domain?: string; path?: string; expires?: string; httpOnly?: boolean; secure?: boolean; sameSite?: string }>
  /** body as text (json/xml/html/text) or base64 for binary */
  bodyText: string
  bodyEncoding: 'utf8' | 'base64'
  sizeBytes: number
  timeMs: number
  httpVersion?: string
}

export interface HttpErrorInfo {
  code: string
  message: string
  details?: string
}

export type RequestOutcome =
  | { ok: true; response: HttpResponseData }
  | { ok: false; error: HttpErrorInfo; timeMs?: number }

/* ---------- workspaces ---------- */

export interface Workspace {
  id: string
  name: string
  createdAt: number
}

/* ---------- collections ---------- */

export interface Collection {
  id: string
  workspaceId: string
  name: string
  description: string
  auth: AuthConfig | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  collectionId: string
  parentFolderId: string | null
  name: string
  description: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface SavedRequest {
  id: string
  collectionId: string
  folderId: string | null
  name: string
  description: string
  sortOrder: number
  config: HttpRequestConfig
  createdAt: number
  updatedAt: number
}

export interface CollectionTree {
  collection: Collection
  folders: Folder[]
  requests: SavedRequest[]
}

/* ---------- environments ---------- */

export interface Environment {
  id: string
  workspaceId: string
  name: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/* ---------- history ---------- */

export interface HistoryEntry {
  id: string
  workspaceId: string
  name: string
  method: string
  url: string
  status: number | null
  outcome: 'ok' | 'error' | 'cancelled'
  timeMs: number | null
  sizeBytes: number | null
  errorMessage: string | null
  snapshot: HttpRequestConfig
  createdAt: number
}

/* ---------- tests / runner ---------- */

export interface TestAssertionResult {
  name: string
  passed: boolean
  message?: string
  skipped?: boolean
}

export interface ScriptRunResult {
  logs: string[]
  assertions: TestAssertionResult[]
  error?: string
  durationMs: number
  /** variables written by script */
  setVariables: Array<{ key: string; value: string; scope: 'environment' | 'local' | 'collection' }>
}

export interface RunRequestResult {
  requestId: string
  requestName: string
  url: string
  method: string
  status: number | null
  ok: boolean
  timeMs: number
  sizeBytes: number
  errorMessage: string | null
  preResult?: ScriptRunResult
  postResult?: ScriptRunResult
  setVariables: Array<{ key: string; value: string }>
}

export interface RunSummary {
  total: number
  passed: number
  failed: number
  durationMs: number
}

export interface TestRunRecord {
  id: string
  name: string
  collectionId: string | null
  environmentId: string | null
  iterations: number
  startedAt: number
  finishedAt: number
  summary: RunSummary
  results: RunRequestResult[]
}

/* ---------- websocket ---------- */

export interface WsMessage {
  id: string
  direction: 'send' | 'recv' | 'system'
  data: string
  isBinary: boolean
  timestamp: number
}

/* ---------- settings ---------- */

export interface AppSettings {
  theme: 'dark' | 'light'
  historyRetention: number
  defaultTimeoutMs: number
  editorWordWrap: boolean
  maxResponsePreviewBytes: number
  /** Whole-window zoom percentage (50–300, steps of 10). */
  zoomLevel: number
  /** Monaco editor font size in px (10–24). */
  editorFontSize: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  historyRetention: 500,
  defaultTimeoutMs: 30000,
  editorWordWrap: true,
  maxResponsePreviewBytes: 5 * 1024 * 1024,
  zoomLevel: 100,
  editorFontSize: 13
}

export const MIN_EDITOR_FONT_SIZE = 10
export const MAX_EDITOR_FONT_SIZE = 24

export function normalizeEditorFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.editorFontSize
  return Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, Math.round(value)))
}
