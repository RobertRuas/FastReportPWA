import { createDoc, listAllDocs, patchDoc, type WindlogDoc } from './windlog'
import { ADMIN_EMAIL, checkAccess } from './accessService'

export interface AuthUser {
  id: string
  email: string
  name: string
}

interface UserRecord {
  email: string
  name: string
  salt: string
  passHash: string
  createdAt: string
  lastLoginAt: string | null
}

const SESSION_KEY = 'fr_session_v2'

// --- Password hashing (PBKDF2 / WebCrypto) ---

function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return bytesToBase64(new Uint8Array(bits))
}

// --- Session persistence ---

function readSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as AuthUser : null
  } catch { return null }
}

function writeSession(user: AuthUser | null) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_KEY)
}

// --- Public API ---

export async function checkAuth(): Promise<AuthUser | null> {
  return readSession()
}

async function findUserByEmail(email: string): Promise<WindlogDoc<UserRecord> | null> {
  const key = email.toLowerCase().trim()
  const docs = await listAllDocs<UserRecord>('users')
  return docs.find(d => (d.data.email ?? '').toLowerCase() === key) ?? null
}

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser | null; error: string | null; needsName?: boolean }> {
  const emailKey = email.toLowerCase().trim()
  if (!emailKey) return { user: null, error: 'auth.error.required' }
  if (!password) return { user: null, error: 'auth.error.required' }

  // Autorização: admin ou presente em `access` com status 'active'
  const access = await checkAccess(emailKey)
  if (access === 'denied') return { user: null, error: 'auth.error.notAuthorized' }
  if (access === 'revoked') return { user: null, error: 'auth.error.accessRevoked' }

  const existing = await findUserByEmail(emailKey)

  if (existing) {
    const hash = await hashPassword(password, existing.data.salt)
    if (hash !== existing.data.passHash) {
      return { user: null, error: 'auth.error.invalidPassword' }
    }
    await patchDoc<UserRecord>('users', existing.id, {
      lastLoginAt: new Date().toISOString()
    })
    const user: AuthUser = { id: existing.id, email: existing.data.email, name: existing.data.name }
    writeSession(user)
    return { user, error: null, needsName: !existing.data.name }
  }

  // Primeiro acesso: cria o usuário com esta senha
  const salt = randomSalt()
  const passHash = await hashPassword(password, salt)
  const now = new Date().toISOString()
  const res = await createDoc<UserRecord>('users', {
    email: emailKey,
    name: '',
    salt,
    passHash,
    createdAt: now,
    lastLoginAt: now
  })
  if (!res.ok) return { user: null, error: res.error.message }

  const user: AuthUser = { id: res.data.id, email: emailKey, name: '' }
  writeSession(user)
  return { user, error: null, needsName: true }
}

export async function logout(): Promise<void> {
  writeSession(null)
}

export async function updateProfile(name: string): Promise<{ error: string | null }> {
  const current = readSession()
  if (!current) return { error: 'not-authenticated' }
  const res = await patchDoc<UserRecord>('users', current.id, { name })
  if (!res.ok) return { error: res.error.message }
  writeSession({ ...current, name })
  return { error: null }
}

export { ADMIN_EMAIL }
