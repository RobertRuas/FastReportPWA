<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()

/**
 * Discreet, collapsed-by-default explanation of how a project is structured.
 * Native <details> so it needs no JS and stays accessible.
 */
const steps = computed(() => [
  { key: 'map', icon: 'pi pi-th-large' },
  { key: 'inbox', icon: 'pi pi-inbox' },
  { key: 'triage', icon: 'pi pi-sort-alt' },
  { key: 'review', icon: 'pi pi-images' },
  { key: 'export', icon: 'pi pi-file-export' },
  { key: 'storage', icon: 'pi pi-database' }
].map(s => ({
  ...s,
  label: t(`help.structure.${s.key}`),
  text: t(`help.structure.${s.key}Text`)
})))
</script>

<template>
  <details class="structure-help">
    <summary class="sh-summary">
      <i class="pi pi-info-circle"></i>
      <span>{{ t('help.structure.title') }}</span>
      <i class="pi pi-chevron-down sh-chevron"></i>
    </summary>

    <p class="sh-intro">{{ t('help.structure.intro') }}</p>

    <ol class="sh-steps">
      <li v-for="step in steps" :key="step.key" class="sh-step">
        <i :class="step.icon" class="sh-step-icon"></i>
        <span class="sh-step-body">
          <span class="sh-step-label">{{ step.label }}</span>
          <span class="sh-step-text">{{ step.text }}</span>
        </span>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.structure-help {
  padding-bottom: var(--spacing-sm);
}

.sh-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  list-style: none;
  -webkit-tap-highlight-color: transparent;
}

/* Hide the native disclosure marker (Safari uses ::-webkit-details-marker) */
.sh-summary::-webkit-details-marker {
  display: none;
}

.sh-summary::marker {
  content: '';
}

.sh-summary i {
  font-size: 11px;
}

.sh-chevron {
  margin-left: auto;
  transition: transform 0.15s ease;
}

.structure-help[open] .sh-chevron {
  transform: rotate(180deg);
}

.sh-intro {
  margin-top: var(--spacing-md);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.sh-steps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  padding: 0;
  list-style: none;
}

.sh-step {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.sh-step-icon {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
  opacity: 0.7;
  flex-shrink: 0;
}

.sh-step-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.sh-step-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-primary);
}

.sh-step-text {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .sh-chevron {
    transition: none;
  }
}
</style>
