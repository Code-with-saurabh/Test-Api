/* Collection runner — sequential execution with iterations, data rows, variable chaining */
import type { HttpRequestConfig, RunRequestResult, ScriptRunResult } from '@shared/types'
import { executeHttpFull } from '../http/executor'
import { runScript } from '../scripts/sandbox'
import * as repos from '../db/repos'
import { resolveVariables } from '@shared/vars'

export interface RunnerRequest {
  id: string
  name: string
  config: HttpRequestConfig
}

export async function runCollection(input: {
  requests: RunnerRequest[]
  environmentId?: string | null
  iterations?: number
  delayMs?: number
  dataRows?: Array<Record<string, string>>
}): Promise<{ results: RunRequestResult[]; durationMs: number }> {
  const started = Date.now()
  const iterations = input.iterations ?? 1
  const delayMs = input.delayMs ?? 0
  const dataRows = input.dataRows && input.dataRows.length ? input.dataRows : [{}]

  // base variables
  const envVars: Record<string, string> = input.environmentId
    ? repos.variablesToMap('environment', input.environmentId)
    : {}
  const localVars: Record<string, string> = {}

  const results: RunRequestResult[] = []

  for (let iter = 0; iter < iterations; iter++) {
    for (const row of dataRows) {
      for (const req of input.requests) {
        // scope maps: env + row data (highest) + local
        const scopeMaps = [envVars, row, localVars]

        const resolveStr = (s: string): string => resolveVariables(s, scopeMaps).result

        // resolve config
        const config = resolveConfigDeep(req.config, resolveStr)

        // pre-script
        let preResult: ScriptRunResult | undefined
        if (config.preScript?.trim()) {
          preResult = runScript({
            script: config.preScript,
            phase: 'pre',
            variables: { ...envVars, ...row, ...localVars }
          })
          for (const sv of preResult.setVariables) {
            if (sv.scope === 'environment') envVars[sv.key] = sv.value
            else localVars[sv.key] = sv.value
          }
          // re-resolve after pre-script (vars may have changed)
          const config2 = resolveConfigDeep(req.config, (s) => resolveVariables(s, [envVars, row, localVars]).result)
          Object.assign(config, config2)
        }

        const outcome = await executeHttpFull(config)
        const result: RunRequestResult = {
          requestId: req.id,
          requestName: req.name,
          url: config.url,
          method: config.method,
          status: outcome.ok ? outcome.response.status : null,
          ok: outcome.ok && outcome.response.status >= 200 && outcome.response.status < 400,
          timeMs: outcome.ok ? outcome.response.timeMs : outcome.timeMs ?? 0,
          sizeBytes: outcome.ok ? outcome.response.sizeBytes : 0,
          errorMessage: outcome.ok ? null : outcome.error.message,
          preResult,
          setVariables: []
        }

        if (outcome.ok && config.postScript?.trim()) {
          const postResult = runScript({
            script: config.postScript,
            phase: 'post',
            variables: { ...envVars, ...row, ...localVars },
            responseJson: outcome.response.bodyEncoding === 'utf8' ? outcome.response.bodyText : undefined,
            statusCode: outcome.response.status,
            responseTimeMs: outcome.response.timeMs
          })
          result.postResult = postResult
          for (const sv of postResult.setVariables) {
            if (sv.scope === 'environment') envVars[sv.key] = sv.value
            else localVars[sv.key] = sv.value
            result.setVariables.push({ key: sv.key, value: sv.value })
          }
        }

        results.push(result)

        if (delayMs > 0) await sleep(delayMs)
      }
    }
  }

  return { results, durationMs: Date.now() - started }
}

function resolveConfigDeep(config: HttpRequestConfig, resolveStr: (s: string) => string): HttpRequestConfig {
  const c = structuredClone(config)
  c.url = resolveStr(c.url)
  for (const h of c.headers) {
    h.key = resolveStr(h.key)
    h.value = resolveStr(h.value)
  }
  for (const p of c.params) {
    p.key = resolveStr(p.key)
    p.value = resolveStr(p.value)
  }
  if (c.body.content) c.body.content = resolveStr(c.body.content)
  if (c.body.form) {
    for (const f of c.body.form) {
      f.key = resolveStr(f.key)
      f.value = resolveStr(f.value)
    }
  }
  if (c.auth.bearer) c.auth.bearer.token = resolveStr(c.auth.bearer.token)
  if (c.auth.basic) {
    c.auth.basic.username = resolveStr(c.auth.basic.username)
    c.auth.basic.password = resolveStr(c.auth.basic.password)
  }
  if (c.auth.digest) {
    c.auth.digest.username = resolveStr(c.auth.digest.username)
    c.auth.digest.password = resolveStr(c.auth.digest.password)
  }
  if (c.auth.oauth2) c.auth.oauth2.accessToken = resolveStr(c.auth.oauth2.accessToken)
  if (c.auth.apiKey) {
    c.auth.apiKey.key = resolveStr(c.auth.apiKey.key)
    c.auth.apiKey.value = resolveStr(c.auth.apiKey.value)
  }
  return c
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
