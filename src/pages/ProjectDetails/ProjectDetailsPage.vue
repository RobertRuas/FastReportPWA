<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { usePageTitle } from '@/composables/usePageTitle'
import { usePageActions } from '@/composables/usePageActions'
import { usePhotoImport } from '@/composables/usePhotoImport'
import { useProjectSession } from '@/composables/useProjectSession'
import { useProjects } from '@/composables/useProjects'
import { usePhotoStore } from '@/composables/usePhotoStore'
import { useI18n } from '@/composables/useI18n'
import { isProjectSynced, isProjectSyncStale } from '@/composables/useProjectSyncMap'
import { exportProject, shareOrSave, type ExportLayout } from '@/services/exportService'
import { syncProject as backupSyncProject, getShareUrl, deleteBackup } from '@/services/backupSync'
import { useAuth } from '@/composables/useAuth'
import ProjectTabs from '@/components/common/ProjectTabs.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const { setTitle } = usePageTitle()
const { setActions } = usePageActions()
const { importPhotos } = usePhotoImport()
const { project, map, stats, openProject, closeProject } = useProjectSession()
const { markExported, markSynced, removeProject, touchProject } = useProjects()
const { revokeAllUrls } = usePhotoStore()

const { currentUser } = useAuth()
const projectId = computed(() => route.params.id as string)
const syncing = ref(false)
const syncProgress = ref(0)
const syncTotal = ref(0)
const emailExporting = ref(false)

onMounted(async () => {
  await openProject(projectId.value)
  if (project.value) {
    setTitle(project.value.name)
  }
})

function changeCols(delta: number) {
  if (!project.value) return
  const next = Math.min(12, Math.max(4, project.value.cols + delta))
  if (next !== project.value.cols) {
    project.value.cols = next
    touchProject(project.value)
  }
}

const allSorted = computed(() => stats.value.total > 0 && stats.value.pending === 0)
const hasPending = computed(() => stats.value.pending > 0)
const canTriage = computed(() => stats.value.pending > 0)
const canExport = computed(() => stats.value.sorted > 0)

const showExportModal = ref(false)
const exporting = ref(false)
const exportProgress = ref(0)
const exportTotal = ref(0)

function goToReview() {
  router.push(`/projects/${projectId.value}/review`)
}

function openExportModal() {
  if (!canExport.value) return
  showExportModal.value = true
}

async function doExport(layout: ExportLayout) {
  if (!project.value || exporting.value) return
  exporting.value = true
  exportProgress.value = 0
  exportTotal.value = stats.value.sorted

  try {
    const blob = await exportProject(project.value, layout, (p) => {
      exportProgress.value = p.current
      exportTotal.value = p.total
    })

    const name = `${project.value.slug || project.value.name}.zip`
    await shareOrSave(blob, name)
    markExported(project.value)
    showExportModal.value = false
    toast.add({ severity: 'success', summary: t('export.success'), life: 3000 })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      showExportModal.value = false
      return
    }
    console.error('[FastReport] Export failed:', err)
    const msg = err instanceof Error ? err.message : t('app.error')
    toast.add({ severity: 'error', summary: t('export.error', { message: msg }), life: 5000 })
  } finally {
    exporting.value = false
  }
}

async function doExportShare() {
  if (!project.value || emailExporting.value || !currentUser.value) return

  if (!project.value.syncedAt) {
    toast.add({ severity: 'warn', summary: t('sync.syncFirst'), life: 3000 })
    showExportModal.value = false
    return
  }

  emailExporting.value = true
  try {
    const result = await getShareUrl(currentUser.value.email, project.value.slug)
    if (!result.ok || !result.url) {
      toast.add({ severity: 'error', summary: t('export.shareError'), detail: result.error, life: 5000 })
      return
    }

    const base = window.location.origin + window.location.pathname
    const params = new URLSearchParams({ url: result.url, name: project.value.name })
    const downloadPageUrl = `${base}#/download?${params.toString()}`

    if (navigator.share) {
      await navigator.share({
        title: `FastReport: ${project.value.name}`,
        text: `Download do projeto "${project.value.name}" — link válido por 1 hora.`,
        url: downloadPageUrl
      })
    } else {
      await navigator.clipboard.writeText(downloadPageUrl)
    }

    showExportModal.value = false
    toast.add({ severity: 'success', summary: t('export.shareSuccess'), life: 4000 })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      showExportModal.value = false
      return
    }
    console.error('[FastReport] Share export failed:', err)
    toast.add({ severity: 'error', summary: t('export.shareError'), life: 5000 })
  } finally {
    emailExporting.value = false
  }
}

