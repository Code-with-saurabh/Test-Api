import type { HttpRequestConfig, KeyValue, AuthConfig } from './types'

/* Minimal cURL parser — supports common flags. Not a full shell parser. */

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  const s = input.trim()
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i++
    if (i >= s.length) break
    const ch = s[i]!
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      let out = ''
      while (i < s.length && s[i] !== quote) {
        if (s[i] === '\\' && quote === '"' && i + 1 < s.length) {
          out += s[i + 1]
          i += 2
          continue
        }
        out += s[i]
        i++
      }
      i++ // closing quote
      tokens.push(out)
    } else {
      let out = ''
      while (i < s.length && !/\s/.test(s[i]!)) {
        if (s[i] === '\\' && i + 1 < s.length) {
          out += s[i + 1]
          i += 2
          continue
        }
        out += s[i]
        i++
      }
      tokens.push(out)
    }
  }
  return tokens
}

function newKv(key: string, value: string): KeyValue {
  return { id: crypto.randomUUID(), key, value, enabled: true }
}

export function parseCurl(curl: string): { config: HttpRequestConfig; error?: string } {
  const tokens = tokenize(curl)
  if (!tokens[0] || !/curl(\.exe)?$/i.test(tokens[0])) {
    return { config: emptyConfig(), error: 'Command does not start with curl' }
  }

  const headers: KeyValue[] = []
  const params: KeyValue[] = []
  let method = ''
  let url = ''
  let bodyContent = ''
  let bodyType: HttpRequestConfig['bodyType'] = 'none'
  let form: KeyValue[] = []
  let isForm = false
  let isJson = false
  let followRedirects = false
  let insecure = false
  let timeoutMs: number | undefined

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]!
    const next = (): string => {
      const v = tokens[++i]
      return v ?? ''
    }

    switch (t) {
      case '-X':
      case '--request':
        method = next().toUpperCase()
        break
      case '-H':
      case '--header': {
        const h = next()
        const idx = h.indexOf(':')
        if (idx > 0) {
          headers.push(newKv(h.slice(0, idx).trim(), h.slice(idx + 1).trim()))
        }
        break
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii': {
        bodyContent += (bodyContent ? '\n' : '') + next()
        if (!method) method = 'POST'
        break
      }
      case '-F':
      case '--form': {
        const f = next()
        const idx = f.indexOf('=')
        if (idx > 0) {
          form.push(newKv(f.slice(0, idx), f.slice(idx + 1)))
        }
        isForm = true
        if (!method) method = 'POST'
        break
      }
      case '-u':
      case '--user': {
        const uv = next()
        headers.push(newKv('Authorization', 'Basic ' + Buffer.from(uv, 'utf8').toString('base64')))
        break
      }
      case '-L':
      case '--location':
        followRedirects = true
        break
      case '-k':
      case '--insecure':
        insecure = true
        break
      case '--max-time': {
        const v = parseInt(next(), 10)
        if (!Number.isNaN(v)) timeoutMs = v * 1000
        break
      }
      case '-b':
      case '--cookie': {
        headers.push(newKv('Cookie', next()))
        break
      }
      case '-A':
      case '--user-agent':
        headers.push(newKv('User-Agent', next()))
        break
      case '-e':
      case '--referer':
        headers.push(newKv('Referer', next()))
        break
      case '--url':
        url = next()
        break
      case '--json': {
        bodyContent = next()
        isJson = true
        if (!method) method = 'POST'
        break
      }
      case '--compressed':
      case '-s':
      case '--silent':
      case '-v':
      case '--verbose':
      case '--http1.1':
      case '--http2':
      case '-i':
      case '--include':
        break
      default: {
        if (t.startsWith('-')) break
        if (!url) url = t
        break
      }
    }
  }

  if (isForm) {
    bodyType = 'form-data'
  } else if (isJson || looksLikeJson(bodyContent)) {
    bodyType = 'json'
  } else if (bodyContent) {
    bodyType = 'raw'
  }

  if (!method) method = bodyContent || isForm ? 'POST' : 'GET'

  // detect content-type json header → set body type
  const ct = headers.find((h) => h.key.toLowerCase() === 'content-type')
  if (ct && ct.value.includes('json') && bodyContent) bodyType = 'json'
  if (ct && ct.value.includes('x-www-form-urlencoded') && bodyContent) {
    bodyType = 'urlencoded'
    form = bodyContent.split('&').filter(Boolean).map((pair) => {
      const idx = pair.indexOf('=')
      return idx >= 0
        ? newKv(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1)))
        : newKv(pair, '')
    })
  }

  // split query params already in URL into params list? Keep in URL for fidelity.
  const auth: AuthConfig = { type: 'none' }

  const config: HttpRequestConfig = {
    method,
    url,
    params,
    headers,
    bodyType,
    body: {
      content: bodyType === 'form-data' || bodyType === 'urlencoded' ? undefined : bodyContent || undefined,
      form: bodyType === 'form-data' || bodyType === 'urlencoded' ? form : undefined
    },
    auth,
    settings: {
      timeoutMs: timeoutMs ?? 30000,
      followRedirects,
      maxRedirects: 10,
      verifySsl: !insecure
    }
  }

  return { config }
}

function looksLikeJson(s: string): boolean {
  const t = s.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

export function emptyConfig(): HttpRequestConfig {
  return {
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    bodyType: 'none',
    body: {},
    auth: { type: 'none' },
    settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, verifySsl: true }
  }
}

/** Export config as cURL command */
export function toCurl(config: HttpRequestConfig): string {
  const parts: string[] = ['curl']

  if (config.method !== 'GET') parts.push('-X', shellQuote(config.method))

  for (const h of config.headers.filter((h) => h.enabled && h.key)) {
    parts.push('-H', shellQuote(`${h.key}: ${h.value}`))
  }

  // URL with query params
  let url = config.url
  const enabledParams = config.params.filter((p) => p.enabled && p.key)
  if (enabledParams.length) {
    const qs = enabledParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  parts.push(shellQuote(url))

  if (config.bodyType === 'form-data' && config.body.form) {
    for (const f of config.body.form.filter((f) => f.enabled && f.key)) {
      parts.push('-F', shellQuote(`${f.key}=${f.value ?? ''}`))
    }
  } else if (
    (config.bodyType === 'urlencoded' || config.bodyType === 'json' || config.bodyType === 'text' ||
      config.bodyType === 'xml' || config.bodyType === 'html' || config.bodyType === 'raw') &&
    config.body.content
  ) {
    parts.push('--data', shellQuote(config.body.content))
  } else if (config.bodyType === 'binary' && config.body.filePath) {
    parts.push('--data-binary', shellQuote(`@${config.body.filePath}`))
  }

  if (!config.settings.followRedirects) {
    // curl doesn't follow by default; nothing to add
  } else {
    parts.push('-L')
  }
  if (!config.settings.verifySsl) parts.push('-k')
  if (config.settings.timeoutMs !== 30000) parts.push('--max-time', String(Math.round(config.settings.timeoutMs / 1000)))

  return parts.join(' ')
}

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_\-./:@=]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}
