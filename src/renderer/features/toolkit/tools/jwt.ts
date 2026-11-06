export interface JwtParts {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
}

export function decodeJwt(token: string): JwtParts | { error: string } {
  const parts = token.split('.')
  if (parts.length < 2) return { error: 'Token must have at least 2 dot-separated parts' }
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]!)) as Record<string, unknown>
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as Record<string, unknown>
    const signature = parts[2] ?? ''
    return { header, payload, signature }
  } catch (e) {
    return { error: 'Invalid JWT: ' + (e instanceof Error ? e.message : String(e)) }
  }
}

export function formatJwt(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

function base64UrlDecode(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  return decodeURIComponent(
    escape(
      atob(b64)
    )
  )
}