function startTriage() {
  if (!canTriage.value) return
  router.push(`/projects/${projectId.value}/triage`)
}

async function onImport() {
  if (!project.value) return
  try {
    const count = await importPhotos(project.value)
    if (count > 0) {
      toast.add({ severity: 'success', summary: t('project.importSuccess', { count }), life: 3000 })
    }
  } catch (err) {
    console.error('[FastReport] Import failed:', err)
    toast.add({ severity: 'error', summary: t('project.importError'), life: 3000 })
  }
}

async function onSyncProject() {
  if (!project.value || syncing.value || !currentUser.value) return
  syncing.value = true
  syncProgress.value = 0
  syncTotal.value = 0
  const result = await backupSyncProject(project.value, currentUser.value.email, (p) => {
    syncProgress.value = p.current
    syncTotal.value = p.total
  })
  if (result.ok) {
    markSynced(project.value)
    toast.add({ severity: 'success', summary: t('sync.syncSuccess'), life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: t('sync.syncError'), detail: result.error, life: 4000 })
  }
  syncing.value = false
}

function onDeleteProject() {
  if (!project.value) return
  const isExported = !!project.value.exportedAt
  const msg = isExported
    ? t('delete.message', { name: project.value.name })
    : t('delete.messageUnexported')

  confirm.require({
    message: msg,
    header: t('delete.title'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('delete.accept'),
    rejectLabel: t('app.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      const p = project.value!
      closeProject()
      revokeAllUrls()
      if (p.syncedAt && currentUser.value) {
        deleteBackup(p.id, currentUser.value.email, p.slug).catch(() => {})
      }
      await removeProject(p.id)
      toast.add({ severity: 'info', summary: t('delete.success'), life: 2000 })
      router.replace('/')
    }
  })
}

setActions([
  { icon: 'pi pi-upload', label: t('project.import'), handler: onImport },
  { icon: 'pi pi-sync', label: t('sync.syncNow'), handler: onSyncProject },
  { icon: 'pi pi-trash', label: t('app.delete'), handler: onDeleteProject }
])
</script>

<template>
  <div v-if="project" class="project-details">

    <div class="summary-row">
      <span class="summary-item"><strong>{{ stats.pending }}</strong> {{ t('project.inbox') }}</span>
      <span class="summary-sep">&middot;</span>
      <span class="summary-item"><strong>{{ stats.sorted }}</strong> {{ t('project.sorted') }}</span>
      <span class="summary-sep">&middot;</span>
      <span class="summary-item"><strong>{{ stats.trashed }}</strong> {{ t('project.trash') }}</span>
      <span class="summary-sep">&middot;</span>
      <span
        class="summary-sync"
        :class="isProjectSynced(project) ? 'sync-ok' : isProjectSyncStale(project) ? 'sync-stale' : 'sync-pending'"
      >
        <i :class="isProjectSynced(project) ? 'pi pi-cloud' : 'pi pi-cloud-upload'"></i>
      </span>
    </div>

    <!-- Cols control -->
    <div class="cols-control">
      <i class="pi pi-th-large cols-icon"></i>
      <span class="cols-label">{{ t('project.cols') }}</span>
      <div class="cols-stepper">
        <button class="cols-btn" :disabled="!project || project.cols <= 4" @click="changeCols(-1)">
          <i class="pi pi-minus"></i>
        </button>
        <span class="cols-value">{{ project?.cols ?? 7 }}</span>
        <button class="cols-btn" :disabled="!project || project.cols >= 12" @click="changeCols(1)">
          <i class="pi pi-plus"></i>
        </button>
      </div>
    </div>

    <!-- Sync alert -->
    <div v-if="project.syncedAt && new Date(project.updatedAt) > new Date(project.syncedAt)" class="sync-alert">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ t('sync.needsSync') }}</span>
      <button class="sync-alert-btn" @click="onSyncProject">
        <i class="pi pi-sync"></i> {{ t('sync.syncNow') }}
      </button>
    </div>

    <div v-if="syncing" class="sync-progress">
      <div class="sync-progress-bar">
        <div class="sync-progress-fill" :style="{ width: syncTotal > 0 ? (syncProgress / syncTotal * 100) + '%' : '0%' }"></div>
      </div>
      <span class="sync-progress-text">
        {{ t('sync.syncing') }} {{ syncTotal > 0 ? `${syncProgress}/${syncTotal}` : '' }}
      </span>
    </div>

    <div class="quick-actions">
      <button
        class="quick-btn quick-btn-triage"
        :class="{ 'quick-btn-active': hasPending, 'quick-btn-disabled': !canTriage }"
        :disabled="!canTriage"
        @click="startTriage"
      >
        <i class="pi pi-sort-alt"></i>
        <span>{{ t('project.startTriage') }}</span>
      </button>

      <div class="quick-row">
        <button class="quick-btn quick-btn-sm" @click="onImport">
          <i class="pi pi-plus"></i>
          <span>{{ t('project.import') }}</span>
          <span v-if="stats.total > 0" class="quick-badge">{{ stats.total }}</span>
        </button>
        <button class="quick-btn quick-btn-sm" :class="{ 'quick-btn-disabled': !canExport }" @click="openExportModal">
          <i class="pi pi-download"></i>
          <span>{{ t('project.export') }}</span>
          <span v-if="stats.sorted > 0" class="quick-badge quick-badge-export">{{ stats.sorted }}</span>
        </button>
      </div>
    </div>

    <div v-if="allSorted" class="status-area">
      <span class="status-icon">
        <i class="pi pi-check"></i>
      </span>
      <h3 class="status-title">{{ t('project.allSorted.title') }}</h3>
      <p class="status-text">{{ t('project.allSorted.text') }}</p>
      <button class="review-btn review-btn-pulse" @click="goToReview">
        <i class="pi pi-th-large"></i>
        <span>{{ t('project.allSorted.review') }}</span>
      </button>
    </div>

    <div v-else-if="stats.total > 0" class="status-area">
      <span class="status-icon status-icon-pending">
        <i class="pi pi-images"></i>
      </span>
      <h3 class="status-title">{{ t('project.pending.title', { count: stats.pending }) }}</h3>
      <p class="status-text">{{ t('project.pending.text') }}</p>
    </div>

    <div v-else class="status-area">
      <span class="status-icon status-icon-empty">
        <i class="pi pi-camera"></i>
      </span>
      <h3 class="status-title">{{ t('project.empty.title') }}</h3>
      <p class="status-text">{{ t('project.empty.text') }}</p>
    </div>

    <ProjectTabs :projectId="projectId" :inboxCount="stats.pending" :reviewCount="stats.sorted" />

    <!-- Export Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showExportModal" class="export-backdrop" @click.self="!exporting && (showExportModal = false)">
          <div class="export-modal">
            <template v-if="!exporting">
              <h3 class="export-title">{{ t('export.title') }}</h3>
              <p class="export-desc">{{ t('export.photos', { count: stats.sorted }) }}</p>

              <button class="export-option" @click="doExport('folders')">
                <span class="export-option-icon">
                  <i class="pi pi-folder"></i>
                </span>
                <div class="export-option-text">
                  <span class="export-option-label">{{ t('export.withFolders') }}</span>
                  <span class="export-option-hint">{{ t('export.withFoldersHint') }}</span>
                </div>
                <i class="pi pi-chevron-right export-option-arrow"></i>
              </button>

              <button class="export-option" @click="doExport('flat')">
                <span class="export-option-icon">
                  <i class="pi pi-images"></i>
                </span>
                <div class="export-option-text">
                  <span class="export-option-label">{{ t('export.flatOnly') }}</span>
                  <span class="export-option-hint">{{ t('export.flatOnlyHint') }}</span>
                </div>
                <i class="pi pi-chevron-right export-option-arrow"></i>
              </button>

              <button class="export-option" @click="doExportShare">
                <span class="export-option-icon export-option-icon-share">
                  <i class="pi pi-share-alt"></i>
                </span>
                <div class="export-option-text">
                  <span class="export-option-label">{{ t('export.shareLink') }}</span>
                  <span class="export-option-hint">{{ t('export.shareLinkHint') }}</span>
                </div>
                <i class="pi pi-chevron-right export-option-arrow"></i>
              </button>
            </template>

            <template v-else>
              <div class="export-progress">
                <i class="pi pi-spin pi-spinner export-progress-icon"></i>
                <span class="export-progress-label">{{ t('export.exporting') }}</span>
                <span class="export-progress-count">{{ exportProgress }} / {{ exportTotal }}</span>
                <div class="export-progress-bar">
                  <div
                    class="export-progress-fill"
                    :style="{ width: exportTotal > 0 ? (exportProgress / exportTotal * 100) + '%' : '0%' }"
                  ></div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>

  <div v-else class="not-found">
    <p>{{ t('project.notFound') }}</p>
  </div>
