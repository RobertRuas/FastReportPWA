<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import JSZip from 'jszip'
import { useSettings } from '@/composables/useSettings'
import { useProjects } from '@/composables/useProjects'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { useSyncStatus } from '@/composables/useSyncStatus'
import { exportProject } from '@/services/exportService'
import { syncProjects } from '@/services/projectSync'
import { stopSettingsSync } from '@/services/settingsSync'
import { resetSyncState } from '@/composables/useSyncStatus'
import {
  isAdmin, ADMIN_EMAIL,
  listAllowedUsers, addAllowedUser, revokeUser, reinstateUser, deleteAllowedUser,
  type AccessEntry
} from '@/services/accessService'
import * as db from '@/services/db'

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const { settings } = useSettings()
const { projects, totalBytes, replaceAll } = useProjects()
const { currentUser, logout, updateProfile } = useAuth()
const { syncState, syncedTimeAgo, syncErrorMsg } = useSyncStatus()

const profileName = ref('')
const profileEmail = ref('')
const savingProfile = ref(false)

const syncing = ref(false)
const showAdmin = computed(() => isAdmin(currentUser.value?.email))
const accessUsers = ref<AccessEntry[]>([])
const newUserEmail = ref('')
const addingUser = ref(false)

const storageUsed = ref(0)
const storageQuota = ref(0)
const backingUp = ref(false)

onMounted(async () => {
  profileName.value = currentUser.value?.name ?? settings.userName
  profileEmail.value = currentUser.value?.email ?? settings.userEmail
  const est = await db.estimateStorage()
  if (est) {
    storageUsed.value = est.used
    storageQuota.value = est.quota
  }
  if (showAdmin.value) {
    accessUsers.value = await listAllowedUsers()
  }
})

async function saveProfile() {
  savingProfile.value = true
  const result = await updateProfile(profileName.value.trim())
  savingProfile.value = false
  if (result.error) {
    toast.add({ severity: 'error', summary: result.error, life: 3000 })
    return
  }
  settings.userName = profileName.value.trim()
  toast.add({ severity: 'success', summary: t('settings.profileSaved'), life: 2000 })
}

const langOptions = computed(() => [
  { label: t('settings.lang.auto'), value: 'auto' },
  { label: t('settings.lang.pt'), value: 'pt' },
  { label: t('settings.lang.en'), value: 'en' }
])

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function storagePercent(): number {
  if (storageQuota.value === 0) return 0
  return Math.min(100, Math.round((storageUsed.value / storageQuota.value) * 100))
}

function totalPhotos(): number {
  return projects.value.reduce((sum, p) => sum + p.photos.length, 0)
}

async function onBackup() {
  if (projects.value.length === 0) {
    toast.add({ severity: 'warn', summary: t('settings.backupEmpty'), life: 2000 })
    return
  }

  backingUp.value = true
  try {
    const masterZip = new JSZip()

    for (const project of projects.value) {
      const projectBlob = await exportProject(project, 'folders')
      masterZip.file(`${project.slug || project.name}.zip`, projectBlob)
    }

    const blob = await masterZip.generateAsync({ type: 'blob' })
    const date = new Date().toISOString().slice(0, 10)
    const filename = `fastreport-backup-${date}.zip`

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }]
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        toast.add({ severity: 'success', summary: t('settings.backupSuccess'), life: 3000 })
        return
      } catch (e: any) {
        if (e?.name === 'AbortError') return
      }
    }

    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'application/zip' })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          toast.add({ severity: 'success', summary: t('settings.backupSuccess'), life: 3000 })
          return
        } catch (e: any) {
          if (e?.name === 'AbortError') return
        }
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.add({ severity: 'success', summary: t('settings.backupSuccess'), life: 3000 })
  } catch (err) {
    console.error('[FastReport] Backup failed:', err)
    toast.add({ severity: 'error', summary: t('settings.backupError'), life: 4000 })
  } finally {
    backingUp.value = false
  }
}

async function onAddUser() {
  const email = newUserEmail.value.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
  addingUser.value = true
  const result = await addAllowedUser(email)
  addingUser.value = false
  if (result.error) {
    toast.add({ severity: 'error', summary: result.error, life: 3000 })
    return
  }
  newUserEmail.value = ''
  accessUsers.value = await listAllowedUsers()
  toast.add({ severity: 'success', summary: t('access.added'), life: 2000 })
}

function onRevokeUser(email: string) {
  confirm.require({
    message: t('access.confirmRevoke').replace('{email}', email),
    header: t('access.revoke'),
    icon: 'pi pi-ban',
    acceptLabel: t('access.revoke'),
    rejectLabel: t('app.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      await revokeUser(email)
      accessUsers.value = await listAllowedUsers()
      toast.add({ severity: 'warn', summary: t('access.revokedSuccess'), life: 2000 })
    }
  })
}

