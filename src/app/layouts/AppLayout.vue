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
import { useI18n } from '@/composables/useI18n'
import { startSettingsSync, stopSettingsSync } from '@/services/settingsSync'
import { checkAccess } from '@/services/accessService'
import { listRemoteBackups } from '@/services/backupSync'
import { useToast } from 'primevue/usetoast'
import type { PageAction } from '@/app/router'

const route = useRoute()
const router = useRouter()
const { overrideActions } = usePageActions()
const { titleOverride } = usePageTitle()
const toast = useToast()
const { t } = useI18n()
const { projects, ready, load: loadProjects } = useProjects()
const { settings, load: loadSettings } = useSettings()
const { authenticated, currentUser, logout } = useAuth()

const booted = ref(false)
const showSyncBanner = ref(false)
const remoteCount = ref(0)

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
      const backups = await listRemoteBackups()
      markDeviceInitialized()
      if (backups.length > 0) {
        remoteCount.value = backups.length
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

function dismissBanner() {
  showSyncBanner.value = false
}

const headerActions = computed<PageAction[]>(() => {
  if (isHome.value) {
    return [
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

      <!-- New device sync banner (only on home) -->
      <div v-if="showSyncBanner && isHome" class="sync-banner">
        <div class="sync-banner-content">
          <i class="pi pi-cloud-download sync-banner-icon"></i>
          <div class="sync-banner-text">
            <span class="sync-banner-title">{{ t('sync.newDeviceTitle') }}</span>
            <span class="sync-banner-hint">{{ remoteCount }} {{ t('sync.newDeviceBackups') }}</span>
          </div>
        </div>
        <div class="sync-banner-actions">
          <button class="sync-banner-btn sync-banner-btn-dismiss" @click="dismissBanner">
            {{ t('app.close') }}
          </button>
        </div>
      </div>

      <main class="app-content" :class="{ 'app-content-fullscreen': isFullscreen }">
        <router-view />
      </main>

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

</style>

<style>
.p-toast.p-toast-top-center {
  top: calc(var(--safe-area-top) + var(--header-height) + var(--toolbar-height) + 8px) !important;
}
</style>
