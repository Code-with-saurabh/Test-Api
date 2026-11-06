import type { HttpRequestConfig, KeyValue } from '@shared/types'
import type { ResponseState, TabState } from '@/stores/tabs'
import { useDataStore } from '@/stores/data'
import { resolveVariables } from '@shared/vars'

interface SendDeps {
  tab: TabState
  activeEnvId: string | null
  setLoading: (id: string, v: boolean) => void
  setResponse: (id: string, r: ResponseState | null, e: { code: string; message: string } | null) => void
  setScriptResults: (id: string, pre?: TabState['preResult'], post?: TabState['postResult']) => void
  onUnresolved: (keys: string[]) => void
}

export async function executeSend(deps: SendDeps): Promise<void> {
  const { tab, activeEnvId, setLoading, setResponse, setScriptResults, onUnresolved } = deps

  // resolve variable maps
  const mapsRes = await window.api.variablesResolveMaps({
    collectionId: tab.collectionId,
    folderId: tab.folderId,
    requestId: tab.savedRequestId,
    environmentId: activeEnvId
  })
  const varMap = mapsRes.ok ? mapsRes.data : {}

  // collect unresolved from URL/headers/params/body
  const unresolved = collectUnresolved(tab.config, varMap)
  onUnresolved(unresolved)

  const config = resolveConfigDeep(tab.config, varMap)

  setLoading(tab.id, true)

  // pre-script
  let preResult: TabState['preResult']
  if (config.preScript?.trim()) {
    const pre = await window.api.scriptRun({
      script: config.preScript,
      phase: 'pre',
      variables: varMap,
      requestJson: JSON.stringify({ url: config.url, method: config.method })
    })
    if (pre.ok) {
      preResult = { logs: pre.data.logs, assertions: pre.data.assertions, error: pre.data.error }
      // apply set variables: re-resolve with updated values
      for (const sv of pre.data.setVariables) {
        varMap[sv.key] = sv.value
      }
      const reResolved = resolveConfigDeep(tab.config, varMap)
      Object.assign(config, reResolved)
    }
  }

  const operationId = crypto.randomUUID()
  const outcome = await window.api.httpSend({ config, operationId })

  if (!outcome.ok) {
    setResponse(tab.id, null, outcome.error)
    setScriptResults(tab.id, preResult, undefined)
    useDataStore.getState().refreshHistory()
    return
  }

  const res = outcome.data
  if (!res.ok) {
    setResponse(tab.id, null, res.error)
    setScriptResults(tab.id, preResult, undefined)
    useDataStore.getState().refreshHistory()
    return
  }

  const r = res.response
  const responseState: ResponseState = {
    status: r.status,
    statusText: r.statusText,
    headers: r.headers,
    cookies: r.cookies,
    bodyText: r.bodyText,
    bodyEncoding: r.bodyEncoding,
    sizeBytes: r.sizeBytes,
    timeMs: r.timeMs,
    contentType: r.headers['content-type'] ?? ''
  }

  // post-response script
  let postResult: TabState['postResult']
  if (config.postScript?.trim()) {
    const post = await window.api.scriptRun({
      script: config.postScript,
      phase: 'post',
      variables: varMap,
      responseJson: r.bodyEncoding === 'utf8' ? r.bodyText : undefined,
      statusCode: r.status,
      responseTimeMs: r.timeMs
    })
    if (post.ok) {
      postResult = { logs: post.data.logs, assertions: post.data.assertions, error: post.data.error }
    }
  }

  setResponse(tab.id, responseState, null)
  setScriptResults(tab.id, preResult, postResult)
  useDataStore.getState().refreshHistory()
}

function collectUnresolved(config: HttpRequestConfig, varMap: Record<string, string>): string[] {
  const keys = new Set<string>()
  const check = (s: string) => {
    for (const m of s.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      const k = m[1]?.trim()
      if (k && !k.startsWith('$') && !(k in varMap)) keys.add(k)
    }
  }
  check(config.url)
  for (const h of config.headers) {
    check(h.key)
    check(h.value)
  }
  for (const p of config.params) {
    check(p.key)
    check(p.value)
  }
  if (config.body.content) check(config.body.content)
  for (const f of config.body.form ?? []) {
    check(f.key)
    check(f.value)
  }
  if (config.auth.bearer) check(config.auth.bearer.token)
  return [...keys]
}

export function resolveConfigDeep(config: HttpRequestConfig, varMap: Record<string, string>): HttpRequestConfig {
  const r = (s: string): string => resolveVariables(s, [varMap]).result
  const c = structuredClone(config)
  c.url = r(c.url)
  for (const h of c.headers) {
    h.key = r(h.key)
    h.value = r(h.value)
  }
  for (const p of c.params) {
    p.key = r(p.key)
    p.value = r(p.value)
  }
  if (c.body.content) c.body.content = r(c.body.content)
  for (const f of c.body.form ?? []) {
    f.key = r(f.key)
    f.value = r(f.value)
  }
  if (c.auth.bearer) c.auth.bearer.token = r(c.auth.bearer.token)
  if (c.auth.basic) {
    c.auth.basic.username = r(c.auth.basic.username)
    c.auth.basic.password = r(c.auth.basic.password)
  }
  if (c.auth.digest) {
    c.auth.digest.username = r(c.auth.digest.username)
    c.auth.digest.password = r(c.auth.digest.password)
  }
  if (c.auth.oauth2) c.auth.oauth2.accessToken = r(c.auth.oauth2.accessToken)
  if (c.auth.apiKey) {
    c.auth.apiKey.key = r(c.auth.apiKey.key)
    c.auth.apiKey.value = r(c.auth.apiKey.value)
  }
  return c
}

export type { KeyValue }
