import { describe, it, expect } from 'vitest'
import { resolveVariables, extractTokens, buildScopeMaps } from '../../src/shared/vars'
import { parseCurl, toCurl, emptyConfig } from '../../src/shared/curl'
import { formatBytes, formatMs } from '../../src/shared/utils'

describe('resolveVariables', () => {
  it('replaces known variables from merged scopes', () => {
    const r = resolveVariables('{{baseUrl}}/users', [{ baseUrl: 'http://localhost:5000' }])
    expect(r.result).toBe('http://localhost:5000/users')
    expect(r.unresolved).toEqual([])
  })

  it('later scopes override earlier ones', () => {
    const r = resolveVariables('{{token}}', [{ token: 'env' }, { token: 'local' }])
    expect(r.result).toBe('local')
  })

  it('reports unresolved variables and leaves them intact', () => {
    const r = resolveVariables('{{missing}}/x', [{}])
    expect(r.result).toBe('{{missing}}/x')
    expect(r.unresolved).toEqual(['missing'])
  })

  it('supports dynamic $guid and $timestamp', () => {
    const r1 = resolveVariables('{{$guid}}', [])
    expect(r1.result).toMatch(/^[0-9a-f-]{36}$/)
    const r2 = resolveVariables('{{$timestamp}}', [])
    expect(Number(r2.result)).toBeGreaterThan(1000000000)
  })

  it('handles multiple tokens in one string', () => {
    const r = resolveVariables('{{a}}-{{b}}', [{ a: '1', b: '2' }])
    expect(r.result).toBe('1-2')
  })
})

describe('extractTokens', () => {
  it('finds unique tokens', () => {
    expect(extractTokens('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })
})

describe('buildScopeMaps', () => {
  it('filters empty maps and preserves order', () => {
    const maps = buildScopeMaps({ global: { x: '1' }, environment: { y: '2' } })
    expect(maps).toHaveLength(2)
    expect(maps[0]).toEqual({ x: '1' })
  })
})

describe('parseCurl', () => {
  it('parses simple GET', () => {
    const { config } = parseCurl('curl https://example.com/api')
    expect(config.method).toBe('GET')
    expect(config.url).toBe('https://example.com/api')
  })

  it('parses POST with json data and headers', () => {
    const curl = `curl -X POST https://api.test.com/users -H "Content-Type: application/json" -H "X-Token: abc" -d '{"name":"test"}'`
    const { config } = parseCurl(curl)
    expect(config.method).toBe('POST')
    expect(config.url).toBe('https://api.test.com/users')
    expect(config.headers.find((h) => h.key === 'Content-Type')?.value).toBe('application/json')
    expect(config.headers.find((h) => h.key === 'X-Token')?.value).toBe('abc')
    expect(config.body.content).toContain('"name":"test"')
    expect(config.bodyType).toBe('json')
  })

  it('parses -L and -k flags', () => {
    const { config } = parseCurl('curl -L -k https://x.com')
    expect(config.settings.followRedirects).toBe(true)
    expect(config.settings.verifySsl).toBe(false)
  })

  it('rejects non-curl commands', () => {
    const { error } = parseCurl('wget https://x.com')
    expect(error).toBeTruthy()
  })
})

describe('toCurl round-trip', () => {
  it('exports GET with query params', () => {
    const config = emptyConfig()
    config.url = 'https://example.com/api'
    config.params.push({ id: '1', key: 'page', value: '2', enabled: true })
    const curl = toCurl(config)
    expect(curl).toContain('curl')
    expect(curl).toContain('page=2')
  })

  it('exports method and header', () => {
    const config = emptyConfig()
    config.method = 'POST'
    config.url = 'https://example.com'
    config.headers.push({ id: '1', key: 'X-Test', value: 'yes', enabled: true })
    config.bodyType = 'json'
    config.body.content = '{"a":1}'
    const curl = toCurl(config)
    expect(curl).toContain('-X POST')
    expect(curl).toContain('X-Test: yes')
    expect(curl).toContain('{"a":1}')
  })
})

describe('format utils', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
  it('formats ms', () => {
    expect(formatMs(250)).toBe('250 ms')
    expect(formatMs(1500)).toBe('1.50 s')
  })
})
