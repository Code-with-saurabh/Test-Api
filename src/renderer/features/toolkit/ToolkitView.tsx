import { useMemo, useState } from 'react'
import { Button, Textarea, Input, Label, Select } from '@/components/ui'
import { uuidv4 } from './tools/uuid'
import { hashString, HASH_ALGOS } from './tools/hash'
import { decodeJwt, formatJwt } from './tools/jwt'
import { formatXml, xmlToJson, jsonToXml } from './tools/xml'
import { jsonToTs } from './tools/json2ts'

type ToolId = 'json' | 'jwt' | 'base64' | 'url' | 'uuid' | 'hash' | 'timestamp' | 'regex' | 'xml'

const TOOLS: Array<{ id: ToolId; name: string }> = [
  { id: 'json', name: 'JSON Formatter' },
  { id: 'jwt', name: 'JWT Decoder' },
  { id: 'base64', name: 'Base64' },
  { id: 'url', name: 'URL Encode/Decode' },
  { id: 'uuid', name: 'UUID Generator' },
  { id: 'hash', name: 'Hash Generator' },
  { id: 'timestamp', name: 'Timestamp Converter' },
  { id: 'regex', name: 'Regex Tester' },
  { id: 'xml', name: 'XML Tools' }
]

export function ToolkitView() {
  const [tool, setTool] = useState<ToolId>('json')

  return (
    <div className="flex h-full min-h-0">
      <div className="w-44 border-r border-border py-2">
        <div className="px-3 py-1 text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-1">Toolkit</div>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`block w-full text-left px-3 py-1.5 text-xs cursor-pointer ${tool === t.id ? 'bg-hover text-txt font-medium border-l-2 border-primary' : 'text-txt-secondary hover:bg-hover border-l-2 border-transparent'}`}
            onClick={() => setTool(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {tool === 'json' && <JsonTool />}
        {tool === 'jwt' && <JwtTool />}
        {tool === 'base64' && <Base64Tool />}
        {tool === 'url' && <UrlTool />}
        {tool === 'uuid' && <UuidTool />}
        {tool === 'hash' && <HashTool />}
        {tool === 'timestamp' && <TimestampTool />}
        {tool === 'regex' && <RegexTool />}
        {tool === 'xml' && <XmlTool />}
      </div>
    </div>
  )
}

function JsonTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'format' | 'minify' | 'ts' | 'validate'>('format')

  const run = () => {
    setError('')
    try {
      const parsed = JSON.parse(input)
      switch (mode) {
        case 'format':
          setOutput(JSON.stringify(parsed, null, 2))
          break
        case 'minify':
          setOutput(JSON.stringify(parsed))
          break
        case 'validate':
          setOutput('✓ Valid JSON')
          break
        case 'ts':
          setOutput(jsonToTs(parsed))
          break
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOutput('')
    }
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center gap-2">
        <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="w-40">
          <option value="format">Format</option>
          <option value="minify">Minify</option>
          <option value="validate">Validate</option>
          <option value="ts">To TypeScript</option>
        </Select>
        <Button variant="primary" size="sm" onClick={run}>
          Run
        </Button>
      </div>
      <Textarea className="h-40" placeholder="Paste JSON…" value={input} onChange={(e) => setInput(e.target.value)} />
      {error && <div className="text-xs text-error">{error}</div>}
      <Label>Output</Label>
      <Textarea className="flex-1 min-h-[200px]" readOnly value={output} />
      {output && output !== '✓ Valid JSON' && (
        <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(output)}>
          Copy output
        </Button>
      )}
    </div>
  )
}

function JwtTool() {
  const [token, setToken] = useState('')
  const result = useMemo(() => (token.trim() ? decodeJwt(token.trim()) : null), [token])
  return (
    <div className="space-y-3 max-w-2xl">
      <div>
        <Label>JWT</Label>
        <Textarea className="h-24" placeholder="eyJhbGciOiJIUzI1NiIs..." value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      {result && 'error' in result && result.error && <div className="text-xs text-error">{result.error}</div>}
      {result && !('error' in result) && (
        <>
          <div>
            <Label>Header</Label>
            <pre className="code text-xs bg-app border border-border rounded p-2 overflow-auto">{formatJwt(result.header)}</pre>
          </div>
          <div>
            <Label>Payload</Label>
            <pre className="code text-xs bg-app border border-border rounded p-2 overflow-auto">{formatJwt(result.payload)}</pre>
          </div>
          <p className="text-2xs text-txt-muted">Decode only — signature is not verified.</p>
        </>
      )}
    </div>
  )
}

function Base64Tool() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [output, setOutput] = useState('')
  const run = () => {
    try {
      setOutput(mode === 'encode' ? btoa(unescape(encodeURIComponent(input))) : decodeURIComponent(escape(atob(input))))
    } catch (e) {
      setOutput('Error: ' + (e instanceof Error ? e.message : String(e)))
    }
  }
  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex gap-2">
        <Select value={mode} onChange={(e) => setMode(e.target.value as 'encode' | 'decode')} className="w-32">
          <option value="encode">Encode</option>
          <option value="decode">Decode</option>
        </Select>
        <Button variant="primary" size="sm" onClick={run}>
          Run
        </Button>
      </div>
      <Textarea className="h-28" value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === 'encode' ? 'Text to encode' : 'Base64 to decode'} />
      <Textarea className="h-28" readOnly value={output} />
    </div>
  )
}

