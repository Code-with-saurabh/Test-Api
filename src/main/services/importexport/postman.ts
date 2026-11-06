/* Postman Collection v2.1 import/export (subset covering requests, folders, variables, auth basics) */
import type { HttpRequestConfig, KeyValue } from '@shared/types'
import { emptyConfig } from '@shared/curl'
import * as repos from '../db/repos'

interface PostmanItem {
  name?: string
  description?: string
  item?: PostmanItem[]
  request?: {
    method?: string
    url?: string | { raw?: string; protocol?: string; host?: string[]; path?: string[]; query?: Array<{ key: string; value: string; disabled?: boolean }> }
    header?: Array<{ key: string; value: string; disabled?: boolean }>
    body?: { mode?: string; raw?: string; urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>; formdata?: Array<{ key: string; value?: string; type?: string; src?: string; disabled?: boolean }> }
    auth?: { type?: string; apikey?: Array<{ key: string; value?: unknown; type?: string }>; bearer?: Array<{ key: string; value?: unknown }>; basic?: Array<{ key: string; value?: unknown }> }
  }
  variable?: Array<{ key: string; value?: string }>
}

interface PostmanCollection {
  info?: { name?: string; description?: string; schema?: string }
  item?: PostmanItem[]
  variable?: Array<{ key: string; value?: string }>
}

function newKv(key: string, value: string, enabled = true): KeyValue {
  return { id: crypto.randomUUID(), key, value, enabled }
}

type PostmanUrl = string | { raw?: string; protocol?: string; host?: string[]; path?: string[]; query?: Array<{ key: string; value: string; disabled?: boolean }> }

function urlToString(url: PostmanUrl | undefined): string {
  if (!url) return ''
  if (typeof url === 'string') return url
  if (url.raw) return url.raw
  const proto = url.protocol ? url.protocol + '://' : 'http://'
  const host = Array.isArray(url.host) ? url.host.join('.') : ''
  const path = Array.isArray(url.path) ? '/' + url.path.join('/') : ''
  return `${proto}${host}${path}`
}

export function importPostmanCollection(json: string): { collections: number; requests: number } {
  const parsed = JSON.parse(json) as PostmanCollection
  const collection = repos.createCollection(parsed.info?.name ?? 'Imported Collection', parsed.info?.description ?? '')
  let requestCount = 0

  // collection-level variables
  for (const v of parsed.variable ?? []) {
    if (v.key) repos.upsertVariable('collection', collection.id, v.key, v.value ?? '', true, false)
  }

  const walk = (items: PostmanItem[], folderId: string | null) => {
    for (const item of items) {
      if (item.item) {
        const folder = repos.createFolder(collection.id, folderId, item.name ?? 'Folder', item.description ?? '')
        walk(item.item, folder.id)
      } else if (item.request) {
        const config = postmanRequestToConfig(item.request)
        repos.createRequest(collection.id, folderId, item.name ?? 'Request', item.description ?? '', config)
        requestCount++
      }
    }
  }
  walk(parsed.item ?? [], null)
  return { collections: 1, requests: requestCount }
}

function postmanRequestToConfig(req: NonNullable<PostmanItem['request']>): HttpRequestConfig {
  const config = emptyConfig()
  config.method = (req.method ?? 'GET').toUpperCase()
  config.url = urlToString(req.url as PostmanUrl | undefined)

  for (const h of req.header ?? []) {
    config.headers.push(newKv(h.key, h.value ?? '', !h.disabled))
  }

  // url query from structured url
  if (req.url && typeof req.url === 'object' && !Array.isArray(req.url) && Array.isArray((req.url as { query?: unknown[] }).query)) {
    for (const q of (req.url as { query: Array<{ key: string; value?: string; disabled?: boolean }> }).query) {
      config.params.push(newKv(q.key, q.value ?? '', !q.disabled))
    }
  }

  const body = req.body
  if (body?.mode === 'raw') {
    config.bodyType = /json/i.test(String((req.header ?? []).find((h) => h.key.toLowerCase() === 'content-type')?.value)) || looksJson(body.raw ?? '')
      ? 'json'
      : 'raw'
    config.body.content = body.raw ?? ''
  } else if (body?.mode === 'urlencoded') {
    config.bodyType = 'urlencoded'
    config.body.form = (body.urlencoded ?? []).map((u) => newKv(u.key, u.value ?? '', !u.disabled))
  } else if (body?.mode === 'formdata') {
    config.bodyType = 'form-data'
    config.body.form = (body.formdata ?? []).map((f) => ({
      ...newKv(f.key, f.value ?? '', !f.disabled),
      type: f.type === 'file' ? ('file' as const) : ('text' as const),
      filePath: f.src
    }))
  }

  // auth (basic subset)
  const auth = req.auth
  if (auth?.type === 'bearer') {
    const token = auth.bearer?.find((b) => b.key === 'token')?.value
    config.auth = { type: 'bearer', bearer: { token: String(token ?? '') } }
  } else if (auth?.type === 'basic') {
    const u = String(auth.basic?.find((b) => b.key === 'username')?.value ?? '')
    const p = String(auth.basic?.find((b) => b.key === 'password')?.value ?? '')
    config.auth = { type: 'basic', basic: { username: u, password: p } }
  } else if (auth?.type === 'apikey') {
    const key = String(auth.apikey?.find((b) => b.key === 'key')?.value ?? '')
    const value = String(auth.apikey?.find((b) => b.key === 'value')?.value ?? '')
    const in_ = String(auth.apikey?.find((b) => b.key === 'in')?.value ?? 'header')
    config.auth = { type: 'apikey', apiKey: { key, value, in: in_ === 'query' ? 'query' : 'header' } }
  }

  return config
}

