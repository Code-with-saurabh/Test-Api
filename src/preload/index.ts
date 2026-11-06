import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type ApiClient, type IpcResponse } from '@shared/ipc'
import type { UpdateStatus } from '@shared/update'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResponse<T>>
}

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ApiClient = {
  ping: () => invoke(IPC.ping),
  getSettings: () => invoke(IPC.settingsGet),
  updateSettings: (patch) => invoke(IPC.settingsUpdate, patch),
  chooseFile: (title) => invoke(IPC.dialogFile, title),
  chooseDirectory: (title) => invoke(IPC.dialogDir, title),
  saveFile: (defaultName, content, encoding) => invoke(IPC.dialogSave, defaultName, content, encoding),
  openExternal: (url) => invoke(IPC.openExternal, url),

  appZoomGet: () => invoke(IPC.appZoomGet),
  appZoomSet: (level) => invoke(IPC.appZoomSet, level),
  appZoomStep: (direction) => invoke(IPC.appZoomStep, direction),
  appZoomReset: () => invoke(IPC.appZoomReset),
  onAppZoomChanged: (callback) => subscribe<number>(IPC.appZoomChanged, callback),

  updateStatus: () => invoke(IPC.updateStatus),
  updateCheck: () => invoke(IPC.updateCheck),
  updateDownload: () => invoke(IPC.updateDownload),
  updateInstall: () => invoke(IPC.updateInstall),
  onUpdateStatus: (callback) => subscribe<UpdateStatus>(IPC.updateStatusChanged, callback),

  httpSend: (input) => invoke(IPC.httpSend, input),
  httpCancel: (operationId) => invoke(IPC.httpCancel, operationId),

  scriptRun: (input) => invoke(IPC.scriptRun, input),
  runnerStart: (input) => invoke(IPC.runnerStart, input),

  collectionsList: (workspaceId) => invoke(IPC.collectionsList, workspaceId),
  collectionsCreate: (input) => invoke(IPC.collectionsCreate, input),
  collectionsUpdate: (input) => invoke(IPC.collectionsUpdate, input),
  collectionsDelete: (id) => invoke(IPC.collectionsDelete, id),
  collectionsDuplicate: (id) => invoke(IPC.collectionsDuplicate, id),
  collectionsTree: (collectionId) => invoke(IPC.collectionsTree, collectionId),

  foldersCreate: (input) => invoke(IPC.foldersCreate, input),
  foldersUpdate: (input) => invoke(IPC.foldersUpdate, input),
  foldersDelete: (id) => invoke(IPC.foldersDelete, id),

  requestsCreate: (input) => invoke(IPC.requestsCreate, input),
  requestsUpdate: (input) => invoke(IPC.requestsUpdate, input),
  requestsDelete: (id) => invoke(IPC.requestsDelete, id),
  requestsMove: (input) => invoke(IPC.requestsMove, input),

  environmentsList: (workspaceId) => invoke(IPC.environmentsList, workspaceId),
  environmentsCreate: (input) => invoke(IPC.environmentsCreate, input),
  environmentsUpdate: (input) => invoke(IPC.environmentsUpdate, input),
  environmentsDelete: (id) => invoke(IPC.environmentsDelete, id),
  environmentsSetActive: (id) => invoke(IPC.environmentsSetActive, id),
  environmentsActiveId: () => invoke(IPC.environmentsActiveId),

  variablesList: (input) => invoke(IPC.variablesList, input),
  variablesUpsert: (input) => invoke(IPC.variablesUpsert, input),
  variablesDelete: (id) => invoke(IPC.variablesDelete, id),
  variablesResolveMaps: (input) => invoke(IPC.variablesResolveMaps, input),

  historyList: (input) => invoke(IPC.historyList, input),
  historyClear: () => invoke(IPC.historyClear),
  historyDelete: (id) => invoke(IPC.historyDelete, id),

  importCurl: (input) => invoke(IPC.importCurl, input),
  exportCurl: (input) => invoke(IPC.exportCurl, input),
  importPostman: (input) => invoke(IPC.importPostman, input),
  exportPostman: (input) => invoke(IPC.exportPostman, input),

  testRunsList: () => invoke(IPC.testRunsList),
  testRunsGet: (id) => invoke(IPC.testRunsGet, id),
  testRunsDelete: (id) => invoke(IPC.testRunsDelete, id),

  wsConnect: (input) => invoke(IPC.wsConnect, input),
  wsSend: (input) => invoke(IPC.wsSend, input),
  wsClose: (input) => invoke(IPC.wsClose, input),
  wsMessages: (input) => invoke(IPC.wsMessages, input)
}

contextBridge.exposeInMainWorld('api', api)
