import { useCallback, useState } from 'react'
import type { KeyValue } from '@shared/types'
import { Checkbox, Button, Input, Select } from '@/components/ui'
import { cn } from '@/lib/cn'

export function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  withFile
}: {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  withFile?: boolean
}) {
  const update = (id: string, patch: Partial<KeyValue>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id))
  const add = () =>
    onChange([...rows, { id: crypto.randomUUID(), key: '', value: '', enabled: true, type: withFile ? 'text' : undefined }])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-panel z-10">
            <tr className="text-txt-secondary text-left border-b border-border">
              <th className="w-8 py-1.5 px-2"></th>
              <th className="py-1.5 px-2 font-medium">{withFile ? 'Key / Name' : 'Key'}</th>
              <th className="py-1.5 px-2 font-medium">Value</th>
              {withFile && <th className="w-20 py-1.5 px-2 font-medium">Type</th>}
              <th className="w-8 py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={withFile ? 5 : 4} className="py-6 text-center text-txt-muted">
                  No {withFile ? 'fields' : 'rows'} — click + to add
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={cn('border-b border-border/40 group', !r.enabled && 'opacity-50')}>
                <td className="px-2 py-1">
                  <Checkbox checked={r.enabled} onChange={(v) => update(r.id, { enabled: v })} />
                </td>
                <td className="px-1 py-1">
                  {r.type === 'file' ? (
                    <Input className="!py-0.5 text-xs" value={r.key} onChange={(e) => update(r.id, { key: e.target.value })} placeholder="fieldName" />
                  ) : (
                    <Input className="!py-0.5 text-xs font-mono" value={r.key} onChange={(e) => update(r.id, { key: e.target.value })} placeholder={keyPlaceholder} />
                  )}
                </td>
                <td className="px-1 py-1">
                  {r.type === 'file' ? (
                    <div className="flex gap-1">
                      <Input className="!py-0.5 text-xs flex-1" readOnly value={r.filePath ?? ''} placeholder="Choose file…" />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const f = await window.api.chooseFile()
                          if (f.ok && f.data) update(r.id, { filePath: f.data })
                        }}
                      >
                        Browse
                      </Button>
                    </div>
                  ) : (
                    <Input className="!py-0.5 text-xs font-mono" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder={valuePlaceholder} />
                  )}
                </td>
                {withFile && (
                  <td className="px-1 py-1">
                    <Select
                      className="!py-0.5 text-xs w-full"
                      value={r.type ?? 'text'}
                      onChange={(e) => update(r.id, { type: e.target.value as 'text' | 'file' })}
                    >
                      <option value="text">Text</option>
                      <option value="file">File</option>
                    </Select>
                  </td>
                )}
                <td className="px-1 py-1 text-center">
                  <button
                    className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error !p-0.5"
                    onClick={() => remove(r.id)}
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-2 py-1">
        <Button size="sm" variant="ghost" onClick={add}>
          + Add
        </Button>
      </div>
    </div>
  )
}

export function useBulkPaste(onRows: (rows: KeyValue[]) => void): {
  open: boolean
  setOpen: (v: boolean) => void
  pasteArea: React.ReactNode
} {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const apply = useCallback(() => {
    const rows: KeyValue[] = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(':')
        if (idx >= 0) {
          return { id: crypto.randomUUID(), key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim(), enabled: true }
        }
        const eq = line.indexOf('=')
        if (eq >= 0) {
          return { id: crypto.randomUUID(), key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim(), enabled: true }
        }
        return { id: crypto.randomUUID(), key: line, value: '', enabled: true }
      })
    onRows(rows)
    setOpen(false)
    setText('')
  }, [text, onRows])

  const pasteArea = open ? (
    <div className="border-b border-border p-2 bg-elevated">
      <textarea
        className="input-base w-full h-24 font-mono text-xs"
        placeholder={'Key: Value\nHeader-Name: other-value\nX-Custom: 123'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 mt-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={apply}>
          Replace all
        </Button>
      </div>
    </div>
  ) : null

  return { open, setOpen, pasteArea }
}
