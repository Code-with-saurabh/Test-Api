import { memo, useMemo, useState, type ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface JsonTreeProps {
  text: string
  maxHeight?: number | string
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

function parseSafe(text: string): { value: JsonValue; ok: boolean } {
  try {
    return { value: JSON.parse(text) as JsonValue, ok: true }
  } catch {
    return { value: null, ok: false }
  }
}

export const JsonTree = memo(function JsonTree({ text }: JsonTreeProps) {
  const { value, ok } = useMemo(() => parseSafe(text), [text])
  if (!ok) {
    return (
      <div className="p-3 text-xs text-error">
        Invalid JSON — use Raw view.{' '}
        <button className="underline text-txt-secondary" onClick={() => void navigator.clipboard.writeText(text)}>
          Copy raw
        </button>
      </div>
    )
  }
  return (
    <div className="p-2 overflow-auto h-full">
      <JsonNode name={null} value={value} depth={0} defaultExpanded />
    </div>
  )
})

function JsonNode({
  name,
  value,
  depth,
  defaultExpanded
}: {
  name: string | null
  value: JsonValue
  depth: number
  defaultExpanded: boolean
}) {
  const [open, setOpen] = useState(defaultExpanded && depth < 2)

  const isArray = Array.isArray(value)
  const isObject = !isArray && value !== null && typeof value === 'object'
  const isLeaf = !isArray && !isObject

  if (isLeaf) {
    return (
      <div className="font-mono text-[12.5px] leading-6 whitespace-pre-wrap break-all" style={{ paddingLeft: depth * 16 }}>
        {name !== null && (
          <>
            <span className="json-key">&quot;{escapeHtml(name)}&quot;</span>
            <span className="json-punct">: </span>
          </>
        )}
        <JsonLeaf value={value} />
        <span className="json-punct">,</span>
      </div>
    )
  }

  const entries: Array<[string | null, JsonValue]> = isArray
    ? (value as JsonValue[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, JsonValue>)

  return (
    <div>
      <div
        className="font-mono text-[12.5px] leading-6 cursor-pointer select-none hover:bg-hover/40 rounded"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setOpen(!open)}
      >
        <span className="inline-flex items-center w-4">{open ? <ChevronDown size={12} className="json-punct" /> : <ChevronRight size={12} className="json-punct" />}</span>
        {name !== null && (
          <>
            <span className="json-key">&quot;{escapeHtml(name)}&quot;</span>
            <span className="json-punct">: </span>
          </>
        )}
        <span className="json-punct">{isArray ? '[' : '{'}</span>
        {!open && (
          <>
            <span className="text-txt-muted"> … </span>
            <span className="json-punct">{isArray ? ']' : '}'}</span>
            <span className="json-punct">,</span>
          </>
        )}
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={k ?? 'null'} name={k} value={v} depth={depth + 1} defaultExpanded={defaultExpanded} />
          ))}
          <div className="font-mono text-[12.5px] leading-6 json-punct" style={{ paddingLeft: depth * 16 + 16 }}>
            {isArray ? ']' : '}'}
            <span className="json-punct">,</span>
          </div>
        </>
      )}
    </div>
  )
}

function JsonLeaf({ value }: { value: JsonValue }): ReactNode {
  if (value === null) return <span className="json-null">null</span>
  switch (typeof value) {
    case 'string':
      return <span className="json-string">&quot;{escapeHtml(value)}&quot;</span>
    case 'number':
      return <span className="json-number">{value}</span>
    case 'boolean':
      return <span className="json-boolean">{String(value)}</span>
    default:
      return <span>{String(value)}</span>
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Lightweight search: returns count of case-insensitive matches in text */
export function jsonMatchCount(text: string, query: string): number {
  if (!query) return 0
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let count = 0
  let idx = 0
  while ((idx = lower.indexOf(q, idx)) !== -1) {
    count++
    idx += q.length
  }
  return count
}
