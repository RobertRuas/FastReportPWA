<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { latestPatchNote } from '@/data/patchNotes'

const STORAGE_KEY = 'fr_last_patch_version'

const { t, lang } = useI18n()
const open = ref(false)
const note = latestPatchNote()

const items = computed(() => {
  if (!note) return []
  return lang.value === 'pt' ? note.items.pt : note.items.en
})

const formattedDate = computed(() => {
  if (!note) return ''
  const d = new Date(note.date)
  const locale = lang.value === 'pt' ? 'pt-PT' : 'en-GB'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
})

onMounted(() => {
  if (!note) return
  let seen: string | null = null
  try { seen = localStorage.getItem(STORAGE_KEY) } catch { /* ignore */ }
  if (seen !== note.version) open.value = true
})

function close() {
  if (note) {
    try { localStorage.setItem(STORAGE_KEY, note.version) } catch { /* ignore */ }
  }
  open.value = false
}
</script>

<template>
  <Transition name="patch-fade">
    <div v-if="open && note" class="patch-backdrop" @click.self="close">
      <div class="patch-sheet" role="dialog" aria-modal="true">
        <div class="patch-header">
          <span class="patch-icon">
            <i class="pi pi-sparkles"></i>
          </span>
          <div class="patch-titles">
            <span class="patch-title">{{ t('patchNotes.title') }}</span>
            <span class="patch-sub">{{ t('patchNotes.subtitle', { version: note.version }) }} · {{ formattedDate }}</span>
          </div>
        </div>
        <ul class="patch-list">
          <li v-for="(item, i) in items" :key="i" class="patch-item">
            <i class="pi pi-check"></i>
            <span>{{ item }}</span>
          </li>
        </ul>
        <button class="patch-close" @click="close">
          {{ t('patchNotes.close') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.patch-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.patch-sheet {
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--safe-area-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  overflow-y: auto;
}

.patch-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.patch-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  color: var(--color-accent);
  font-size: 20px;
  flex-shrink: 0;
}

.patch-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.patch-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-primary);
}

.patch-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.patch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.patch-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.4;
}

.patch-item i {
  color: var(--color-accent);
  font-size: 12px;
  margin-top: 4px;
  flex-shrink: 0;
}

.patch-close {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-height: var(--touch-target);
}

.patch-close:active { opacity: 0.85; }

.patch-fade-enter-active { transition: opacity 0.2s ease; }
.patch-fade-enter-active .patch-sheet { transition: transform 0.25s ease; }
.patch-fade-leave-active { transition: opacity 0.15s ease; }
.patch-fade-leave-active .patch-sheet { transition: transform 0.15s ease; }
.patch-fade-enter-from { opacity: 0; }
.patch-fade-enter-from .patch-sheet { transform: translateY(100%); }
.patch-fade-leave-to { opacity: 0; }
.patch-fade-leave-to .patch-sheet { transform: translateY(100%); }
</style>
