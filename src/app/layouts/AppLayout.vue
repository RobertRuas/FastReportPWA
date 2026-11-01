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
import { startSettingsSync, stopSettingsSync } from '@/services/settingsSync'
import { checkAccess } from '@/services/accessService'
import { syncProjects } from '@/services/projectSync'
import { useToast } from 'primevue/usetoast'
import type { PageAction } from '@/app/router'

const route = useRoute()
const router = useRouter()
const { overrideActions } = usePageActions()
const { titleOverride } = usePageTitle()
const toast = useToast()
const { projects, ready, load: loadProjects, replaceAll } = useProjects()
const { settings, load: loadSettings } = useSettings()
const { authenticated, currentUser, logout } = useAuth()
const syncing = ref(false)

const booted = ref(false)
const initialSync = ref(false)

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
      initialSync.value = true
      await syncProjects(projects.value, replaceAll)
      markDeviceInitialized()
      initialSync.value = false
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
  if (syncing.value) return
  syncing.value = true
  const result = await syncProjects(projects.value, replaceAll)
  syncing.value = false
  if (result.ok) {
    toast.add({ severity: 'success', summary: 'Sincronizado', life: 2000 })
  } else {
    toast.add({ severity: 'error', summary: 'Erro ao sincronizar', detail: result.error, life: 4000 })
  }
}

const headerActions = computed<PageAction[]>(() => {
  if (isHome.value) {
    return [
      { icon: syncing.value ? 'pi pi-spin pi-spinner' : 'pi pi-sync', label: 'Sincronizar', handler: onSync },
      { icon: 'pi pi-plus', label: 'Novo projeto', handler: () => router.push('/projects/new') }
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
      <p v-if="initialSync" class="app-loading-text">A sincronizar dados...</p>
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
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-primary);
}

.app-loading-icon {
  font-size: 24px;
  color: var(--color-text-secondary);
}

.app-loading-text {
  margin-top: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>

<style>
.p-toast.p-toast-top-center {
  top: calc(var(--safe-area-top) + var(--header-height) + var(--toolbar-height) + 8px) !important;
}
</style>
