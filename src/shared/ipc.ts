/* IPC contract — single source of truth for main ↔ preload ↔ renderer */
import type {
  AppSettings,
  Collection,
  CollectionTree,
  Environment,
  Folder,
  HistoryEntry,
  HttpRequestConfig,
  RequestOutcome,
  RunRequestResult,
  SavedRequest,
  ScriptRunResult,
  TestRunRecord,
  VariableRow,
  WsMessage
} from './types'
import type { UpdateStatus } from './update'

export interface IpcResult<T> {
  ok: true
  data: T
}

export interface IpcFailure {
  ok: false
  error: { code: string; message: string; details?: string }
}

export type IpcResponse<T> = IpcResult<T> | IpcFailure

export interface ApiClient {
  /* system */
  ping(): Promise<IpcResponse<{ pong: true; version: string }>>
  getSettings(): Promise<IpcResponse<AppSettings>>
  updateSettings(patch: Partial<AppSettings>): Promise<IpcResponse<AppSettings>>
  chooseFile(title?: string): Promise<IpcResponse<string | null>>
  chooseDirectory(title?: string): Promise<IpcResponse<string | null>>
  saveFile(defaultName: string, content: string, encoding?: 'utf8' | 'base64'): Promise<IpcResponse<string | null>>
  openExternal(url: string): Promise<IpcResponse<{ opened: boolean }>>

  /* app zoom */
  appZoomGet(): Promise<IpcResponse<{ level: number }>>
  appZoomSet(level: number): Promise<IpcResponse<{ level: number }>>
  appZoomStep(direction: -1 | 1): Promise<IpcResponse<{ level: number }>>
  appZoomReset(): Promise<IpcResponse<{ level: number }>>
  /** Fired whenever zoom changes (menu, wheel, settings, reset). Returns an unsubscribe function. */
  onAppZoomChanged(callback: (level: number) => void): () => void

  /* auto update (GitHub Releases) */
  updateStatus(): Promise<IpcResponse<UpdateStatus>>
  updateCheck(): Promise<IpcResponse<UpdateStatus>>
  updateDownload(): Promise<IpcResponse<UpdateStatus>>
  updateInstall(): Promise<IpcResponse<{ installing: boolean }>>
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void

  /* http */
  httpSend(input: { config: HttpRequestConfig; operationId?: string }): Promise<IpcResponse<RequestOutcome>>
  httpCancel(operationId: string): Promise<IpcResponse<{ cancelled: boolean }>>

  /* scripts */
  scriptRun(input: {
    script: string
    phase: 'pre' | 'post'
    variables: Record<string, string>
    responseJson?: string
    statusCode?: number
    responseTimeMs?: number
    requestJson?: string
  }): Promise<IpcResponse<ScriptRunResult>>

  /* runner */
  runnerStart(input: {
    requests: Array<{ id: string; name: string; config: HttpRequestConfig }>
    environmentId?: string | null
    iterations?: number
    delayMs?: number
    dataRows?: Array<Record<string, string>>
  }): Promise<IpcResponse<{ runId: string; results: RunRequestResult[]; durationMs: number }>>

  /* collections */
  collectionsList(workspaceId?: string): Promise<IpcResponse<Collection[]>>
  collectionsCreate(input: { name: string; description?: string }): Promise<IpcResponse<Collection>>
  collectionsUpdate(input: { id: string; name?: string; description?: string }): Promise<IpcResponse<Collection>>
  collectionsDelete(id: string): Promise<IpcResponse<{ deleted: true }>>
  collectionsDuplicate(id: string): Promise<IpcResponse<Collection>>
  collectionsTree(collectionId: string): Promise<IpcResponse<CollectionTree>>

  foldersCreate(input: { collectionId: string; parentFolderId?: string | null; name: string; description?: string }): Promise<IpcResponse<Folder>>
  foldersUpdate(input: { id: string; name?: string; description?: string }): Promise<IpcResponse<Folder>>
  foldersDelete(id: string): Promise<IpcResponse<{ deleted: true }>>

  requestsCreate(input: { collectionId: string; folderId?: string | null; name: string; description?: string; config: HttpRequestConfig }): Promise<IpcResponse<SavedRequest>>
  requestsUpdate(input: { id: string; name?: string; description?: string; config?: HttpRequestConfig; folderId?: string | null }): Promise<IpcResponse<SavedRequest>>
  requestsDelete(id: string): Promise<IpcResponse<{ deleted: true }>>
  requestsMove(input: { id: string; collectionId: string; folderId: string | null; sortOrder?: number }): Promise<IpcResponse<SavedRequest>>

  /* environments & variables */
  environmentsList(workspaceId?: string): Promise<IpcResponse<Environment[]>>
  environmentsCreate(input: { name: string }): Promise<IpcResponse<Environment>>
  environmentsUpdate(input: { id: string; name?: string }): Promise<IpcResponse<Environment>>
  environmentsDelete(id: string): Promise<IpcResponse<{ deleted: true }>>
  environmentsSetActive(id: string | null): Promise<IpcResponse<{ activeId: string | null }>>
  environmentsActiveId(): Promise<IpcResponse<string | null>>

