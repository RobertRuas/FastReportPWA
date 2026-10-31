<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { PageAction } from '@/app/router'
import { useSaveStatus } from '@/composables/useSaveStatus'

defineProps<{
  title: string
  actions?: PageAction[]
}>()

const router = useRouter()
const { isSaving, hasSaved, hasError, savedTimeAgo, errorInfo, clearError } = useSaveStatus()

const showPopup = ref(false)
let popupTimer: ReturnType<typeof setTimeout> | null = null

function onIndicatorClick() {
  if (hasError.value) {
    clearError()
    showPopup.value = false
    return
  }
  showPopup.value = true
  if (popupTimer) clearTimeout(popupTimer)
  popupTimer = setTimeout(() => { showPopup.value = false }, 3000)
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-left">
      <h1 class="app-header-title">{{ title }}</h1>
      <button
        v-if="isSaving || hasSaved || hasError"
        class="save-indicator"
        :class="{
          'save-indicator-saving': isSaving,
          'save-indicator-saved': !isSaving && hasSaved && !hasError,
          'save-indicator-error': hasError,
          'save-indicator-pulse': hasError
        }"
        @click="onIndicatorClick"
      >
        <i v-if="isSaving" class="pi pi-spin pi-spinner"></i>
        <i v-else-if="hasError" class="pi pi-exclamation-circle"></i>
        <i v-else class="pi pi-check"></i>
      </button>
    </div>
    <div class="app-header-actions">
      <button
        v-for="(action, index) in actions"
        :key="index"
        class="header-action"
        :aria-label="action.label"
        :title="action.label"
        @click="action.handler?.()"
      >
        <i :class="action.icon"></i>
      </button>
      <button class="header-action" aria-label="Definições" title="Definições" @click="router.push('/settings')">
        <i class="pi pi-cog"></i>
      </button>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="popup-fade">
      <div v-if="showPopup && !hasError" class="save-popup save-popup-ok" @click="showPopup = false">
        <i class="pi pi-check-circle popup-icon popup-icon-ok"></i>
        <div class="popup-text">
          <span class="popup-title">Tudo salvo no dispositivo</span>
          <span class="popup-detail">Fotos e dados guardados localmente.</span>
          <span v-if="savedTimeAgo" class="popup-time">às {{ savedTimeAgo }}</span>
        </div>
      </div>
      <div v-else-if="showPopup && hasError" class="save-popup save-popup-error" @click="onIndicatorClick">
        <i class="pi pi-exclamation-triangle popup-icon popup-icon-error"></i>
        <div class="popup-text">
          <span class="popup-title">Não foi possível salvar</span>
          <span class="popup-detail">Verifique o espaço disponível no dispositivo.</span>
          <span v-if="errorInfo.time" class="popup-time">às {{ errorInfo.time }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  min-height: calc(var(--header-height) + var(--safe-area-top));
  padding: 0 var(--spacing-lg);
  padding-top: var(--safe-area-top);
  padding-bottom: var(--spacing-sm);
  background: var(--color-header-bg);
  z-index: var(--z-header);
  flex-shrink: 0;
}

.app-header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.app-header-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-header-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* --- Save Indicator --- */
.save-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  border-radius: 50%;
}

.save-indicator:active {
  background: rgba(255, 255, 255, 0.1);
}

.save-indicator-saving {
  color: rgba(255, 255, 255, 0.5);
}

.save-indicator-saved {
  color: #10B981;
}

.save-indicator-error {
  color: #EF4444;
}

.save-indicator-pulse {
  animation: error-pulse 1.2s ease-in-out infinite;
}

@keyframes error-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

@media (prefers-reduced-motion: reduce) {
  .save-indicator-pulse {
    animation: none;
  }
}

/* --- Actions --- */
.app-header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.header-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  margin-bottom: calc(-1 * var(--spacing-sm));
  border: none;
  background: transparent;
  color: var(--color-header-text);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 20px;
  -webkit-tap-highlight-color: transparent;
  opacity: 0.85;
}

.header-action:active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}
</style>

<style>
/* --- Save Popup (teleported) --- */
.save-popup {
  position: fixed;
  top: calc(var(--safe-area-top) + var(--header-height) + 8px);
  left: var(--spacing-lg);
  right: var(--spacing-lg);
  max-width: 300px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  z-index: var(--z-toast);
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.save-popup-ok {
  background: var(--color-bg-primary);
  border: 1px solid #10B981;
}

.save-popup-error {
  background: var(--color-bg-primary);
  border: 1px solid #EF4444;
}

.popup-icon {
  font-size: 14px;
  margin-top: 2px;
  flex-shrink: 0;
}

.popup-icon-ok {
  color: #10B981;
}

.popup-icon-error {
  color: #EF4444;
}

.popup-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.popup-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-primary);
}

.popup-detail {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.popup-time {
  font-size: 10px;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.popup-fade-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popup-fade-leave-active {
  transition: opacity 0.1s ease;
}

.popup-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.popup-fade-leave-to {
  opacity: 0;
}
</style>
