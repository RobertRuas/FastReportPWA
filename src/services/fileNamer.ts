import type { Slot, Photo } from '@/models/types'

export function slotFileToken(slot: Slot): string {
  return slot.group ? `${slot.group}_${slot.folder}` : slot.folder
}

export function slotPath(slot: Slot): string {
  return slot.group ? `${slot.group}/${slot.folder}` : slot.folder
}

export function nextIndex(photos: Photo[], slotId: string): number {
  const indices = photos
    .filter(p => p.slot === slotId)
    .map((_, i) => i + 1)

  if (indices.length === 0) return 1

  for (let i = 1; i <= indices.length + 1; i++) {
    if (!indices.includes(i)) return i
  }
  return indices.length + 1
}

export function fileName(
  projectSlug: string,
  slot: Slot,
  index: number
): string {
  return `${projectSlug}_${slotFileToken(slot)}_${index}.jpeg`
}