function looksJson(s: string): boolean {
  const t = s.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

export function exportPostmanCollection(collectionId: string): string {
  const tree = repos.getCollectionTree(collectionId)
  const varRows = repos.listVariables('collection', collectionId)

  // build item nodes with id mapping
  const nodes = new Map<string, PostmanItem>()
  for (const f of tree.folders) {
    const node: PostmanItem = { name: f.name, description: f.description, item: [] }
    nodes.set(f.id, node)
  }
  const roots: PostmanItem[] = []
  for (const f of tree.folders) {
    const node = nodes.get(f.id)!
    if (f.parentFolderId && nodes.has(f.parentFolderId)) {
      nodes.get(f.parentFolderId)!.item!.push(node)
    } else {
      roots.push(node)
    }
  }
  for (const r of tree.requests) {
    const node: PostmanItem = { name: r.name, description: r.description, request: toPostmanRequest(r.config) }
    if (r.folderId && nodes.has(r.folderId)) {
      nodes.get(r.folderId)!.item!.push(node)
    } else {
      roots.push(node)
    }
  }

  const out: PostmanCollection = {
    info: {
      name: tree.collection.name,
      description: tree.collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: roots,
    variable: varRows.filter((v) => v.enabled).map((v) => ({ key: v.key, value: v.isSecret ? '' : v.value }))
  }
  return JSON.stringify(out, null, 2)
}

function toPostmanRequest(config: HttpRequestConfig): NonNullable<PostmanItem['request']> {
  const headers = config.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => ({ key: h.key, value: h.value }))
  const query = config.params
    .filter((p) => p.enabled && p.key)
    .map((p) => ({ key: p.key, value: p.value }))

  const req: NonNullable<PostmanItem['request']> = {
    method: config.method,
    url: { raw: config.url, query },
    header: headers
  }

  if (config.bodyType === 'json' || config.bodyType === 'raw' || config.bodyType === 'text' || config.bodyType === 'xml' || config.bodyType === 'html') {
    const ct =
      config.bodyType === 'json'
        ? 'application/json'
        : config.bodyType === 'xml'
          ? 'application/xml'
          : config.bodyType === 'html'
            ? 'text/html'
            : 'text/plain'
    req.body = { mode: 'raw', raw: config.body.content ?? '' }
    req.header = [...headers, { key: 'Content-Type', value: ct }]
  } else if (config.bodyType === 'urlencoded') {
    req.body = {
      mode: 'urlencoded',
      urlencoded: (config.body.form ?? []).filter((f) => f.enabled).map((f) => ({ key: f.key, value: f.value }))
    }
  } else if (config.bodyType === 'form-data') {
    req.body = {
      mode: 'formdata',
      formdata: (config.body.form ?? [])
        .filter((f) => f.enabled)
        .map((f) => ({ key: f.key, value: f.value, type: f.type === 'file' ? 'file' : 'text', src: f.filePath }))
    }
  }

  if (config.auth.type === 'bearer' && config.auth.bearer) {
    req.auth = { type: 'bearer', bearer: [{ key: 'token', value: config.auth.bearer.token }] }
  } else if (config.auth.type === 'basic' && config.auth.basic) {
    req.auth = {
      type: 'basic',
      basic: [
        { key: 'username', value: config.auth.basic.username },
        { key: 'password', value: config.auth.basic.password }
      ]
    }
  } else if (config.auth.type === 'apikey' && config.auth.apiKey) {
    req.auth = {
      type: 'apikey',
      apikey: [
        { key: 'key', value: config.auth.apiKey.key },
        { key: 'value', value: config.auth.apiKey.value },
        { key: 'in', value: config.auth.apiKey.in }
      ]
    }
  }

  return req
}
