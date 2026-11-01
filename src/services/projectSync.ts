import { supabase } from './supabase'
import * as db from './db'
import type { Project, Photo } from '@/models/types'
import { uploadProjectPhotos, downloadProjectPhotos, deleteProjectPhotos } from './photoSync'
import type { SyncProgress } from './photoSync'
import { markSyncing, markSynced, markSyncError } from '@/composables/useSyncStatus'
import { markProjectsSynced, markProjectSynced } from '@/composables/useProjectSyncMap'

interface RemoteProject {
  id: string
  user_id: string
  name: string
  slug: string
  map_id: string
  photos: Photo[]
  created_at: string
  updated_at: string
  exported_at: string | null
  deleted: boolean
}

function toRemote(p: Project, userId: string): RemoteProject {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    slug: p.slug,
    map_id: p.mapId,
    photos: p.photos,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    exported_at: p.exportedAt,
    deleted: false
  }
}

function toLocal(r: RemoteProject): Project {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    mapId: r.map_id,
    photos: r.photos ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    exportedAt: r.exported_at
  }
}

export async function syncProjectsMetadataOnly(
  localProjects: Project[],
  onProjectsChanged: (projects: Project[]) => void
): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    const { data: remoteRows, error } = await supabase
      .from('fr_projects')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    const remote = (remoteRows ?? []) as RemoteProject[]
    const remoteMap = new Map(remote.map(r => [r.id, r]))
    const localMap = new Map(localProjects.map(l => [l.id, l]))
    const merged: Project[] = []

    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

    for (const id of allIds) {
      const local = localMap.get(id)
      const rem = remoteMap.get(id)

      if (local && !rem) {
        await supabase.from('fr_projects').upsert(toRemote(local, user.id))
        merged.push(local)
      } else if (!local && rem) {
        if (!rem.deleted) {
          const proj = toLocal(rem)
          await db.saveProject(proj)
          merged.push(proj)
        }
      } else if (local && rem) {
        if (rem.deleted) {
          await db.deleteProject(id)
        } else {
          const localTime = new Date(local.updatedAt).getTime()
          const remoteTime = new Date(rem.updated_at).getTime()
          if (remoteTime > localTime) {
            const proj = toLocal(rem)
            await db.saveProject(proj)
            merged.push(proj)
          } else {
            merged.push(local)
          }
        }
      }
    }

    onProjectsChanged(merged)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Metadata sync failed' }
  }
}

export async function syncSingleProject(
  project: Project,
  onProgress?: (p: SyncProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    await supabase.from('fr_projects').upsert(toRemote(project, user.id))
    await uploadProjectPhotos(project, user.id, onProgress)
    markProjectSynced(project.id, project.updatedAt)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sync failed' }
  }
}

export async function syncDeleteProject(
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    await supabase.from('fr_projects')
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('user_id', user.id)

    await deleteProjectPhotos(projectId, user.id)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sync delete failed' }
  }
}

export async function syncProjects(
  localProjects: Project[],
  onProjectsChanged: (projects: Project[]) => void,
  onProgress?: (p: SyncProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  markSyncing()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    markSyncError('Not authenticated')
    return { ok: false, error: 'Not authenticated' }
  }

  try {
    const { data: remoteRows, error } = await supabase
      .from('fr_projects')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    const remote = (remoteRows ?? []) as RemoteProject[]
    const remoteMap = new Map(remote.map(r => [r.id, r]))
    const localMap = new Map(localProjects.map(l => [l.id, l]))
    const merged: Project[] = []

    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

    for (const id of allIds) {
      const local = localMap.get(id)
      const rem = remoteMap.get(id)

      if (local && !rem) {
        await supabase.from('fr_projects').upsert(toRemote(local, user.id))
        merged.push(local)
        await uploadProjectPhotos(local, user.id, onProgress)
      } else if (!local && rem) {
        if (!rem.deleted) {
          const proj = toLocal(rem)
          await db.saveProject(proj)
          merged.push(proj)
          await downloadProjectPhotos(proj, user.id, onProgress)
        }
      } else if (local && rem) {
        if (rem.deleted) {
          await db.deleteProject(id)
        } else {
          const localTime = new Date(local.updatedAt).getTime()
          const remoteTime = new Date(rem.updated_at).getTime()

          if (remoteTime > localTime) {
            const proj = toLocal(rem)
            await db.saveProject(proj)
            merged.push(proj)
            await downloadProjectPhotos(proj, user.id, onProgress)
          } else if (localTime > remoteTime) {
            await supabase.from('fr_projects').upsert(toRemote(local, user.id))
            merged.push(local)
            await uploadProjectPhotos(local, user.id, onProgress)
          } else {
            merged.push(local)
          }
        }
      }
    }

    onProjectsChanged(merged)
    markProjectsSynced(merged.map(p => ({ id: p.id, updatedAt: p.updatedAt })))
    markSynced()
    return { ok: true }
  } catch (err: any) {
    const msg = err?.message ?? 'Sync failed'
    markSyncError(msg)
    return { ok: false, error: msg }
  }
}
