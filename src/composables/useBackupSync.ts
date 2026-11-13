import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { syncProject as doSync, deleteBackup as doDelete, type SyncProgress } from '@/services/backupSync'
import { useProjects } from './useProjects'
import { useI18n } from './useI18n'
import type { Project } from '@/models/types'

// Module-scope state — shared across all pages that call useBackupSync.
const syncingId = ref<string>('')
const syncPhase = ref<'export' | 'upload' | ''>('')
const syncProgress = ref(0)
const syncTotal = ref(0)

const syncPct = computed(() => {
  if (syncTotal.value === 0) return 0
  return Math.min(100, Math.round((syncProgress.value / syncTotal.value) * 100))
})

export function formatMB(bytes: number): string {
  if (!bytes) return '0 MB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export function useBackupSync() {
  const toast = useToast()
  const { t } = useI18n()
  const { markSynced } = useProjects()

  async function sync(project: Project, email: string): Promise<boolean> {
    if (syncingId.value) return false
    syncingId.value = project.id
    syncPhase.value = 'export'
    syncProgress.value = 0
    syncTotal.value = 0

    const result = await doSync(project, email, (p: SyncProgress) => {
      syncPhase.value = p.phase
      syncProgress.value = p.current
      syncTotal.value = p.total
    })

    syncingId.value = ''
    syncPhase.value = ''
    syncProgress.value = 0
    syncTotal.value = 0

    if (result.ok) {
      markSynced(project)
      toast.add({ severity: 'success', summary: t('sync.syncSuccess'), life: 2000 })
      return true
    }
    toast.add({ severity: 'error', summary: t('sync.syncError'), detail: result.error, life: 4000 })
    return false
  }

  async function removeRemote(project: Project, email: string): Promise<boolean> {
    const result = await doDelete(project.id, email, project.slug)
    if (!result.ok) {
      toast.add({
        severity: 'warn',
        summary: 'Falha ao remover backup da nuvem',
        detail: result.error,
        life: 4000
      })
      return false
    }
    return true
  }

  return {
    syncingId,
    syncPhase,
    syncProgress,
    syncTotal,
    syncPct,
    sync,
    removeRemote
  }
}
