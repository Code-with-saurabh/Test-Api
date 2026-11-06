import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron'
import { IPC, type IpcResponse } from '@shared/ipc'
import { httpRequestConfigSchema } from '@shared/schemas'
import type { AppSettings, HttpRequestConfig } from '@shared/types'
import { normalizeEditorFontSize } from '@shared/types'
import * as repos from '../services/db/repos'
import { getDb, persist } from '../services/db/store'
import { cancelHttp, executeHttpFull } from '../services/http/executor'
import { runScript } from '../services/scripts/sandbox'
import { runCollection, type RunnerRequest } from '../services/runner/runner'
import { parseCurl, toCurl } from '@shared/curl'
import { importPostmanCollection, exportPostmanCollection } from '../services/importexport/postman'
import { resolveVariables, buildScopeMaps } from '@shared/vars'
import { wsManager } from '../services/ws/client'
import { isValidAppZoom } from '@shared/zoom'
import { getAppZoom, resetAppZoom, setAppZoom, stepAppZoom } from '../services/zoom/controller'
import { checkForUpdates, downloadUpdate, getUpdateStatus, installUpdate } from '../services/updater'

function ok<T>(data: T): IpcResponse<T> {
  return { ok: true, data }
}

function fail(code: string, message: string, details?: string): IpcResponse<never> {
  return { ok: false, error: { code, message, details } }
}

function wrap<T>(fn: () => T): IpcResponse<T> {
  try {
    return ok(fn())
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : String(e))
  }
}

async function wrapAsync<T>(fn: () => Promise<T>): Promise<IpcResponse<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    return fail('INTERNAL', e instanceof Error ? e.message : String(e))
  }
}

