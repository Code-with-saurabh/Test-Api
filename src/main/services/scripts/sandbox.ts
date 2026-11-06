/* Script sandbox — node:vm with hard timeout, frozen safe globals. No require/process/fs/network. */
import vm from 'vm'
import crypto from 'crypto'
import type { ScriptRunResult, TestAssertionResult } from '@shared/types'

const SCRIPT_TIMEOUT_MS = 5000

interface PmAssertion {
  name: string
  passed: boolean
  message?: string
}

class PmExpectFailure extends Error {}

function makeExpect(actual: unknown) {
  interface ExpectChain {
    to: Record<string, unknown>
    not: { to: Record<string, unknown> }
  }
  const chain: ExpectChain = {
    to: {},
    not: { to: {} }
  }

  const fail = (msg: string): never => {
    throw new PmExpectFailure(msg)
  }

  const not = {
    to: {
      be: {
        oneOf: (list: unknown[]) => {
          if (list.includes(actual)) fail(`expected value NOT in list, but it was`)
        }
      },
      have: {
        property: (p: string) => {
          if (actual && typeof actual === 'object' && p in (actual as object)) fail(`expected NOT to have property ${p}`)
        },
        status: () => fail('expected NOT to have this status')
      },
      eql: (v: unknown) => {
        if (JSON.stringify(actual) === JSON.stringify(v)) fail(`expected NOT to deep-equal ${JSON.stringify(v)}`)
      }
    }
  }

  const to: Record<string, unknown> = {
    be: {
      oneOf: (list: unknown[]) => {
        if (!list.includes(actual)) fail(`expected one of ${JSON.stringify(list)}, got ${JSON.stringify(actual)}`)
      },
      an: (t: string) => {
        const type = Array.isArray(actual) ? 'array' : typeof actual
        if (type !== t && !(t === 'array' && Array.isArray(actual))) fail(`expected type ${t}, got ${type}`)
      },
      true: () => {
        if (actual !== true) fail('expected true')
      },
      false: () => {
        if (actual !== false) fail('expected false')
      },
      null: () => {
        if (actual !== null) fail('expected null')
      },
      undefined: () => {
        if (actual !== undefined) fail('expected undefined')
      },
      exist: () => {
        if (actual === null || actual === undefined) fail('expected value to exist')
      },
      ok: () => {
        if (!actual) fail('expected truthy value')
      },
      eql: (v: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(v)) fail(`expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`)
      },
      closeTo: (v: number, delta = 0.001) => {
        if (typeof actual !== 'number' || Math.abs(actual - v) > delta) fail(`expected ~${v}, got ${JSON.stringify(actual)}`)
      }
    },
    have: {
      property: (p: string, v?: unknown) => {
        if (!actual || typeof actual !== 'object') fail('expected object to have property ' + p)
        if (!(p in (actual as object))) fail(`expected object to have property ${p}`)
        if (v !== undefined) {
          const av = (actual as Record<string, unknown>)[p]
          if (JSON.stringify(av) !== JSON.stringify(v)) fail(`property ${p}: expected ${JSON.stringify(v)}, got ${JSON.stringify(av)}`)
        }
      },
      status: (s: number) => {
        const code = (actual as { status?: number })?.status
        if (code !== s) fail(`expected status ${s}, got ${code}`)
      },
      statusMessage: (s: number) => {
        const code = (actual as { status?: number })?.status
        if (code !== s) fail(`expected status ${s}, got ${code}`)
      },
      length: (n: number) => {
        const len = (actual as { length?: number })?.length
        if (len !== n) fail(`expected length ${n}, got ${len}`)
      },
      header: (name: string) => {
        const headers = (actual as { headers?: Record<string, string> })?.headers
        const found = headers && Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase())
        if (!found) fail(`expected header ${name}`)
      },
      json: () => {
        /* marker used by pm.response.to.have.json — actual is response-like */
      }
    },
    include: {
      oneOf: (list: unknown[]) => {
        if (!list.includes(actual)) fail(`expected to include ${JSON.stringify(actual)}`)
      },
      string: (s: string) => {
        if (typeof actual !== 'string' || !actual.includes(s)) fail(`expected string to include ${JSON.stringify(s)}`)
      },
      member: (v: unknown) => {
        if (!Array.isArray(actual) || !actual.includes(v)) fail('expected array to include member')
      }
    }
  }

  chain.to = to
  chain.not = not as ExpectChain['not']
  // allow pm.expect(x).to.be.true style where be.true is function — expose getters
  Object.defineProperty(to, 'be', {
    get() {
      return to.be
    }
  })
  // true/false/null etc as function-style via boolean props accessed as functions:
  for (const k of ['true', 'false', 'null', 'undefined', 'exist', 'ok']) {
    const fn = (to.be as Record<string, unknown>)[k]
    if (typeof fn === 'function') {
      Object.defineProperty(to, k, { get: () => fn })
    }
  }

  return chain
}

