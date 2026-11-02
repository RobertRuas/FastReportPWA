import { ref, readonly } from 'vue'
import { processImage, generateThumb } from '@/services/imageProcessor'
import type { Project } from '@/models/types'
import { usePhotoStore } from './usePhotoStore'
import { useProjects } from './useProjects'

const CONCURRENCY = 3

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

  async function processOne(file: File, project: Project): Promise<boolean> {
    try {
      currentFileName.value = file.name
      const processed = await processImage(file)
      const thumb = await generateThumb(processed.blob)
      await addPhotosToInbox(project, [{
        blob: processed.blob,
        thumb,
        width: processed.width,
        height: processed.height
      }])
      return true
    } catch (err) {
      console.error('[FastReport] Failed to process:', file.name, err)
      return false
    }
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

    let completed = 0
    let succeeded = 0

    return new Promise<number>((resolve) => {
      let nextIndex = 0
      let running = 0

      function startNext() {
        while (running < CONCURRENCY && nextIndex < sorted.length) {
          const file = sorted[nextIndex++]
          running++
          processOne(file, project).then((ok) => {
            if (ok) succeeded++
            running--
            completed++
            processedFiles.value = completed
            progress.value = Math.round((completed / sorted.length) * 100)

            if (completed === sorted.length) {
              saveProjectNow(project).then(() => {
                importing.value = false
                resolve(succeeded)
              })
            } else {
              startNext()
            }
          })
        }
      }

      startNext()
    })
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
