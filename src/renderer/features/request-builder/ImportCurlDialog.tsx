import { useState } from 'react'
import { Modal, Button, Textarea, Label } from '@/components/ui'
import { useTabsStore } from '@/stores/tabs'
import { emptyConfig } from '@shared/curl'

export function ImportCurlDialog({ open, onClose, tabId }: { open: boolean; onClose: () => void; tabId: string }) {
  const [curl, setCurl] = useState('')
  const [error, setError] = useState('')
  const update = useTabsStore((s) => s.updateConfig)

  const doImport = async () => {
    setError('')
    const res = await window.api.importCurl({ curl })
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    if (res.data.error) {
      setError(res.data.error)
    }
    const config = res.data.config ?? emptyConfig()
    update(tabId, config)
    onClose()
    setCurl('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Import from cURL" wide>
      <div className="space-y-3">
        <div>
          <Label>Paste cURL command</Label>
          <Textarea
            className="h-40"
            placeholder={'curl -X POST https://api.example.com/users \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"test"}\''}
            value={curl}
            onChange={(e) => setCurl(e.target.value)}
            spellCheck={false}
          />
        </div>
        {error && <div className="text-xs text-error">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void doImport()} disabled={!curl.trim()}>
            Import
          </Button>
        </div>
      </div>
    </Modal>
  )
}
