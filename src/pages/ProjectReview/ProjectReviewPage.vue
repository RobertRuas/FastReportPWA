<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { usePageTitle } from '@/composables/usePageTitle'
import { usePageActions } from '@/composables/usePageActions'
import { useProjectSession } from '@/composables/useProjectSession'
import { usePhotoStore } from '@/composables/usePhotoStore'
import { useProjects } from '@/composables/useProjects'
import { useUndo } from '@/services/undoManager'
import { useI18n } from '@/composables/useI18n'
import { getClassifiableSlots, hasGroups, getGroups, getSlotsForGroup, getSlot as getMapSlot } from '@/services/mapCatalog'
import ProjectTabs from '@/components/common/ProjectTabs.vue'
import type { Slot, Photo } from '@/models/types'

const scrollCache = new Map<string, number>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { setTitle } = usePageTitle()
const { setActions } = usePageActions()
const { project, map, stats, openProject } = useProjectSession()
const { getThumbUrl, movePhoto, clearTrash } = usePhotoStore()
const { touchProject } = useProjects()
const { push: undoPush, pop: undoPop, canUndo, count: undoCount } = useUndo()
const { t } = useI18n()

const projectId = computed(() => route.params.id as string)
const activeFilter = ref<string>('all')

function getScrollContainer(): HTMLElement | null {
  return document.querySelector('.app-content') as HTMLElement | null
}

onMounted(async () => {
  await openProject(projectId.value)
  if (project.value) {
    setTitle(project.value.name)
  }
  await nextTick()
  const el = getScrollContainer()
  const saved = scrollCache.get(projectId.value)
  if (el && saved) {
    requestAnimationFrame(() => { el.scrollTop = saved })
  }
})

onBeforeRouteLeave((to) => {
  const el = getScrollContainer()
  if (el && to.name === 'triage') {
    scrollCache.set(projectId.value, el.scrollTop)
  } else {
    scrollCache.delete(projectId.value)
  }
})

function goToTriage() {
  router.push(`/projects/${projectId.value}/triage`)
}

function openViewer(slotId: string, photoId: string) {
  router.push(`/projects/${projectId.value}/triage?slot=${slotId}&photo=${photoId}`)
}

setActions([
  { icon: 'pi pi-sort-alt', label: 'Triagem', handler: goToTriage }
])

const mapWithGroups = computed(() => map.value ? hasGroups(map.value) : false)
const groups = computed(() => map.value ? getGroups(map.value) : [])

const inboxPhotos = computed(() => {
  if (!project.value) return []
  return project.value.photos.filter(p => p.slot === 'inbox')
})

interface SlotWithPhotos {
  slot: Slot
  photos: Photo[]
}

interface SlotGroup {
  label: string
  slots: SlotWithPhotos[]
}

const slotGroups = computed<SlotGroup[]>(() => {
  if (!map.value || !project.value) return []
  const result: SlotGroup[] = []

  const generalSlot = map.value.slots.find(s => s.id === 'general')
  if (generalSlot) {
    const photos = project.value.photos.filter(p => p.slot === 'general')
    result.push({ label: '', slots: [{ slot: generalSlot, photos }] })
  }

  if (mapWithGroups.value) {
    for (const groupName of groups.value) {
      if (activeFilter.value !== 'all' && activeFilter.value !== groupName) continue
      const groupSlots = getSlotsForGroup(map.value, groupName)
      const slotItems = groupSlots.map(slot => ({
        slot,
        photos: project.value!.photos.filter(p => p.slot === slot.id)
      }))
      if (slotItems.length > 0) result.push({ label: groupName, slots: slotItems })
    }
  } else {
    const classifiable = getClassifiableSlots(map.value).filter(s => !s.isTrash && s.id !== 'general')
    const slotItems = classifiable.map(slot => ({
      slot,
      photos: project.value!.photos.filter(p => p.slot === slot.id)
    }))
    if (slotItems.length > 0) result.push({ label: '', slots: slotItems })
  }

  const trashPhotos = project.value.photos.filter(p => p.slot === 'trash')
  const trashSlot = map.value.slots.find(s => s.isTrash)
  if (trashSlot) {
    result.push({ label: '__trash__', slots: [{ slot: trashSlot, photos: trashPhotos }] })
  }

  return result
})

const trashCount = computed(() => {
  if (!project.value) return 0
  return project.value.photos.filter(p => p.slot === 'trash').length
})

