import { useEffect, useState } from 'react'
import { Modal, Button, Input, Select, Label } from '@/components/ui'
import { useTabsStore, type TabState } from '@/stores/tabs'
import { useDataStore } from '@/stores/data'
import type { Collection, Folder } from '@shared/types'

export function SaveRequestDialog({ open, onClose, tab }: { open: boolean; onClose: () => void; tab: TabState }) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [collectionId, setCollectionId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const markSaved = useTabsStore((s) => s.markSaved)
  const refreshCollections = useDataStore((s) => s.refreshCollections)

  useEffect(() => {
    if (!open) return
    setName(tab.savedRequestId ? tab.title : tab.title === 'New Request' ? suggestName(tab) : tab.title)
    setCollectionId(tab.collectionId ?? '')
    setFolderId(tab.folderId ?? '')
    setDescription('')
    setError('')
    void window.api.collectionsList().then((r) => {
      if (r.ok) {
        setCollections(r.data)
        if (!tab.collectionId && r.data[0]) setCollectionId(r.data[0].id)
      }
    })
  }, [open, tab])

  useEffect(() => {
    if (!open || !collectionId) {
      setFolders([])
      return
    }
    void window.api.collectionsTree(collectionId).then((r) => {
      if (r.ok) setFolders(r.data.folders)
    })
  }, [open, collectionId])

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!collectionId) {
      setError('Create a collection first (Collections → +)')
      return
    }
    setSaving(true)
    try {
      if (tab.savedRequestId) {
        const res = await window.api.requestsUpdate({
          id: tab.savedRequestId,
          name: name.trim(),
          description,
          config: tab.config,
          folderId: folderId || null
        })
        if (!res.ok) throw new Error(res.error.message)
        markSaved(tab.id, tab.savedRequestId, collectionId, folderId || null, name.trim())
      } else {
        const res = await window.api.requestsCreate({
          collectionId,
          folderId: folderId || null,
          name: name.trim(),
          description,
          config: tab.config
        })
        if (!res.ok) throw new Error(res.error.message)
        markSaved(tab.id, res.data.id, collectionId, folderId || null, name.trim())
      }
      await refreshCollections()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={tab.savedRequestId ? 'Update Request' : 'Save Request'}>
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Get Users" autoFocus />
        </div>
        <div>
          <Label>Collection</Label>
          <Select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className="w-full">
            <option value="">— select —</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Folder (optional)</Label>
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="w-full">
            <option value="">— root —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <div className="text-xs text-error">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : tab.savedRequestId ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function suggestName(tab: TabState): string {
  try {
    const u = new URL(tab.config.url)
    return `${tab.config.method} ${u.pathname}`.slice(0, 60)
  } catch {
    return tab.config.url ? `${tab.config.method} ${tab.config.url}`.slice(0, 60) : 'New Request'
  }
}
