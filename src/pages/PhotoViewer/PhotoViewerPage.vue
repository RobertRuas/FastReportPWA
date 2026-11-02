<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectSession } from '@/composables/useProjectSession'
import { usePhotoStore } from '@/composables/usePhotoStore'
import { useProjects } from '@/composables/useProjects'
import { useI18n } from '@/composables/useI18n'
import { useUndo } from '@/services/undoManager'
import { rotate90cw, mirrorH } from '@/services/photoEditor'
import { generateThumb } from '@/services/imageProcessor'
import * as db from '@/services/db'
import {
  getGroups, getSlotsForGroup, hasGroups,
  getClassifiableSlots, getTrashSlot
} from '@/services/mapCatalog'
import type { Slot } from '@/models/types'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { project, map, stats, openProject } = useProjectSession()
const { movePhoto, getFullUrl, updateBlobs } = usePhotoStore()
const { touchProject } = useProjects()
const { push: undoPush, pop: undoPop, clear: undoClear, canUndo } = useUndo()
const { t } = useI18n()

const currentIndex = ref(0)
const slideDir = ref<'next' | 'prev'>('next')
const activeGroup = ref<string | null>(null)
const busy = ref(false)
const showMoveOverlay = ref(false)

const scopeSlot = computed(() => (route.query.slot as string) || null)
const startPhotoId = computed(() => (route.query.photo as string) || null)

let wakeLock: WakeLockSentinel | null = null

