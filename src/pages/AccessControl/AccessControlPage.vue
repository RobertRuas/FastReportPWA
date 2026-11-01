<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import InputText from 'primevue/inputtext'
import { useI18n } from '@/composables/useI18n'
import {
  ADMIN_EMAIL,
  listAllowedUsers, addAllowedUser, revokeUser, reinstateUser, deleteAllowedUser,
  type AccessEntry
} from '@/services/accessService'

const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()

const accessUsers = ref<AccessEntry[]>([])
const newUserEmail = ref('')
const addingUser = ref(false)

onMounted(async () => {
  accessUsers.value = await listAllowedUsers()
})

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
</script>

<template>
  <div class="access-page">

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

  </div>
</template>

<style scoped>
.access-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

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
