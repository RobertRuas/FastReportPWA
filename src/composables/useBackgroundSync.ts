import { ref, computed } from 'vue'
import type { Project } from '@/models/types'
import { syncProjects } from '@/services/projectSync'
import type { SyncProgress } from '@/services/photoSync'

const running = ref(false)
const progress = ref(0)
const total = ref(0)
const phase = ref<'uploading' | 'downloading' | ''>('')

export function useBackgroundSync() {
  const percent = computed(() => total.value > 0 ? Math.round((progress.value / total.value) * 100) : 0)

  async function startSync(
    projects: Project[],
    onChanged: (p: Project[]) => void
  ): Promise<{ ok: boolean; error?: string }> {
    if (running.value) return { ok: false, error: 'Already syncing' }

    running.value = true
    progress.value = 0
    total.value = 0
    phase.value = ''

    const onProgress = (p: SyncProgress) => {
      progress.value = p.current
      total.value = p.total
      phase.value = p.phase
    }

    const result = await syncProjects(projects, onChanged, onProgress)

    running.value = false
    phase.value = ''
    return result
  }

  return { running, progress, total, phase, percent, startSync }
}