onMounted(async () => {
  await openProject(projectId.value)
  if (startPhotoId.value && scopedPhotos.value.length > 0) {
    const idx = scopedPhotos.value.findIndex(p => p.id === startPhotoId.value)
    if (idx >= 0) currentIndex.value = idx
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch { /* not supported or denied */ }
})


onUnmounted(() => {
  wakeLock?.release()
  undoClear()
})

const scopedPhotos = computed(() => {
  if (!project.value) return []
  const slot = scopeSlot.value ?? 'inbox'
  return project.value.photos.filter(p => p.slot === slot)
})

const isReviewMode = computed(() => scopeSlot.value !== null)

const currentPhoto = computed(() => scopedPhotos.value[currentIndex.value])
const currentUrl = computed(() => currentPhoto.value ? getFullUrl(currentPhoto.value.id) : undefined)
const counter = computed(() =>
  scopedPhotos.value.length > 0
    ? `${currentIndex.value + 1}/${scopedPhotos.value.length}`
    : '0/0'
)
const allDone = computed(() => scopedPhotos.value.length === 0)

const groupColors: Record<string, { color: string; bg: string }> = {
  C12: { color: '#3B82F6', bg: '#EFF6FF' },
  C25: { color: '#F59E0B', bg: '#FEF3C7' }
}

const mapWithGroups = computed(() => map.value ? hasGroups(map.value) : false)

interface CategoryItem {
  key: string
  label: string
  slot?: Slot
  isGroup?: boolean
  color?: string
  bg?: string
}

const topCategories = computed<CategoryItem[]>(() => {
  if (!map.value) return []
  const result: CategoryItem[] = []

  const general = map.value.slots.find(s => s.id === 'general')
  if (general) result.push({ key: 'general', label: t('triage.general'), slot: general })

  const trash = getTrashSlot(map.value)
  if (trash) result.push({ key: 'trash', label: t('triage.trash'), slot: trash })

  if (mapWithGroups.value) {
    for (const group of getGroups(map.value)) {
      const colors = groupColors[group] ?? { color: '#8B5CF6', bg: '#F3E8FF' }
      result.push({ key: group, label: group, isGroup: true, ...colors })
    }
  }

  return result
})

const subSlots = computed(() => {
  if (!map.value) return []
  if (mapWithGroups.value) {
    if (!activeGroup.value) return []
    return getSlotsForGroup(map.value, activeGroup.value)
  }
  return getClassifiableSlots(map.value).filter(s => !s.isTrash && s.id !== 'general')
})

const activeGroupColor = computed(() => {
  if (!activeGroup.value) return null
  return groupColors[activeGroup.value]?.color ?? '#8B5CF6'
})

function slotCount(slotId: string): number {
  if (!project.value) return 0
  return project.value.photos.filter(p => p.slot === slotId).length
}

const lastClassified = ref('')

function classifyTo(slot: Slot, label: string) {
  if (busy.value || !project.value || !currentPhoto.value) return

  const photoId = currentPhoto.value.id

  lastClassified.value = slot.id
  navigator.vibrate?.(8)

  const fromSlot = movePhoto(project.value!, photoId, slot.id)
  undoPush({ type: 'move', photoId, fromSlot, toSlot: slot.id })
  touchProject(project.value!)

  if (currentIndex.value >= scopedPhotos.value.length) {
    currentIndex.value = Math.max(0, scopedPhotos.value.length - 1)
  }
  slideDir.value = 'next'

  setTimeout(() => { lastClassified.value = '' }, 300)
}

function selectCategory(cat: CategoryItem) {
  if (busy.value) return
  if (cat.isGroup) {
    activeGroup.value = activeGroup.value === cat.key ? null : cat.key
    return
  }
  if (cat.slot) classifyTo(cat.slot, cat.label)
}

function selectSub(slot: Slot) {
  if (busy.value) return
  classifyTo(slot, slot.folder)
}

function onTrash() {
  if (!map.value) return
  const trash = getTrashSlot(map.value)
  if (trash) classifyTo(trash, t('triage.trash'))
}

function onUndo() {
  if (busy.value) return
  const entry = undoPop()
  if (!entry || !project.value) return

  if (entry.type === 'move') {
    movePhoto(project.value, entry.photoId, entry.fromSlot)
    touchProject(project.value)
    const idx = scopedPhotos.value.findIndex(p => p.id === entry.photoId)
    if (idx >= 0) currentIndex.value = idx
    slideDir.value = 'prev'
  } else if (entry.type === 'image' && entry.prevFull && entry.prevThumb) {
    updateBlobs(entry.photoId, project.value.id, entry.prevFull, entry.prevThumb)
    const photo = project.value.photos.find(p => p.id === entry.photoId)
    if (photo && entry.prevFull) {
      createImageBitmap(entry.prevFull).then(bm => {
        photo.w = bm.width
        photo.h = bm.height
        bm.close()
      })
    }
    touchProject(project.value)
  }
}

async function onRotate() {
  if (busy.value || !currentPhoto.value || !project.value) return
  busy.value = true

  const photo = currentPhoto.value
  const blobRecord = await db.getBlob(photo.id)
  if (!blobRecord) { busy.value = false; return }

  const rotated = await rotate90cw(blobRecord.full)
  const thumb = await generateThumb(rotated)

  undoPush({
    type: 'image',
    photoId: photo.id,
    fromSlot: photo.slot,
    toSlot: photo.slot,
    prevFull: blobRecord.full,
    prevThumb: blobRecord.thumb
  })

  await updateBlobs(photo.id, project.value.id, rotated, thumb)
  const tmp = photo.w
  photo.w = photo.h
  photo.h = tmp
  touchProject(project.value)
  busy.value = false
}

async function onMirror() {
  if (busy.value || !currentPhoto.value || !project.value) return
  busy.value = true

  const photo = currentPhoto.value
  const blobRecord = await db.getBlob(photo.id)
  if (!blobRecord) { busy.value = false; return }

  const mirrored = await mirrorH(blobRecord.full)
  const thumb = await generateThumb(mirrored)

  undoPush({
    type: 'image',
    photoId: photo.id,
    fromSlot: photo.slot,
    toSlot: photo.slot,
    prevFull: blobRecord.full,
    prevThumb: blobRecord.thumb
  })

  await updateBlobs(photo.id, project.value.id, mirrored, thumb)
  touchProject(project.value)
  busy.value = false
}

// --- Swipe navigation ---
let swipe: { startX: number; startY: number; pointerId: number; axis: 'none' | 'x' | 'y' } | null = null
const swipeOffset = ref(0)
const swipeTrans = ref(false)
const swipeY = ref(0)
const swipeYTrans = ref(false)
const dismissOpacity = computed(() => swipeY.value > 0 ? Math.max(0, 1 - swipeY.value / 300) : 1)

function onImagePointerDown(e: PointerEvent) {
  if (busy.value || allDone.value) return
  swipe = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, axis: 'none' }
  swipeOffset.value = 0
  swipeTrans.value = false
  swipeY.value = 0
  swipeYTrans.value = false
}

function onImagePointerMove(e: PointerEvent) {
  if (!swipe || e.pointerId !== swipe.pointerId) return
  const dx = e.clientX - swipe.startX
  const dy = e.clientY - swipe.startY

  if (swipe.axis === 'none') {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    swipe.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
  }

  e.preventDefault()

  if (swipe.axis === 'x') {
    swipeOffset.value = dx
  } else {
    swipeY.value = Math.max(0, dy)
  }
}

