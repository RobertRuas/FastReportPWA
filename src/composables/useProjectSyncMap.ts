import type { Project } from '@/models/types'

export function isProjectSynced(project: Project): boolean {
  if (!project.syncedAt) return false
  return new Date(project.syncedAt) >= new Date(project.updatedAt)
}

export function isProjectSyncStale(project: Project): boolean {
  if (!project.syncedAt) return false
  return new Date(project.updatedAt) > new Date(project.syncedAt)
}

export function projectSyncState(project: Project): 'synced' | 'stale' | 'never' {
  if (!project.syncedAt) return 'never'
  return new Date(project.syncedAt) >= new Date(project.updatedAt) ? 'synced' : 'stale'
}
