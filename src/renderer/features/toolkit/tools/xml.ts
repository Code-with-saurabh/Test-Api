/* Lightweight XML utilities for toolkit — DOM-based (browser) */

export function formatXml(xml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('Invalid XML: ' + (err.textContent ?? '').slice(0, 200))
  return serialize(doc.documentElement, 0)
}

function serialize(el: Element, depth: number): string {
  const indent = '  '.repeat(depth)
  const attrs = [...el.attributes].map((a) => ` ${a.name}="${a.value}"`).join('')
  const children = [...el.childNodes]
  if (children.length === 0) return `${indent}<${el.tagName}${attrs}/>`
  if (children.length === 1 && children[0]!.nodeType === Node.TEXT_NODE) {
    return `${indent}<${el.tagName}${attrs}>${children[0]!.textContent ?? ''}</${el.tagName}>`
  }
  const inner = children
    .map((c) => {
      if (c.nodeType === Node.TEXT_NODE) {
        const t = (c.textContent ?? '').trim()
        return t ? `${'  '.repeat(depth + 1)}${t}` : ''
      }
      if (c.nodeType === Node.ELEMENT_NODE) return serialize(c as Element, depth + 1)
      return ''
    })
    .filter(Boolean)
    .join('\n')
  return `${indent}<${el.tagName}${attrs}>\n${inner}\n${indent}</${el.tagName}>`
}

export function xmlToJson(xml: string): unknown {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('Invalid XML')
  return elementToObj(doc.documentElement)
}

function elementToObj(el: Element): unknown {
  const obj: Record<string, unknown> = {}
  for (const a of [...el.attributes]) obj[`@${a.name}`] = a.value
  const children = [...el.childNodes].filter((c) => c.nodeType === Node.ELEMENT_NODE) as Element[]
  const text = [...el.childNodes]
    .filter((c) => c.nodeType === Node.TEXT_NODE)
    .map((c) => c.textContent?.trim() ?? '')
    .join('')
    .trim()
  if (children.length === 0) {
    if (Object.keys(obj).length === 0) return text
    if (text) obj['#text'] = text
    return obj
  }
  for (const c of children) {
    const v = elementToObj(c)
    if (c.tagName in obj) {
      const existing = obj[c.tagName]
      if (Array.isArray(existing)) existing.push(v)
      else obj[c.tagName] = [existing, v]
    } else {
      obj[c.tagName] = v
    }
  }
  return obj
}

export function jsonToXml(value: unknown, rootName = 'root'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${objToXml(value, rootName)}`
}

function objToXml(value: unknown, name: string): string {
  if (value === null || value === undefined) return `<${name}/>`
  if (typeof value !== 'object') return `<${name}>${escapeXml(String(value))}</${name}>`
  if (Array.isArray(value)) {
    return value.map((v) => objToXml(v, name)).join('\n')
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return `<${name}/>`
  const inner = entries.map(([k, v]) => objToXml(v, k)).join('\n')
  return `<${name}>\n${inner}\n</${name}>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
