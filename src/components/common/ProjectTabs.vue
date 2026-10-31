<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'

defineProps<{
  projectId: string
  inboxCount?: number
  reviewCount?: number
}>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const activeTab = computed(() =>
  route.name === 'project-review' ? 'review' : 'inbox'
)
</script>

<template>
  <div class="project-tabs">
    <button
      class="tab-item"
      :class="{ 'tab-active': activeTab === 'inbox' }"
      @click="router.replace(`/projects/${projectId}`)"
    >
      <i class="pi pi-inbox"></i>
      <span>{{ t('slot.inbox') }}</span>
      <span v-if="inboxCount" class="tab-badge">{{ inboxCount }}</span>
    </button>
    <button
      class="tab-item"
      :class="{ 'tab-active': activeTab === 'review' }"
      @click="router.replace(`/projects/${projectId}/review`)"
    >
      <i class="pi pi-th-large"></i>
      <span>{{ t('review.title') }}</span>
      <span v-if="reviewCount" class="tab-badge tab-badge-review">{{ reviewCount }}</span>
    </button>
  </div>
</template>

<style scoped>
.project-tabs {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border);
  z-index: var(--z-toolbar);
  padding-bottom: var(--safe-area-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  -webkit-tap-highlight-color: transparent;
}

.tab-item i {
  font-size: var(--font-size-sm);
}

.tab-active {
  color: var(--color-accent);
}

.tab-badge {
  font-size: 10px;
  font-weight: 600;
  color: #D97706;
  background: #FEF3C7;
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 18px;
  text-align: center;
}

.tab-badge-review {
  color: var(--color-success);
  background: #ECFDF5;
}
</style>
