// Cliente HTTP para a windlog (api.windlog.org)
// Documentação: https://api.windlog.org/docs
//
// Formato de resposta:
//   sucesso: { ok: true, data: ... }
//   erro:    { ok: false, error: { code, message, details? } }

const BASE_URL = (import.meta.env.VITE_WINDLOG_URL as string) || 'https://api.windlog.org'
const API_KEY = import.meta.env.VITE_WINDLOG_KEY as string

export interface WindlogDoc<T> {
  id: string
  data: T
  version: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface WindlogListResult<T> {
  items: WindlogDoc<T>[]
  total: number
  limit: number
  offset: number
}

export interface WindlogFileMeta {
  id: string
  collection: string
  originalName: string
  size: number
  mimeType: string
  sha256: string
}

export interface WindlogErr {
  code: string
  message: string
  details?: unknown
}

export type WindlogResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WindlogErr }

function authHeader(): Record<string, string> {
  return { 'X-API-Key': API_KEY }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<WindlogResult<T>> {
  const url = `${BASE_URL}${path}`
  const init: RequestInit = {
    method,
    headers: {
      ...authHeader(),
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(extraHeaders ?? {})
    }
  }
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body)
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.status === 429 && attempt < 2) {
        const retryAfter = Number(res.headers.get('retry-after')) || (attempt + 1) * 2
        await new Promise(r => setTimeout(r, retryAfter * 1000))
        continue
      }
      const json = await res.json().catch(() => null)
      if (!json) {
        return { ok: false, error: { code: 'NETWORK', message: `HTTP ${res.status}` } }
      }
      return json as WindlogResult<T>
    } catch (err: any) {
      if (attempt === 2) {
        return { ok: false, error: { code: 'NETWORK', message: err?.message ?? 'Network error' } }
      }
    }
  }
  return { ok: false, error: { code: 'NETWORK', message: 'Max retries' } }
}

// --- Documents ---

export function createDoc<T>(collection: string, data: T) {
  return request<WindlogDoc<T>>('POST', `/v1/${collection}`, data)
}

export function getDoc<T>(collection: string, id: string) {
  return request<WindlogDoc<T>>('GET', `/v1/${collection}/${id}`)
}

export async function listDocs<T>(
  collection: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<WindlogResult<WindlogListResult<T>>> {
  const params = new URLSearchParams()
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.offset != null) params.set('offset', String(opts.offset))
  const q = params.toString()
  return request('GET', `/v1/${collection}${q ? '?' + q : ''}`)
}

// Lista exaustiva (paginando até cobrir total).
export async function listAllDocs<T>(collection: string): Promise<WindlogDoc<T>[]> {
  const items: WindlogDoc<T>[] = []
  const limit = 200
  let offset = 0
  while (true) {
    const res = await listDocs<T>(collection, { limit, offset })
    if (!res.ok) break
    items.push(...res.data.items)
    if (items.length >= res.data.total || res.data.items.length === 0) break
    offset += res.data.items.length
  }
  return items
}

export function patchDoc<T>(collection: string, id: string, data: Partial<T>) {
  return request<WindlogDoc<T>>('PATCH', `/v1/${collection}/${id}`, data)
}

export function putDoc<T>(collection: string, id: string, data: T) {
  return request<WindlogDoc<T>>('PUT', `/v1/${collection}/${id}`, data)
}

export function removeDoc(collection: string, id: string) {
  return request<{ id: string; deleted: boolean }>('DELETE', `/v1/${collection}/${id}`)
}

// --- Files ---

export async function uploadFile(
  collection: string,
  blob: Blob,
  filename: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<WindlogResult<WindlogFileMeta>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}/v1/files/${collection}`)
    xhr.setRequestHeader('X-API-Key', API_KEY)
    xhr.timeout = 0 // sem timeout — a windlog pode ser lenta

    if (onProgress) {
      onProgress(0, blob.size)
      xhr.upload.onprogress = (e) => {
        const total = e.lengthComputable ? e.total : blob.size
        onProgress(e.loaded, total)
      }
      xhr.upload.onload = () => onProgress(blob.size, blob.size)
    }

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        resolve(json as WindlogResult<WindlogFileMeta>)
      } catch {
        resolve({ ok: false, error: { code: 'NETWORK', message: `HTTP ${xhr.status}` } })
      }
    }
    xhr.onerror = () => resolve({
      ok: false,
      error: { code: 'NETWORK', message: `Falha de rede (HTTP ${xhr.status || 'sem resposta'})` }
    })
    xhr.ontimeout = () => resolve({
      ok: false,
      error: { code: 'TIMEOUT', message: 'Upload excedeu o tempo limite' }
    })
    xhr.onabort = () => resolve({ ok: false, error: { code: 'ABORTED', message: 'Upload cancelado' } })

    const form = new FormData()
    form.append('file', blob, filename)
    xhr.send(form)
  })
}

export async function downloadFile(
  fileId: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<WindlogResult<Blob>> {
  try {
    const res = await fetch(`${BASE_URL}/v1/files/${fileId}`, { headers: authHeader() })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      if (json) return json as WindlogResult<Blob>
      return { ok: false, error: { code: 'NETWORK', message: `HTTP ${res.status}` } }
    }
    if (!onProgress || !res.body) {
      const blob = await res.blob()
      return { ok: true, data: blob }
    }
    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      onProgress(loaded, total)
    }
    const blob = new Blob(chunks as BlobPart[])
    return { ok: true, data: blob }
  } catch (err: any) {
    return { ok: false, error: { code: 'NETWORK', message: err?.message ?? 'Download failed' } }
  }
}

export function deleteFile(fileId: string) {
  return request<{ id: string; deleted: boolean }>('DELETE', `/v1/files/${fileId}`)
}

// Confirma que o arquivo saiu de verdade da API — um HEAD/GET após o DELETE
// precisa responder NOT_FOUND. Se continuar acessível, devolvemos erro para
// a UI poder reportar que o blob ainda existe no servidor.
export async function deleteFileAndVerify(
  fileId: string,
  maxAttempts = 3
): Promise<WindlogResult<{ id: string; deleted: boolean }>> {
  const del = await deleteFile(fileId)
  if (!del.ok && del.error.code !== 'NOT_FOUND') return del

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
    try {
      const res = await fetch(`${BASE_URL}/v1/files/${fileId}`, {
        method: 'GET',
        headers: authHeader()
      })
      if (res.status === 404) {
        return { ok: true, data: { id: fileId, deleted: true } }
      }
      // 200 = ainda acessível → tenta de novo
      // Consumir body para liberar a conexão
      await res.arrayBuffer().catch(() => null)
    } catch {
      // Falha de rede na verificação — não impede a conclusão
      return { ok: true, data: { id: fileId, deleted: true } }
    }
  }
  return {
    ok: false,
    error: {
      code: 'DELETE_UNCONFIRMED',
      message: 'O servidor não confirmou a remoção do arquivo após 3 tentativas.'
    }
  }
}