const isEmpty = computed(() => stats.value.sorted === 0 && stats.value.trashed === 0)

const gridCols = computed(() => project.value?.cols ?? 7)
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gridCols.value}, 1fr)`
}))

// --- Inter-slot drag-and-drop ---
const dragPhotoId = ref<string | null>(null)
const dragFromSlot = ref<string | null>(null)
const dropTargetSlot = ref<string | null>(null)

interface DragState {
  photoId: string
  fromSlot: string
  el: HTMLElement
  startX: number
  startY: number
  pointerId: number
  started: boolean
  ghost: HTMLElement | null
}

let dragState: DragState | null = null

function onThumbPointerDown(e: PointerEvent, photoId: string, fromSlot: string) {
  if (e.button !== 0) return
  dragState = {
    photoId,
    fromSlot,
    el: e.currentTarget as HTMLElement,
    startX: e.clientX,
    startY: e.clientY,
    pointerId: e.pointerId,
    started: false,
    ghost: null
  }
}

function onGlobalPointerMove(e: PointerEvent) {
  if (!dragState || e.pointerId !== dragState.pointerId) return

  const dx = Math.abs(e.clientX - dragState.startX)
  const dy = Math.abs(e.clientY - dragState.startY)

  if (!dragState.started) {
    if (dx < 8 && dy < 8) return
    if (dy > dx) { dragState = null; return }
    dragState.started = true
    dragPhotoId.value = dragState.photoId
    dragFromSlot.value = dragState.fromSlot

    const ghost = dragState.el.cloneNode(true) as HTMLElement
    ghost.classList.add('drag-ghost')
    ghost.style.position = 'fixed'
    ghost.style.width = dragState.el.offsetWidth + 'px'
    ghost.style.height = dragState.el.offsetHeight + 'px'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = '1000'
    ghost.style.opacity = '0.85'
    ghost.style.transform = 'scale(1.1)'
    ghost.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
    document.body.appendChild(ghost)
    dragState.ghost = ghost

    try { dragState.el.setPointerCapture(e.pointerId) } catch {}
    navigator.vibrate?.(6)
  }

  if (dragState.ghost) {
    dragState.ghost.style.left = (e.clientX - dragState.el.offsetWidth / 2) + 'px'
    dragState.ghost.style.top = (e.clientY - dragState.el.offsetHeight / 2) + 'px'
  }

  const target = document.elementFromPoint(e.clientX, e.clientY)
  const dropZone = target?.closest('[data-drop-slot]') as HTMLElement | null
  dropTargetSlot.value = dropZone?.dataset.dropSlot ?? null
}

function onGlobalPointerUp(e: PointerEvent) {
  if (!dragState || e.pointerId !== dragState.pointerId) return

  if (dragState.ghost) {
    document.body.removeChild(dragState.ghost)
  }

  if (dragState.started && dropTargetSlot.value && project.value) {
    const toSlot = dropTargetSlot.value
    const fromSlot = dragState.fromSlot
    const photoId = dragState.photoId

    if (toSlot !== fromSlot) {
      movePhoto(project.value, photoId, toSlot)
      undoPush({ type: 'move', photoId, fromSlot, toSlot })
      touchProject(project.value)
    }
  }

  dragPhotoId.value = null
  dragFromSlot.value = null
  dropTargetSlot.value = null
  dragState = null
}

// --- Intra-slot reorder ---
interface ReorderCtx {
  slotId: string
  el: HTMLElement
  index: number
  container: HTMLElement
  wrappers: HTMLElement[]
  centers: number[]
  step: number
  startX: number
  pointerId: number
  targetIndex: number
}

let reorderCtx: ReorderCtx | null = null
let didReorder = false
let pendingReorder: { pointerId: number; startX: number; startY: number; el: HTMLElement; index: number; slotId: string } | null = null

function onReorderPointerDown(e: PointerEvent, slotId: string, index: number) {
  didReorder = false
  pendingReorder = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    el: e.currentTarget as HTMLElement,
    index,
    slotId
  }
}

function onReorderPointerMove(e: PointerEvent) {
  if (pendingReorder && !reorderCtx) {
    const dx = Math.abs(e.clientX - pendingReorder.startX)
    const dy = Math.abs(e.clientY - pendingReorder.startY)
    if (dy > 6) { pendingReorder = null; return }
    if (dx < 6) return

    const el = pendingReorder.el
    try { el.setPointerCapture(pendingReorder.pointerId) } catch { pendingReorder = null; return }

    const container = el.parentElement!
    const wrappers = Array.from(container.querySelectorAll('.photo-thumb-wrap')) as HTMLElement[]
    const gap = parseFloat(getComputedStyle(container).gap) || 0
    const centers = wrappers.map(w => {
      const r = w.getBoundingClientRect()
      return r.left + r.width / 2
    })

    reorderCtx = {
      slotId: pendingReorder.slotId,
      el,
      index: pendingReorder.index,
      container,
      wrappers,
      centers,
      step: wrappers[0].offsetWidth + gap,
      startX: e.clientX,
      pointerId: pendingReorder.pointerId,
      targetIndex: pendingReorder.index
    }

    didReorder = true
    el.classList.add('is-dragging')
    pendingReorder = null
  }

  if (!reorderCtx) return
  e.preventDefault()

  const dx = e.clientX - reorderCtx.startX
  reorderCtx.el.style.transform = `translateX(${dx}px) scale(1.06)`
  reorderCtx.el.style.zIndex = '10'

  const draggedCenter = reorderCtx.centers[reorderCtx.index] + dx
  let closest = reorderCtx.index
  let minDist = Infinity
  for (let i = 0; i < reorderCtx.centers.length; i++) {
    const dist = Math.abs(draggedCenter - reorderCtx.centers[i])
    if (dist < minDist) { minDist = dist; closest = i }
  }

  if (closest !== reorderCtx.targetIndex) {
    reorderCtx.targetIndex = closest
    const from = reorderCtx.index
    const to = closest

    reorderCtx.wrappers.forEach((el, i) => {
      if (i === from) return
      el.style.transition = 'transform 0.15s ease'
      if (from < to && i > from && i <= to) {
        el.style.transform = `translateX(${-reorderCtx!.step}px)`
      } else if (from > to && i >= to && i < from) {
        el.style.transform = `translateX(${reorderCtx!.step}px)`
      } else {
        el.style.transform = ''
      }
    })
  }
}

function onReorderPointerUp() {
  if (reorderCtx && project.value) {
    const from = reorderCtx.index
    const to = reorderCtx.targetIndex

    reorderCtx.wrappers.forEach(el => {
      el.style.transform = ''
      el.style.transition = ''
      el.style.zIndex = ''
      el.classList.remove('is-dragging')
    })

    if (from !== to) {
      const slotPhotos = project.value.photos.filter(p => p.slot === reorderCtx!.slotId)
      const allPhotos = project.value.photos
      const photoToMove = slotPhotos[from]
      const photoAtTarget = slotPhotos[to]

      if (photoToMove && photoAtTarget) {
        const fromGlobal = allPhotos.indexOf(photoToMove)
        const toGlobal = allPhotos.indexOf(photoAtTarget)
        if (fromGlobal >= 0 && toGlobal >= 0) {
          allPhotos.splice(fromGlobal, 1)
          const newTarget = allPhotos.indexOf(photoAtTarget)
          allPhotos.splice(from < to ? newTarget + 1 : newTarget, 0, photoToMove)
          touchProject(project.value)
        }
      }
    }
  }

  reorderCtx = null
  pendingReorder = null
}

// --- Undo ---
function onUndo() {
  const entry = undoPop()
  if (!entry || !project.value) return

  if (entry.type === 'move') {
    movePhoto(project.value, entry.photoId, entry.fromSlot)
    touchProject(project.value)
  }
}

// --- Clear trash ---
function onClearTrash() {
  if (!project.value || trashCount.value === 0) return
  confirm.require({
    message: t('review.clearTrash.message', { count: trashCount.value }),
    header: t('review.clearTrash.title'),
    icon: 'pi pi-trash',
    acceptLabel: t('review.clearTrash.accept'),
    rejectLabel: t('app.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      await clearTrash(project.value!)
      touchProject(project.value!)
      toast.add({ severity: 'success', summary: t('review.clearTrash.success'), life: 2000 })
    }
  })
}

function isSlotFull(slot: Slot, count: number): boolean {
  return slot.expectedCount !== null && count >= slot.expectedCount
}
</script>

<template>
  <div
    v-if="project"
    class="review-page"
    @pointermove="onGlobalPointerMove"
    @pointerup="onGlobalPointerUp"
    @pointercancel="onGlobalPointerUp"
  >

    <div v-if="isEmpty" class="empty-state">
      <span class="empty-icon">
        <i class="pi pi-th-large"></i>
      </span>
      <h3 class="empty-title">{{ t('review.empty.title') }}</h3>
      <p class="empty-text">{{ t('review.empty.text') }}</p>
      <button class="empty-action" @click="goToTriage">
        <i class="pi pi-sort-alt"></i>
        <span>{{ t('review.empty.action') }}</span>
      </button>
    </div>

    <template v-else>
      <!-- Group filter -->
      <div v-if="mapWithGroups" class="group-filter">
        <button
          class="filter-btn"
          :class="{ 'filter-btn-active': activeFilter === 'all' }"
          @click="activeFilter = 'all'"
        >{{ t('review.all') }}</button>
        <button
          v-for="g in groups"
          :key="g"
          class="filter-btn"
          :class="{ 'filter-btn-active': activeFilter === g }"
          @click="activeFilter = activeFilter === g ? 'all' : g"
        >{{ g }}</button>
      </div>

      <!-- Inbox strip -->
      <div
        v-if="inboxPhotos.length > 0"
        class="inbox-strip"
        :data-drop-slot="'inbox'"
        :class="{ 'inbox-strip-drop': dropTargetSlot === 'inbox' }"
      >
        <div class="inbox-strip-header">
          <span class="inbox-strip-label">{{ t('review.inbox') }}</span>
          <span class="inbox-strip-count">{{ inboxPhotos.length }}</span>
        </div>
        <div class="inbox-strip-scroll">
          <div
            v-for="photo in inboxPhotos"
            :key="photo.id"
            class="inbox-thumb-wrap"
            :class="{ 'is-drag-source': dragPhotoId === photo.id }"
            @pointerdown="onThumbPointerDown($event, photo.id, 'inbox')"
            @click="openViewer('inbox', photo.id)"
          >
            <div class="inbox-thumb">
              <img
                v-if="getThumbUrl(photo.id)"
                :src="getThumbUrl(photo.id)"
                class="thumb-img"
                loading="lazy"
                draggable="false"
              />
              <div v-else class="thumb-placeholder">
                <i class="pi pi-image"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Slot groups -->
      <div class="groups-area">
        <div v-for="group in slotGroups" :key="group.label" class="slot-group">
          <div v-if="group.label && group.label !== '__trash__'" class="group-header">
            <span class="group-label">{{ group.label }}</span>
          </div>
          <div v-if="group.label === '__trash__'" class="group-header group-header-trash">
            <span class="group-label">{{ t('review.trash') }}</span>
            <button
              v-if="trashCount > 0"
              class="clear-trash-btn"
              @click="onClearTrash"
            >{{ t('review.clearTrash') }}</button>
          </div>

          <div v-for="slotItem in group.slots" :key="slotItem.slot.id" class="slot-section">
            <div
              class="slot-header"
              :class="{
                'slot-header-general': slotItem.slot.id === 'general',
                'slot-header-full': isSlotFull(slotItem.slot, slotItem.photos.length)
              }"
            >
              <span class="slot-name">{{ slotItem.slot.folder }}</span>
              <span class="slot-line"></span>
              <span class="slot-count">
                {{ slotItem.photos.length }}
                <template v-if="slotItem.slot.expectedCount !== null">/ {{ slotItem.slot.expectedCount }}</template>
              </span>
              <i v-if="isSlotFull(slotItem.slot, slotItem.photos.length)" class="pi pi-check slot-check"></i>
            </div>
            <div
              class="photo-grid"
              :style="gridStyle"
              :data-drop-slot="slotItem.slot.id"
              :class="{ 'photo-grid-drop': dropTargetSlot === slotItem.slot.id }"
            >
              <template v-if="slotItem.photos.length > 0">
                <div
                  v-for="(photo, idx) in slotItem.photos"
                  :key="photo.id"
                  class="photo-thumb-wrap"
                  :class="{
                    'is-drag-source': dragPhotoId === photo.id,
                    'is-trash-photo': slotItem.slot.isTrash
                  }"
                  @pointerdown="onReorderPointerDown($event, slotItem.slot.id, idx); onThumbPointerDown($event, photo.id, slotItem.slot.id)"
                  @pointermove="onReorderPointerMove"
                  @pointerup="onReorderPointerUp"
                  @pointercancel="onReorderPointerUp"
                  @click="!didReorder && openViewer(slotItem.slot.id, photo.id)"
                >
                  <div class="photo-thumb">
                    <img
                      v-if="getThumbUrl(photo.id)"
                      :src="getThumbUrl(photo.id)"
                      class="thumb-img"
                      loading="lazy"
                      draggable="false"
                    />
                    <div v-else class="thumb-placeholder">
                      <i class="pi pi-image"></i>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="drop-zone-empty">
                <i class="pi pi-arrow-down"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Undo footer -->
      <div v-if="canUndo" class="undo-footer">
        <button class="undo-btn" @click="onUndo">
          <i class="pi pi-undo"></i>
          <span>{{ t('app.undo') }}</span>
          <span class="undo-count">{{ undoCount }}</span>
        </button>
      </div>
    </template>

    <ProjectTabs :projectId="projectId" :inboxCount="stats.pending" :reviewCount="stats.sorted" />
  </div>

  <div v-else class="not-found">
    <p>{{ t('project.notFound') }}</p>
  </div>
</template>

<style scoped>
.review-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding-bottom: 64px;
}

/* --- Group filter --- */
.group-filter {
  display: flex;
  gap: var(--spacing-xs);
}

.filter-btn {
  flex: 1;
  height: 34px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.filter-btn:active {
  background: var(--color-bg-secondary);
}

.filter-btn-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.filter-btn-active:active {
  opacity: 0.85;
}

/* --- Inbox strip --- */
.inbox-strip {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.inbox-strip-drop {
  border-color: #10B981;
  background: #F0FDF4;
}

.inbox-strip-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.inbox-strip-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.inbox-strip-count {
  font-size: 10px;
  font-weight: 600;
  color: #D97706;
  background: #FEF3C7;
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}

.inbox-strip-scroll {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.inbox-strip-scroll::-webkit-scrollbar {
  display: none;
}

.inbox-thumb-wrap {
  flex-shrink: 0;
  cursor: grab;
  touch-action: pan-x;
}

.inbox-thumb-wrap.is-drag-source {
  opacity: 0.3;
}

.inbox-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-primary);
}

/* --- Slot groups --- */
.groups-area {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.slot-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.group-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.group-header-trash {
  color: var(--color-error);
}

.group-header-trash::after {
  background: rgba(220, 38, 38, 0.2);
}

.group-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.group-header-trash .group-label {
  color: var(--color-error);
}

.clear-trash-btn {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-error);
  background: transparent;
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.clear-trash-btn:active {
  background: rgba(220, 38, 38, 0.08);
}

.slot-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.slot-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.slot-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.slot-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.slot-header-general .slot-name {
  color: var(--color-accent);
}

.slot-header-general .slot-line {
  background: var(--color-accent);
  opacity: 0.3;
}

.slot-header-general .slot-count {
  color: var(--color-accent);
  opacity: 0.6;
}

.slot-header-full .slot-name {
  color: #10B981;
}

.slot-header-full .slot-line {
  background: #10B981;
  opacity: 0.3;
}

.slot-check {
  font-size: 10px;
  color: #10B981;
}

.slot-count {
  font-size: 10px;
  color: var(--color-text-secondary);
  opacity: 0.7;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.photo-grid {
  display: grid;
  gap: 3px;
  position: relative;
  min-height: 28px;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

.photo-grid-drop {
  background: #F0FDF4;
  outline: 2px dashed #10B981;
  outline-offset: 2px;
}

.photo-thumb-wrap {
  position: relative;
  touch-action: pan-y;
  cursor: grab;
}

.photo-thumb-wrap.is-dragging {
  cursor: grabbing;
  touch-action: none;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
}

.photo-thumb-wrap.is-drag-source {
  opacity: 0.3;
}

.photo-thumb-wrap.is-trash-photo {
  opacity: 0.5;
}

.photo-thumb {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-secondary);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 14px;
  opacity: 0.5;
}

.drop-zone-empty {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  opacity: 0.4;
}

.photo-grid-drop .drop-zone-empty {
  border-color: #10B981;
  color: #10B981;
  opacity: 0.8;
  background: #F0FDF4;
}

/* --- Undo footer --- */
.undo-footer {
  position: fixed;
  bottom: calc(48px + var(--safe-area-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toolbar);
}

.undo-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.undo-btn:active {
  opacity: 0.85;
}

.undo-count {
  font-size: 10px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

/* --- Empty State --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 28px;
}

.empty-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.empty-action {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  margin-top: var(--spacing-sm);
}

.empty-action:active {
  opacity: 0.85;
}

/* --- Not Found --- */
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
</style>
