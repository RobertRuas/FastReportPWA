import * as db from './db'
import type { Photo, PhotoBlob } from '@/models/types'
import { processImage, generateThumb } from './imageProcessor'

const NA_IMAGE_URL = '/na.jpg'

function generatePhotoId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `ph${ts}${rand}`
}

export async function addDefaultPhoto(projectId: string): Promise<Photo | null> {
  try {
    const response = await fetch(NA_IMAGE_URL)
    if (!response.ok) return null
    const rawBlob = await response.blob()

    const file = new File([rawBlob], 'na.jpg', { type: 'image/jpeg' })
    const processed = await processImage(file)
    const thumb = await generateThumb(processed.blob)

    const id = generatePhotoId()
    const photo: Photo = {
      id,
      slot: 'general',
      w: processed.width,
      h: processed.height,
      bytes: processed.blob.size
    }

    const photoBlob: PhotoBlob = {
      id,
      projectId,
      full: processed.blob,
      thumb
    }

    await db.saveBlob(photoBlob)
    return photo
  } catch (err) {
    console.error('[FastReport] Failed to add default photo:', err)
    return null
  }
}
