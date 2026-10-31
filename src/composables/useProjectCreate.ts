import { ref, computed } from 'vue'
import { slugify } from '@/services/slugify'
import { useProjects } from './useProjects'
import { useI18n } from './useI18n'
import { getAllMaps, getClassifiableSlots, hasGroups, getGroups } from '@/services/mapCatalog'
import type { OrganizationMap } from '@/models/types'

export function useProjectCreate() {
  const { projects, createProject } = useProjects()
  const { t } = useI18n()

  const name = ref('')
  const mapId = ref('')

  const maps = getAllMaps()
  if (maps.length > 0) mapId.value = maps[0].id

  const slug = computed(() => slugify(name.value.trim()))

  const nameError = computed(() => {
    const trimmed = name.value.trim()
    if (!trimmed) return ''
    if (slug.value.length === 0) return t('new.error.invalid')
    const dup = projects.value.find(
      p => slugify(p.name).toLowerCase() === slug.value.toLowerCase()
    )
    if (dup) return t('new.error.alreadyExists')
    return ''
  })

  const canCreate = computed(() =>
    name.value.trim().length > 0 &&
    slug.value.length > 0 &&
    !nameError.value &&
    mapId.value.length > 0
  )

  const filenamePreview = computed(() => {
    if (!slug.value) return ''
    return `${slug.value}_T1_001.jpeg`
  })

  function mapSummary(map: OrganizationMap): string {
    const slots = getClassifiableSlots(map).filter(s => !s.isTrash)
    const parts: string[] = [t('new.slots', { count: String(slots.length) })]
    if (hasGroups(map)) {
      const groups = getGroups(map)
      parts.push(t('new.groups', { count: String(groups.length) }))
    }
    return parts.join(' · ')
  }

  async function create(): Promise<string> {
    const project = await createProject(name.value.trim(), mapId.value)
    return project.id
  }

  function reset() {
    name.value = ''
    mapId.value = maps.length > 0 ? maps[0].id : ''
  }

  return {
    name,
    mapId,
    maps,
    slug,
    nameError,
    canCreate,
    filenamePreview,
    mapSummary,
    create,
    reset
  }
}
