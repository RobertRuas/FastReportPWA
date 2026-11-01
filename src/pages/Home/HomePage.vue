<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import ProgressBar from 'primevue/progressbar'
import { useProjects } from '@/composables/useProjects'
import { useI18n } from '@/composables/useI18n'
import { isProjectSynced } from '@/composables/useProjectSyncMap'
import { syncSingleProject, syncDeleteProject } from '@/services/projectSync'
import { getAllMaps, getMap } from '@/services/mapCatalog'
import { importZip } from '@/services/zipImportService'
import SwipeActions from '@/components/common/SwipeActions.vue'
import type { SwipeAction } from '@/components/common/SwipeActions.vue'
import * as db from '@/services/db'

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { t, lang } = useI18n()
const { projects, projectStats, totalBytes, removeProject } = useProjects()
const importing = ref(false)
const syncingId = ref('')

const storageUsed = ref(0)

onMounted(async () => {
  const est = await db.estimateStorage()
  if (est) storageUsed.value = est.used
})

const mapsCount = getAllMaps().length

const exportedCount = computed(() =>
  projects.value.filter(p => p.exportedAt !== null).length
)

const pendingCount = computed(() =>
  projects.value.filter(p => p.exportedAt === null).length
)

const cards = computed(() => [
  { key: 'projects', title: t('home.summary.projects'), icon: 'pi pi-folder', count: projects.value.length, color: '#3B82F6', route: '/projects/list' },
  { key: 'maps', title: t('home.summary.maps'), icon: 'pi pi-th-large', count: mapsCount, color: '#8B5CF6', route: '/maps' },
  { key: 'exported', title: t('home.summary.exported'), icon: 'pi pi-check-circle', count: exportedCount.value, color: '#10B981', route: '/projects/list?filter=exported' },
  { key: 'pending', title: t('home.summary.pending'), icon: 'pi pi-clock', count: pendingCount.value, color: '#F59E0B', route: '/projects/list?filter=pending' }
])

const sortedProjects = computed(() =>
  projects.value.slice().sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
)

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
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
      icon: 'pi pi-pencil',
      label: t('project.actions.edit'),
      color: '#F59E0B',
      handler: () => router.push(`/projects/${project.id}`)
    },
    {
      icon: 'pi pi-trash',
      label: t('app.delete'),
      color: '#EF4444',
      handler: () => onDeleteProject(project)
    }
  ]
}

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
      await syncDeleteProject(project.id)
      await removeProject(project.id)
      toast.add({ severity: 'info', summary: t('delete.success'), life: 2000 })
    }
  })
}

async function onImportZip() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.zip,application/zip'

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    importing.value = true
    try {
      const result = await importZip(file)
      toast.add({ severity: 'success', summary: t('zip.success'), life: 3000 })
      router.push(`/projects/${result.projectId}`)
    } catch (err: any) {
      const msg = err?.message === 'noMetadata' ? t('zip.error.noMetadata')
        : err?.message === 'mapNotFound' ? t('zip.error.mapNotFound', { mapId: '' })
        : t('zip.error.generic')
      toast.add({ severity: 'error', summary: msg, life: 4000 })
    } finally {
      importing.value = false
    }
  }

  input.click()
}
</script>

<template>
  <div class="home-page">

    <div class="cards-grid">
      <button
        v-for="card in cards"
        :key="card.key"
        class="summary-card"
        @click="router.push(card.route)"
      >
        <div class="card-top">
          <span class="card-icon" :style="{ background: card.color + '18', color: card.color }">
            <i :class="card.icon"></i>
          </span>
          <span class="card-count">{{ card.count }}</span>
        </div>
        <span class="card-title">{{ card.title }}</span>
      </button>
    </div>

    <template v-if="sortedProjects.length > 0">
      <div class="list-header">
        <span class="list-header-title">{{ t('app.projects') }}</span>
      </div>

      <div class="project-list">
        <SwipeActions
          v-for="project in sortedProjects"
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
    </template>

    <div v-else class="empty-state">
      <span class="empty-icon">
        <i class="pi pi-folder-open"></i>
      </span>
      <h3 class="empty-title">{{ t('home.empty.title') }}</h3>
      <p class="empty-text">{{ t('home.empty.text') }}</p>
      <button class="empty-action" @click="router.push('/projects/new')">
        <i class="pi pi-plus"></i>
        <span>{{ t('home.empty.newProject') }}</span>
      </button>
      <button class="empty-link" @click="onImportZip" :disabled="importing">
        <i class="pi pi-file-import"></i>
        <span>{{ t('home.empty.importZip') }}</span>
      </button>
    </div>

    <div class="storage-footer">
      <span class="storage-info">
        <i class="pi pi-database"></i>
        {{ formatBytes(totalBytes) }} {{ t('home.storage.used') }}
      </span>
    </div>

  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

/* --- Summary Cards --- */
.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.summary-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  min-height: 80px;
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.summary-card:active {
  background: var(--color-border);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 13px;
  flex-shrink: 0;
}

.card-count {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}

.card-title {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

/* --- List Header --- */
.list-header {
  display: flex;
  align-items: center;
}

.list-header-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

/* --- Project List --- */
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

/* --- Empty State --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 28px;
}

.empty-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.empty-action {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  margin-top: var(--spacing-sm);
}

.empty-action:active {
  opacity: 0.85;
}

.empty-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.empty-link:active {
  color: var(--color-text-primary);
}

/* --- Storage Footer --- */
.storage-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) 0;
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.storage-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.storage-info i {
  font-size: 12px;
}
</style>
