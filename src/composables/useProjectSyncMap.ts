import { reactive } from 'vue'

const STORAGE_KEY = 'fr_project_sync_map'

const syncMap = reactive<Record<string, string>>({})

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>
      Object.assign(syncMap, parsed)
    }
  } catch { /* ignore */ }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(syncMap))
}

loadFromStorage()

export function markProjectSynced(projectId: string, updatedAt: string) {
  syncMap[projectId] = updatedAt
  persist()
}

export function markProjectsSynced(entries: Array<{ id: string; updatedAt: string }>) {
  for (const e of entries) {
    syncMap[e.id] = e.updatedAt
  }
  persist()
}

export function removeProjectFromSyncMap(projectId: string) {
  delete syncMap[projectId]
  persist()
}

export function isProjectSynced(projectId: string, updatedAt: string): boolean {
  return syncMap[projectId] === updatedAt
}

export function useProjectSyncMap() {
  return { syncMap }
}
