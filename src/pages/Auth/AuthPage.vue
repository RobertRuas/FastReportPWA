<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { updateLastAccess } from '@/services/accessService'

const router = useRouter()
const { login, updateProfile } = useAuth()
const { t } = useI18n()

type Step = 'login' | 'name'

const step = ref<Step>('login')
const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)
const error = ref('')

onMounted(() => {
  setTimeout(() => document.getElementById('auth-email')?.focus(), 150)
})

function translateError(key: string | null): string {
  if (!key) return ''
  if (key.startsWith('auth.error.')) return t(key)
  return key
}

async function handleLogin() {
  const e = email.value.trim()
  const p = password.value
  if (!e || !p) { error.value = t('auth.error.required'); return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { error.value = t('auth.error.invalidEmail'); return }
  if (p.length < 4) { error.value = t('auth.error.passwordShort'); return }

  error.value = ''
  loading.value = true
  const result = await login(e, p)
  loading.value = false

  if (!result.ok) {
    error.value = translateError(result.error)
    return
  }

  await updateLastAccess(e)

  if (result.needsName) {
    step.value = 'name'
    await nextTick()
    document.getElementById('auth-name')?.focus()
    return
  }

  router.replace('/')
}

async function handleSetName() {
  const n = name.value.trim()
  if (!n) { error.value = t('auth.error.required'); return }

  error.value = ''
  loading.value = true
  await updateProfile(n)
  loading.value = false

  router.replace('/')
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">

      <div class="auth-brand">
        <div class="auth-logo">
          <i class="pi pi-bolt"></i>
        </div>
        <h1 class="auth-app-name">FastReport</h1>
        <p class="auth-subtitle">
          <template v-if="step === 'login'">{{ t('auth.subtitleLogin') }}</template>
          <template v-else>{{ t('auth.subtitleName') }}</template>
        </p>
      </div>

      <!-- STEP 1: Email + Password -->
      <div v-if="step === 'login'" class="auth-form">
        <div class="auth-field">
          <label for="auth-email">{{ t('auth.email') }}</label>
          <InputText
            id="auth-email"
            v-model="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
            autocomplete="email"
            @keyup.enter="handleLogin"
          />
        </div>

        <div class="auth-field">
          <label for="auth-password">{{ t('auth.password') }}</label>
          <Password
            id="auth-password"
            v-model="password"
            :placeholder="t('auth.passwordPlaceholder')"
            :feedback="false"
            toggleMask
            inputClass="auth-pass-input"
            @keyup.enter="handleLogin"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <Button
          :label="t('auth.login')"
          :loading="loading"
          class="auth-submit"
          @click="handleLogin"
        />

        <p class="auth-hint">{{ t('auth.hintFirstLogin') }}</p>
      </div>

      <!-- STEP 2: Name (first time only) -->
      <div v-else class="auth-form">
        <div class="auth-field">
          <label for="auth-name">{{ t('auth.name') }}</label>
          <InputText
            id="auth-name"
            v-model="name"
            :placeholder="t('auth.namePlaceholder')"
            autocomplete="name"
            @keyup.enter="handleSetName"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <Button
          :label="t('auth.continue')"
          :loading="loading"
          class="auth-submit"
          @click="handleSetName"
        />
      </div>

    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  height: 100dvh;
  padding: var(--spacing-lg);
  padding-top: calc(var(--spacing-xl) + var(--safe-area-top));
  padding-bottom: calc(var(--spacing-xl) + var(--safe-area-bottom));
  background: var(--color-bg-primary);
}

.auth-container {
  width: 100%;
  max-width: 340px;
}

.auth-brand {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.auth-logo {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--color-header-bg);
  color: var(--color-header-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: var(--spacing-md);
}

.auth-app-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.auth-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--spacing-xs) 0 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.auth-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.auth-field :deep(.p-inputtext),
.auth-field :deep(.p-password),
.auth-field :deep(.auth-pass-input) {
  width: 100%;
  height: var(--field-height);
}

.auth-submit {
  width: 100%;
  height: var(--button-height);
  justify-content: center;
}

.auth-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
  text-align: center;
}

.auth-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  line-height: 1.4;
  opacity: 0.8;
}
</style>
