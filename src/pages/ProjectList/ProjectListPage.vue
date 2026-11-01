<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import ProgressBar from 'primevue/progressbar'
import { useProjects } from '@/composables/useProjects'
import { useI18n } from '@/composables/useI18n'
import { usePageTitle } from '@/composables/usePageTitle'
import { isProjectSynced } from '@/composables/useProjectSyncMap'
import { syncSingleProject } from '@/services/projectSync'
import { getMap } from '@/services/mapCatalog'
import SwipeActions from '@/components/common/SwipeActions.vue'
import type { SwipeAction } from '@/components/common/SwipeActions.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { t, lang } = useI18n()
const { projects, projectStats, removeProject } = useProjects()
const { setTitle } = usePageTitle()

const filter = computed(() => (route.query.filter as string) ?? 'all')

const titleMap: Record<string, string> = {
  all: t('app.projects'),
  exported: t('home.summary.exported'),
  pending: t('home.summary.pending')
}

setTitle(titleMap[filter.value] ?? t('app.projects'))

const filteredProjects = computed(() => {
  const sorted = projects.value.slice().sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  if (filter.value === 'exported') return sorted.filter(p => p.exportedAt !== null)
  if (filter.value === 'pending') return sorted.filter(p => p.exportedAt === null)
  return sorted
})

function mapName(mapId: string): string {
  const m = getMap(mapId)
  if (!m) return mapId
  return lang.value === 'pt' ? m.name.pt : m.name.en
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return lang.value === 'pt' ? 'Hoje' : 'Today'
  if (days === 1) return lang.value === 'pt' ? 'Ontem' : 'Yesterday'
  if (days < 7) return lang.value === 'pt' ? `${days} dias` : `${days} days`
  const locale = lang.value === 'pt' ? 'pt-PT' : 'en-GB'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function projectProgress(project: typeof projects.value[0]): number {
  const stats = projectStats(project)
  if (stats.total === 0) return 0
  return Math.round((stats.sorted / stats.total) * 100)
}

function thumbColor(name: string): string {
  const colors = ['#3B82F6', '#10B981', '#D97706', '#8B5CF6', '#EF4444']
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getSwipeActions(project: typeof projects.value[0]): SwipeAction[] {
  return [
    {
      icon: 'pi pi-sync',
      label: t('sync.syncNow'),
      color: '#3B82F6',
      handler: () => onSyncProject(project)
    },
    {
      icon: 'pi pi-trash',
      label: t('app.delete'),
      color: '#EF4444',
      handler: () => onDeleteProject(project)
    }
  ]
}

const syncingId = ref('')

async function onSyncProject(project: typeof projects.value[0]) {
  syncingId.value = project.id
  const result = await syncSingleProject(project)
  syncingId.value = ''
  if (result.ok) {
    toast.add({ severity: 'success', summary: t('sync.syncSuccess'), life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: t('sync.syncError'), detail: result.error, life: 4000 })
  }
}

function onDeleteProject(project: typeof projects.value[0]) {
  const isExported = !!project.exportedAt
  const msg = isExported
    ? t('delete.message', { name: project.name })
    : t('delete.messageUnexported')

  confirm.require({
    message: msg,
    header: t('delete.title'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('delete.accept'),
    rejectLabel: t('app.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      await removeProject(project.id)
      toast.add({ severity: 'info', summary: t('delete.success'), life: 2000 })
    }
  })
}
</script>

<template>
  <div class="project-list-page">

    <div v-if="filteredProjects.length === 0" class="empty-state">
      <i class="pi pi-folder-open empty-icon"></i>
      <span class="empty-text">{{ t('home.empty.title') }}</span>
    </div>

    <div v-else class="project-list">
      <SwipeActions
        v-for="project in filteredProjects"
        :key="project.id"
        :actions="getSwipeActions(project)"
      >
        <button
          class="project-item"
          @click="router.push(`/projects/${project.id}`)"
        >
          <span class="project-thumb" :style="{ background: thumbColor(project.name) }">
            <i class="pi pi-folder-open"></i>
          </span>
          <div class="project-info">
            <span class="project-name">{{ project.name }}</span>
            <span class="project-meta">
              {{ mapName(project.mapId) }} · {{ formatDate(project.updatedAt) }}
            </span>
            <div class="project-progress-row">
              <ProgressBar
                :value="projectProgress(project)"
                :showValue="false"
                class="project-bar"
              />
              <span class="project-photo-count">
                {{ projectStats(project).sorted }}/{{ projectStats(project).total }}
              </span>
            </div>
          </div>
          <div class="project-end">
            <i
              v-if="syncingId === project.id"
              class="pi pi-spin pi-spinner project-sync-icon"
            ></i>
            <span
              v-else
              class="project-sync-dot"
              :class="isProjectSynced(project.id, project.updatedAt) ? 'project-sync-dot-synced' : 'project-sync-dot-pending'"
            >
              <i :class="isProjectSynced(project.id, project.updatedAt) ? 'pi pi-cloud' : 'pi pi-cloud-upload'"></i>
            </span>
            <i class="pi pi-chevron-right project-arrow"></i>
          </div>
        </button>
      </SwipeActions>
    </div>

  </div>
</template>

<style scoped>
.project-list-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.project-list {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.project-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-secondary);
  border: none;
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  width: 100%;
}

.project-item:active {
  background: var(--color-border);
}

.project-list > :deep(.swipe-container + .swipe-container .project-item) {
  border-top: 1px solid var(--color-border);
}

.project-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  color: #fff;
  font-size: 16px;
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.project-progress-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.project-bar {
  flex: 1;
  height: 4px;
}

.project-bar :deep(.p-progressbar-value) {
  background: var(--color-accent);
}

.project-photo-count {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.project-end {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.project-sync-icon {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.project-sync-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.project-sync-dot-synced {
  color: #10B981;
}

.project-sync-dot-pending {
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.project-arrow {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 32px;
}

.empty-text {
  font-size: var(--font-size-sm);
}
</style>
