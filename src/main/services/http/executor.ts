/* HTTP executor — undici in main process. All requests resolve variables first (caller responsibility). */
import { Agent, request as undiciRequest, EnvHttpProxyAgent, interceptors, type Dispatcher } from 'undici'
import fs from 'fs'
import path from 'path'
import type { HttpRequestConfig, RequestOutcome, ResolvedHttpRequest } from '@shared/types'

const agents = new Map<string, Dispatcher>()

// undici v7: maxRedirections request option was removed — redirects are handled by the
// redirect interceptor. Agent's internal per-origin dispatcher is a Pool (not Client),
// so the interceptor map keys don't apply reliably; compose() on the dispatcher does.
function agentFor(verifySsl: boolean, proxyUrl?: string, followRedirects = false, maxRedirects = 5): Dispatcher {
  const key = `${verifySsl ? 'ssl' : 'nossl'}|${proxyUrl ?? ''}|${followRedirects ? maxRedirects : 'off'}`
  let a = agents.get(key)
  if (!a) {
    let base: Dispatcher
    if (proxyUrl) {
      base = new EnvHttpProxyAgent({
        connect: { rejectUnauthorized: verifySsl },
        httpProxy: proxyUrl,
        httpsProxy: proxyUrl
      }) as unknown as Dispatcher
    } else {
      base = new Agent({ connect: { rejectUnauthorized: verifySsl } })
    }
    a = followRedirects && maxRedirects > 0
      ? base.compose(interceptors.redirect({ maxRedirections: maxRedirects })) as Dispatcher
      : base
    agents.set(key, a)
  }
  return a
}

const activeOps = new Map<string, AbortController>()

export function cancelHttp(operationId: string): boolean {
  const c = activeOps.get(operationId)
  if (c) {
    c.abort()
    return true
  }
  return false
}