function onImagePointerUp(e: PointerEvent) {
  if (!swipe || e.pointerId !== swipe.pointerId) return
  const dx = e.clientX - swipe.startX
  const dy = e.clientY - swipe.startY
  const axis = swipe.axis
  swipe = null

  if (axis === 'x') {
    const threshold = 60
    if (Math.abs(dx) >= threshold) {
      if (dx < 0 && currentIndex.value < scopedPhotos.value.length - 1) {
        slideDir.value = 'next'
        currentIndex.value++
      } else if (dx > 0 && currentIndex.value > 0) {
        slideDir.value = 'prev'
        currentIndex.value--
      }
    }
    swipeTrans.value = true
    swipeOffset.value = 0
    setTimeout(() => { swipeTrans.value = false }, 200)
  } else if (axis === 'y') {
    if (dy > 120) {
      close()
      return
    }
    swipeYTrans.value = true
    swipeY.value = 0
    setTimeout(() => { swipeYTrans.value = false }, 200)
  }
}

function onImagePointerCancel() {
  swipe = null
  swipeTrans.value = true
  swipeOffset.value = 0
  swipeYTrans.value = true
  swipeY.value = 0
  setTimeout(() => { swipeTrans.value = false; swipeYTrans.value = false }, 200)
}

const moveTargetSlots = computed(() => {
  if (!map.value) return []
  return getClassifiableSlots(map.value).filter(s => {
    if (!currentPhoto.value) return false
    return s.id !== currentPhoto.value.slot
  })
})

function openMoveOverlay() {
  if (!isReviewMode.value || allDone.value) return
  showMoveOverlay.value = true
}

function moveToSlot(slot: Slot) {
  if (!project.value || !currentPhoto.value) return
  const photoId = currentPhoto.value.id
  const fromSlot = movePhoto(project.value, photoId, slot.id)
  undoPush({ type: 'move', photoId, fromSlot, toSlot: slot.id })
  touchProject(project.value)
  showMoveOverlay.value = false

  if (currentIndex.value >= scopedPhotos.value.length) {
    currentIndex.value = Math.max(0, scopedPhotos.value.length - 1)
  }
}

function close() {
  const fallback = `/projects/${projectId.value}`
  if (window.history.state?.back) {
    router.back()
  } else {
    router.replace(fallback)
  }
}

function goToReview() {
  router.replace(`/projects/${projectId.value}/review`)
}
</script>

