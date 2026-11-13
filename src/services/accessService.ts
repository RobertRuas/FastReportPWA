import { createDoc, listAllDocs, patchDoc, removeDoc, type WindlogDoc } from './windlog'

export const ADMIN_EMAIL = '92ruas@gmail.com'

export interface AccessEntry {
  email: string
  status: 'active' | 'revoked'
  lastAccessAt: string | null
  deviceInfo: string | null
  createdAt: string
}

interface AccessRecord {
  email: string
  status: 'active' | 'revoked'
  lastAccessAt: string | null
  deviceInfo: string | null
  createdAt: string
}

export function isAdmin(email: string | undefined): boolean {
  return email === ADMIN_EMAIL
}

async function findByEmail(email: string): Promise<WindlogDoc<AccessRecord> | null> {
  const key = email.toLowerCase().trim()
  const docs = await listAllDocs<AccessRecord>('access')
  return docs.find(d => (d.data.email ?? '').toLowerCase() === key) ?? null
}

export async function checkAccess(email: string): Promise<'allowed' | 'revoked' | 'denied'> {
  if (email === ADMIN_EMAIL) return 'allowed'
  const entry = await findByEmail(email)
  if (!entry) return 'denied'
  return entry.data.status === 'active' ? 'allowed' : 'revoked'
}

export async function updateLastAccess(email: string) {
  const entry = await findByEmail(email)
  if (!entry) return
  await patchDoc<AccessRecord>('access', entry.id, {
    lastAccessAt: new Date().toISOString(),
    deviceInfo: navigator.userAgent
  })
}

export async function listAllowedUsers(): Promise<AccessEntry[]> {
  const docs = await listAllDocs<AccessRecord>('access')
  return docs
    .map(d => ({
      email: d.data.email,
      status: d.data.status,
      lastAccessAt: d.data.lastAccessAt,
      deviceInfo: d.data.deviceInfo,
      createdAt: d.data.createdAt ?? d.createdAt
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function addAllowedUser(email: string): Promise<{ error: string | null }> {
  const key = email.toLowerCase().trim()
  const existing = await findByEmail(key)
  if (existing) return { error: 'duplicate' }
  const res = await createDoc<AccessRecord>('access', {
    email: key,
    status: 'active',
    lastAccessAt: null,
    deviceInfo: null,
    createdAt: new Date().toISOString()
  })
  return { error: res.ok ? null : res.error.message }
}

export async function revokeUser(email: string): Promise<{ error: string | null }> {
  const entry = await findByEmail(email)
  if (!entry) return { error: 'not-found' }
  const res = await patchDoc<AccessRecord>('access', entry.id, { status: 'revoked' })
  return { error: res.ok ? null : res.error.message }
}

export async function reinstateUser(email: string): Promise<{ error: string | null }> {
  const entry = await findByEmail(email)
  if (!entry) return { error: 'not-found' }
  const res = await patchDoc<AccessRecord>('access', entry.id, { status: 'active' })
  return { error: res.ok ? null : res.error.message }
}

export async function deleteAllowedUser(email: string): Promise<{ error: string | null }> {
  const entry = await findByEmail(email)
  if (!entry) return { error: 'not-found' }
  const res = await removeDoc('access', entry.id)
  return { error: res.ok ? null : res.error.message }
}
