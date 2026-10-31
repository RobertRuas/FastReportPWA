import JSZip from 'jszip'
import type { ProjectMetadata } from '@/models/types'
import { getMap } from './mapCatalog'
import { processImage, generateThumb } from './imageProcessor'
import { useProjects } from '@/composables/useProjects'
import { usePhotoStore } from '@/composables/usePhotoStore'

export interface ZipImportResult {
  projectId: string
  photosImported: number
}

export async function importZip(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ZipImportResult> {
  const zip = await JSZip.loadAsync(file)

  const metaFile = zip.file('fastreport.json') ?? zip.file('.fastreport.json')
  if (!metaFile) {
    throw new Error('noMetadata')
  }

  const metaText = await metaFile.async('string')
  let metadata: ProjectMetadata
  try {
    metadata = JSON.parse(metaText)
  } catch {
    throw new Error('metadataCorrupt')
  }

  if (!metadata.mapId || !metadata.displayName) {
    throw new Error('metadataCorrupt')
  }

  const map = getMap(metadata.mapId)
  if (!map) {
    throw new Error('mapNotFound')
  }

  const { createProject } = useProjects()
  const { addPhotosToInbox } = usePhotoStore()

  let projectName = metadata.displayName
  try {
    var project = await createProject(projectName, metadata.mapId)
  } catch (e: any) {
    if (e?.message === 'Project name already exists') {
      let suffix = 2
      while (true) {
        try {
          projectName = `${metadata.displayName} (${suffix})`
          var project = await createProject(projectName, metadata.mapId)
          break
        } catch {
          suffix++
          if (suffix > 100) throw new Error('tooManyDuplicates')
        }
      }
    } else {
      throw e
    }
  }

  const imageFiles: { path: string; zipEntry: JSZip.JSZipObject }[] = []
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return
    const lower = relativePath.toLowerCase()
    if (lower === 'fastreport.json' || lower === '.fastreport.json') return
    if (lower.startsWith('__macosx') || lower.startsWith('.')) return
    const ext = lower.split('.').pop() ?? ''
    if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp', 'webp'].includes(ext)) {
      imageFiles.push({ path: relativePath, zipEntry: entry })
    }
  })

  const total = imageFiles.length
  let imported = 0

  const slotLookup = new Map<string, string>()
  for (const slot of map.slots) {
    slotLookup.set(slot.folder.toLowerCase(), slot.id)
    if (slot.group) {
      slotLookup.set(`${slot.group}/${slot.folder}`.toLowerCase(), slot.id)
    }
  }

  const batchBySlot: Record<string, { blob: Blob; thumb: Blob; width: number; height: number }[]> = {}

  for (let i = 0; i < imageFiles.length; i++) {
    const { path, zipEntry } = imageFiles[i]
    onProgress?.(i + 1, total)

    try {
      const blob = await zipEntry.async('blob')

      const parts = path.split('/')
      parts.pop()
      const folderPath = parts.join('/').toLowerCase()

      let targetSlot = 'inbox'
      if (folderPath) {
        const lastFolder = parts[parts.length - 1]?.toLowerCase()
        targetSlot = slotLookup.get(folderPath) ?? slotLookup.get(lastFolder ?? '') ?? 'inbox'
      }

      const isJpeg = blob.type === 'image/jpeg' || path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg')

      let fullBlob: Blob
      let width: number
      let height: number

      if (isJpeg) {
        const bm = await createImageBitmap(blob)
        width = bm.width
        height = bm.height
        bm.close()
        fullBlob = blob
      } else {
        const fakeFile = new File([blob], path.split('/').pop() ?? 'image', { type: blob.type })
        const processed = await processImage(fakeFile)
        fullBlob = processed.blob
        width = processed.width
        height = processed.height
      }

      const thumb = await generateThumb(fullBlob)

      if (!batchBySlot[targetSlot]) batchBySlot[targetSlot] = []
      batchBySlot[targetSlot].push({ blob: fullBlob, thumb, width, height })
      imported++
    } catch {
      // skip files that fail to process
    }
  }

  const { movePhoto } = usePhotoStore()

  await addPhotosToInbox(project, Object.values(batchBySlot).flat())

  let photoIdx = 0
  for (const [slotId, items] of Object.entries(batchBySlot)) {
    if (slotId === 'inbox') {
      photoIdx += items.length
      continue
    }
    for (let i = 0; i < items.length; i++) {
      const photo = project.photos[photoIdx]
      if (photo) {
        movePhoto(project, photo.id, slotId)
      }
      photoIdx++
    }
  }

  const { markExported, saveProjectNow } = useProjects()
  markExported(project)
  await saveProjectNow(project)

  return { projectId: project.id, photosImported: imported }
}