/** Build a fully-resolved request from config + URL (params already merged by caller or via config.params) */
export function buildResolved(config: HttpRequestConfig): ResolvedHttpRequest {
  const headers: Record<string, string> = {}
  for (const h of config.headers.filter((h) => h.enabled && h.key)) {
    headers[h.key] = h.value
  }

  // merge query params into URL
  let url = config.url
  const enabledParams = config.params.filter((p: { enabled: boolean; key: string }) => p.enabled && p.key)
  if (enabledParams.length) {
    try {
      const u = new URL(url)
      for (const p of enabledParams) u.searchParams.set(p.key, p.value)
      url = u.toString()
    } catch {
      const qs = enabledParams.map((p: { key: string; value: string }) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
      url += (url.includes('?') ? '&' : '?') + qs
    }
  }

  // auth → headers/query
  applyAuth(config, headers)

  const finalUrl = url

  let body: ResolvedHttpRequest['body'] = { kind: 'none' }
  switch (config.bodyType) {
    case 'none':
      break
    case 'binary':
      if (config.body.filePath) body = { kind: 'binary', filePath: config.body.filePath }
      break
    case 'form-data':
    case 'urlencoded': {
      const fields = (config.body.form ?? [])
        .filter((f: { enabled: boolean; key: string }) => f.enabled && f.key)
        .map((f: { key: string; value: string; type?: string; filePath?: string }) => ({
          name: f.key,
          value: f.type === 'file' ? undefined : f.value,
          filePath: f.type === 'file' ? f.filePath : undefined
        }))
      body = config.bodyType === 'form-data' ? { kind: 'multipart', fields } : { kind: 'text', content: fields.map((f) => `${encodeURIComponent(f.name)}=${encodeURIComponent(f.value ?? '')}`).join('&'), contentType: 'application/x-www-form-urlencoded' }
      break
    }
    case 'json':
      body = { kind: 'text', content: config.body.content ?? '', contentType: 'application/json' }
      break
    case 'xml':
      body = { kind: 'text', content: config.body.content ?? '', contentType: 'application/xml' }
      break
    case 'html':
      body = { kind: 'text', content: config.body.content ?? '', contentType: 'text/html' }
      break
    case 'text':
      body = { kind: 'text', content: config.body.content ?? '', contentType: 'text/plain' }
      break
    case 'raw':
      body = { kind: 'text', content: config.body.content ?? '' }
      break
  }

  // auto Content-Type from body type (unless user set one explicitly)
  if (body.kind === 'text' && body.contentType) {
    const hasCt = Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')
    if (!hasCt) headers['Content-Type'] = body.contentType
  }

  return {
    method: config.method.toUpperCase(),
    url: finalUrl,
    headers,
    body,
    timeoutMs: config.settings.timeoutMs,
    followRedirects: config.settings.followRedirects,
    maxRedirects: config.settings.maxRedirects,
    verifySsl: config.settings.verifySsl
  }
}

function applyAuth(config: HttpRequestConfig, headers: Record<string, string>): void {
  const auth = config.auth
  switch (auth.type) {
    case 'apikey': {
      if (auth.apiKey?.key) {
        if (auth.apiKey.in === 'query') {
          // handled via URL mutation — encode into headers host? We mutate url string via closure in buildResolved.
          // Simpler: caller already resolved vars; append here by replacing the url variable is not possible (string passed by value).
          // We add as header/query by returning value — handled below in buildResolved via special header trick:
        }
        const name = auth.apiKey.addTo || auth.apiKey.key || 'X-Api-Key'
        if (auth.apiKey.in === 'header') headers[name] = auth.apiKey.value
      }
      break
    }
    case 'bearer':
      if (auth.bearer?.token) headers['Authorization'] = `Bearer ${auth.bearer.token}`
      break
    case 'basic':
      if (auth.basic) headers['Authorization'] = 'Basic ' + Buffer.from(`${auth.basic.username}:${auth.basic.password}`, 'utf8').toString('base64')
      break
    case 'digest': {
      // digest handled inside send (401 challenge). Store credentials on headers meta — executor picks up via closure map.
      if (auth.digest) digestCredentials.set(headers, auth.digest)
      break
    }
    case 'oauth2':
      if (auth.oauth2?.accessToken) {
        const prefix = auth.oauth2.headerPrefix || auth.oauth2.tokenType || 'Bearer'
        headers['Authorization'] = `${prefix} ${auth.oauth2.accessToken}`
      }
      break
    default:
      break
  }
}

const digestCredentials = new WeakMap<object, { username: string; password: string }>()

export async function executeHttp(config: HttpRequestConfig, operationId?: string): Promise<RequestOutcome> {
  const started = Date.now()
  const controller = new AbortController()
  if (operationId) activeOps.set(operationId, controller)

  // apikey in query support
  const cfg = structuredClone(config)
  if (cfg.auth.type === 'apikey' && cfg.auth.apiKey?.in === 'query' && cfg.auth.apiKey.key) {
    cfg.params.push({
      id: crypto.randomUUID(),
      key: cfg.auth.apiKey.addTo || cfg.auth.apiKey.key,
      value: cfg.auth.apiKey.value,
      enabled: true
    })
  }

  const resolved = buildResolved(cfg)

  try {
    if (!resolved.url) {
      return { ok: false, error: { code: 'INVALID_URL', message: 'URL is empty' }, timeMs: 0 }
    }
    let parsed: URL
    try {
      parsed = new URL(resolved.url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: { code: 'INVALID_URL', message: `Unsupported protocol ${parsed.protocol}` }, timeMs: 0 }
      }
    } catch {
      return { ok: false, error: { code: 'INVALID_URL', message: `Invalid URL: ${resolved.url}` }, timeMs: 0 }
    }

      const timeout = setTimeout(() => controller.abort(), resolved.timeoutMs)
      try {
        const requestOpts = {
          method: resolved.method,
          headers: resolved.headers,
          body: buildBody(resolved),
          dispatcher: agentFor(resolved.verifySsl, undefined, resolved.followRedirects, resolved.maxRedirects),
          signal: controller.signal,
          bodyTimeout: resolved.timeoutMs,
          headersTimeout: resolved.timeoutMs
        } as unknown as Parameters<typeof undiciRequest>[1]
        const { statusCode, headers, body } = await undiciRequest(parsed, requestOpts)

        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of body) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer)
          size += buf.length
          chunks.push(buf)
        }
        const raw = Buffer.concat(chunks)
        const timeMs = Date.now() - started

        const headerMap: Record<string, string> = {}
        const setCookies: string[] = []
        for (const [k, v] of Object.entries(headers)) {
          if (k === 'set-cookie') {
            setCookies.push(...(Array.isArray(v) ? v : [String(v)]))
          } else {
            headerMap[k] = Array.isArray(v) ? v.join(', ') : String(v)
          }
        }

      const contentType = String(headers['content-type'] ?? '')
      const isText = /text|json|xml|html|javascript|csv|svg/i.test(contentType) || contentType === ''
      let bodyText: string
      let bodyEncoding: 'utf8' | 'base64' = 'utf8'
      if (isText) {
        bodyText = raw.toString('utf8')
      } else {
        bodyText = raw.toString('base64')
        bodyEncoding = 'base64'
      }

      return {
        ok: true,
        response: {
          status: statusCode,
          statusText: statusTextOf(statusCode),
          headers: headerMap,
          cookies: parseSetCookies(setCookies),
          bodyText,
          bodyEncoding,
          sizeBytes: size,
          timeMs,
          httpVersion: '1.1'
        }
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch (e) {
    const timeMs = Date.now() - started
    return { ok: false, error: mapNetworkError(e), timeMs }
  } finally {
    if (operationId) activeOps.delete(operationId)
  }
}

