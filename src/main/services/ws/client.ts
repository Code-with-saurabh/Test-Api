/* WebSocket client manager — main process */
import { WebSocket } from 'ws'
import { EventEmitter } from 'events'
import type { WsMessage } from '@shared/types'

interface Connection {
  id: string
  ws: WebSocket
  messages: WsMessage[]
  connected: boolean
  error?: string
  url: string
}

class WsManager extends EventEmitter {
  private connections = new Map<string, Connection>()

  connect(id: string, url: string, protocols?: string[]): void {
    this.close(id)
    const ws = protocols?.length ? new WebSocket(url, protocols) : new WebSocket(url)
    const conn: Connection = { id, ws, messages: [], connected: false, url }
    this.connections.set(id, conn)

    const push = (direction: WsMessage['direction'], data: string, isBinary = false) => {
      conn.messages.push({ id: crypto.randomUUID(), direction, data, isBinary, timestamp: Date.now() })
      if (conn.messages.length > 1000) conn.messages.shift()
      this.emit('message', id)
    }

    ws.on('open', () => {
      conn.connected = true
      conn.error = undefined
      push('system', `Connected to ${url}`)
      this.emit('status', id)
    })
    ws.on('message', (data, isBinaryFlag) => {
      const text = isBinaryFlag ? `<binary ${Buffer.isBuffer(data) ? data.length : 0} bytes>` : data.toString()
      push('recv', text, !!isBinaryFlag)
    })
    ws.on('close', (code, reason) => {
      conn.connected = false
      push('system', `Closed (${code}) ${reason.toString()}`)
      this.emit('status', id)
    })
    ws.on('error', (err) => {
      conn.connected = false
      conn.error = err.message
      push('system', `Error: ${err.message}`)
      this.emit('status', id)
    })
  }

  send(id: string, data: string): boolean {
    const c = this.connections.get(id)
    if (!c || !c.connected) return false
    c.ws.send(data)
    c.messages.push({ id: crypto.randomUUID(), direction: 'send', data, isBinary: false, timestamp: Date.now() })
    if (c.messages.length > 1000) c.messages.shift()
    this.emit('message', id)
    return true
  }

  close(id: string): void {
    const c = this.connections.get(id)
    if (c) {
      try {
        c.ws.close()
      } catch {
        /* ignore */
      }
      c.connected = false
    }
  }

  closeAll(): void {
    for (const id of this.connections.keys()) this.close(id)
  }

  messages(id: string): { messages: WsMessage[]; connected: boolean; error?: string } {
    const c = this.connections.get(id)
    if (!c) return { messages: [], connected: false, error: 'Connection not found' }
    return { messages: c.messages, connected: c.connected, error: c.error }
  }
}

export const wsManager = new WsManager()
