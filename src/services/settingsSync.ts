import { watch, type Reactive } from 'vue'
import type { AppSettings } from '@/models/types'
import { getDoc, putDoc, listAllDocs, type WindlogDoc } from './windlog'
import { checkAuth } from './authService'

interface SettingsRecord {
  userId: string
  langPref: AppSettings['langPref']
  ui: number
  updatedAt: string
}

const POLL_INTERVAL_MS = 30_000
const DEBOUNCE_MS = 1000

let pollTimer: ReturnType<typeof setInterval> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let remoteUpdate = false
let stopWatch: (() => void) | null = null
let currentUserId: string | null = null
let currentDocId: string | null = null
let lastRemoteUpdatedAt: string | null = null

async function findDocForUser(userId: string): Promise<WindlogDoc<SettingsRecord> | null> {
  const docs = await listAllDocs<SettingsRecord>('settings')
  return docs.find(d => d.data.userId === userId) ?? null
}

function applyRemote(settings: Reactive<AppSettings>, data: SettingsRecord) {
  remoteUpdate = true
  settings.langPref = data.langPref
  settings.ui = data.ui
  remoteUpdate = false
  lastRemoteUpdatedAt = data.updatedAt
}

async function upsert(settings: AppSettings) {
  if (!currentUserId) return
  const now = new Date().toISOString()
  const payload: SettingsRecord = {
    userId: currentUserId,
    langPref: settings.langPref,
    ui: settings.ui,
    updatedAt: now
  }
  if (currentDocId) {
    const res = await putDoc<SettingsRecord>('settings', currentDocId, payload)
    if (res.ok) lastRemoteUpdatedAt = payload.updatedAt
  } else {
    // precisa de doc id — recria via list+put? Melhor: tentar listar primeiro
    const found = await findDocForUser(currentUserId)
    if (found) {
      currentDocId = found.id
      const res = await putDoc<SettingsRecord>('settings', found.id, payload)
      if (res.ok) lastRemoteUpdatedAt = payload.updatedAt
    } else {
      // Fallback: cria novo
      const { createDoc } = await import('./windlog')
      const res = await createDoc<SettingsRecord>('settings', payload)
      if (res.ok) {
        currentDocId = res.data.id
        lastRemoteUpdatedAt = payload.updatedAt
      }
    }
  }
}

async function pollRemote(settings: Reactive<AppSettings>) {
  if (!currentDocId) return
  const res = await getDoc<SettingsRecord>('settings', currentDocId)
  if (!res.ok) return
  if (res.data.data.updatedAt !== lastRemoteUpdatedAt) {
    applyRemote(settings, res.data.data)
  }
}

export async function startSettingsSync(settings: Reactive<AppSettings>) {
  const user = await checkAuth()
  if (!user) return
  currentUserId = user.id

  const existing = await findDocForUser(user.id)
  if (existing) {
    currentDocId = existing.id
    applyRemote(settings, existing.data)
  } else {
    await upsert(settings)
  }

  stopWatch = watch(
    () => ({ langPref: settings.langPref, ui: settings.ui }),
    () => {
      if (remoteUpdate) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => upsert(settings), DEBOUNCE_MS)
    },
    { deep: true }
  )

  pollTimer = setInterval(() => pollRemote(settings), POLL_INTERVAL_MS)
}

export function stopSettingsSync() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  if (stopWatch) { stopWatch(); stopWatch = null }
  currentUserId = null
  currentDocId = null
  lastRemoteUpdatedAt = null
}
