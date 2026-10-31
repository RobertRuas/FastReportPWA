import { ref, computed } from 'vue'
import { useProjects } from './useProjects'
import { usePhotoStore } from './usePhotoStore'
import { getMap } from '@/services/mapCatalog'

const currentProjectId = ref<string | null>(null)

export function useProjectSession() {
  const { getProject, projectStats, photosInSlot } = useProjects()
  const { loadProjectUrls, revokeAllUrls } = usePhotoStore()

  const project = computed(() =>
    currentProjectId.value ? getProject(currentProjectId.value) : undefined
  )

  const map = computed(() =>
    project.value ? getMap(project.value.mapId) : undefined
  )

  const stats = computed(() =>
    project.value
      ? projectStats(project.value)
      : { total: 0, pending: 0, trashed: 0, sorted: 0, bytes: 0 }
  )

  async function openProject(id: string) {
    if (currentProjectId.value === id) return
    revokeAllUrls()
    currentProjectId.value = id
    await loadProjectUrls(id)
  }

  function closeProject() {
    revokeAllUrls()
    currentProjectId.value = null
  }

  return {
    currentProjectId,
    project,
    map,
    stats,
    photosInSlot,
    openProject,
    closeProject
  }
}
