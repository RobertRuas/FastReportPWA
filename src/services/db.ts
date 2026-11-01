import type { Project, PhotoBlob, AppSettings } from '@/models/types'
import { markSaving, markSaved, markError } from '@/composables/useSaveStatus'

const DB_NAME = 'fastreport'
const DB_VERSION = 1

let dbInstance: IDBDatabase | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

function open(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('blobs')) {
        const store = db.createObjectStore('blobs', { keyPath: 'id' })
        store.createIndex('projectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
    }

    req.onsuccess = () => {
      dbInstance = req.result
      resolve(dbInstance)
    }

    req.onerror = () => reject(req.error)
  })
}

function tx(
  storeNames: string | string[],
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBTransaction> {
  return open().then(db => db.transaction(storeNames, mode))
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function writeTx(
  storeNames: string | string[],
  work: (t: IDBTransaction) => void
): Promise<void> {
  markSaving()
  return open().then(db => {
    return new Promise<void>((resolve, reject) => {
      const t = db.transaction(storeNames, 'readwrite')
      t.oncomplete = () => { markSaved(); resolve() }
      t.onerror = () => { markError(t.error); reject(t.error) }
      t.onabort = () => { const e = t.error ?? new Error('Transação cancelada'); markError(e); reject(e) }
      work(t)
    })
  }).catch(e => {
    markError(e)
    throw e
  })
}

// --- Projects ---

export async function getAllProjects(): Promise<Project[]> {
  const t = await tx('projects')
  return req(t.objectStore('projects').getAll())
}

export async function getProject(id: string): Promise<Project | undefined> {
  const t = await tx('projects')
  return req(t.objectStore('projects').get(id))
}

export function saveProject(project: Project): Promise<void> {
  const data = JSON.parse(JSON.stringify(project))
  return writeTx('projects', (t) => {
    t.objectStore('projects').put(data)
  })
}

export function saveProjectDebounced(project: Project): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveProject(project).catch(e => {
      console.error('[FastReport] Debounced save failed:', e)
    })
  }, 250)
}

export async function saveProjectNow(project: Project): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await saveProject(project)
}

export function deleteProject(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    markSaving()
    open().then(db => {
      const t = db.transaction(['projects', 'blobs'], 'readwrite')
      t.oncomplete = () => { markSaved(); resolve() }
      t.onerror = () => { markError(t.error); reject(t.error) }
      t.onabort = () => { const e = t.error ?? new Error('Transação cancelada'); markError(e); reject(e) }

      t.objectStore('projects').delete(id)
      const blobStore = t.objectStore('blobs')
      const index = blobStore.index('projectId')
      const getKeys = index.getAllKeys(id)
      getKeys.onsuccess = () => {
        for (const key of getKeys.result) {
          blobStore.delete(key)
        }
      }
    }).catch(e => { markError(e); reject(e) })
  })
}

// --- Blobs ---

export async function getBlob(id: string): Promise<PhotoBlob | undefined> {
  const t = await tx('blobs')
  return req(t.objectStore('blobs').get(id))
}

export async function getAllBlobsForProject(projectId: string): Promise<PhotoBlob[]> {
  const t = await tx('blobs')
  const index = t.objectStore('blobs').index('projectId')
  return req(index.getAll(projectId))
}

export function saveBlob(blob: PhotoBlob): Promise<void> {
  return writeTx('blobs', (t) => {
    t.objectStore('blobs').put(blob)
  })
}

export function deleteBlob(id: string): Promise<void> {
  return writeTx('blobs', (t) => {
    t.objectStore('blobs').delete(id)
  })
}

export function deleteBlobsForProject(projectId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    markSaving()
    open().then(db => {
      const t = db.transaction('blobs', 'readwrite')
      t.oncomplete = () => { markSaved(); resolve() }
      t.onerror = () => { markError(t.error); reject(t.error) }
      t.onabort = () => { const e = t.error ?? new Error('Transação cancelada'); markError(e); reject(e) }

      const index = t.objectStore('blobs').index('projectId')
      const getKeys = index.getAllKeys(projectId)
      getKeys.onsuccess = () => {
        const store = t.objectStore('blobs')
        for (const key of getKeys.result) {
          store.delete(key)
        }
      }
    }).catch(e => { markError(e); reject(e) })
  })
}

// --- Settings ---

const SETTINGS_DEFAULTS: AppSettings = {
  cols: 'auto',
  langPref: 'auto',
  ui: 1,
  userName: '',
  userEmail: '',
  autoSync: false
}

export async function getSettings(): Promise<AppSettings> {
  const t = await tx('settings')
  const store = t.objectStore('settings')
  const result: Partial<AppSettings> = {}

  for (const key of Object.keys(SETTINGS_DEFAULTS) as (keyof AppSettings)[]) {
    const val = await req(store.get(key))
    if (val !== undefined) {
      (result as Record<string, unknown>)[key] = val
    }
  }

  return { ...SETTINGS_DEFAULTS, ...result }
}

export function saveSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  return writeTx('settings', (t) => {
    t.objectStore('settings').put(value, key)
  })
}

export function saveAllSettings(settings: AppSettings): Promise<void> {
  return writeTx('settings', (t) => {
    const store = t.objectStore('settings')
    for (const key of Object.keys(settings) as (keyof AppSettings)[]) {
      store.put(settings[key], key)
    }
  })
}

// --- Boot ---

export interface BootData {
  projects: Project[]
  settings: AppSettings
}

export async function boot(): Promise<BootData> {
  const [projects, settings] = await Promise.all([
    getAllProjects(),
    getSettings()
  ])
  return { projects, settings }
}

// --- Clear Local Cache (photos only) ---

export async function clearLocalCache(): Promise<void> {
  const database = await open()
  return new Promise((resolve, reject) => {
    const t = database.transaction('blobs', 'readwrite')
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.objectStore('blobs').clear()
  })
}

// --- Clear All Data ---

export async function clearAllData(): Promise<void> {
  const database = await open()
  const storeNames = Array.from(database.objectStoreNames)
  return new Promise((resolve, reject) => {
    const t = database.transaction(storeNames, 'readwrite')
    t.oncomplete = () => {
      dbInstance = null
      resolve()
    }
    t.onerror = () => reject(t.error)
    for (const name of storeNames) {
      t.objectStore(name).clear()
    }
  })
}

// --- Storage Persistence ---

export async function requestPersistence(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist()
  }
  return false
}

export async function isStoragePersisted(): Promise<boolean> {
  if (navigator.storage?.persisted) {
    return navigator.storage.persisted()
  }
  return false
}

export async function estimateStorage(): Promise<{ used: number; quota: number } | null> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return { used: est.usage ?? 0, quota: est.quota ?? 0 }
  }
  return null
}
