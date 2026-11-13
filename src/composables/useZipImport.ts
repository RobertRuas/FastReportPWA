import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { importZip } from '@/services/zipImportService'
import { useI18n } from './useI18n'

const importing = ref(false)

// Input singleton anexado ao <body> — iOS Safari precisa do input no DOM
// para disparar `change` de forma consistente em cada toque.
let pickerInput: HTMLInputElement | null = null
let pickerResolve: ((file: File | null) => void) | null = null

function ensureInput(): HTMLInputElement {
  if (pickerInput) return pickerInput
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.zip,application/zip'
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.top = '-9999px'
  input.style.width = '1px'
  input.style.height = '1px'
  input.style.opacity = '0'
  input.tabIndex = -1
  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null
    const resolve = pickerResolve
    pickerResolve = null
    input.value = '' // permite re-selecionar o mesmo ficheiro
    resolve?.(file)
  })
  // `cancel` em iOS/Safari recentes; ignorado nos browsers que não suportam.
  input.addEventListener('cancel', () => {
    const resolve = pickerResolve
    pickerResolve = null
    resolve?.(null)
  })
  document.body.appendChild(input)
  pickerInput = input
  return input
}

function pickZipFile(): Promise<File | null> {
  const input = ensureInput()
  // Se já havia uma escolha pendente, descarta-a.
  if (pickerResolve) {
    pickerResolve(null)
    pickerResolve = null
  }
  return new Promise<File | null>((resolve) => {
    pickerResolve = resolve
    input.value = ''
    // Leve delay para garantir que o ciclo de evento do toque atual termine
    // antes de abrir o picker (iOS às vezes precisa disto).
    setTimeout(() => input.click(), 0)
  })
}

export function useZipImport() {
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()

  async function pickAndImport() {
    if (importing.value) return
    const file = await pickZipFile()
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

  return { importing, pickAndImport }
}
