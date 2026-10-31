<script setup lang="ts">
import { useNavigation } from '@/composables/useNavigation'
import type { PageAction } from '@/app/router'

defineProps<{
  actions?: PageAction[]
}>()

const { goBack } = useNavigation()
</script>

<template>
  <div class="page-toolbar">
    <button class="toolbar-action" aria-label="Voltar" title="Voltar" @click="goBack">
      <i class="pi pi-arrow-left"></i>
    </button>
    <div class="toolbar-actions">
      <button
        v-for="(action, index) in actions"
        :key="index"
        class="toolbar-action"
        :aria-label="action.label"
        :title="action.label"
        @click="action.handler?.()"
      >
        <i :class="action.icon"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--toolbar-height);
  padding: 0 var(--spacing-sm);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  z-index: var(--z-toolbar);
  flex-shrink: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.toolbar-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  -webkit-tap-highlight-color: transparent;
}

.toolbar-action:active {
  background: var(--color-bg-secondary);
}
</style>
