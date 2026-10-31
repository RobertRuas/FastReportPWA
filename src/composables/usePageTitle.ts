import { ref, onUnmounted } from 'vue'

const titleOverride = ref<string | null>(null)

export function usePageTitle() {
  function setTitle(title: string) {
    titleOverride.value = title
  }

  function clearTitle() {
    titleOverride.value = null
  }

  onUnmounted(() => {
    clearTitle()
  })

  return { titleOverride, setTitle, clearTitle }
}
