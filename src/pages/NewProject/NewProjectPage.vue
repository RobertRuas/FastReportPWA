<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import InputText from 'primevue/inputtext'
import { usePageTitle } from '@/composables/usePageTitle'
import { usePageActions } from '@/composables/usePageActions'
import { useProjectCreate } from '@/composables/useProjectCreate'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const toast = useToast()
const { t, lang } = useI18n()
const { setTitle } = usePageTitle()
const { setActions } = usePageActions()
const {
  name, mapId, maps, slug, nameError,
  canCreate, filenamePreview, mapSummary, create
} = useProjectCreate()

setTitle(t('new.title'))

async function onSubmit() {
  if (!canCreate.value) return
  try {
    const id = await create()
    toast.add({ severity: 'success', summary: t('new.title'), life: 2000 })
    router.replace(`/projects/${id}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('app.error')
    toast.add({ severity: 'error', summary: msg, life: 3000 })
  }
}

setActions([
  {
    icon: 'pi pi-check',
    label: t('new.create'),
    handler: onSubmit
  }
])

onMounted(() => {
  const input = document.querySelector<HTMLInputElement>('.project-name-input input')
  input?.focus()
})
</script>

<template>
  <div class="new-project-page">

    <div class="form-field">
      <label class="form-label" for="project-name">{{ t('new.name') }}</label>
      <InputText
        id="project-name"
        v-model="name"
        class="project-name-input"
        :placeholder="t('new.namePlaceholder')"
        autocapitalize="words"
        autocomplete="off"
        @keydown.enter="onSubmit"
      />
      <span v-if="nameError" class="form-error">{{ nameError }}</span>
      <span v-else-if="filenamePreview" class="form-hint">
        <i class="pi pi-file"></i>
        {{ filenamePreview }}
      </span>
    </div>

    <div class="form-field">
      <label class="form-label">{{ t('new.map') }}</label>
      <div class="map-list">
        <button
          v-for="map in maps"
          :key="map.id"
          class="map-option"
          :class="{ 'map-option-selected': mapId === map.id }"
          @click="mapId = map.id"
        >
          <span class="map-option-radio">
            <span v-if="mapId === map.id" class="map-option-dot"></span>
          </span>
          <div class="map-option-info">
            <span class="map-option-name">{{ lang === 'pt' ? map.name.pt : map.name.en }}</span>
            <span class="map-option-meta">{{ mapSummary(map) }}</span>
          </div>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.new-project-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.project-name-input {
  width: 100%;
}

.form-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
}

.form-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.form-hint i {
  font-size: 11px;
}

/* --- Map Selection --- */
.map-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.map-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.map-option:active {
  background: var(--color-border);
}

.map-option-selected {
  border-color: var(--color-accent);
}

.map-option-radio {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  flex-shrink: 0;
}

.map-option-selected .map-option-radio {
  border-color: var(--color-accent);
}

.map-option-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-accent);
}

.map-option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.map-option-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.map-option-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
