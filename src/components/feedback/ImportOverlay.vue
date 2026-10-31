<script setup lang="ts">
import { usePhotoImport } from '@/composables/usePhotoImport'
import ProgressBar from 'primevue/progressbar'

const { importing, progress, totalFiles, processedFiles, currentFileName } = usePhotoImport()
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="importing" class="import-overlay">
        <div class="import-card">
          <div class="import-icon-wrap">
            <i class="pi pi-images import-icon"></i>
            <div class="import-spinner"></div>
          </div>

          <div class="import-info">
            <span class="import-title">A importar fotos</span>
            <span class="import-count">{{ processedFiles }} / {{ totalFiles }}</span>
          </div>

          <ProgressBar :value="progress" :showValue="false" class="import-bar" />

          <span class="import-file">{{ currentFileName }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.import-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 1000);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.import-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl) var(--spacing-xl) var(--spacing-lg);
  width: min(300px, 85vw);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.import-icon-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.import-icon {
  font-size: 28px;
  color: #3B82F6;
  z-index: 1;
}

.import-spinner {
  position: absolute;
  inset: 0;
  border: 3px solid var(--color-border);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.import-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.import-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.import-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.import-bar {
  width: 100%;
  height: 6px;
}

.import-bar :deep(.p-progressbar-value) {
  background: #3B82F6;
  transition: width 0.3s ease;
}

.import-file {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .import-spinner {
    animation: none;
    border-top-color: #3B82F6;
  }
}
</style>
