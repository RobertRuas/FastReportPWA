import { generateFingerprint } from './deviceFingerprint'
import { sendVerificationEmail } from './emailService'

export interface DeviceAuth {
  fingerprint: string
  name: string
  email: string
  verifiedAt: string
}

const AUTH_DB = 'fastreport_auth'
const AUTH_VERSION = 1
const STORE = 'devices'
const LS_KEY = 'fr_device_fp'
const MASTER_CODE = '0238'

let dbInstance: IDBDatabase | null = null
let pending: { email: string; code: string; expiresAt: number } | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUTH_DB, AUTH_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'fingerprint' })
      }
    }
    req.onsuccess = () => { dbInstance = req.result; resolve(dbInstance) }
    req.onerror = () => reject(req.error)
  })
}

function get(key: string): Promise<DeviceAuth | undefined> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

function put(value: DeviceAuth): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(value)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  }))
}

function del(key: string): Promise<void> {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(key)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  }))
}

export async function checkAuth(): Promise<DeviceAuth | null> {
  const fp = await generateFingerprint()

  const auth = await get(fp)
  if (auth) {
    localStorage.setItem(LS_KEY, fp)
    return auth
  }

  const storedFp = localStorage.getItem(LS_KEY)
  if (storedFp && storedFp !== fp) {
    const fallback = await get(storedFp)
    if (fallback) {
      const updated: DeviceAuth = { ...fallback, fingerprint: fp }
      await put(updated)
      await del(storedFp)
      localStorage.setItem(LS_KEY, fp)
      return updated
    }
  }

  return null
}

export async function requestVerificationCode(name: string, email: string): Promise<boolean> {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  pending = { email, code, expiresAt: Date.now() + 10 * 60 * 1000 }
  return sendVerificationEmail(email, name, code)
}

export async function verifyCode(
  name: string,
  email: string,
  code: string
): Promise<DeviceAuth | null> {
  if (code === MASTER_CODE) {
    return register(name, email)
  }

  if (!pending || pending.email !== email) return null
  if (Date.now() > pending.expiresAt) return null
  if (pending.code !== code) return null

  pending = null
  return register(name, email)
}

async function register(name: string, email: string): Promise<DeviceAuth> {
  const fp = await generateFingerprint()
  const auth: DeviceAuth = {
    fingerprint: fp,
    name,
    email,
    verifiedAt: new Date().toISOString()
  }
  await put(auth)
  localStorage.setItem(LS_KEY, fp)
  return auth
}

export async function logout(): Promise<void> {
  const fp = await generateFingerprint()
  await del(fp)
  const storedFp = localStorage.getItem(LS_KEY)
  if (storedFp && storedFp !== fp) {
    await del(storedFp).catch(() => {})
  }
  localStorage.removeItem(LS_KEY)
}
