import { supabase } from './supabase'
import * as db from './db'
import type { Project } from '@/models/types'

export interface SyncProgress {
  current: number
  total: number
  phase: 'uploading' | 'downloading'
}

export async function deleteProjectPhotos(projectId: string, userId: string) {
  const basePath = `${userId}/${projectId}`
  const { data: files } = await supabase.storage.from('fr-photos').list(basePath)
  if (files && files.length > 0) {
    for (const folder of files) {
      const subPath = `${basePath}/${folder.name}`
      const { data: subFiles } = await supabase.storage.from('fr-photos').list(subPath)
      if (subFiles && subFiles.length > 0) {
        const paths = subFiles.map(f => `${subPath}/${f.name}`)
        await supabase.storage.from('fr-photos').remove(paths)
      }
    }
  }
}

export async function uploadProjectPhotos(
  project: Project,
  userId: string,
  onProgress?: (p: SyncProgress) => void
) {
  const blobs = await db.getAllBlobsForProject(project.id)
  const total = blobs.length
  let current = 0

  for (const blob of blobs) {
    const basePath = `${userId}/${project.id}/${blob.id}`

    const { data: existing } = await supabase.storage
      .from('fr-photos')
      .list(`${userId}/${project.id}/${blob.id}`)

    const existingNames = new Set((existing ?? []).map(f => f.name))

    if (!existingNames.has('full.jpg')) {
      await supabase.storage.from('fr-photos').upload(
        `${basePath}/full.jpg`,
        blob.full,
        { contentType: 'image/jpeg', upsert: true }
      )
    }
    if (!existingNames.has('thumb.jpg')) {
      await supabase.storage.from('fr-photos').upload(
        `${basePath}/thumb.jpg`,
        blob.thumb,
        { contentType: 'image/jpeg', upsert: true }
      )
    }

    current++
    onProgress?.({ current, total, phase: 'uploading' })
  }
}

export async function downloadProjectPhotos(
  project: Project,
  userId: string,
  onProgress?: (p: SyncProgress) => void
) {
  const total = project.photos.length
  let current = 0

  for (const photo of project.photos) {
    const existing = await db.getBlob(photo.id)
    if (existing) {
      current++
      onProgress?.({ current, total, phase: 'downloading' })
      continue
    }

    const basePath = `${userId}/${project.id}/${photo.id}`

    const [fullRes, thumbRes] = await Promise.all([
      supabase.storage.from('fr-photos').download(`${basePath}/full.jpg`),
      supabase.storage.from('fr-photos').download(`${basePath}/thumb.jpg`)
    ])

    if (fullRes.data && thumbRes.data) {
      await db.saveBlob({
        id: photo.id,
        projectId: project.id,
        full: fullRes.data,
        thumb: thumbRes.data
      })
    }

    current++
    onProgress?.({ current, total, phase: 'downloading' })
  }
}
