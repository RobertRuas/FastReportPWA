import { ref, computed } from 'vue'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'pending' | 'error'

const syncState = ref<SyncState>('idle')
const lastSyncedAt = ref(0)
const syncErrorMsg = ref('')

export function markSyncing() {
  syncState.value = 'syncing'
  syncErrorMsg.value = ''
}

export function markSynced() {
  syncState.value = 'synced'
  lastSyncedAt.value = Date.now()
  syncErrorMsg.value = ''
}

export function markSyncError(msg: string) {
  syncState.value = 'error'
  syncErrorMsg.value = msg
}

export function markPending() {
  if (syncState.value !== 'syncing') {
    syncState.value = 'pending'
  }
}

export function resetSyncState() {
  syncState.value = 'idle'
  lastSyncedAt.value = 0
  syncErrorMsg.value = ''
}

export function useSyncStatus() {
  const syncedTimeAgo = computed(() => {
    if (!lastSyncedAt.value) return ''
    return new Date(lastSyncedAt.value).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit'
    })
  })

  return {
    syncState: computed(() => syncState.value),
    lastSyncedAt: computed(() => lastSyncedAt.value),
    syncErrorMsg: computed(() => syncErrorMsg.value),
    syncedTimeAgo
  }
}