</template>

<style scoped>
.project-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* --- Cols Control --- */
.cols-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
}

.cols-icon {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.cols-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  font-weight: 500;
  flex: 1;
}

.cols-stepper {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.cols-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cols-btn:active { background: var(--color-border); }
.cols-btn:disabled { opacity: 0.3; cursor: default; }

.cols-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  min-width: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* --- Sync Alert --- */
.sync-alert {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  color: #92400E;
}

.sync-alert i { font-size: 14px; color: #D97706; }
.sync-alert span { flex: 1; }

.sync-alert-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #D97706;
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.sync-alert-btn:active { opacity: 0.8; }

/* --- Summary Row --- */
.summary-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.summary-item strong {
  font-weight: 700;
  color: var(--color-text-primary);
}

.summary-sep {
  color: var(--color-border);
}

.summary-sync {
  display: flex;
  align-items: center;
  font-size: 13px;
}

.sync-ok { color: #10B981; }
.sync-stale { color: #D97706; }
.sync-pending { color: var(--color-text-secondary); opacity: 0.5; }

/* --- Sync Progress --- */
.sync-progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
}

.sync-progress-bar {
  flex: 1;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.sync-progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.sync-progress-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* --- Quick Actions --- */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.quick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.quick-btn:active {
  background: var(--color-border);
}

.quick-btn-triage.quick-btn-active {
  border-color: #3B82F6;
  background: #EFF6FF;
  color: #3B82F6;
}

.quick-btn-triage.quick-btn-active:active {
  background: #DBEAFE;
}

.quick-btn-disabled {
  opacity: 0.4;
  cursor: default;
}

.quick-btn-disabled:active {
  background: var(--color-bg-secondary);
}

.quick-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.quick-btn-sm {
  padding: var(--spacing-sm);
  font-size: var(--font-size-xs);
}

.quick-btn i {
  font-size: 14px;
}

.quick-badge {
  font-size: 10px;
  font-weight: 600;
  color: #3B82F6;
  background: #EFF6FF;
  padding: 1px 6px;
  border-radius: 10px;
}

.quick-badge-export {
  color: var(--color-success);
  background: #ECFDF5;
}

/* --- Status Area --- */
.status-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) 0;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #ECFDF5;
  color: #10B981;
  font-size: 22px;
  margin-bottom: var(--spacing-xs);
}

.status-icon-pending {
  background: #FEF3C7;
  color: #D97706;
}

.status-icon-empty {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.status-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.status-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: center;
}

/* --- Review Pulsating Button --- */
.review-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  margin-top: var(--spacing-sm);
}

.review-btn:active {
  opacity: 0.85;
}

.review-btn-pulse {
  background: #10B981;
  animation: pulse-review 2s ease-in-out infinite;
}

@keyframes pulse-review {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 163, 129, 0.5); transform: scale(1); }
  50% { box-shadow: 0 0 0 10px rgba(16, 163, 129, 0); transform: scale(1.03); }
}

@media (prefers-reduced-motion: reduce) {
  .review-btn-pulse {
    animation: none;
  }
}

/* --- Not Found --- */
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

<style>
/* --- Export Modal (teleported, unscoped) --- */
.export-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-primary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  padding: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--safe-area-bottom));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.export-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.export-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: -4px;
}

.export-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  text-align: left;
}

.export-option:active {
  background: var(--color-border);
}

.export-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
}

.export-option-icon-share {
  background: #3B82F6;
}

.export-option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.export-option-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.export-option-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.export-option-arrow {
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.export-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) 0;
}

.export-progress-icon {
  font-size: 24px;
  color: var(--color-accent);
}

.export-progress-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.export-progress-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.export-progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: var(--spacing-xs);
}

.export-progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.15s ease;
}

.modal-fade-enter-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .export-modal {
  transition: transform 0.25s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}

.modal-fade-leave-active .export-modal {
  transition: transform 0.15s ease;
}

.modal-fade-enter-from {
  opacity: 0;
}

.modal-fade-enter-from .export-modal {
  transform: translateY(100%);
}

.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-leave-to .export-modal {
  transform: translateY(100%);
}
</style>
