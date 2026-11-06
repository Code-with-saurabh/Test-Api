/* JSON → TypeScript interface converter */

export function jsonToTs(value: unknown, rootName = 'Root'): string {
  const lines: string[] = []
  emit(value, rootName, lines, 0, new Set())
  return lines.join('\n')
}

function emit(value: unknown, name: string, lines: string[], depth: number, seen: Set<string>): void {
  const indent = '  '.repeat(depth)
  const safeName = toPascal(name)

  if (value === null) {
    lines.push(`${indent}type ${safeName} = null`)
    return
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${indent}type ${safeName} = unknown[]`)
      return
    }
    const item = value[0]
    const itemName = safeName.replace(/s$/, '') || 'Item'
    emit(item, itemName, lines, depth, seen)
    lines.push(`${indent}type ${safeName} = ${toPascal(itemName)}[]`)
    return
  }
  if (typeof value === 'object') {
    if (seen.has(safeName)) {
      lines.push(`${indent}type ${safeName} = Record<string, unknown>`)
      return
    }
    seen.add(safeName)
    lines.push(`${indent}interface ${safeName} {`)
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k)
      const childName = `${safeName}_${toPascal(k)}`
      if (v !== null && typeof v === 'object') {
        emit(v, childName, lines, depth + 1, seen)
        const t = Array.isArray(v) ? `${toPascal(childName.replace(/s$/, '')) || 'Item'}[]` : toPascal(childName)
        lines.push(`${indent}  ${key}: ${t}`)
      } else {
        lines.push(`${indent}  ${key}: ${tsType(v)}`)
      }
    }
    lines.push(`${indent}}`)
    return
  }
  lines.push(`${indent}type ${safeName} = ${tsType(value)}`)
}

function tsType(v: unknown): string {
  if (v === null) return 'null'
  switch (typeof v) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'undefined':
      return 'undefined'
    default:
      return 'unknown'
  }
}

function toPascal(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Type'
}
