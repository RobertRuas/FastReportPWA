<script setup lang="ts">
import { ref } from 'vue'

export interface SwipeAction {
  icon: string
  label: string
  color: string
  handler: () => void
}

defineProps<{
  actions: SwipeAction[]
}>()

const container = ref<HTMLElement>()
const offsetX = ref(0)
const isOpen = ref(false)
const THRESHOLD = 60
const ACTION_WIDTH = 64

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

  if (locked) return
  if (!dragging) return

  e.preventDefault()
  const base = isOpen.value ? -THRESHOLD : 0
  const raw = base + dx
  offsetX.value = Math.min(0, Math.max(-THRESHOLD * 2, raw))
}

function onTouchEnd() {
  if (!dragging) return
  if (offsetX.value < -THRESHOLD / 2) {
    offsetX.value = -THRESHOLD
    isOpen.value = true
  } else {
    offsetX.value = 0
    isOpen.value = false
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
</script>

<template>
  <div class="swipe-container" ref="container">
    <div
      class="swipe-content"
      :style="{ transform: `translateX(${offsetX}px)` }"
      :class="{ 'swipe-content-animated': !dragging }"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <slot />
    </div>
    <div class="swipe-actions" :style="{ width: `${ACTION_WIDTH * actions.length}px` }">
      <button
        v-for="(action, i) in actions"
        :key="i"
        class="swipe-action-btn"
        :style="{ background: action.color, width: `${ACTION_WIDTH}px` }"
        @click="onActionClick(action)"
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

.swipe-content-animated {
  transition: transform 0.2s ease;
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
  align-items: center;
  justify-content: center;
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
