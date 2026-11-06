import { useEffect, useState } from 'react'
import { Modal, Button, Select, Label, Input, Toggle, Textarea } from '@/components/ui'
import type { Collection, Environment, RunRequestResult, SavedRequest } from '@shared/types'
import { CheckCircle2, XCircle } from 'lucide-react'
import { formatMs } from '@shared/utils'

export function RunTestsDialog({
  open,
  onClose,
  collectionId
}: {
  open: boolean
  onClose: () => void
  collectionId?: string | null
}) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [cid, setCid] = useState('')
  const [envId, setEnvId] = useState('')
  const [iterations, setIterations] = useState(1)
  const [delayMs, setDelayMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RunRequestResult[] | null>(null)
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number; durationMs: number } | null>(null)
  const [error, setError] = useState('')
  const [dataJson, setDataJson] = useState('')
  const [useData, setUseData] = useState(false)

  useEffect(() => {
    if (!open) return
    setResults(null)
    setSummary(null)
    setError('')
    void Promise.all([window.api.collectionsList(), window.api.environmentsList(), window.api.environmentsActiveId()]).then(([c, e, a]) => {
      if (c.ok) {
        setCollections(c.data)
        setCid(collectionId ?? c.data[0]?.id ?? '')
      }
      if (e.ok) setEnvironments(e.data)
      if (a.ok && a.data) setEnvId(a.data)
    })
  }, [open, collectionId])

  const start = async () => {
    setRunning(true)
    setError('')
    setResults(null)
    try {
      const treeRes = await window.api.collectionsTree(cid)
      if (!treeRes.ok) throw new Error(treeRes.error.message)
      const requests: SavedRequest[] = treeRes.data.requests
      if (!requests.length) throw new Error('Collection has no requests')

      let dataRows: Array<Record<string, string>> | undefined
      if (useData && dataJson.trim()) {
        const parsed = JSON.parse(dataJson) as Array<Record<string, string>>
        if (!Array.isArray(parsed)) throw new Error('Data must be a JSON array of objects')
        dataRows = parsed
      }

      const runRes = await window.api.runnerStart({
        requests: requests.map((r) => ({ id: r.id, name: r.name, config: r.config })),
        environmentId: envId || null,
        iterations,
        delayMs,
        dataRows
      })
      if (!runRes.ok) throw new Error(runRes.error.message)
      setResults(runRes.data.results)
      const passed = runRes.data.results.filter((r) => r.ok).length
      setSummary({
        total: runRes.data.results.length,
        passed,
        failed: runRes.data.results.length - passed,
        durationMs: runRes.data.durationMs
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Collection Runner" wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Collection</Label>
            <Select value={cid} onChange={(e) => setCid(e.target.value)} className="w-full">
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Environment</Label>
            <Select value={envId} onChange={(e) => setEnvId(e.target.value)} className="w-full">
              <option value="">— none —</option>
              {environments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Iterations</Label>
            <Input type="number" min={1} max={1000} value={iterations} onChange={(e) => setIterations(Number(e.target.value) || 1)} />
          </div>
          <div>
            <Label>Delay between requests (ms)</Label>
            <Input type="number" min={0} max={60000} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value) || 0)} />
          </div>
        </div>

        <Toggle checked={useData} onChange={setUseData} label="Data-driven (JSON array of variable rows)" />
        {useData && (
          <Textarea
            className="h-24"
            placeholder='[{"user":"alice"},{"user":"bob"}]'
            value={dataJson}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDataJson(e.target.value)}
          />
        )}

        {error && <div className="text-xs text-error">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => void start()} disabled={running || !cid}>
            {running ? 'Running…' : 'Run'}
          </Button>
        </div>

        {summary && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-4 text-xs mb-2">
              <span className="text-success font-medium">✓ {summary.passed} passed</span>
              <span className="text-error font-medium">✕ {summary.failed} failed</span>
              <span className="text-txt-secondary">{formatMs(summary.durationMs)}</span>
            </div>
          </div>
        )}

        {results && (
          <div className="max-h-72 overflow-auto border border-border rounded">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-elevated">
                <tr className="text-left text-txt-secondary">
                  <th className="p-2 font-medium"></th>
                  <th className="p-2 font-medium">Request</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Time</th>
                  <th className="p-2 font-medium">Assertions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const assertions = [...(r.preResult?.assertions ?? []), ...(r.postResult?.assertions ?? [])]
                  const allPassed = assertions.every((a) => a.passed)
                  return (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2">
                        {r.ok ? (
                          <CheckCircle2 size={13} className="text-success" />
                        ) : (
                          <XCircle size={13} className="text-error" />
                        )}
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{r.requestName}</div>
                        <div className="text-2xs text-txt-muted font-mono truncate max-w-[240px]">
                          {r.method} {r.url}
                        </div>
                        {r.errorMessage && <div className="text-2xs text-error mt-0.5">{r.errorMessage}</div>}
                      </td>
                      <td className="p-2 font-mono">{r.status ?? '—'}</td>
                      <td className="p-2 text-txt-secondary">{formatMs(r.timeMs)}</td>
                      <td className="p-2">
                        {assertions.length === 0 ? (
                          <span className="text-txt-muted">—</span>
                        ) : (
                          <span className={allPassed ? 'text-success' : 'text-error'}>
                            {assertions.filter((a) => a.passed).length}/{assertions.length}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