async function onReinstateUser(email: string) {
  await reinstateUser(email)
  accessUsers.value = await listAllowedUsers()
  toast.add({ severity: 'success', summary: t('access.reinstated'), life: 2000 })
}

function onDeleteUser(email: string) {
  confirm.require({
    message: t('access.confirmDelete').replace('{email}', email),
    header: t('access.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('access.delete'),
    rejectLabel: t('app.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      await deleteAllowedUser(email)
      accessUsers.value = await listAllowedUsers()
      toast.add({ severity: 'info', summary: t('access.deleted'), life: 2000 })
    }
  })
}

function formatLastAccess(dateStr: string | null): string {
  if (!dateStr) return t('access.never')
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function shortDevice(ua: string | null): string {
  if (!ua) return '—'
  if (ua.includes('iPhone')) return 'iPhone'
  if (ua.includes('iPad')) return 'iPad'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('Mac')) return 'Mac'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Linux')) return 'Linux'
  return 'Browser'
}

async function onSyncNow() {
  syncing.value = true
  const result = await syncProjects(projects.value, replaceAll)
  syncing.value = false
  if (result.ok) {
    toast.add({ severity: 'success', summary: t('sync.syncSuccess'), life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: t('sync.syncError'), detail: result.error, life: 4000 })
  }
}

function onLogout() {
  confirm.require({
    message: t('auth.logout.message'),
    header: t('auth.logout.title'),
    icon: 'pi pi-sign-out',
    acceptLabel: t('auth.logout.accept'),
    rejectLabel: t('app.cancel'),
    accept: async () => {
      stopSettingsSync()
      resetSyncState()
      await logout()
      router.replace({ name: 'auth' })
    }
  })
}

function onResetAll() {
  confirm.require({
    message: t('settings.resetAll.message'),
    header: t('settings.resetAll.title'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('settings.resetAll.accept'),
    rejectLabel: t('app.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await db.clearAllData()
        toast.add({ severity: 'info', summary: t('settings.resetAll.success'), life: 2000 })
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) {
        console.error('[FastReport] Reset failed:', err)
        toast.add({ severity: 'error', summary: t('app.error'), life: 3000 })
      }
    }
  })
}
</script>

<template>
  <div class="settings-page">

    <!-- Profile -->
    <section class="section">
      <h2 class="section-title">{{ t('settings.profile') }}</h2>
      <div class="card">
        <div class="profile-field">
          <label class="profile-label">{{ t('settings.userName') }}</label>
          <InputText
            v-model="profileName"
            :placeholder="t('settings.userNamePlaceholder')"
            class="profile-input"
          />
        </div>
        <div class="profile-field">
          <label class="profile-label">{{ t('settings.userEmail') }}</label>
          <InputText
            v-model="profileEmail"
            type="email"
            disabled
            class="profile-input"
          />
        </div>
        <p class="card-hint">
          <i class="pi pi-info-circle"></i>
          {{ t('settings.profileHint') }}
        </p>
        <button class="save-btn" :disabled="savingProfile" @click="saveProfile">
          <i :class="savingProfile ? 'pi pi-spin pi-spinner' : 'pi pi-check'"></i>
          {{ t('app.save') }}
        </button>
      </div>
    </section>

    <!-- Preferences -->
    <section class="section">
      <h2 class="section-title">{{ t('settings.preferences') }}</h2>
      <div class="card">
        <div class="row-between">
          <span class="row-label">{{ t('settings.language') }}</span>
          <Select
            v-model="settings.langPref"
            :options="langOptions"
            optionLabel="label"
            optionValue="value"
            class="lang-select"
          />
        </div>
      </div>
    </section>

    <!-- Storage -->
    <section class="section">
      <h2 class="section-title">{{ t('settings.storage') }}</h2>

      <div class="stats-row">
        <div class="stat-chip">
          <span class="stat-chip-value">{{ projects.length }}</span>
          <span class="stat-chip-label">{{ t('settings.projects') }}</span>
        </div>
        <div class="stat-chip">
          <span class="stat-chip-value">{{ totalPhotos() }}</span>
          <span class="stat-chip-label">{{ t('settings.photos') }}</span>
        </div>
        <div class="stat-chip">
          <span class="stat-chip-value">{{ formatBytes(totalBytes) }}</span>
          <span class="stat-chip-label">{{ t('settings.data') }}</span>
        </div>
      </div>

      <div class="card">
        <div class="storage-label-row">
          <span class="storage-label">{{ t('settings.deviceStorage') }}</span>
          <span class="storage-pct">{{ storagePercent() }}%</span>
        </div>
        <div class="storage-bar">
          <div class="storage-bar-fill" :style="{ width: storagePercent() + '%' }"></div>
        </div>
        <span class="storage-detail">{{ formatBytes(storageUsed) }} / {{ formatBytes(storageQuota) }}</span>
      </div>

      <div class="card">
        <button class="action-row" @click="onBackup" :disabled="backingUp">
          <span class="action-icon action-icon-accent">
            <i :class="backingUp ? 'pi pi-spin pi-spinner' : 'pi pi-download'"></i>
          </span>
          <div class="action-text">
            <span class="action-label">{{ t('settings.backup') }}</span>
            <span class="action-hint">{{ t('settings.backupHint') }}</span>
          </div>
          <i class="pi pi-chevron-right action-arrow"></i>
        </button>
      </div>

      <div class="card card-danger">
        <button class="action-row" @click="onResetAll">
          <span class="action-icon action-icon-danger">
            <i class="pi pi-trash"></i>
          </span>
          <div class="action-text">
            <span class="action-label action-label-danger">{{ t('settings.resetAll') }}</span>
            <span class="action-hint">{{ t('settings.resetAllHint') }}</span>
          </div>
          <i class="pi pi-chevron-right action-arrow"></i>
        </button>
      </div>
    </section>

    <!-- Cloud Sync -->
    <section class="section">
      <h2 class="section-title">{{ t('sync.cloudSync') }}</h2>
      <div class="card">
        <div class="row-between">
          <span class="row-label">Status</span>
          <span class="sync-status" :class="'sync-status-' + syncState">
            <template v-if="syncState === 'synced'">
              <i class="pi pi-check-circle"></i> {{ t('sync.synced') }}
            </template>
            <template v-else-if="syncState === 'syncing'">
              <i class="pi pi-spin pi-spinner"></i> {{ t('sync.syncing') }}
            </template>
            <template v-else-if="syncState === 'pending'">
              <i class="pi pi-cloud-upload"></i> {{ t('sync.pending') }}
            </template>
            <template v-else-if="syncState === 'error'">
              <i class="pi pi-exclamation-circle"></i> {{ t('sync.error') }}
            </template>
            <template v-else>
              <i class="pi pi-cloud"></i> —
            </template>
          </span>
        </div>
        <span v-if="syncState === 'synced' && syncedTimeAgo" class="storage-detail">{{ syncedTimeAgo }}</span>
        <span v-if="syncState === 'error' && syncErrorMsg" class="storage-detail" style="color: var(--color-error)">{{ syncErrorMsg }}</span>
      </div>
      <div class="card">
        <button class="action-row" :disabled="syncing" @click="onSyncNow">
          <span class="action-icon action-icon-accent">
            <i :class="syncing ? 'pi pi-spin pi-spinner' : 'pi pi-sync'"></i>
          </span>
          <div class="action-text">
            <span class="action-label">{{ t('sync.syncNow') }}</span>
            <span class="action-hint">{{ t('sync.syncNowHint') }}</span>
          </div>
          <i class="pi pi-chevron-right action-arrow"></i>
        </button>
      </div>
    </section>

    <!-- Access Control (admin only) -->
    <section v-if="showAdmin" class="section">
      <h2 class="section-title">{{ t('access.title') }}</h2>

      <div class="card">
        <div class="access-add-row">
          <InputText
            v-model="newUserEmail"
            type="email"
            :placeholder="t('access.addPlaceholder')"
            class="access-add-input"
            @keyup.enter="onAddUser"
          />
          <button class="access-add-btn" :disabled="addingUser" @click="onAddUser">
            <i :class="addingUser ? 'pi pi-spin pi-spinner' : 'pi pi-plus'"></i>
          </button>
        </div>
      </div>

      <div v-for="user in accessUsers" :key="user.email" class="card">
        <div class="access-user-header">
          <div class="access-user-info">
            <span class="access-user-email">{{ user.email }}</span>
            <span v-if="user.email === ADMIN_EMAIL" class="access-badge access-badge-admin">{{ t('access.admin') }}</span>
            <span v-else-if="user.status === 'active'" class="access-badge access-badge-active">{{ t('access.active') }}</span>
            <span v-else class="access-badge access-badge-revoked">{{ t('access.revoked') }}</span>
          </div>
        </div>
        <div class="access-user-meta">
          <span><i class="pi pi-clock"></i> {{ formatLastAccess(user.lastAccessAt) }}</span>
          <span><i class="pi pi-desktop"></i> {{ shortDevice(user.deviceInfo) }}</span>
        </div>
        <div v-if="user.email !== ADMIN_EMAIL" class="access-user-actions">
          <button
            v-if="user.status === 'active'"
            class="access-action-btn access-action-revoke"
            @click="onRevokeUser(user.email)"
          >
            <i class="pi pi-ban"></i> {{ t('access.revoke') }}
          </button>
          <button
            v-else
            class="access-action-btn access-action-reinstate"
            @click="onReinstateUser(user.email)"
          >
            <i class="pi pi-check"></i> {{ t('access.reinstate') }}
          </button>
          <button
            class="access-action-btn access-action-delete"
            @click="onDeleteUser(user.email)"
          >
            <i class="pi pi-trash"></i> {{ t('access.delete') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Account -->
    <section class="section">
      <div class="card">
        <button class="action-row" @click="onLogout">
          <span class="action-icon action-icon-danger">
            <i class="pi pi-sign-out"></i>
          </span>
          <div class="action-text">
            <span class="action-label action-label-danger">{{ t('auth.logout') }}</span>
            <span class="action-hint">{{ t('auth.logoutHint') }}</span>
          </div>
          <i class="pi pi-chevron-right action-arrow"></i>
        </button>
      </div>
    </section>

    <!-- About -->
    <section class="section">
      <h2 class="section-title">{{ t('settings.about') }}</h2>
      <div class="card">
        <div class="row-between">
          <span class="row-label">{{ t('settings.version') }}</span>
          <span class="row-value">0.1.0</span>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* --- Card --- */
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.card-danger {
  border-color: rgba(220, 38, 38, 0.15);
}

.card-hint {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--color-text-secondary);
}

.card-hint i {
  font-size: 10px;
  flex-shrink: 0;
}

/* --- Profile --- */
.profile-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.profile-input {
  width: 100%;
  padding: 6px 8px !important;
}

/* --- Save Button --- */
.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: 6px 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.save-btn:active {
  opacity: 0.8;
}

.save-btn i {
  font-size: 11px;
}

/* --- Row Between --- */
.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
}

.row-value {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.lang-select {
  width: 120px;
}

:deep(.lang-select .p-select-label) {
  padding: 4px 8px;
}

/* --- Stats Row --- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-xs);
}

.stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.stat-chip-value {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-chip-label {
  font-size: 10px;
  color: var(--color-text-secondary);
}

/* --- Storage Bar --- */
.storage-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.storage-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
}

.storage-pct {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.storage-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.storage-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.storage-detail {
  font-size: 10px;
  color: var(--color-text-secondary);
}

/* --- Action Row --- */
.action-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  text-align: left;
}

.action-row:active {
  opacity: 0.7;
}

.action-row:disabled {
  opacity: 0.5;
  cursor: default;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  font-size: 13px;
}

.action-icon-accent {
  background: var(--color-accent);
  color: #fff;
}

.action-icon-danger {
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
}

.action-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.action-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.action-label-danger {
  color: var(--color-error);
}

.action-hint {
  font-size: 10px;
  color: var(--color-text-secondary);
  line-height: 1.2;
}

.action-arrow {
  font-size: 10px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

/* --- Sync Status --- */
.sync-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.sync-status i {
  font-size: 11px;
}

.sync-status-synced {
  color: #10B981;
}

.sync-status-syncing {
  color: var(--color-text-secondary);
}

.sync-status-pending {
  color: #F59E0B;
}

.sync-status-error {
  color: var(--color-error);
}

.sync-status-idle {
  color: var(--color-text-secondary);
}

/* --- Access Control --- */
.access-add-row {
  display: flex;
  gap: var(--spacing-xs);
}

.access-add-input {
  flex: 1;
  padding: 6px 8px !important;
}

.access-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  -webkit-tap-highlight-color: transparent;
}

.access-add-btn:active {
  opacity: 0.8;
}

.access-user-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.access-user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.access-user-email {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.access-badge-admin {
  background: var(--color-accent);
  color: #fff;
}

.access-badge-active {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
}

.access-badge-revoked {
  background: rgba(239, 68, 68, 0.12);
  color: #EF4444;
}

.access-user-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: 10px;
  color: var(--color-text-secondary);
}

.access-user-meta i {
  font-size: 10px;
  margin-right: 2px;
}

.access-user-actions {
  display: flex;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border);
}

.access-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.access-action-btn:active {
  opacity: 0.7;
}

.access-action-revoke {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
}

.access-action-reinstate {
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
}

.access-action-delete {
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-error);
}
</style>
