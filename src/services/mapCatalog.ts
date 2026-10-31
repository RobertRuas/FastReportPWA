import type { OrganizationMap, Slot } from '@/models/types'
import inspectionT24 from '@/data/inspection-t24.json'
import tendonsRetrofit from '@/data/tendons-retrofit.json'

const maps: OrganizationMap[] = [
  inspectionT24 as OrganizationMap,
  tendonsRetrofit as OrganizationMap
]

export function getAllMaps(): OrganizationMap[] {
  return maps
}

export function getMap(id: string): OrganizationMap | undefined {
  return maps.find(m => m.id === id)
}

export function getSlot(map: OrganizationMap, slotId: string): Slot | undefined {
  return map.slots.find(s => s.id === slotId)
}

export function getInboxSlot(map: OrganizationMap): Slot {
  return map.slots.find(s => s.isInbox)!
}

export function getTrashSlot(map: OrganizationMap): Slot | undefined {
  return map.slots.find(s => s.isTrash)
}

export function getGroups(map: OrganizationMap): string[] {
  const groups = new Set<string>()
  for (const slot of map.slots) {
    if (slot.group) groups.add(slot.group)
  }
  return Array.from(groups)
}

export function getSlotsForGroup(map: OrganizationMap, group: string): Slot[] {
  return map.slots.filter(s => s.group === group)
}

export function getClassifiableSlots(map: OrganizationMap): Slot[] {
  return map.slots.filter(s => !s.isInbox)
}

export function hasGroups(map: OrganizationMap): boolean {
  return map.slots.some(s => !!s.group)
}

export interface MapValidationError {
  code: string
  message: string
}

export function validateMap(map: OrganizationMap): MapValidationError[] {
  const errors: MapValidationError[] = []

  if (map.slots.length === 0) {
    errors.push({ code: 'noSlots', message: 'Map must have at least one slot' })
    return errors
  }

  const inboxSlots = map.slots.filter(s => s.isInbox)
  if (inboxSlots.length === 0) {
    errors.push({ code: 'noInbox', message: 'Map must have exactly one inbox slot' })
  } else if (inboxSlots.length > 1) {
    errors.push({ code: 'multipleInbox', message: 'Map must have exactly one inbox slot' })
  }

  for (const slot of map.slots) {
    if (slot.isInbox && slot.group) {
      errors.push({ code: 'inboxInGroup', message: 'Inbox slot cannot be in a group' })
    }
    if (slot.isTrash && slot.group) {
      errors.push({ code: 'trashInGroup', message: 'Trash slot cannot be in a group' })
    }
    if (slot.isInbox && slot.isTrash) {
      errors.push({ code: 'inboxIsTrash', message: 'A slot cannot be both inbox and trash' })
    }
  }

  const ids = new Set<string>()
  for (const slot of map.slots) {
    if (ids.has(slot.id)) {
      errors.push({ code: 'duplicateId', message: `Duplicate slot id: ${slot.id}` })
    }
    ids.add(slot.id)
  }

  const hotkeyScopes = new Map<string, Set<string>>()
  for (const slot of map.slots) {
    const scope = slot.group ?? '__global__'
    if (!hotkeyScopes.has(scope)) hotkeyScopes.set(scope, new Set())
    const used = hotkeyScopes.get(scope)!
    for (const hk of slot.hotkeys) {
      if (used.has(hk)) {
        errors.push({ code: 'duplicateHotkey', message: `Duplicate hotkey "${hk}" in scope "${scope}"` })
      }
      used.add(hk)
    }
  }

  const unsafePattern = /[/:]/
  for (const slot of map.slots) {
    if (unsafePattern.test(slot.folder) || slot.folder.startsWith('.') || slot.folder.includes('..')) {
      errors.push({ code: 'unsafeFolder', message: `Unsafe folder name: ${slot.folder}` })
    }
  }

  if (inboxSlots.length === 1 && inboxSlots[0].folder !== map.inboxFolder) {
    errors.push({ code: 'inboxFolderMismatch', message: 'inboxFolder does not match inbox slot folder' })
  }

  return errors
}