export function registerIpcHandlers(): void {
  /* ---- system ---- */
  ipcMain.handle(IPC.ping, () => ok({ pong: true as const, version: app.getVersion() }))

  // Open links in the system browser. Toolbar/download/About links are https;
  // the contact link uses mailto.
  ipcMain.handle(IPC.openExternal, async (_e, url: unknown) => {
    if (typeof url !== 'string' || !/^(https:\/\/|mailto:)/.test(url)) {
      return fail('FORBIDDEN', 'Only https:// and mailto: links can be opened')
    }
    await shell.openExternal(url)
    return ok({ opened: true })
  })

  ipcMain.handle(IPC.settingsGet, () => wrap(() => getDb().settings))

  ipcMain.handle(IPC.settingsUpdate, (event, patch: Partial<AppSettings>) => {
    if (patch?.zoomLevel !== undefined && !isValidAppZoom(patch.zoomLevel)) {
      return fail('VALIDATION', 'Zoom level must be between 50% and 300% in 10% steps')
    }

    return wrap(() => {
      const allowed: (keyof AppSettings)[] = [
        'theme',
        'historyRetention',
        'defaultTimeoutMs',
        'editorWordWrap',
        'maxResponsePreviewBytes',
        'zoomLevel',
        'editorFontSize'
      ]
      const db = getDb()
      for (const k of allowed) {
        if (patch[k] !== undefined) (db.settings as unknown as Record<string, unknown>)[k] = patch[k]
      }
      if (patch.editorFontSize !== undefined) {
        db.settings.editorFontSize = normalizeEditorFontSize(patch.editorFontSize)
      }
      if (patch.zoomLevel !== undefined) {
        setAppZoom(BrowserWindow.fromWebContents(event.sender), patch.zoomLevel)
      }
      persist()
      return db.settings
    })
  })

  /* ---- app zoom ---- */
  ipcMain.handle(IPC.appZoomGet, () => ok({ level: getAppZoom() }))
  ipcMain.handle(IPC.appZoomSet, (event, level: number) =>
    ok({ level: setAppZoom(BrowserWindow.fromWebContents(event.sender), level) })
  )
  ipcMain.handle(IPC.appZoomStep, (event, direction: -1 | 1) => {
    if (direction !== -1 && direction !== 1) return fail('VALIDATION', 'Zoom direction must be -1 or 1')
    return ok({ level: stepAppZoom(BrowserWindow.fromWebContents(event.sender), direction) })
  })
  ipcMain.handle(IPC.appZoomReset, (event) => ok({ level: resetAppZoom(BrowserWindow.fromWebContents(event.sender)) }))

  /* ---- auto update (GitHub Releases) ---- */
  ipcMain.handle(IPC.updateStatus, () => ok(getUpdateStatus()))
  ipcMain.handle(IPC.updateCheck, async () => ok(await checkForUpdates(true)))
  ipcMain.handle(IPC.updateDownload, async () => ok(await downloadUpdate()))
  ipcMain.handle(IPC.updateInstall, () => ok({ installing: installUpdate() }))

  ipcMain.handle(IPC.dialogFile, async (_e, title?: string) => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], title: title || 'Select file' })
    return ok(r.canceled ? null : (r.filePaths[0] ?? null))
  })

  ipcMain.handle(IPC.dialogDir, async (_e, title?: string) => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'], title: title || 'Select folder' })
    return ok(r.canceled ? null : (r.filePaths[0] ?? null))
  })

  ipcMain.handle(IPC.dialogSave, async (_e, defaultName: string, content: string, encoding?: 'utf8' | 'base64') => {
    const r = await dialog.showSaveDialog({ defaultPath: defaultName })
    if (r.canceled || !r.filePath) return ok(null)
    const fs = await import('fs')
    if (encoding === 'base64') fs.writeFileSync(r.filePath, Buffer.from(content, 'base64'))
    else fs.writeFileSync(r.filePath, content, 'utf8')
    return ok(r.filePath)
  })

  /* ---- http ---- */
  ipcMain.handle(IPC.httpSend, async (_e, input: { config: HttpRequestConfig; operationId?: string }) => {
    const parsed = httpRequestConfigSchema.safeParse(input.config)
    if (!parsed.success) {
      return fail('VALIDATION', 'Invalid request configuration', parsed.error.issues[0]?.message)
    }
    const outcome = await executeHttpFull(parsed.data, input.operationId)

    // record history (redacted)
    repos.addHistory({
      workspaceId: 'default',
      name: parsed.data.url.slice(0, 120) || 'Untitled request',
      method: parsed.data.method,
      url: parsed.data.url,
      status: outcome.ok ? outcome.response.status : null,
      outcome: outcome.ok ? 'ok' : outcome.error.code === 'ABORTED' ? 'cancelled' : 'error',
      timeMs: outcome.ok ? outcome.response.timeMs : (outcome.timeMs ?? null),
      sizeBytes: outcome.ok ? outcome.response.sizeBytes : null,
      errorMessage: outcome.ok ? null : outcome.error.message,
      snapshot: parsed.data
    })

    return ok(outcome)
  })

  ipcMain.handle(IPC.httpCancel, (_e, operationId: string) => ok({ cancelled: cancelHttp(operationId) }))

  /* ---- scripts ---- */
  ipcMain.handle(
    IPC.scriptRun,
    (
      _e,
      input: {
        script: string
        phase: 'pre' | 'post'
        variables: Record<string, string>
        responseJson?: string
        statusCode?: number
        responseTimeMs?: number
      }
    ) => wrap(() => runScript(input))
  )

  /* ---- runner ---- */
  ipcMain.handle(
    IPC.runnerStart,
    async (
      _e,
      input: {
        requests: RunnerRequest[]
        environmentId?: string | null
        iterations?: number
        delayMs?: number
        dataRows?: Array<Record<string, string>>
      }
    ) =>
      wrapAsync(async () => {
        const runId = crypto.randomUUID()
        const startedAt = Date.now()
        const { results, durationMs } = await runCollection(input)
        const passed = results.filter((r) => r.ok).length
        repos.saveTestRun({
          id: runId,
          name: `Run ${new Date(startedAt).toISOString()}`,
          collectionId: null,
          environmentId: input.environmentId ?? null,
          iterations: input.iterations ?? 1,
          startedAt,
          finishedAt: Date.now(),
          summary: { total: results.length, passed, failed: results.length - passed, durationMs },
          results
        })
        return { runId, results, durationMs }
      })
  )

  /* ---- collections ---- */
  ipcMain.handle(IPC.collectionsList, (_e, workspaceId?: string) => wrap(() => repos.listCollections(workspaceId)))
  ipcMain.handle(IPC.collectionsCreate, (_e, input: { name: string; description?: string }) =>
    wrap(() => repos.createCollection(input.name, input.description ?? ''))
  )
  ipcMain.handle(IPC.collectionsUpdate, (_e, input: { id: string; name?: string; description?: string }) =>
    wrap(() => repos.updateCollection(input.id, input))
  )
  ipcMain.handle(IPC.collectionsDelete, (_e, id: string) => wrap(() => repos.deleteCollection(id) as void))
  ipcMain.handle(IPC.collectionsDuplicate, (_e, id: string) => wrap(() => repos.duplicateCollection(id)))
  ipcMain.handle(IPC.collectionsTree, (_e, collectionId: string) => wrap(() => repos.getCollectionTree(collectionId)))

  ipcMain.handle(IPC.foldersCreate, (_e, input: { collectionId: string; parentFolderId?: string | null; name: string; description?: string }) =>
    wrap(() => repos.createFolder(input.collectionId, input.parentFolderId ?? null, input.name, input.description ?? ''))
  )
  ipcMain.handle(IPC.foldersUpdate, (_e, input: { id: string; name?: string; description?: string }) =>
    wrap(() => repos.updateFolder(input.id, input))
  )
  ipcMain.handle(IPC.foldersDelete, (_e, id: string) => wrap(() => repos.deleteFolder(id) as void))

  ipcMain.handle(IPC.requestsCreate, (_e, input: { collectionId: string; folderId?: string | null; name: string; description?: string; config: HttpRequestConfig }) =>
    wrap(() => repos.createRequest(input.collectionId, input.folderId ?? null, input.name, input.description ?? '', input.config))
  )
  ipcMain.handle(IPC.requestsUpdate, (_e, input: { id: string; name?: string; description?: string; config?: HttpRequestConfig; folderId?: string | null }) =>
    wrap(() => repos.updateRequest(input.id, input))
  )
  ipcMain.handle(IPC.requestsDelete, (_e, id: string) => wrap(() => repos.deleteRequest(id) as void))
  ipcMain.handle(IPC.requestsMove, (_e, input: { id: string; collectionId: string; folderId: string | null; sortOrder?: number }) =>
    wrap(() => repos.moveRequest(input.id, input.collectionId, input.folderId, input.sortOrder))
  )

  /* ---- environments ---- */
  ipcMain.handle(IPC.environmentsList, (_e, workspaceId?: string) => wrap(() => repos.listEnvironments(workspaceId)))
  ipcMain.handle(IPC.environmentsCreate, (_e, input: { name: string }) => wrap(() => repos.createEnvironment(input.name)))
  ipcMain.handle(IPC.environmentsUpdate, (_e, input: { id: string; name?: string }) => wrap(() => repos.updateEnvironment(input.id, input)))
  ipcMain.handle(IPC.environmentsDelete, (_e, id: string) => wrap(() => repos.deleteEnvironment(id) as void))
  ipcMain.handle(IPC.environmentsSetActive, (_e, id: string | null) => wrap(() => repos.setActiveEnvironment(id) as void))
  ipcMain.handle(IPC.environmentsActiveId, () => wrap(() => repos.getActiveEnvironmentId()))

  /* ---- variables ---- */
  ipcMain.handle(IPC.variablesList, (_e, input: { ownerType: string; ownerId: string }) =>
    wrap(() => repos.listVariables(input.ownerType as never, input.ownerId))
  )
  ipcMain.handle(
    IPC.variablesUpsert,
    (_e, input: { ownerType: string; ownerId: string; key: string; value: string; enabled: boolean; isSecret: boolean }) =>
      wrap(() => repos.upsertVariable(input.ownerType as never, input.ownerId, input.key, input.value, input.enabled, input.isSecret))
  )
  ipcMain.handle(IPC.variablesDelete, (_e, id: string) => wrap(() => repos.deleteVariable(id) as void))
  ipcMain.handle(
    IPC.variablesResolveMaps,
    (_e, input: { collectionId?: string | null; folderId?: string | null; requestId?: string | null; environmentId?: string | null }) =>
      wrap(() => {
        const activeEnv = input.environmentId ?? repos.getActiveEnvironmentId()
        const maps = buildScopeMaps({
          global: repos.variablesToMap('global', 'global'),
          environment: activeEnv ? repos.variablesToMap('environment', activeEnv) : undefined,
          collection: input.collectionId ? repos.variablesToMap('collection', input.collectionId) : undefined,
          folder: input.folderId ? repos.variablesToMap('folder', input.folderId) : undefined,
          request: input.requestId ? repos.variablesToMap('request', input.requestId) : undefined
        })
        const merged: Record<string, string> = {}
        for (const m of maps) Object.assign(merged, m)
        return merged
      })
  )

  /* ---- history ---- */
  ipcMain.handle(IPC.historyList, (_e, input?: { limit?: number; method?: string; search?: string }) =>
    wrap(() => repos.listHistory(input?.limit ?? 200, input?.method, input?.search))
  )
  ipcMain.handle(IPC.historyClear, () => wrap(() => repos.clearHistory() as void))
  ipcMain.handle(IPC.historyDelete, (_e, id: string) => wrap(() => repos.deleteHistory(id) as void))

  /* ---- import/export ---- */
  ipcMain.handle(IPC.importCurl, (_e, input: { curl: string }) => wrap(() => parseCurl(input.curl)))
  ipcMain.handle(IPC.exportCurl, (_e, input: { config: HttpRequestConfig }) => wrap(() => ({ curl: toCurl(input.config) })))
  ipcMain.handle(IPC.importPostman, (_e, input: { json: string }) => wrap(() => importPostmanCollection(input.json)))
  ipcMain.handle(IPC.exportPostman, (_e, input: { collectionId: string }) => wrap(() => ({ json: exportPostmanCollection(input.collectionId) })))

  /* ---- test runs ---- */
  ipcMain.handle(IPC.testRunsList, () => wrap(() => repos.listTestRuns()))
  ipcMain.handle(IPC.testRunsGet, (_e, id: string) => wrap(() => repos.getTestRun(id)))
  ipcMain.handle(IPC.testRunsDelete, (_e, id: string) => wrap(() => repos.deleteTestRun(id) as void))

  /* ---- websocket ---- */
  ipcMain.handle(IPC.wsConnect, (_e, input: { url: string; protocols?: string[] }) =>
    wrap(() => {
      const id = crypto.randomUUID()
      wsManager.connect(id, input.url, input.protocols)
      return { connectionId: id }
    })
  )
  ipcMain.handle(IPC.wsSend, (_e, input: { connectionId: string; data: string }) =>
    wrap(() => {
      const sent = wsManager.send(input.connectionId, input.data)
      if (!sent) throw new Error('Not connected')
      return { sent: true as const }
    })
  )
  ipcMain.handle(IPC.wsClose, (_e, input: { connectionId: string }) => wrap(() => wsManager.close(input.connectionId) as void))
  ipcMain.handle(IPC.wsMessages, (_e, input: { connectionId: string }) => wrap(() => wsManager.messages(input.connectionId)))

  /* resolve helper used nowhere yet — kept for future scripted sends */
  void resolveVariables
}
