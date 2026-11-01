<script setup lang="ts">
import { ref, computed } from 'vue'

export interface SwipeAction {
  icon: string
  label: string
  color: string
  handler: () => void
}

const props = defineProps<{
  actions: SwipeAction[]
}>()

const ACTION_WIDTH = 56
const SNAP_THRESHOLD = 30

const openWidth = computed(() => ACTION_WIDTH * props.actions.length)
const offsetX = ref(0)
const isOpen = ref(false)

let startX = 0
let startY = 0
let dragging = false
let locked = false

function onTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  dragging = false
  locked = false
}

function onTouchMove(e: TouchEvent) {
  const dx = e.touches[0].clientX - startX
  const dy = e.touches[0].clientY - startY

  if (!dragging && !locked) {
    if (Math.abs(dy) > Math.abs(dx)) {
      locked = true
      return
    }
    if (Math.abs(dx) > 8) dragging = true
  }

  if (locked || !dragging) return

  e.preventDefault()
  const base = isOpen.value ? -openWidth.value : 0
  const raw = base + dx
  offsetX.value = Math.min(0, Math.max(-openWidth.value - 20, raw))
}

function onTouchEnd() {
  if (!dragging) {
    if (isOpen.value) {
      close()
    }
    return
  }
  dragging = false

  if (isOpen.value) {
    if (offsetX.value > -openWidth.value + SNAP_THRESHOLD) {
      close()
    } else {
      offsetX.value = -openWidth.value
    }
  } else {
    if (offsetX.value < -SNAP_THRESHOLD) {
      offsetX.value = -openWidth.value
      isOpen.value = true
    } else {
      offsetX.value = 0
    }
  }
}

function close() {
  offsetX.value = 0
  isOpen.value = false
}

function onActionClick(action: SwipeAction) {
  close()
  action.handler()
}

defineExpose({ close })
</script>

<template>
  <div class="swipe-container">
    <div
      class="swipe-content"
      :style="{ transform: `translateX(${offsetX}px)` }"
      :class="{ 'swipe-animated': !dragging }"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <slot />
    </div>
    <div class="swipe-actions" :style="{ width: `${openWidth}px` }">
      <button
        v-for="(action, i) in actions"
        :key="i"
        class="swipe-action-btn"
        :style="{ background: action.color, width: `${ACTION_WIDTH}px` }"
        @click="onActionClick(action)"
        :aria-label="action.label"
      >
        <i :class="action.icon"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.swipe-container {
  position: relative;
  overflow: hidden;
}

.swipe-content {
  position: relative;
  z-index: 1;
  background: var(--color-bg-secondary);
}

.swipe-animated {
  transition: transform 0.25s ease;
}

.swipe-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  z-index: 0;
}

.swipe-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 100%;
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.swipe-action-btn:active {
  opacity: 0.8;
}
</style>
