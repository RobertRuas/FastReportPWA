import { ref, computed } from 'vue'
import type { Project, Photo } from '@/models/types'
import * as db from '@/services/db'
import { slugify } from '@/services/slugify'
import { getMap } from '@/services/mapCatalog'

const projects = ref<Project[]>([])
const ready = ref(false)

function generateId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `p${ts}${rand}`
}

export function useProjects() {
  async function load() {
    const data = await db.boot()
    projects.value = data.projects
    ready.value = true
  }

  function getProject(id: string): Project | undefined {
    return projects.value.find(p => p.id === id)
  }

  async function createProject(name: string, mapId: string): Promise<Project> {
    const map = getMap(mapId)
    if (!map) throw new Error(`Map not found: ${mapId}`)

    const slug = slugify(name)
    if (slug.length === 0) throw new Error('Invalid project name')

    const duplicate = projects.value.find(
      p => slugify(p.name).toLowerCase() === slug.toLowerCase()
    )
    if (duplicate) throw new Error('Project name already exists')

    const now = new Date().toISOString()
    const project: Project = {
      id: generateId(),
      name,
      slug,
      mapId,
      createdAt: now,
      updatedAt: now,
      exportedAt: null,
      photos: []
    }

    await db.saveProjectNow(project)
    projects.value.push(project)
    db.requestPersistence()

    return project
  }

  async function removeProject(id: string): Promise<void> {
    await db.deleteProject(id)
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx >= 0) projects.value.splice(idx, 1)
  }

  function touchProject(project: Project) {
    project.updatedAt = new Date().toISOString()
    project.exportedAt = null
    db.saveProjectDebounced(project)
  }

  async function saveProjectNow(project: Project) {
    project.updatedAt = new Date().toISOString()
    project.exportedAt = null
    await db.saveProjectNow(project)
  }

  function markExported(project: Project) {
    const now = new Date().toISOString()
    project.updatedAt = now
    project.exportedAt = now
    db.saveProjectNow(project)
  }

  function photosInSlot(project: Project, slotId: string): Photo[] {
    return project.photos.filter(p => p.slot === slotId)
  }

  function projectStats(project: Project) {
    const total = project.photos.length
    const pending = project.photos.filter(p => p.slot === 'inbox').length
    const trashed = project.photos.filter(p => p.slot === 'trash').length
    const sorted = total - pending - trashed
    const bytes = project.photos.reduce((sum, p) => sum + p.bytes, 0)
    return { total, pending, trashed, sorted, bytes }
  }

  const totalBytes = computed(() =>
    projects.value.reduce(
      (sum, p) => sum + p.photos.reduce((s, ph) => s + ph.bytes, 0),
      0
    )
  )

  function replaceAll(newProjects: Project[]) {
    projects.value = newProjects
  }

  return {
    projects,
    ready,
    load,
    getProject,
    createProject,
    removeProject,
    touchProject,
    saveProjectNow,
    markExported,
    photosInSlot,
    projectStats,
    totalBytes,
    replaceAll
  }
}