  variablesList(input: { ownerType: string; ownerId: string }): Promise<IpcResponse<VariableRow[]>>
  variablesUpsert(input: { ownerType: string; ownerId: string; key: string; value: string; enabled: boolean; isSecret: boolean }): Promise<IpcResponse<VariableRow>>
  variablesDelete(id: string): Promise<IpcResponse<{ deleted: true }>>
  /** resolved flat maps for send-time (secrets included only if includeSecrets) */
  variablesResolveMaps(input: { collectionId?: string | null; folderId?: string | null; requestId?: string | null; environmentId?: string | null }): Promise<IpcResponse<Record<string, string>>>

  /* history */
  historyList(input?: { limit?: number; method?: string; search?: string }): Promise<IpcResponse<HistoryEntry[]>>
  historyClear(): Promise<IpcResponse<{ cleared: true }>>
  historyDelete(id: string): Promise<IpcResponse<{ deleted: true }>>

  /* import/export */
  importCurl(input: { curl: string }): Promise<IpcResponse<{ config: HttpRequestConfig; error?: string }>>
  exportCurl(input: { config: HttpRequestConfig }): Promise<IpcResponse<{ curl: string }>>
  importPostman(input: { json: string }): Promise<IpcResponse<{ collections: number; requests: number }>>
  exportPostman(input: { collectionId: string }): Promise<IpcResponse<{ json: string }>>

  /* test runs */
  testRunsList(): Promise<IpcResponse<TestRunRecord[]>>
  testRunsGet(id: string): Promise<IpcResponse<TestRunRecord | null>>
  testRunsDelete(id: string): Promise<IpcResponse<{ deleted: true }>>

  /* websocket */
  wsConnect(input: { url: string; protocols?: string[] }): Promise<IpcResponse<{ connectionId: string }>>
  wsSend(input: { connectionId: string; data: string }): Promise<IpcResponse<{ sent: true }>>
  wsClose(input: { connectionId: string }): Promise<IpcResponse<{ closed: true }>>
  wsMessages(input: { connectionId: string; sinceId?: string }): Promise<IpcResponse<{ messages: WsMessage[]; connected: boolean; error?: string }>>
}

/* channel name constants (main + preload use these) */
export const IPC = {
  ping: 'sys:ping',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  dialogFile: 'dialog:file',
  dialogDir: 'dialog:dir',
  dialogSave: 'dialog:save',
  appZoomGet: 'zoom:get',
  appZoomSet: 'zoom:set',
  appZoomStep: 'zoom:step',
  appZoomReset: 'zoom:reset',
  appZoomChanged: 'zoom:changed',
  updateStatus: 'update:status',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateStatusChanged: 'update:status-changed',
  httpSend: 'http:send',
  httpCancel: 'http:cancel',
  scriptRun: 'script:run',
  runnerStart: 'runner:start',
  collectionsList: 'db:collections:list',
  collectionsCreate: 'db:collections:create',
  collectionsUpdate: 'db:collections:update',
  collectionsDelete: 'db:collections:delete',
  collectionsDuplicate: 'db:collections:duplicate',
  collectionsTree: 'db:collections:tree',
  foldersCreate: 'db:folders:create',
  foldersUpdate: 'db:folders:update',
  foldersDelete: 'db:folders:delete',
  requestsCreate: 'db:requests:create',
  requestsUpdate: 'db:requests:update',
  requestsDelete: 'db:requests:delete',
  requestsMove: 'db:requests:move',
  environmentsList: 'db:environments:list',
  environmentsCreate: 'db:environments:create',
  environmentsUpdate: 'db:environments:update',
  environmentsDelete: 'db:environments:delete',
  environmentsSetActive: 'db:environments:setActive',
  environmentsActiveId: 'db:environments:activeId',
  variablesList: 'db:variables:list',
  variablesUpsert: 'db:variables:upsert',
  variablesDelete: 'db:variables:delete',
  variablesResolveMaps: 'vars:resolveMaps',
  historyList: 'db:history:list',
  historyClear: 'db:history:clear',
  historyDelete: 'db:history:delete',
  importCurl: 'ie:importCurl',
  exportCurl: 'ie:exportCurl',
  importPostman: 'ie:importPostman',
  exportPostman: 'ie:exportPostman',
  testRunsList: 'db:testRuns:list',
  testRunsGet: 'db:testRuns:get',
  testRunsDelete: 'db:testRuns:delete',
  wsConnect: 'ws:connect',
  wsSend: 'ws:send',
  wsClose: 'ws:close',
  wsMessages: 'ws:messages',
  openExternal: 'shell:openExternal'
} as const