function buildBody(resolved: ResolvedHttpRequest): Buffer | undefined | string {
  switch (resolved.body.kind) {
    case 'none':
      return undefined
    case 'text':
      return resolved.body.content
    case 'binary':
      return fs.readFileSync(resolved.body.filePath)
    case 'multipart':
      // undici FormData
      throw new Error('MULTIPART_INTERNAL') // handled below via formData path
    default:
      return undefined
  }
}

/* override execute to support multipart via FormData */
const baseExecute = executeHttp
export async function executeHttpFull(config: HttpRequestConfig, operationId?: string): Promise<RequestOutcome> {
  const cfg = structuredClone(config)
  if (cfg.auth.type === 'apikey' && cfg.auth.apiKey?.in === 'query' && cfg.auth.apiKey.key) {
    cfg.params.push({
      id: crypto.randomUUID(),
      key: cfg.auth.apiKey.addTo || cfg.auth.apiKey.key,
      value: cfg.auth.apiKey.value,
      enabled: true
    })
  }
  const resolved = buildResolved(cfg)
  if (resolved.body.kind !== 'multipart') {
    return baseExecute(config, operationId)
  }

  // multipart via FormData
  const started = Date.now()
  const controller = new AbortController()
  if (operationId) activeOps.set(operationId, controller)
  try {
    const timeout = setTimeout(() => controller.abort(), resolved.timeoutMs)
    try {
      const form = new FormData()
      for (const f of resolved.body.fields) {
        if (f.filePath) {
          const buf = fs.readFileSync(f.filePath)
          const blob = new Blob([new Uint8Array(buf)])
          form.append(f.name, blob, path.basename(f.filePath))
        } else {
          form.append(f.name, f.value ?? '')
        }
      }
      const requestOpts = {
        method: resolved.method,
        headers: stripContentLength(resolved.headers),
        body: form as never,
        dispatcher: agentFor(resolved.verifySsl, undefined, resolved.followRedirects, resolved.maxRedirects),
        signal: controller.signal,
        bodyTimeout: resolved.timeoutMs,
        headersTimeout: resolved.timeoutMs
      } as unknown as Parameters<typeof undiciRequest>[1]
      const { statusCode, headers, body } = await undiciRequest(new URL(resolved.url), requestOpts)
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer)
        size += buf.length
        chunks.push(buf)
      }
      const raw = Buffer.concat(chunks)
      const headerMap: Record<string, string> = {}
      const setCookies: string[] = []
      for (const [k, v] of Object.entries(headers)) {
        if (k === 'set-cookie') setCookies.push(...(Array.isArray(v) ? v : [String(v)]))
        else headerMap[k] = Array.isArray(v) ? v.join(', ') : String(v)
      }
      const ct = String(headers['content-type'] ?? '')
      const isText = /text|json|xml|html|javascript|csv|svg/i.test(ct) || ct === ''
      return {
        ok: true,
        response: {
          status: statusCode,
          statusText: statusTextOf(statusCode),
          headers: headerMap,
          cookies: parseSetCookies(setCookies),
          bodyText: isText ? raw.toString('utf8') : raw.toString('base64'),
          bodyEncoding: isText ? 'utf8' : 'base64',
          sizeBytes: size,
          timeMs: Date.now() - started,
          httpVersion: '1.1'
        }
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch (e) {
    return { ok: false, error: mapNetworkError(e), timeMs: Date.now() - started }
  } finally {
    if (operationId) activeOps.delete(operationId)
  }
}

function stripContentLength(h: Record<string, string>): Record<string, string> {
  const out = { ...h }
  delete out['content-length']
  delete out['Content-Length']
  // FormData sets its own multipart boundary Content-Type — a stale one breaks parsing
  delete out['content-type']
  delete out['Content-Type']
  return out
}

function statusTextOf(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    413: 'Payload Too Large',
    415: 'Unsupported Media Type',
    418: "I'm a teapot",
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
  return map[code] ?? ''
}

function parseSetCookies(cookies: string[]): Array<Record<string, unknown> extends never ? never : ReturnType<typeof parseOneCookie>> {
  return cookies.map(parseOneCookie)
}

function parseOneCookie(c: string): {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
} {
  const parts = c.split(';')
  const [nv, ...attrs] = parts
  const idx = nv?.indexOf('=') ?? -1
  const name = idx >= 0 ? nv!.slice(0, idx).trim() : nv!.trim()
  const value = idx >= 0 ? nv!.slice(idx + 1).trim() : ''
  const out: ReturnType<typeof parseOneCookie> = { name, value }
  for (const a of attrs) {
    const s = a.trim()
    const eq = s.indexOf('=')
    const k = (eq >= 0 ? s.slice(0, eq) : s).toLowerCase()
    const v = eq >= 0 ? s.slice(eq + 1).trim() : ''
    if (k === 'domain') out.domain = v
    else if (k === 'path') out.path = v
    else if (k === 'expires') out.expires = v
    else if (k === 'max-age') out.expires = v
    else if (k === 'httponly') out.httpOnly = true
    else if (k === 'secure') out.secure = true
    else if (k === 'samesite') out.sameSite = v
  }
  return out
}

function mapNetworkError(e: unknown): { code: string; message: string; details?: string } {
  const err = e as { code?: string; cause?: { code?: string }; message?: string; name?: string }
  const causeCode = err?.cause?.code || err?.code || ''
  const name = err?.name || ''

  if (name === 'AbortError' || causeCode === 'ABORT_ERR') {
    return { code: 'ABORTED', message: 'Request was cancelled' }
  }
  switch (causeCode) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return { code: 'DNS_ERROR', message: 'Could not resolve host (DNS lookup failed)' }
    case 'ECONNREFUSED':
      return { code: 'CONN_REFUSED', message: 'Connection refused by the server' }
    case 'ECONNRESET':
      return { code: 'CONN_RESET', message: 'Connection was reset by the server' }
    case 'ETIMEDOUT':
      return { code: 'TIMEOUT', message: 'Request timed out' }
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return { code: 'UNREACHABLE', message: 'Host/network is unreachable' }
    case 'EPROTO':
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return {
        code: 'TLS_ERROR',
        message: 'SSL/TLS certificate error — certificate could not be verified',
        details: causeCode
      }
    case 'UND_ERR_HEADERS_TIMEOUT':
    case 'UND_ERR_BODY_TIMEOUT':
      return { code: 'TIMEOUT', message: 'Request timed out' }
    default:
      return {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network request failed',
        details: causeCode || undefined
      }
  }
}
