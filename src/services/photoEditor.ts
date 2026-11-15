const JPEG_QUALITY = 0.85

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('toBlob failed')),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

export async function rotate90cw(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const { width: w, height: h } = bitmap

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(h, w)
    const ctx = canvas.getContext('2d')!
    ctx.translate(h, 0)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  }

  const canvas = document.createElement('canvas')
  canvas.width = h
  canvas.height = w
  const ctx = canvas.getContext('2d')!
  ctx.translate(h, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvasToBlob(canvas)
}

/** Crop region in normalized coordinates (0..1) relative to the source image. */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

const MIN_CROP_PX = 16

export async function cropImage(blob: Blob, rect: CropRect): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const { width: iw, height: ih } = bitmap

  const sx = Math.max(0, Math.min(Math.round(rect.x * iw), iw - MIN_CROP_PX))
  const sy = Math.max(0, Math.min(Math.round(rect.y * ih), ih - MIN_CROP_PX))
  const sw = Math.max(MIN_CROP_PX, Math.min(Math.round(rect.w * iw), iw - sx))
  const sh = Math.max(MIN_CROP_PX, Math.min(Math.round(rect.h * ih), ih - sy))

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(sw, sh)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)
    bitmap.close()
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  }

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)
  bitmap.close()
  return canvasToBlob(canvas)
}

export async function mirrorH(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const { width: w, height: h } = bitmap

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvasToBlob(canvas)
}
