/* Integration tests — real network calls (run separately from pure unit tests). */
import { describe, expect, it } from 'vitest'
import { executeHttp, buildResolved } from '../../src/main/services/http/executor'
import type { HttpRequestConfig } from '../../src/shared/types'

function baseConfig(url: string, overrides: Partial<HttpRequestConfig> = {}): HttpRequestConfig {
  return {
    method: 'GET',
    url,
    headers: [],
    params: [],
    bodyType: 'none',
    body: {},
    auth: { type: 'none' },
    settings: { timeoutMs: 20000, followRedirects: true, maxRedirects: 5, verifySsl: true },
    ...overrides
  } as HttpRequestConfig
}

const REDIRECT_URL = `https://postman-echo.com/redirect-to?url=${encodeURIComponent('https://postman-echo.com/get')}`

describe('HTTP executor (live network)', () => {
  it('GET postman-echo /get returns 200 JSON', async () => {
    const outcome = await executeHttp(baseConfig('https://postman-echo.com/get'))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    expect(outcome.response.status).toBe(200)
    const body = JSON.parse(outcome.response.bodyText) as { headers: Record<string, string> }
    expect(body.headers).toBeTruthy()
    expect(outcome.response.sizeBytes).toBeGreaterThan(0)
  }, 45000)

  it('follows redirects via undici redirect interceptor → final 200 JSON', async () => {
    const outcome = await executeHttp(baseConfig(REDIRECT_URL))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    expect(outcome.response.status).toBe(200)
    const body = JSON.parse(outcome.response.bodyText) as { url: string }
    expect(body.url).toContain('/get')
  }, 45000)

  it('does not follow redirects when disabled — returns 302', async () => {
    const cfg = baseConfig(REDIRECT_URL)
    cfg.settings.followRedirects = false
    const outcome = await executeHttp(cfg)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    expect(outcome.response.status).toBe(302)
  }, 45000)

  it('maps DNS failure to DNS_ERROR', async () => {
    const outcome = await executeHttp(baseConfig('https://this-host-does-not-exist-apiforge.invalid/x'))
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('expected failure')
    expect(outcome.error.code).toBe('DNS_ERROR')
  }, 30000)

  it('buildResolved merges params into URL', () => {
    const resolved = buildResolved(baseConfig('https://example.com/api', {
      params: [
        { id: 'p1', key: 'page', value: '2', enabled: true },
        { id: 'p2', key: 'off', value: 'x', enabled: false }
      ]
    }))
    expect(resolved.url).toBe('https://example.com/api?page=2')
  })
})
