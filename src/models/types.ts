export interface LocalizedName {
  pt: string
  en: string
}

export interface Slot {
  id: string
  folder: string
  group?: string
  hotkeys: string[]
  expectedCount: number | null
  unlimited: boolean
  isTrash: boolean
  isInbox: boolean
}

export interface OrganizationMap {
  id: string
  version: number
  name: LocalizedName
  fileNamePattern: string
  inboxFolder: string
  slots: Slot[]
}

export interface ProjectMetadata {
  schemaVersion: number
  mapId: string
  displayName: string
  createdAt: string
}

export interface Photo {
  id: string
  slot: string
  w: number
  h: number
  bytes: number
}

export interface Project {
  id: string
  name: string
  slug: string
  mapId: string
  createdAt: string
  updatedAt: string
  exportedAt: string | null
  photos: Photo[]
}

export interface PhotoBlob {
  id: string
  projectId: string
  full: Blob
  thumb: Blob
}

export interface AppSettings {
  cols: 'auto' | number
  langPref: 'auto' | 'pt' | 'en'
  ui: number
  userName: string
  userEmail: string
  autoSync: boolean
}

export interface UndoEntry {
  type: 'move' | 'image'
  photoId: string
  fromSlot: string
  toSlot: string
  prevFull?: Blob
  prevThumb?: Blob
}
