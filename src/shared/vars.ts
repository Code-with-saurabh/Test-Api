/* Pure variable resolution — runs in main process, unit-testable */

export interface VarMap {
  [key: string]: string
}

export interface ResolveContext {
  /** higher priority last in map-merge; final map is flat */
  scopes: Array<Record<string, string>>
  /** built-in dynamic generators */
  dynamic?: boolean
}

export function* guidGenerator(): Generator<string> {
  while (true) yield crypto.randomUUID()
}

/** Resolve {{var}} and {{dynamic}} tokens. Unknown keys are left as-is and reported. */
export function resolveVariables(input: string, scopeMaps: Array<Record<string, string>>): {
  result: string
  unresolved: string[]
} {
  const merged: Record<string, string> = {}
  // earlier scopes = lower priority; later overrides
  for (const m of scopeMaps) {
    for (const [k, v] of Object.entries(m)) merged[k] = v
  }

  const unresolved: string[] = []
  const now = Math.floor(Date.now() / 1000)

  const result = input.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (full, rawKey: string) => {
    const key = rawKey.trim()
    // dynamic variables
    if (key.startsWith('$')) {
      switch (key) {
        case '$guid':
          return crypto.randomUUID()
        case '$timestamp':
          return String(now)
        case '$isoTimestamp':
          return new Date().toISOString()
        case '$randomInt':
          return String(Math.floor(Math.random() * 10000))
        default:
          unresolved.push(key)
          return full
      }
    }
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      return merged[key] ?? full
    }
    unresolved.push(key)
    return full
  })

  return { result, unresolved }
}

/** Collect all {{tokens}} in a string */
export function extractTokens(input: string): string[] {
  const out = new Set<string>()
  for (const m of input.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    if (m[1]) out.add(m[1].trim())
  }
  return [...out]
}

/** Merge variable scope maps from lowest to highest priority */
export function buildScopeMaps(input: {
  global?: Record<string, string>
  environment?: Record<string, string>
  collection?: Record<string, string>
  folder?: Record<string, string>
  request?: Record<string, string>
  local?: Record<string, string>
}): Array<Record<string, string>> {
  return [input.global, input.environment, input.collection, input.folder, input.request, input.local].filter(
    (m): m is Record<string, string> => !!m
  )
}
