import { supabase } from './supabase'
import * as db from './db'
import type { Project } from '@/models/types'

export async function uploadProjectPhotos(project: Project, userId: string) {
  const blobs = await db.getAllBlobsForProject(project.id)
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
  }
}

export async function downloadProjectPhotos(project: Project, userId: string) {
  for (const photo of project.photos) {
    const existing = await db.getBlob(photo.id)
    if (existing) continue

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
  }
}
