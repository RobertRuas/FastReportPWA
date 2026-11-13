import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { importZip } from '@/services/zipImportService'
import { useI18n } from './useI18n'

const importing = ref(false)

export function useZipImport() {
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()

  async function pickAndImport() {
    if (importing.value) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,application/zip'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      importing.value = true
      try {
        const result = await importZip(file)
        toast.add({ severity: 'success', summary: t('zip.success'), life: 3000 })
        router.push(`/projects/${result.projectId}`)
      } catch (err: any) {
        const msg = err?.message === 'noMetadata' ? t('zip.error.noMetadata')
          : err?.message === 'mapNotFound' ? t('zip.error.mapNotFound', { mapId: '' })
          : t('zip.error.generic')
        toast.add({ severity: 'error', summary: msg, life: 4000 })
      } finally {
        importing.value = false
      }
    }

    input.click()
  }

  return { importing, pickAndImport }
}
