import { ref, computed } from 'vue'

const pendingOps = ref(0)
const lastSavedAt = ref<number>(0)
const lastErrorMsg = ref('')
const lastErrorAt = ref<number>(0)

let hideTimer: ReturnType<typeof setTimeout> | null = null
const showSaved = ref(false)

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function markSaving() {
  pendingOps.value++
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showSaved.value = false
}

export function markSaved() {
  pendingOps.value = Math.max(0, pendingOps.value - 1)
  lastSavedAt.value = Date.now()
  lastErrorMsg.value = ''
  if (pendingOps.value === 0) {
    showSaved.value = true
    hideTimer = setTimeout(() => { showSaved.value = false }, 2000)
  }
}

export function markError(err?: unknown) {
  pendingOps.value = Math.max(0, pendingOps.value - 1)
  lastErrorAt.value = Date.now()
  lastErrorMsg.value = err instanceof Error ? err.message : 'Erro ao salvar dados'
}

export function clearError() {
  lastErrorMsg.value = ''
}

export function useSaveStatus() {
  const isSaving = computed(() => pendingOps.value > 0)
  const hasSaved = computed(() => showSaved.value && !isSaving.value)
  const hasError = computed(() => lastErrorMsg.value !== '')

  const savedTimeAgo = computed(() => {
    if (!lastSavedAt.value) return ''
    return formatTime(lastSavedAt.value)
  })

  const errorInfo = computed(() => ({
    message: lastErrorMsg.value,
    time: lastErrorAt.value ? formatTime(lastErrorAt.value) : ''
  }))

  return { isSaving, hasSaved, hasError, savedTimeAgo, errorInfo, clearError }
}