<template>
  <div class="viewer-page">

    <div class="viewer-toolbar">
      <button class="vt-btn" aria-label="Fechar" @click="close">
        <i class="pi pi-times"></i>
      </button>
      <div class="vt-right">
        <button class="vt-btn" :class="{ 'vt-btn-disabled': !canUndo }" aria-label="Desfazer" @click="onUndo">
          <i class="pi pi-undo"></i>
        </button>
        <button class="vt-btn" :class="{ 'vt-btn-disabled': allDone }" aria-label="Espelhar" @click="onMirror">
          <i class="pi pi-arrows-h"></i>
        </button>
        <button class="vt-btn" :class="{ 'vt-btn-disabled': allDone }" aria-label="Rodar" @click="onRotate">
          <i class="pi pi-refresh"></i>
        </button>
        <button v-if="isReviewMode" class="vt-btn" :class="{ 'vt-btn-disabled': allDone }" aria-label="Mover para" @click="openMoveOverlay">
          <i class="pi pi-folder-open"></i>
        </button>
        <button class="vt-btn vt-btn-danger" :class="{ 'vt-btn-disabled': allDone }" aria-label="Lixeira" @click="onTrash">
          <i class="pi pi-trash"></i>
        </button>
        <span v-if="activeGroup" class="vt-group" :style="{ color: activeGroupColor, background: activeGroupColor + '1a' }">
          {{ activeGroup }}
        </span>
        <span class="vt-counter">{{ counter }}</span>
      </div>
    </div>

    <template v-if="allDone && isReviewMode">
      <div class="done-area">
        <span class="done-icon">
          <i class="pi pi-check"></i>
        </span>
        <h3 class="done-title">{{ t('triage.slotEmpty.title') }}</h3>
        <p class="done-text">{{ t('triage.slotEmpty.text') }}</p>
        <button class="done-btn" @click="close">
          <i class="pi pi-arrow-left"></i>
          <span>{{ t('triage.slotEmpty.back') }}</span>
        </button>
        <button v-if="canUndo" class="done-undo" @click="onUndo">
          <i class="pi pi-undo"></i>
          <span>{{ t('triage.done.undoLast') }}</span>
        </button>
      </div>
    </template>

    <template v-else-if="allDone && stats.total > 0">
      <div class="done-area">
        <span class="done-icon">
          <i class="pi pi-check"></i>
        </span>
        <h3 class="done-title">{{ t('triage.done.title') }}</h3>
        <p class="done-text">{{ t('triage.done.text', { sorted: stats.sorted, trashed: stats.trashed }) }}</p>
        <div class="done-actions">
          <button class="done-btn done-btn-primary" @click="goToReview">
            <i class="pi pi-th-large"></i>
            <span>{{ t('triage.done.review') }}</span>
          </button>
          <button class="done-btn" @click="close">
            <i class="pi pi-arrow-left"></i>
            <span>{{ t('triage.done.back') }}</span>
          </button>
        </div>
        <button v-if="canUndo" class="done-undo" @click="onUndo">
          <i class="pi pi-undo"></i>
          <span>{{ t('triage.done.undoLast') }}</span>
        </button>
      </div>
    </template>

    <template v-else-if="allDone">
      <div class="done-area">
        <span class="done-icon done-icon-empty">
          <i class="pi pi-camera"></i>
        </span>
        <h3 class="done-title">{{ t('triage.empty.title') }}</h3>
        <p class="done-text">{{ t('triage.empty.text') }}</p>
        <button class="done-btn" @click="close">
          <i class="pi pi-arrow-left"></i>
          <span>{{ t('triage.done.back') }}</span>
        </button>
      </div>
    </template>

    <template v-else>
      <div
        class="viewer-image-area"
        :style="{ opacity: dismissOpacity }"
        @pointerdown="onImagePointerDown"
        @pointermove="onImagePointerMove"
        @pointerup="onImagePointerUp"
        @pointercancel="onImagePointerCancel"
        style="touch-action: none;"
      >
        <Transition :name="slideDir === 'next' ? 'slide-next' : 'slide-prev'" mode="out-in">
          <div
            class="image-frame"
            :key="currentPhoto?.id"
            :style="{
              transform: `translateX(${swipeOffset}px) translateY(${swipeY}px)`,
              transition: (swipeTrans || swipeYTrans) ? 'transform 0.2s ease' : 'none'
            }"
          >
            <img
              v-if="currentUrl"
              :src="currentUrl"
              class="image-real"
              draggable="false"
            />
          </div>
        </Transition>

      </div>

      <div class="sorting-keyboard">
        <div class="kb-categories">
          <button
            v-for="cat in topCategories"
            :key="cat.key"
            class="kb-cat"
            :class="{
              'kb-cat-active': activeGroup === cat.key,
              'kb-cat-lixo': cat.key === 'trash',
              'kb-cat-done': cat.slot && lastClassified === cat.slot.id
            }"
            :style="activeGroup === cat.key && cat.bg ? { background: cat.bg, borderColor: cat.color, color: cat.color } : {}"
            @click="selectCategory(cat)"
          >
            {{ cat.label }}
          </button>
        </div>

        <div v-if="subSlots.length > 0" class="kb-subs">
          <button
            v-for="slot in subSlots"
            :key="slot.id"
            class="kb-sub"
            :class="{
              'kb-sub-disabled': mapWithGroups && !activeGroup,
              'kb-sub-full': slot.expectedCount !== null && slotCount(slot.id) >= slot.expectedCount,
              'kb-sub-done': lastClassified === slot.id
            }"
            :style="activeGroup && activeGroupColor ? { borderColor: activeGroupColor } : {}"
            @click="selectSub(slot)"
          >
            <span class="kb-sub-label">{{ slot.folder }}</span>
            <span v-if="slot.expectedCount !== null" class="kb-sub-count">{{ slotCount(slot.id) }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Move overlay -->
    <Transition name="modal-fade">
      <div v-if="showMoveOverlay" class="move-backdrop" @click.self="showMoveOverlay = false">
        <div class="move-sheet">
          <div class="move-header">
            <span class="move-title">{{ t('viewer.moveTo') }}</span>
            <button class="move-close" @click="showMoveOverlay = false">
              <i class="pi pi-times"></i>
            </button>
          </div>
          <div class="move-grid">
            <button
              v-for="slot in moveTargetSlots"
              :key="slot.id"
              class="move-slot-btn"
              :class="{ 'move-slot-trash': slot.isTrash }"
              @click="moveToSlot(slot)"
            >
              <span class="move-slot-name">{{ slot.folder }}</span>
              <span class="move-slot-count">{{ project!.photos.filter(p => p.slot === slot.id).length }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.viewer-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: #000;
}

/* --- Toolbar --- */
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(var(--header-height) + var(--safe-area-top));
  padding: 0 var(--spacing-sm);
  padding-top: var(--safe-area-top);
  background: var(--color-bg-primary);
  flex-shrink: 0;
}

