import { ref, readonly } from 'vue'
import { processImage, generateThumb } from '@/services/imageProcessor'
import type { Project } from '@/models/types'
import { usePhotoStore } from './usePhotoStore'
import { useProjects } from './useProjects'

const importing = ref(false)
const progress = ref(0)
const totalFiles = ref(0)
const processedFiles = ref(0)
const currentFileName = ref('')

export function usePhotoImport() {
  const { addPhotosToInbox } = usePhotoStore()
  const { saveProjectNow } = useProjects()

  function selectFiles(): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = 'image/*'
      input.style.display = 'none'
      document.body.appendChild(input)
      input.onchange = () => {
        const files = input.files ? Array.from(input.files) : []
        document.body.removeChild(input)
        resolve(files)
      }
      input.click()
    })
  }

  function naturalSort(files: File[]): File[] {
    return files.slice().sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    )
  }

  async function importPhotos(project: Project): Promise<number> {
    const files = await selectFiles()
    if (files.length === 0) return 0

    const sorted = naturalSort(files)

    importing.value = true
    progress.value = 0
    totalFiles.value = sorted.length
    processedFiles.value = 0
    currentFileName.value = ''

    try {
      const results: { blob: Blob; thumb: Blob; width: number; height: number }[] = []

      for (let i = 0; i < sorted.length; i++) {
        currentFileName.value = sorted[i].name
        try {
          const processed = await processImage(sorted[i])
          const thumb = await generateThumb(processed.blob)
          results.push({
            blob: processed.blob,
            thumb,
            width: processed.width,
            height: processed.height
          })
        } catch (err) {
          console.error('[FastReport] Failed to process:', sorted[i].name, err)
        }

        processedFiles.value = i + 1
        progress.value = Math.round(((i + 1) / sorted.length) * 100)
        await new Promise(r => requestAnimationFrame(r))
      }

      if (results.length > 0) {
        await addPhotosToInbox(project, results)
        await saveProjectNow(project)
      }

      return results.length
    } finally {
      importing.value = false
    }
  }

  return {
    importing: readonly(importing),
    progress: readonly(progress),
    totalFiles: readonly(totalFiles),
    processedFiles: readonly(processedFiles),
    currentFileName: readonly(currentFileName),
    importPhotos
  }
}
