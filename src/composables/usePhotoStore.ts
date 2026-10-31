import { reactive } from 'vue'
import type { Project, Photo, PhotoBlob } from '@/models/types'
import * as db from '@/services/db'
import { revokeImageUrl } from '@/services/imageProcessor'

const urls = reactive<Record<string, { full: string; thumb: string }>>({})

function generatePhotoId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `f${ts}${rand}`
}

export function usePhotoStore() {
  async function loadProjectUrls(projectId: string) {
    const blobs = await db.getAllBlobsForProject(projectId)
    for (const b of blobs) {
      if (!urls[b.id]) {
        urls[b.id] = {
          full: URL.createObjectURL(b.full),
          thumb: URL.createObjectURL(b.thumb)
        }
      }
    }
  }

  function getThumbUrl(photoId: string): string | undefined {
    return urls[photoId]?.thumb
  }

  function getFullUrl(photoId: string): string | undefined {
    return urls[photoId]?.full
  }

  async function addPhotosToInbox(
    project: Project,
    images: { blob: Blob; thumb: Blob; width: number; height: number }[]
  ) {
    for (const img of images) {
      const id = generatePhotoId()

      const photo: Photo = {
        id,
        slot: 'inbox',
        w: img.width,
        h: img.height,
        bytes: img.blob.size
      }
      project.photos.push(photo)

      const blobRecord: PhotoBlob = {
        id,
        projectId: project.id,
        full: img.blob,
        thumb: img.thumb
      }
      await db.saveBlob(blobRecord)

      urls[id] = {
        full: URL.createObjectURL(img.blob),
        thumb: URL.createObjectURL(img.thumb)
      }
    }
  }

  function movePhoto(project: Project, photoId: string, toSlot: string): string {
    const photo = project.photos.find(p => p.id === photoId)
    if (!photo) throw new Error(`Photo not found: ${photoId}`)
    const fromSlot = photo.slot
    photo.slot = toSlot
    return fromSlot
  }

  async function updateBlobs(photoId: string, projectId: string, full: Blob, thumb: Blob) {
    const oldUrls = urls[photoId]
    if (oldUrls) {
      revokeImageUrl(oldUrls.full)
      revokeImageUrl(oldUrls.thumb)
    }

    await db.saveBlob({ id: photoId, projectId, full, thumb })

    urls[photoId] = {
      full: URL.createObjectURL(full),
      thumb: URL.createObjectURL(thumb)
    }
  }

  async function deletePhoto(project: Project, photoId: string) {
    const idx = project.photos.findIndex(p => p.id === photoId)
    if (idx >= 0) project.photos.splice(idx, 1)

    await db.deleteBlob(photoId)

    const u = urls[photoId]
    if (u) {
      revokeImageUrl(u.full)
      revokeImageUrl(u.thumb)
      delete urls[photoId]
    }
  }

  async function clearTrash(project: Project) {
    const trashPhotos = project.photos.filter(p => p.slot === 'trash')
    for (const photo of trashPhotos) {
      await deletePhoto(project, photo.id)
    }
  }

  function revokeAllUrls() {
    for (const id of Object.keys(urls)) {
      revokeImageUrl(urls[id].full)
      revokeImageUrl(urls[id].thumb)
      delete urls[id]
    }
  }

  function getInboxCount(project: Project): number {
    return project.photos.filter(p => p.slot === 'inbox').length
  }

  return {
    loadProjectUrls,
    getThumbUrl,
    getFullUrl,
    addPhotosToInbox,
    movePhoto,
    updateBlobs,
    deletePhoto,
    clearTrash,
    revokeAllUrls,
    getInboxCount
  }
}
