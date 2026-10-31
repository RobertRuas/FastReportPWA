import { ref, computed, readonly } from 'vue'
import type { UndoEntry } from '@/models/types'

const stack = ref<UndoEntry[]>([])

export function useUndo() {
  function push(entry: UndoEntry) {
    stack.value.push(entry)
  }

  function pop(): UndoEntry | undefined {
    return stack.value.pop()
  }

  function clear() {
    stack.value = []
  }

  function removeByPhoto(photoId: string) {
    stack.value = stack.value.filter(e => e.photoId !== photoId)
  }

  const canUndo = computed(() => stack.value.length > 0)
  const count = computed(() => stack.value.length)

  return { push, pop, clear, removeByPhoto, stack: readonly(stack), canUndo, count }
}
