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
