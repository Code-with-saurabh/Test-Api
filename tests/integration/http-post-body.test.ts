/* POST/body integration tests — verifies request bodies actually reach the server. */
import { describe, expect, it } from 'vitest'
import { executeHttpFull } from '../../src/main/services/http/executor'
import type { HttpRequestConfig } from '../../src/shared/types'

function cfg(overrides: Partial<HttpRequestConfig>): HttpRequestConfig {
  return {
    method: 'POST',
    url: 'https://postman-echo.com/post',
    headers: [],
    params: [],
    bodyType: 'json',
    body: { content: '{"hello":"world"}' },
    auth: { type: 'none' },
    settings: { timeoutMs: 20000, followRedirects: true, maxRedirects: 5, verifySsl: true },
    ...overrides
  } as HttpRequestConfig
}

describe('POST body delivery (live)', () => {
  it('JSON body reaches server with echo .json field', async () => {
    const outcome = await executeHttpFull(cfg({}))
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    expect(outcome.response.status).toBe(200)
    const body = JSON.parse(outcome.response.bodyText) as { json?: Record<string, unknown> }
    expect(body.json).toBeTruthy()
    expect(body.json).toEqual({ hello: 'world' })
  }, 45000)

  it('sends Content-Type: application/json for json body', async () => {
    const outcome = await executeHttpFull(cfg({ headers: [{ id: 'h1', key: 'Accept', value: '*/*', enabled: true }] }))
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    // postman-echo echoes received request headers in body.headers
    const body = JSON.parse(outcome.response.bodyText) as { headers?: Record<string, string> }
    expect(body.headers?.['content-type']).toContain('application/json')
  }, 45000)

  it('urlencoded body arrives as form fields', async () => {
    const outcome = await executeHttpFull(cfg({
      bodyType: 'urlencoded',
      body: { form: [{ id: 'f1', key: 'name', value: 'apiforge', enabled: true }] }
    }))
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    const echo = JSON.parse(outcome.response.bodyText) as { form?: Record<string, string>; headers?: Record<string, string> }
    expect(echo.headers?.['content-type']).toContain('application/x-www-form-urlencoded')
    expect(echo.form).toBeTruthy()
    expect(echo.form?.name).toBe('apiforge')
  }, 45000)

  it('text body arrives as raw .data', async () => {
    const outcome = await executeHttpFull(cfg({
      bodyType: 'text',
      body: { content: 'plain payload 123' },
      headers: [{ id: 'h1', key: 'Content-Type', value: 'text/plain', enabled: true }]
    }))
    if (!outcome.ok || !outcome.response) throw new Error('expected ok')
    const body = JSON.parse(outcome.response.bodyText) as { data?: string }
    expect(body.data).toBe('plain payload 123')
  }, 45000)

  it('empty body with bodyType none still sends (no crash)', async () => {
    const outcome = await executeHttpFull(cfg({ bodyType: 'none', body: {} }))
    expect(outcome.ok).toBe(true)
  }, 45000)
})