function UrlTool() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const output = useMemo(() => {
    try {
      return mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input)
    } catch {
      return 'Invalid input for decode'
    }
  }, [input, mode])
  return (
    <div className="space-y-3 max-w-2xl">
      <Select value={mode} onChange={(e) => setMode(e.target.value as 'encode' | 'decode')} className="w-36">
        <option value="encode">Encode</option>
        <option value="decode">Decode</option>
      </Select>
      <Textarea className="h-24" value={input} onChange={(e) => setInput(e.target.value)} />
      <Textarea className="h-24" readOnly value={output} />
    </div>
  )
}

function UuidTool() {
  const [count, setCount] = useState(5)
  const [list, setList] = useState<string[]>([])
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div>
          <Label>Count</Label>
          <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-24" />
        </div>
        <Button variant="primary" size="sm" onClick={() => setList(Array.from({ length: Math.min(100, Math.max(1, count)) }, () => uuidv4()))}>
          Generate
        </Button>
        {list.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(list.join('\n'))}>
            Copy all
          </Button>
        )}
      </div>
      <div className="font-mono text-xs space-y-1">
        {list.map((u, i) => (
          <div key={i} className="flex items-center gap-2 bg-app border border-border rounded px-2 py-1">
            <span className="flex-1">{u}</span>
            <button className="text-txt-muted hover:text-txt" onClick={() => void navigator.clipboard.writeText(u)}>
              copy
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function HashTool() {
  const [input, setInput] = useState('')
  const [algo, setAlgo] = useState<string>('sha256')
  const results = useMemo(() => (input ? HASH_ALGOS.map((a) => ({ algo: a, hash: hashString(input, a) })) : []), [input])
  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex gap-2">
        <Select value={algo} onChange={(e) => setAlgo(e.target.value)} className="w-32">
          {HASH_ALGOS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      </div>
      <Textarea className="h-24" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text to hash" />
      <div className="space-y-1">
        {results.map((r) => (
          <div key={r.algo} className="flex items-center gap-2 text-xs font-mono bg-app border border-border rounded px-2 py-1">
            <span className="text-txt-secondary w-16">{r.algo}</span>
            <span className="flex-1 break-all">{r.hash}</span>
            <button className="text-txt-muted hover:text-txt" onClick={() => void navigator.clipboard.writeText(r.hash)}>
              copy
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimestampTool() {
  const [epoch, setEpoch] = useState('')
  const [iso, setIso] = useState('')
  const now = () => {
    const t = Math.floor(Date.now() / 1000)
    setEpoch(String(t))
    setIso(new Date().toISOString())
  }
  return (
    <div className="space-y-4 max-w-xl">
      <Button variant="secondary" size="sm" onClick={now}>
        Set current time
      </Button>
      <div>
        <Label>Epoch (seconds)</Label>
        <Input value={epoch} onChange={(e) => setEpoch(e.target.value)} />
        <div className="text-xs text-txt-secondary mt-1">{epoch && !isNaN(Number(epoch)) ? new Date(Number(epoch) * 1000).toLocaleString() : ''}</div>
      </div>
      <div>
        <Label>ISO 8601</Label>
        <Input value={iso} onChange={(e) => setIso(e.target.value)} />
        <div className="text-xs text-txt-secondary mt-1">
          {iso && !isNaN(Date.parse(iso)) ? `${Math.floor(Date.parse(iso) / 1000)} (epoch)` : ''}
        </div>
      </div>
    </div>
  )
}

function RegexTool() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [test, setTest] = useState('')
  const results = useMemo(() => {
    if (!pattern) return { matches: [] as Array<{ match: string; index: number; groups: string[] }>, error: '' }
    try {
      const re = new RegExp(pattern, flags)
      const matches: Array<{ match: string; index: number; groups: string[] }> = []
      if (flags.includes('g')) {
        for (const m of test.matchAll(re)) {
          matches.push({ match: m[0], index: m.index ?? 0, groups: m.slice(1) })
        }
      } else {
        const m = re.exec(test)
        if (m) matches.push({ match: m[0], index: m.index ?? 0, groups: m.slice(1) })
      }
      return { matches, error: '' }
    } catch (e) {
      return { matches: [], error: e instanceof Error ? e.message : String(e) }
    }
  }, [pattern, flags, test])

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label>Pattern</Label>
          <Input className="font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="\\d+" />
        </div>
        <div className="w-20">
          <Label>Flags</Label>
          <Input className="font-mono" value={flags} onChange={(e) => setFlags(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Test string</Label>
        <Textarea className="h-24" value={test} onChange={(e) => setTest(e.target.value)} />
      </div>
      {results.error && <div className="text-xs text-error">{results.error}</div>}
      <div className="text-xs">
        <Label>Matches ({results.matches.length})</Label>
        {results.matches.map((m, i) => (
          <div key={i} className="font-mono bg-app border border-border rounded px-2 py-1 mb-1">
            [{m.index}] &quot;{m.match}&quot; {m.groups.length > 0 && <span className="text-txt-muted">groups: {JSON.stringify(m.groups)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function XmlTool() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'format' | 'toJson' | 'fromJson'>('format')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const run = () => {
    setError('')
    try {
      if (mode === 'format') setOutput(formatXml(input))
      else if (mode === 'toJson') setOutput(JSON.stringify(xmlToJson(input), null, 2))
      else setOutput(jsonToXml(JSON.parse(input)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex gap-2 items-end">
        <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="w-40">
          <option value="format">Format XML</option>
          <option value="toJson">XML → JSON</option>
          <option value="fromJson">JSON → XML</option>
        </Select>
        <Button variant="primary" size="sm" onClick={run}>
          Run
        </Button>
      </div>
      <Textarea className="h-36" value={input} onChange={(e) => setInput(e.target.value)} placeholder="<root><item>1</item></root>" />
      {error && <div className="text-xs text-error">{error}</div>}
      <Textarea className="flex-1 min-h-[160px]" readOnly value={output} />
    </div>
  )
}
