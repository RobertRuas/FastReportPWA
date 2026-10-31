const MAX_SIZE = 1024
const JPEG_QUALITY = 0.85
const THUMB_WIDTH = 256
const THUMB_QUALITY = 0.75

export interface ProcessedImage {
  id: string
  name: string
  blob: Blob
  url: string
  width: number
  height: number
}

export async function processImage(file: File): Promise<ProcessedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await createImageBitmap(file)
  }
  const { width: ow, height: oh } = bitmap

  let w = ow
  let h = oh
  if (w > MAX_SIZE || h > MAX_SIZE) {
    if (w >= h) {
      h = Math.round((h / w) * MAX_SIZE)
      w = MAX_SIZE
    } else {
      w = Math.round((w / h) * MAX_SIZE)
      h = MAX_SIZE
    }
  }

  let blob: Blob
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('toBlob failed')),
        'image/jpeg',
        JPEG_QUALITY
      )
    })
  }

  return { id: '', name: '', blob, url: '', width: w, height: h }
}

export async function generateThumb(fullBlob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(fullBlob)
  const { width: ow, height: oh } = bitmap

  const scale = THUMB_WIDTH / ow
  const w = THUMB_WIDTH
  const h = Math.round(oh * scale)

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return canvas.convertToBlob({ type: 'image/jpeg', quality: THUMB_QUALITY })
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('toBlob failed')),
      'image/jpeg',
      THUMB_QUALITY
    )
  })
}

export function revokeImageUrl(url: string) {
  URL.revokeObjectURL(url)
}
