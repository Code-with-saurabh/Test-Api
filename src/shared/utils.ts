export function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes
  let u = -1
  do {
    v /= 1024
    u++
  } while (v >= 1024 && u < units.length - 1)
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function tryFormatJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return null
  }
}

export function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--success)'
  if (status >= 300 && status < 400) return 'var(--info)'
  if (status >= 400 && status < 500) return 'var(--warning)'
  if (status >= 500) return 'var(--error)'
  return 'var(--text-secondary)'
}

export function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#36B37E'
    case 'POST':
      return '#E6AD50'
    case 'PUT':
      return '#6C8CFF'
    case 'PATCH':
      return '#9B7BFF'
    case 'DELETE':
      return '#E45B63'
    default:
      return '#9AA1B2'
  }
}
