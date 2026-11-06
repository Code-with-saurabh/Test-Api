import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Check } from 'lucide-react'
import type { Environment, VariableRow } from '@shared/types'
import { useDataStore } from '@/stores/data'
import { Button, Input, EmptyState, Checkbox, Label } from '@/components/ui'

export function EnvironmentsView() {
  const { environments, activeEnvironmentId, refreshEnvironments, setActiveEnvironment } = useDataStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [variables, setVariables] = useState<VariableRow[]>([])
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [reveal, setReveal] = useState<Set<string>>(new Set())

  useEffect(() => {
    void refreshEnvironments()
  }, [refreshEnvironments])

  const loadVars = useCallback(async () => {
    if (!selectedId) return
    const res = await window.api.variablesList({ ownerType: 'environment', ownerId: selectedId })
    if (res.ok) setVariables(res.data)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      setVariables([])
      return
    }
    void loadVars()
  }, [selectedId, loadVars])

  const createEnv = async () => {
    if (!newName.trim()) return
    const res = await window.api.environmentsCreate({ name: newName.trim() })
    if (res.ok) {
      setNewName('')
      await refreshEnvironments()
      setSelectedId(res.data.id)
    }
  }

  const deleteEnv = async (id: string) => {
    if (!confirm('Delete this environment and its variables?')) return
    await window.api.environmentsDelete(id)
    if (selectedId === id) setSelectedId(null)
    await refreshEnvironments()
  }

  const addVar = async () => {
    if (!selectedId || !newKey.trim()) return
    await window.api.variablesUpsert({
      ownerType: 'environment',
      ownerId: selectedId,
      key: newKey.trim(),
      value: newValue,
      enabled: true,
      isSecret: false
    })
    setNewKey('')
    setNewValue('')
    await loadVars()
  }

  const updateVar = async (v: VariableRow, patch: Partial<VariableRow>) => {
    await window.api.variablesUpsert({
      ownerType: 'environment',
      ownerId: v.ownerId,
      key: v.key,
      value: patch.value ?? v.value,
      enabled: patch.enabled ?? v.enabled,
      isSecret: patch.isSecret ?? v.isSecret
    })
    await loadVars()
  }

  const deleteVar = async (id: string) => {
    await window.api.variablesDelete(id)
    await loadVars()
  }

  return (
    <div className="flex h-full min-h-0">
      {/* env list */}
      <div className="w-52 border-r border-border flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Environments</span>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {environments.map((e) => (
            <EnvRow
              key={e.id}
              env={e}
              active={activeEnvironmentId === e.id}
              selected={selectedId === e.id}
              onSelect={() => setSelectedId(e.id)}
              onActivate={() => void setActiveEnvironment(activeEnvironmentId === e.id ? null : e.id)}
              onDelete={() => void deleteEnv(e.id)}
            />
          ))}
          {environments.length === 0 && (
            <div className="p-3 text-xs text-txt-muted">No environments yet.</div>
          )}
        </div>
        <div className="p-2 border-t border-border flex gap-1">
          <Input className="!py-1 text-xs" placeholder="New environment" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void createEnv()} />
          <Button size="sm" variant="primary" onClick={() => void createEnv()}>
            <Plus size={13} />
          </Button>
        </div>
      </div>

      {/* variables */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selectedId ? (
          <EmptyState title="Select an environment" description="Create environments like Development, Testing, Production and manage their variables." />
        ) : (
          <>
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <span className="text-sm font-medium">{environments.find((e) => e.id === selectedId)?.name}</span>
              {activeEnvironmentId === selectedId && <span className="text-2xs text-success border border-success/40 rounded px-1">ACTIVE</span>}
              <div className="flex-1" />
              <span className="text-2xs text-txt-muted">Variables use {'{{key}}'} syntax in requests</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr className="text-left text-txt-secondary border-b border-border">
                    <th className="w-8 p-2"></th>
                    <th className="p-2 font-medium">Key</th>
                    <th className="p-2 font-medium">Value</th>
                    <th className="w-16 p-2 font-medium">Secret</th>
                    <th className="w-10 p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr key={v.id} className="border-b border-border/40 group">
                      <td className="p-2">
                        <Checkbox checked={v.enabled} onChange={(en) => void updateVar(v, { enabled: en })} />
                      </td>
                      <td className="p-1">
                        <Input
                          className="!py-0.5 text-xs font-mono"
                          defaultValue={v.key}
                          key={v.id + v.key}
                          onBlur={(e) => {
                            if (e.target.value !== v.key && e.target.value.trim()) {
                              void window.api.variablesUpsert({
                                ownerType: 'environment',
                                ownerId: v.ownerId,
                                key: e.target.value.trim(),
                                value: v.value,
                                enabled: v.enabled,
                                isSecret: v.isSecret
                              }).then(loadVars)
                            }
                          }}
                        />
                      </td>
                      <td className="p-1">
                        <div className="flex gap-1">
                          <Input
                            className="!py-0.5 text-xs font-mono"
                            type={v.isSecret && !reveal.has(v.id) ? 'password' : 'text'}
                            value={v.value}
                            onChange={(e) => void updateVar(v, { value: e.target.value })}
                          />
                          {v.isSecret && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setReveal((s) => {
                                  const n = new Set(s)
                                  if (n.has(v.id)) n.delete(v.id)
                                  else n.add(v.id)
                                  return n
                                })
                              }
                            >
                              {reveal.has(v.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <Checkbox checked={v.isSecret} onChange={(s) => void updateVar(v, { isSecret: s })} />
                      </td>
                      <td className="p-2 text-center">
                        <button className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error" onClick={() => void deleteVar(v.id)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-2 border-t border-border flex items-end gap-2">
              <div className="flex-1">
                <Label>Key</Label>
                <Input className="!py-1 text-xs font-mono" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="baseUrl" />
              </div>
              <div className="flex-[2]">
                <Label>Value</Label>
                <Input className="!py-1 text-xs font-mono" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="http://localhost:5000" />
              </div>
              <Button size="sm" variant="primary" className="!py-1.5" onClick={() => void addVar()}>
                <Plus size={13} /> Add
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EnvRow({
  env,
  active,
  selected,
  onSelect,
  onActivate,
  onDelete
}: {
  env: Environment
  active: boolean
  selected: boolean
  onSelect: () => void
  onActivate: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer text-xs group ${selected ? 'bg-hover' : 'hover:bg-hover'}`}
      onClick={onSelect}
    >
      <button
        className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${active ? 'bg-success border-success' : 'border-border-strong'}`}
        title={active ? 'Active environment' : 'Activate'}
        onClick={(e) => {
          e.stopPropagation()
          onActivate()
        }}
      >
        {active && <Check size={9} className="text-white" />}
      </button>
      <span className="truncate font-medium">{env.name}</span>
      <button
        className="ml-auto opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
