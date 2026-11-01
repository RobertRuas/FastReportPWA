import { supabase } from './supabase'
import * as db from './db'
import type { Project, Photo } from '@/models/types'
import { uploadProjectPhotos, downloadProjectPhotos } from './photoSync'
import { markSyncing, markSynced, markSyncError } from '@/composables/useSyncStatus'

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

export async function syncProjects(
  localProjects: Project[],
  onProjectsChanged: (projects: Project[]) => void
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
        await uploadProjectPhotos(local, user.id)
      } else if (!local && rem) {
        if (!rem.deleted) {
          const proj = toLocal(rem)
          await db.saveProject(proj)
          merged.push(proj)
          await downloadProjectPhotos(proj, user.id)
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
            await downloadProjectPhotos(proj, user.id)
          } else if (localTime > remoteTime) {
            await supabase.from('fr_projects').upsert(toRemote(local, user.id))
            merged.push(local)
            await uploadProjectPhotos(local, user.id)
          } else {
            merged.push(local)
          }
        }
      }
    }

    onProjectsChanged(merged)
    markSynced()
    return { ok: true }
  } catch (err: any) {
    const msg = err?.message ?? 'Sync failed'
    markSyncError(msg)
    return { ok: false, error: msg }
  }
}