.vt-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.vt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 15px;
  -webkit-tap-highlight-color: transparent;
}

.vt-btn:active {
  background: var(--color-border);
}

.vt-btn-danger {
  color: var(--color-error);
}

.vt-btn-disabled {
  opacity: 0.3;
  pointer-events: none;
}

.vt-group {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
}

.vt-counter {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 40px;
  text-align: center;
}

/* --- Image Area --- */
.viewer-image-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  position: relative;
}

.image-frame {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-real {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

/* --- Slide Transitions --- */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-next-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-next-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}

.slide-prev-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-prev-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

/* --- Sorting Keyboard --- */
.sorting-keyboard {
  background: var(--color-bg-secondary);
  padding: var(--spacing-sm) var(--spacing-sm) calc(var(--spacing-sm) + var(--safe-area-bottom));
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.kb-categories {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  gap: var(--spacing-sm);
}

.kb-cat {
  height: 42px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.kb-cat:active {
  background: var(--color-bg-secondary);
}

.kb-cat-done {
  background: #10B981 !important;
  border-color: #10B981 !important;
  color: #fff !important;
  transition: background 0.08s ease, border-color 0.08s ease, color 0.08s ease;
}

.kb-cat-lixo {
  color: var(--color-error);
  border-color: rgba(220, 38, 38, 0.3);
}

.kb-cat-active {
  font-weight: 600;
}

.kb-subs {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--spacing-xs);
}

.kb-sub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 42px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s ease;
  gap: 1px;
}

.kb-sub:active {
  background: var(--color-bg-secondary);
}

.kb-sub-done {
  background: #10B981 !important;
  border-color: #10B981 !important;
  color: #fff !important;
  transition: background 0.08s ease, border-color 0.08s ease, color 0.08s ease;
}

.kb-sub-done .kb-sub-label,
.kb-sub-done .kb-sub-count {
  color: #fff !important;
}

.kb-sub-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.kb-sub-full {
  background: #ECFDF5;
  border-color: #10B981;
  color: #10B981;
}

.kb-sub-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  line-height: 1;
}

.kb-sub-count {
  font-size: 10px;
  color: var(--color-text-secondary);
  line-height: 1;
}

.kb-sub-full .kb-sub-count {
  color: #10B981;
}


/* --- Done Area --- */
.done-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl);
  background: var(--color-bg-primary);
}

.done-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #ECFDF5;
  color: #10B981;
  font-size: 36px;
  margin-bottom: var(--spacing-md);
}

.done-icon-empty {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.done-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-primary);
}

.done-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

.done-actions {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.done-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.done-btn:active {
  background: var(--color-border);
}

.done-btn-primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.done-btn-primary:active {
  opacity: 0.85;
}

.done-undo {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-xs) var(--spacing-md);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.done-undo:active {
  color: var(--color-text-primary);
}

/* --- Move Overlay --- */
.move-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}

.move-sheet {
  width: 100%;
  max-width: 400px;
  max-height: 70vh;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--safe-area-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  overflow-y: auto;
}

.move-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.move-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.move-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-bg-secondary);
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.move-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.move-slot-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--spacing-md) var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.move-slot-btn:active {
  background: var(--color-border);
}

.move-slot-trash {
  border-color: rgba(220, 38, 38, 0.3);
}

.move-slot-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.move-slot-trash .move-slot-name {
  color: var(--color-error);
}

.move-slot-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.modal-fade-enter-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .move-sheet {
  transition: transform 0.25s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-leave-active .move-sheet {
  transition: transform 0.15s ease;
}

.modal-fade-enter-from {
  opacity: 0;
}

.modal-fade-enter-from .move-sheet {
  transform: translateY(100%);
}

.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-leave-to .move-sheet {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .slide-next-enter-active,
  .slide-next-leave-active,
  .slide-prev-enter-active,
  .slide-prev-leave-active {
    transition: none;
  }
}
</style>
