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
import { isProjectSynced, useProjectSyncMap } from '@/composables/useProjectSyncMap'
import { exportProject, shareOrSave, type ExportLayout } from '@/services/exportService'
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
const { markExported, removeProject } = useProjects()
const { revokeAllUrls } = usePhotoStore()
const { syncMap } = useProjectSyncMap()

const projectId = computed(() => route.params.id as string)

onMounted(async () => {
  await openProject(projectId.value)
  if (project.value) {
    setTitle(project.value.name)
  }
})

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

const showActions = ref(false)

function onDeleteProject() {
  if (!project.value) return
  showActions.value = false
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
      const id = project.value!.id
      closeProject()
      revokeAllUrls()
      await removeProject(id)
      toast.add({ severity: 'info', summary: t('delete.success'), life: 2000 })
      router.replace('/')
    }
  })
}

setActions([
  { icon: 'pi pi-upload', label: 'Importar', handler: onImport },
  { icon: 'pi pi-ellipsis-v', label: 'Menu', handler: () => { showActions.value = true } }
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
    </div>

    <div
      class="sync-badge"
      :class="isProjectSynced(project.id, project.updatedAt) ? 'sync-badge-synced' : 'sync-badge-pending'"
    >
      <i :class="isProjectSynced(project.id, project.updatedAt) ? 'pi pi-cloud' : 'pi pi-cloud-upload'"></i>
      <span>{{ isProjectSynced(project.id, project.updatedAt) ? t('sync.project.synced') : t('sync.project.notSynced') }}</span>
    </div>

    <button
      class="triage-card"
      :class="{ 'triage-card-active': hasPending, 'triage-card-disabled': !canTriage }"
      :disabled="!canTriage"
      @click="startTriage"
    >
      <span class="triage-card-icon" :class="{ 'triage-card-icon-pulse': hasPending }">
        <i class="pi pi-sort-alt"></i>
      </span>
      <span class="triage-card-label">{{ t('project.startTriage') }}</span>
    </button>

    <div class="action-row">
      <button class="action-card" @click="onImport">
        <span class="action-card-icon">
          <i class="pi pi-plus"></i>
        </span>
        <span class="action-card-label">{{ t('project.import') }}</span>
        <span v-if="stats.total > 0" class="action-card-badge">{{ stats.total }}</span>
      </button>
      <button class="action-card" :class="{ 'action-card-disabled': !canExport }" @click="openExportModal">
        <span class="action-card-icon action-card-icon-export">
          <i class="pi pi-download"></i>
        </span>
        <span class="action-card-label">{{ t('project.export') }}</span>
        <span v-if="stats.sorted > 0" class="action-card-badge action-card-badge-export">{{ stats.sorted }}</span>
      </button>
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

    <!-- Action Sheet -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showActions" class="export-backdrop" @click.self="showActions = false">
          <div class="export-modal">
            <button class="action-sheet-item" @click="showActions = false; openExportModal()">
              <i class="pi pi-download"></i>
              <span>{{ t('project.actions.export') }}</span>
            </button>
            <button class="action-sheet-item" @click="showActions = false; onImport()">
              <i class="pi pi-upload"></i>
              <span>{{ t('project.actions.import') }}</span>
            </button>
            <button class="action-sheet-item action-sheet-danger" @click="onDeleteProject()">
              <i class="pi pi-trash"></i>
              <span>{{ t('project.actions.delete') }}</span>
            </button>
            <button class="action-sheet-item action-sheet-cancel" @click="showActions = false">
              <span>{{ t('app.cancel') }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

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
  gap: var(--spacing-xl);
  padding-bottom: 64px;
}

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

/* --- Sync Badge --- */
.sync-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  font-weight: 500;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 20px;
  align-self: center;
}

.sync-badge i {
  font-size: 12px;
}

.sync-badge-synced {
  color: #10B981;
  background: #ECFDF5;
}

.sync-badge-pending {
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}

/* --- Triage Card --- */
.triage-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg) var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.triage-card:active {
  background: var(--color-border);
}

.triage-card-active {
  border-color: #3B82F6;
  background: #EFF6FF;
}

.triage-card-active:active {
  background: #DBEAFE;
}

.triage-card-disabled {
  opacity: 0.4;
  cursor: default;
}

.triage-card-disabled:active {
  background: var(--color-bg-secondary);
}

.triage-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
}

.triage-card-icon-pulse {
  background: #3B82F6;
  animation: pulse-icon 1.5s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); transform: scale(1); }
  50% { box-shadow: 0 0 0 14px rgba(59, 130, 246, 0); transform: scale(1.08); }
}

.triage-card-label {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

/* --- Action Row --- */
.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.action-card:active {
  background: var(--color-border);
}

.action-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
}

.action-card-icon-export {
  background: var(--color-success);
}

.action-card-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.action-card-badge {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: #3B82F6;
  background: #EFF6FF;
  padding: 1px 8px;
  border-radius: 10px;
}

/* --- Status Area --- */
.status-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) 0;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #ECFDF5;
  color: #10B981;
  font-size: 28px;
  margin-bottom: var(--spacing-sm);
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
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.status-text {
  font-size: var(--font-size-sm);
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
  margin-top: var(--spacing-md);
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
  .triage-card-icon-pulse,
  .review-btn-pulse {
    animation: none;
  }
}

.action-card-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.action-card-badge-export {
  color: var(--color-success);
  background: #ECFDF5;
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

/* --- Action Sheet --- */
.action-sheet-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  padding: var(--spacing-md);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  text-align: left;
}

.action-sheet-item:last-child {
  border-bottom: none;
}

.action-sheet-item:active {
  background: var(--color-bg-secondary);
}

.action-sheet-item i {
  font-size: 16px;
  width: 20px;
  text-align: center;
  color: var(--color-text-secondary);
}

.action-sheet-danger {
  color: var(--color-error);
}

.action-sheet-danger i {
  color: var(--color-error);
}

.action-sheet-cancel {
  justify-content: center;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}
</style>
