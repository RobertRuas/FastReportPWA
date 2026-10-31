import JSZip from 'jszip'
import type { Project, ProjectMetadata } from '@/models/types'
import { getMap, getSlot } from './mapCatalog'
import { slotFileToken, slotPath } from './fileNamer'
import * as db from './db'

export type ExportLayout = 'folders' | 'flat'

export interface ExportProgress {
  current: number
  total: number
}

export async function exportProject(
  project: Project,
  layout: ExportLayout,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  const map = getMap(project.mapId)
  const zip = new JSZip()

  const classifiedPhotos = project.photos.filter(p => p.slot !== 'inbox' && p.slot !== 'trash')
  const total = classifiedPhotos.length

  const counters: Record<string, number> = {}

  for (let i = 0; i < classifiedPhotos.length; i++) {
    const photo = classifiedPhotos[i]
    const blobRecord = await db.getBlob(photo.id)
    if (!blobRecord) continue

    const buf = await blobRecord.full.arrayBuffer()
    const slot = map ? getSlot(map, photo.slot) : undefined
    const folderName = slot ? (slot.group ? `${slot.group}/${slot.folder}` : slot.folder) : photo.slot
    const tokenKey = slot ? slotFileToken(slot) : photo.slot

    counters[tokenKey] = (counters[tokenKey] ?? 0) + 1
    const num = String(counters[tokenKey]).padStart(3, '0')
    const fileName = `${project.slug}_${tokenKey}_${num}.jpeg`

    if (layout === 'folders') {
      zip.file(`${folderName}/${fileName}`, new Uint8Array(buf))
    } else {
      zip.file(fileName, new Uint8Array(buf))
    }

    onProgress?.({ current: i + 1, total })
  }

  if (layout === 'folders') {
    const metadata: ProjectMetadata = {
      schemaVersion: 1,
      mapId: project.mapId,
      displayName: project.name,
      createdAt: project.createdAt
    }
    zip.file('fastreport.json', JSON.stringify(metadata, null, 2))
  }

  return zip.generateAsync({ type: 'blob' })
}

export async function shareOrSave(blob: Blob, filename: string): Promise<void> {
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'application/zip' })
    const shareData = { files: [file] }
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch (e: any) {
        if (e?.name === 'AbortError') throw e
      }
    }
  }

  await saveFile(blob, filename)
}

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'ZIP',
          accept: { 'application/zip': ['.zip'] }
        }]
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
