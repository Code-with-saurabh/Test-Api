import { useCallback, useEffect, useState } from 'react'
import { FolderPlus, FilePlus, Play, Trash2, Copy, Folder as FolderIcon, FileCode2, ChevronRight, ChevronDown, Search, FolderInput } from 'lucide-react'
import type { Collection, CollectionTree, Folder, SavedRequest } from '@shared/types'
import { useDataStore } from '@/stores/data'
import { useTabsStore } from '@/stores/tabs'
import { Button, Input, EmptyState, Modal, Label, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { emptyConfig } from '@shared/curl'
import { methodColor } from '@shared/utils'

export function CollectionsView() {
  const { collections, refreshCollections } = useDataStore()
  const [search, setSearch] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [trees, setTrees] = useState<Record<string, CollectionTree>>({})
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'collection' | 'folder' | 'request'; id: string; collectionId: string } | null>(null)
  const [newCollectionOpen, setNewCollectionOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [moveTarget, setMoveTarget] = useState<SavedRequest | null>(null)

  const newTab = useTabsStore((s) => s.newTab)

  const loadTree = useCallback(async (collectionId: string) => {
    const res = await window.api.collectionsTree(collectionId)
    if (res.ok) setTrees((t) => ({ ...t, [collectionId]: res.data }))
  }, [])

  useEffect(() => {
    void refreshCollections()
  }, [refreshCollections])

  useEffect(() => {
    for (const c of collections) {
      if (openIds.has(c.id)) void loadTree(c.id)
    }
  }, [collections, openIds, loadTree])

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createCollection = async () => {
    if (!newCollectionName.trim()) return
    const res = await window.api.collectionsCreate({ name: newCollectionName.trim() })
    if (res.ok) {
      setNewCollectionOpen(false)
      setNewCollectionName('')
      await refreshCollections()
    }
  }

  const openRequest = (r: SavedRequest, collectionId: string, folderId: string | null) => {
    newTab(r.config, { title: r.name, savedRequestId: r.id, collectionId, folderId })
  }

  const filtered = collections.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">Collections</span>
        <div className="flex gap-0.5">
          <button className="btn-ghost !p-1" title="New collection" onClick={() => setNewCollectionOpen(true)}>
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="px-2 py-1.5 border-b border-border">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-txt-muted" />
          <Input className="!pl-6 !py-1 text-xs" placeholder="Search collections…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-auto py-1" onClick={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()}>
        {filtered.length === 0 && (
          <EmptyState
            title="No collections"
            description="Create a collection to organize and save your API requests."
            action={
              <Button size="sm" variant="primary" onClick={() => setNewCollectionOpen(true)}>
                New Collection
              </Button>
            }
          />
        )}
        {filtered.map((c) => (
          <CollectionNode
            key={c.id}
            collection={c}
            tree={trees[c.id]}
            open={openIds.has(c.id)}
            onToggle={() => toggleOpen(c.id)}
            onContext={(e, type, id) => {
              e.preventDefault()
              e.stopPropagation()
              setContextMenu({ x: e.clientX, y: e.clientY, type, id, collectionId: c.id })
            }}
            onOpenRequest={openRequest}
            onLoadTree={() => void loadTree(c.id)}
            onMoveRequest={setMoveTarget}
          />
        ))}
      </div>

      {/* context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextMenuItems(contextMenu, {
            onNewRequest: async () => {
              const res = await window.api.requestsCreate({
                collectionId: contextMenu.collectionId,
                folderId: contextMenu.type === 'folder' ? contextMenu.id : null,
                name: 'New Request',
                config: emptyConfig()
              })
              if (res.ok) {
                await refreshCollections()
                if (contextMenu.type === 'collection') toggleOpen(contextMenu.collectionId)
              }
              setContextMenu(null)
            },
            onNewFolder: async () => {
              const res = await window.api.foldersCreate({
                collectionId: contextMenu.collectionId,
                parentFolderId: contextMenu.type === 'folder' ? contextMenu.id : null,
                name: 'New Folder'
              })
              if (res.ok) {
                await refreshCollections()
                toggleOpen(contextMenu.collectionId)
              }
              setContextMenu(null)
            },
            onRename: () => {
              const name = prompt('New name:')
              if (!name) return
              void (async () => {
                if (contextMenu.type === 'collection') await window.api.collectionsUpdate({ id: contextMenu.id, name })
                else if (contextMenu.type === 'folder') await window.api.foldersUpdate({ id: contextMenu.id, name })
                else await window.api.requestsUpdate({ id: contextMenu.id, name })
                await refreshCollections()
              })()
              setContextMenu(null)
            },
            onDuplicate: () => {
              void (async () => {
                if (contextMenu.type === 'collection') await window.api.collectionsDuplicate(contextMenu.id)
                await refreshCollections()
              })()
              setContextMenu(null)
            },
            onDelete: () => {
              if (!confirm('Delete this item? This cannot be undone.')) return
              void (async () => {
                if (contextMenu.type === 'collection') await window.api.collectionsDelete(contextMenu.id)
                else if (contextMenu.type === 'folder') await window.api.foldersDelete(contextMenu.id)
                else await window.api.requestsDelete(contextMenu.id)
                await refreshCollections()
              })()
              setContextMenu(null)
            }
          })}
        />
      )}

      <Modal open={newCollectionOpen} onClose={() => setNewCollectionOpen(false)} title="New Collection">
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && void createCollection()} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewCollectionOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void createCollection()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      <MoveRequestDialog request={moveTarget} onClose={() => setMoveTarget(null)} />
    </div>
  )
}

function CollectionNode({
  collection,
  tree,
  open,
  onToggle,
  onContext,
  onOpenRequest,
  onLoadTree,
  onMoveRequest
}: {
  collection: Collection
  tree?: CollectionTree
  open: boolean
  onToggle: () => void
  onContext: (e: React.MouseEvent, type: 'collection' | 'folder' | 'request', id: string) => void
  onOpenRequest: (r: SavedRequest, collectionId: string, folderId: string | null) => void
  onLoadTree: () => void
  onMoveRequest: (r: SavedRequest) => void
}) {
  useEffect(() => {
    if (open && !tree) onLoadTree()
  }, [open, tree, onLoadTree])

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-hover cursor-pointer text-xs group"
        onClick={onToggle}
        onContextMenu={(e) => onContext(e, 'collection', collection.id)}
      >
        {open ? <ChevronDown size={13} className="text-txt-muted shrink-0" /> : <ChevronRight size={13} className="text-txt-muted shrink-0" />}
        <FolderIcon size={13} className="text-warning shrink-0" />
        <span className="truncate font-medium">{collection.name}</span>
        <span className="ml-auto opacity-0 group-hover:opacity-100 text-2xs text-txt-muted">{tree?.requests.length ?? ''}</span>
      </div>
      {open && tree && (
        <div className="ml-3">
          <FolderNodes
            folders={tree.folders.filter((f) => !f.parentFolderId)}
            allFolders={tree.folders}
            requests={tree.requests}
            collectionId={collection.id}
            onContext={onContext}
            onOpenRequest={onOpenRequest}
            onMoveRequest={onMoveRequest}
            depth={0}
          />
          {tree.requests
            .filter((r) => !r.folderId)
            .map((r) => (
              <RequestNode key={r.id} request={r} collectionId={collection.id} onContext={onContext} onOpen={onOpenRequest} onMove={onMoveRequest} />
            ))}
        </div>
      )}
    </div>
  )
}

function FolderNodes({
  folders,
  allFolders,
  requests,
  collectionId,
  onContext,
  onOpenRequest,
  onMoveRequest,
  depth
}: {
  folders: Folder[]
  allFolders: Folder[]
  requests: SavedRequest[]
  collectionId: string
  onContext: (e: React.MouseEvent, type: 'collection' | 'folder' | 'request', id: string) => void
  onOpenRequest: (r: SavedRequest, collectionId: string, folderId: string | null) => void
  onMoveRequest: (r: SavedRequest) => void
  depth: number
}) {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set())
  return (
    <>
      {folders.map((f) => {
        const children = allFolders.filter((x) => x.parentFolderId === f.id)
        const childReq = requests.filter((r) => r.folderId === f.id)
        const isOpen = openSet.has(f.id)
        return (
          <div key={f.id}>
            <div
              className="flex items-center gap-1 px-2 py-1 hover:bg-hover cursor-pointer text-xs group"
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() =>
                setOpenSet((s) => {
                  const n = new Set(s)
                  if (n.has(f.id)) n.delete(f.id)
                  else n.add(f.id)
                  return n
                })
              }
              onContextMenu={(e) => onContext(e, 'folder', f.id)}
            >
              {isOpen ? <ChevronDown size={12} className="text-txt-muted shrink-0" /> : <ChevronRight size={12} className="text-txt-muted shrink-0" />}
              <FolderIcon size={12} className="text-info shrink-0" />
              <span className="truncate">{f.name}</span>
            </div>
            {isOpen && (
              <div>
                <FolderNodes
                  folders={children}
                  allFolders={allFolders}
                  requests={requests}
                  collectionId={collectionId}
                  onContext={onContext}
                  onOpenRequest={onOpenRequest}
                  onMoveRequest={onMoveRequest}
                  depth={depth + 1}
                />
                {childReq.map((r) => (
                  <RequestNode key={r.id} request={r} collectionId={collectionId} onContext={onContext} onOpen={onOpenRequest} onMove={onMoveRequest} indent={depth + 1} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function RequestNode({
  request,
  collectionId,
  onContext,
  onOpen,
  onMove,
  indent = 0
}: {
  request: SavedRequest
  collectionId: string
  onContext: (e: React.MouseEvent, type: 'collection' | 'folder' | 'request', id: string) => void
  onOpen: (r: SavedRequest, collectionId: string, folderId: string | null) => void
  onMove: (r: SavedRequest) => void
  indent?: number
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 hover:bg-hover cursor-pointer text-xs group"
      style={{ paddingLeft: 16 + indent * 14 }}
      onClick={() => onOpen(request, collectionId, request.folderId)}
      onContextMenu={(e) => onContext(e, 'request', request.id)}
      title={request.description || request.name}
    >
      <span className="font-mono text-2xs font-bold shrink-0 w-11" style={{ color: methodColor(request.config.method) }}>
        {request.config.method}
      </span>
      <FileCode2 size={11} className="text-txt-muted shrink-0" />
      <span className="truncate">{request.name}</span>
      <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          className="p-0.5 hover:text-primary"
          title="Open in new tab"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(request, collectionId, request.folderId)
          }}
        >
          <Play size={11} />
        </button>
        <button
          className="p-0.5 hover:text-info"
          title="Move"
          onClick={(e) => {
            e.stopPropagation()
            onMove(request)
          }}
        >
          <FolderInput size={11} />
        </button>
      </div>
    </div>
  )
}

interface MenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick: () => void
}

function contextMenuItems(
  ctx: { type: 'collection' | 'folder' | 'request'; id: string },
  handlers: {
    onNewRequest: () => void
    onNewFolder: () => void
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
  }
): MenuItem[] {
  if (ctx.type === 'collection') {
    return [
      { label: 'New Request', icon: <FilePlus size={13} />, onClick: handlers.onNewRequest },
      { label: 'New Folder', icon: <FolderPlus size={13} />, onClick: handlers.onNewFolder },
      { label: 'Rename', onClick: handlers.onRename },
      { label: 'Duplicate', icon: <Copy size={13} />, onClick: handlers.onDuplicate },
      { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: handlers.onDelete }
    ]
  }
  if (ctx.type === 'folder') {
    return [
      { label: 'New Request', icon: <FilePlus size={13} />, onClick: handlers.onNewRequest },
      { label: 'New Subfolder', icon: <FolderPlus size={13} />, onClick: handlers.onNewFolder },
      { label: 'Rename', onClick: handlers.onRename },
      { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: handlers.onDelete }
    ]
  }
  return [
    { label: 'Rename', onClick: handlers.onRename },
    { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: handlers.onDelete }
  ]
}

function ContextMenu({ x, y, items }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  return (
    <div className="fixed z-50" style={{ left: Math.min(x, window.innerWidth - 180), top: Math.min(y, window.innerHeight - 160) }}>
      <div className="panel shadow-xl py-1 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
        {items.map((it, i) => (
          <button
            key={i}
            className={cn(
              'flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-hover',
              it.danger && 'text-error'
            )}
            onClick={it.onClick}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MoveRequestDialog({ request, onClose }: { request: SavedRequest | null; onClose: () => void }) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [cid, setCid] = useState('')
  const [folderId, setFolderId] = useState('')
  const refreshCollections = useDataStore((s) => s.refreshCollections)

  useEffect(() => {
    if (!request) return
    setCid(request.collectionId)
    setFolderId(request.folderId ?? '')
    void window.api.collectionsList().then((r) => {
      if (r.ok) setCollections(r.data)
    })
  }, [request])

  const move = async () => {
    if (!request) return
    await window.api.requestsMove({ id: request.id, collectionId: cid, folderId: folderId || null })
    await refreshCollections()
    onClose()
  }

  return (
    <Modal open={!!request} onClose={onClose} title={`Move "${request?.name ?? ''}"`}>
      <div className="space-y-3">
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
          <Label>Folder</Label>
          <Input placeholder="(root)" value={folderId} onChange={(e) => setFolderId(e.target.value)} />
          <p className="text-2xs text-txt-muted mt-1">Paste folder id, or leave empty for collection root.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void move()}>
            Move
          </Button>
        </div>
      </div>
    </Modal>
  )
}
