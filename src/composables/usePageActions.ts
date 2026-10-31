import { ref, onUnmounted } from 'vue'
import type { PageAction } from '@/app/router'

const overrideActions = ref<PageAction[] | null>(null)

export function usePageActions() {
  function setActions(actions: PageAction[]) {
    overrideActions.value = actions
  }

  function clearActions() {
    overrideActions.value = null
  }

  onUnmounted(() => {
    clearActions()
  })

  return { overrideActions, setActions, clearActions }
}