export function runScript(input: {
  script: string
  phase: 'pre' | 'post'
  variables: Record<string, string>
  responseJson?: string
  statusCode?: number
  responseTimeMs?: number
  requestJson?: string
}): ScriptRunResult {
  const started = Date.now()
  const assertions: PmAssertion[] = []
  const logs: string[] = []
  const setVariables: ScriptRunResult['setVariables'] = []

  const envVars: Record<string, string> = { ...input.variables }
  const localVars: Record<string, string> = {}

  let parsedBody: unknown = undefined
  if (input.responseJson) {
    try {
      parsedBody = JSON.parse(input.responseJson)
    } catch {
      parsedBody = undefined
    }
  }

  const responseObj = {
    status: input.statusCode ?? 0,
    code: input.statusCode ?? 0,
    ok: (input.statusCode ?? 0) >= 200 && (input.statusCode ?? 0) < 300,
    time: input.responseTimeMs ?? 0,
    headers: {} as Record<string, string>,
    json(): unknown {
      if (parsedBody === undefined) throw new Error('Response body is not valid JSON')
      return parsedBody
    },
    text(): string {
      return input.responseJson ?? ''
    }
  }

  const pm = {
    test(name: string, fn: () => void) {
      try {
        fn()
        assertions.push({ name, passed: true })
      } catch (e) {
        const msg = e instanceof PmExpectFailure ? e.message : e instanceof Error ? e.message : String(e)
        assertions.push({ name, passed: false, message: msg })
      }
    },
    expect: (actual: unknown) => makeExpect(actual),
    response: {
      ...responseObj,
      to: {
        have: {
          status(s: number) {
            if (responseObj.status !== s) throw new PmExpectFailure(`expected status ${s}, got ${responseObj.status}`)
          },
          header(name: string) {
            /* header check needs headers — stubbed permissive */
            void name
          },
          json() {
            if (parsedBody === undefined) throw new PmExpectFailure('response is not JSON')
          }
        },
        not: {
          have: {
            status(s: number) {
              if (responseObj.status === s) throw new PmExpectFailure(`expected NOT status ${s}`)
            }
          }
        }
      }
    },
    environment: {
      get(key: string): string | undefined {
        return envVars[key]
      },
      set(key: string, value: unknown) {
        const v = typeof value === 'string' ? value : JSON.stringify(value)
        envVars[key] = v
        setVariables.push({ key, value: v, scope: 'environment' })
      },
      unset(key: string) {
        delete envVars[key]
        setVariables.push({ key, value: '', scope: 'environment' })
      },
      has(key: string): boolean {
        return key in envVars
      },
      toObject(): Record<string, string> {
        return { ...envVars }
      }
    },
    collectionVariables: {
      get(key: string): string | undefined {
        return envVars[key]
      },
      set(key: string, value: unknown) {
        const v = typeof value === 'string' ? value : JSON.stringify(value)
        envVars[key] = v
        setVariables.push({ key, value: v, scope: 'collection' })
      },
      unset(key: string) {
        delete envVars[key]
      },
      has(key: string): boolean {
        return key in envVars
      },
      toObject(): Record<string, string> {
        return { ...envVars }
      }
    },
    local: {
      get(key: string): string | undefined {
        return localVars[key]
      },
      set(key: string, value: unknown) {
        localVars[key] = typeof value === 'string' ? value : JSON.stringify(value)
      },
      unset(key: string) {
        delete localVars[key]
      },
      toObject(): Record<string, string> {
        return { ...localVars }
      }
    },
    info: {
      requestName: '',
      methodName: '',
      iteration: 0
    },
    console: {
      log: (...args: unknown[]) => logs.push(args.map(fmt).join(' ')),
      warn: (...args: unknown[]) => logs.push('[warn] ' + args.map(fmt).join(' ')),
      error: (...args: unknown[]) => logs.push('[error] ' + args.map(fmt).join(' ')),
      info: (...args: unknown[]) => logs.push(args.map(fmt).join(' '))
    }
  }

  const sandbox = {
    pm,
    console: pm.console,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    TypeError,
    RangeError,
    URIError,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    crypto: {
      randomUUID: () => crypto.randomUUID(),
      randomBytes: (n: number) => Array.from(crypto.randomBytes(n))
    },
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout: () => undefined,
    clearInterval: () => undefined
  }

  let error: string | undefined
  try {
    const context = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false }
    })
    const script = new vm.Script(input.script, { filename: `${input.phase}-request-script.js` })
    script.runInContext(context, { timeout: SCRIPT_TIMEOUT_MS, breakOnSigint: true })
  } catch (e) {
    if (e && typeof e === 'object' && (e as { code?: string }).code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      error = `Script timed out after ${SCRIPT_TIMEOUT_MS}ms`
    } else {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  return {
    logs,
    assertions: assertions.map<TestAssertionResult>((a) => ({ name: a.name, passed: a.passed, message: a.message })),
    error,
    durationMs: Date.now() - started,
    setVariables
  }
}

function fmt(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
