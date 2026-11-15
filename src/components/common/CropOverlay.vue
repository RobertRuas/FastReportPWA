<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '@/composables/useI18n'
import type { CropRect } from '@/services/photoEditor'

const props = defineProps<{ src: string; busy?: boolean }>()
const emit = defineEmits<{
  cancel: []
  apply: [rect: CropRect]
}>()

const { t } = useI18n()

const stage = ref<HTMLElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)

/** Rendered image box, relative to the stage. */
const box = ref({ left: 0, top: 0, width: 0, height: 0 })
/** Crop rect in normalized image coordinates. */
const rect = ref<CropRect>({ x: 0, y: 0, w: 1, h: 1 })

const MIN = 0.08
const HANDLES = ['nw', 'ne', 'sw', 'se'] as const
type Handle = typeof HANDLES[number]
type Mode = Handle | 'move'

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function measure() {
  if (!stage.value || !imgEl.value) return
  const s = stage.value.getBoundingClientRect()
  const i = imgEl.value.getBoundingClientRect()
  box.value = { left: i.left - s.left, top: i.top - s.top, width: i.width, height: i.height }
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measure)
})

onUnmounted(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('orientationchange', measure)
})

const frameStyle = computed(() => ({
  left: `${box.value.left + rect.value.x * box.value.width}px`,
  top: `${box.value.top + rect.value.y * box.value.height}px`,
  width: `${rect.value.w * box.value.width}px`,
  height: `${rect.value.h * box.value.height}px`
}))

const isFull = computed(() => rect.value.w > 0.995 && rect.value.h > 0.995)

let drag: { mode: Mode; startX: number; startY: number; start: CropRect; pointerId: number } | null = null

function onDown(mode: Mode, e: PointerEvent) {
  if (props.busy) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag = { mode, startX: e.clientX, startY: e.clientY, start: { ...rect.value }, pointerId: e.pointerId }
}

function onMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  if (box.value.width === 0 || box.value.height === 0) return
  e.preventDefault()

  const dx = (e.clientX - drag.startX) / box.value.width
  const dy = (e.clientY - drag.startY) / box.value.height
  const s = drag.start

  if (drag.mode === 'move') {
    rect.value = {
      x: clamp(s.x + dx, 0, 1 - s.w),
      y: clamp(s.y + dy, 0, 1 - s.h),
      w: s.w,
      h: s.h
    }
    return
  }

  let x1 = s.x
  let y1 = s.y
  let x2 = s.x + s.w
  let y2 = s.y + s.h

  if (drag.mode[1] === 'w') x1 = clamp(s.x + dx, 0, x2 - MIN)
  if (drag.mode[1] === 'e') x2 = clamp(s.x + s.w + dx, x1 + MIN, 1)
  if (drag.mode[0] === 'n') y1 = clamp(s.y + dy, 0, y2 - MIN)
  if (drag.mode[0] === 's') y2 = clamp(s.y + s.h + dy, y1 + MIN, 1)

  rect.value = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

function onUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  drag = null
}

function reset() {
  rect.value = { x: 0, y: 0, w: 1, h: 1 }
}
</script>

<template>
  <div class="crop-overlay">

    <div class="crop-bar">
      <button class="crop-btn" :aria-label="t('app.cancel')" @click="emit('cancel')">
        <i class="pi pi-times"></i>
      </button>
      <span class="crop-title">{{ t('crop.title') }}</span>
      <div class="crop-bar-right">
        <button class="crop-reset" :disabled="isFull || busy" @click="reset">
          {{ t('crop.reset') }}
        </button>
        <button class="crop-apply" :disabled="isFull || busy" @click="emit('apply', { ...rect })">
          <i :class="busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i>
          <span>{{ t('crop.apply') }}</span>
        </button>
      </div>
    </div>

    <div ref="stage" class="crop-stage">
      <img
        ref="imgEl"
        :src="src"
        class="crop-img"
        draggable="false"
        @load="measure"
      />

      <div
        v-if="box.width > 0"
        class="crop-frame"
        :style="frameStyle"
        @pointerdown="onDown('move', $event)"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <span class="crop-grid"></span>
        <span
          v-for="h in HANDLES"
          :key="h"
          class="crop-handle"
          :class="`crop-handle-${h}`"
          @pointerdown.stop="onDown(h, $event)"
          @pointermove.stop="onMove"
          @pointerup.stop="onUp"
          @pointercancel.stop="onUp"
        ></span>
      </div>
    </div>

    <div class="crop-hint">{{ t('crop.hint') }}</div>

  </div>
</template>

<style scoped>
.crop-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: #000;
}

/* --- Bar --- */
.crop-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: calc(var(--header-height) + var(--safe-area-top));
  padding: 0 var(--spacing-sm);
  padding-top: var(--safe-area-top);
  background: var(--color-bg-primary);
  flex-shrink: 0;
}

.crop-title {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.crop-bar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.crop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  font-size: 15px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.crop-btn:active {
  background: var(--color-border);
}

.crop-reset {
  padding: 0 var(--spacing-sm);
  height: 36px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.crop-apply {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 var(--spacing-md);
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.crop-apply:active {
  opacity: 0.85;
}

.crop-reset:disabled,
.crop-apply:disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* --- Stage --- */
.crop-stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Room for the corner handles, which sit outside the frame */
  padding: 22px;
  overflow: hidden;
  touch-action: none;
}

.crop-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.crop-frame {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  cursor: move;
  touch-action: none;
}

/* Rule-of-thirds guides */
.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.28) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.28) 1px, transparent 1px);
  background-size: 33.333% 33.333%;
  background-position: 0 0;
}

.crop-handle {
  position: absolute;
  width: 32px;
  height: 32px;
  touch-action: none;
}

.crop-handle::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2.5px solid #fff;
}

.crop-handle-nw {
  top: -16px;
  left: -16px;
  cursor: nwse-resize;
}
.crop-handle-nw::after {
  top: 7px;
  left: 7px;
  border-right: none;
  border-bottom: none;
}

.crop-handle-ne {
  top: -16px;
  right: -16px;
  cursor: nesw-resize;
}
.crop-handle-ne::after {
  top: 7px;
  right: 7px;
  border-left: none;
  border-bottom: none;
}

.crop-handle-sw {
  bottom: -16px;
  left: -16px;
  cursor: nesw-resize;
}
.crop-handle-sw::after {
  bottom: 7px;
  left: 7px;
  border-right: none;
  border-top: none;
}

.crop-handle-se {
  bottom: -16px;
  right: -16px;
  cursor: nwse-resize;
}
.crop-handle-se::after {
  bottom: 7px;
  right: 7px;
  border-left: none;
  border-top: none;
}

/* --- Hint --- */
.crop-hint {
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-bottom: calc(var(--spacing-sm) + var(--safe-area-bottom));
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
}
</style>
