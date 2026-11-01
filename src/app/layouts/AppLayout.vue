<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import AppHeader from '@/components/navigation/AppHeader.vue'
import PageToolbar from '@/components/navigation/PageToolbar.vue'
import ImportOverlay from '@/components/feedback/ImportOverlay.vue'
import { usePageActions } from '@/composables/usePageActions'
import { usePageTitle } from '@/composables/usePageTitle'
import { useProjects } from '@/composables/useProjects'
import { useSettings } from '@/composables/useSettings'
import { useAuth } from '@/composables/useAuth'
import { useBackgroundSync } from '@/composables/useBackgroundSync'
import { useI18n } from '@/composables/useI18n'
import { startSettingsSync, stopSettingsSync } from '@/services/settingsSync'
import { checkAccess } from '@/services/accessService'
import { syncProjectsMetadataOnly } from '@/services/projectSync'
import { useToast } from 'primevue/usetoast'
import type { PageAction } from '@/app/router'

const route = useRoute()
const router = useRouter()
const { overrideActions } = usePageActions()
const { titleOverride } = usePageTitle()
const toast = useToast()
const { t } = useI18n()
const { projects, ready, load: loadProjects, replaceAll } = useProjects()
const { settings, load: loadSettings } = useSettings()
const { authenticated, currentUser, logout } = useAuth()
const { running: bgSyncing, progress: bgProgress, total: bgTotal, percent: bgPercent, startSync } = useBackgroundSync()

const booted = ref(false)
const showSyncBanner = ref(false)

const DEVICE_KEY = 'fr_device_initialized'

function isNewDevice(): boolean {
  return !localStorage.getItem(DEVICE_KEY)
}

function markDeviceInitialized() {
  localStorage.setItem(DEVICE_KEY, new Date().toISOString())
}

onMounted(async () => {
  await Promise.all([loadProjects(), loadSettings()])

  if (authenticated.value && currentUser.value?.email) {
    const access = await checkAccess(currentUser.value.email)
    if (access !== 'allowed') {
      await logout()
      router.replace({ name: 'auth' })
      return
    }
    startSettingsSync(settings)

    if (isNewDevice()) {
      await syncProjectsMetadataOnly(projects.value, replaceAll)
      markDeviceInitialized()
      if (projects.value.length > 0) {
        showSyncBanner.value = true
      }
    }
  }

  booted.value = true
})

onUnmounted(() => {
  stopSettingsSync()
})

const isFullscreen = computed(() => route.meta.fullscreen === true)
const isPublic = computed(() => route.meta.public === true)
const isHome = computed(() => route.meta.isHome === true)
const pageTitle = computed(() => titleOverride.value ?? (route.meta.title as string) ?? '')
const toolbarActions = computed(() => overrideActions.value ?? (route.meta.actions as PageAction[]) ?? [])

async function onSync() {
  if (bgSyncing.value) return
  showSyncBanner.value = false
  const result = await startSync(projects.value, replaceAll)
  if (result.ok) {
    toast.add({ severity: 'success', summary: t('sync.syncSuccess'), life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: t('sync.syncError'), detail: result.error, life: 4000 })
  }
}

function dismissBanner() {
  showSyncBanner.value = false
}

const headerActions = computed<PageAction[]>(() => {
  if (isHome.value) {
    return [
      { icon: bgSyncing.value ? 'pi pi-spin pi-spinner' : 'pi pi-sync', label: t('sync.syncNow'), handler: onSync },
      { icon: 'pi pi-plus', label: t('new.title'), handler: () => router.push('/projects/new') }
    ]
  }
  return []
})
</script>

<template>
  <div class="app-layout">
    <template v-if="booted">
      <template v-if="!isFullscreen">
        <AppHeader :title="pageTitle" :actions="headerActions" />
        <PageToolbar v-if="!isHome" :actions="toolbarActions" />
      </template>

      <!-- New device sync banner -->
      <div v-if="showSyncBanner && !bgSyncing" class="sync-banner">
        <div class="sync-banner-content">
          <i class="pi pi-cloud-download sync-banner-icon"></i>
          <div class="sync-banner-text">
            <span class="sync-banner-title">{{ t('sync.newDeviceTitle') }}</span>
            <span class="sync-banner-hint">{{ t('sync.newDeviceHint') }}</span>
          </div>
        </div>
        <div class="sync-banner-actions">
          <button class="sync-banner-btn sync-banner-btn-primary" @click="onSync">
            <i class="pi pi-sync"></i> {{ t('sync.syncNow') }}
          </button>
          <button class="sync-banner-btn sync-banner-btn-dismiss" @click="dismissBanner">
            {{ t('app.close') }}
          </button>
        </div>
      </div>

      <main class="app-content" :class="{ 'app-content-fullscreen': isFullscreen }">
        <router-view />
      </main>

      <!-- Background sync progress bar -->
      <div v-if="bgSyncing" class="bg-sync-bar">
        <div class="bg-sync-fill" :style="{ width: bgPercent + '%' }"></div>
        <span class="bg-sync-text">
          <i class="pi pi-spin pi-spinner"></i>
          {{ t('sync.syncing') }} {{ bgTotal > 0 ? `${bgProgress}/${bgTotal}` : '' }}
        </span>
      </div>
    </template>
    <template v-else-if="isPublic">
      <main class="app-content app-content-fullscreen">
        <router-view />
      </main>
    </template>
    <div v-else class="app-loading">
      <i class="pi pi-spin pi-spinner app-loading-icon"></i>
    </div>
    <ImportOverlay />
    <Toast position="top-center" />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--color-bg-primary);
}

.app-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--safe-area-bottom));
  background-color: var(--color-bg-primary);
}

.app-content-fullscreen {
  padding: 0;
}

.app-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-primary);
}

.app-loading-icon {
  font-size: 24px;
  color: var(--color-text-secondary);
}

/* --- New device sync banner --- */
.sync-banner {
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.sync-banner-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.sync-banner-icon {
  font-size: 20px;
  color: var(--color-accent);
  flex-shrink: 0;
}

.sync-banner-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sync-banner-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.sync-banner-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.sync-banner-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.sync-banner-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-family);
  min-height: var(--touch-target);
}

.sync-banner-btn-primary {
  background: var(--color-accent);
  color: #fff;
}

.sync-banner-btn-primary:active { opacity: 0.85; }

.sync-banner-btn-dismiss {
  background: var(--color-border);
  color: var(--color-text-secondary);
}

.sync-banner-btn-dismiss:active { opacity: 0.85; }

/* --- Background sync bar --- */
.bg-sync-bar {
  position: relative;
  height: 28px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  overflow: hidden;
}

.bg-sync-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(55, 65, 81, 0.1);
  transition: width 0.3s ease;
}

.bg-sync-text {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  height: 100%;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.bg-sync-text i {
  font-size: 10px;
}
</style>

<style>
.p-toast.p-toast-top-center {
  top: calc(var(--safe-area-top) + var(--header-height) + var(--toolbar-height) + 8px) !important;
}
</style>
