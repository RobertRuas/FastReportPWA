<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useAuth } from '@/composables/useAuth'
import { useSettings } from '@/composables/useSettings'
import { useI18n } from '@/composables/useI18n'

const router = useRouter()
const { requestCode, verify } = useAuth()
const { settings } = useSettings()
const { t } = useI18n()

const step = ref<'register' | 'verify'>('register')
const name = ref('')
const email = ref('')
const digits = ref(['', '', '', ''])
const loading = ref(false)
const error = ref('')
const digitRefs = ref<HTMLInputElement[]>([])

onMounted(() => {
  setTimeout(() => document.getElementById('auth-name')?.focus(), 150)
})

async function handleRequestCode() {
  const n = name.value.trim()
  const e = email.value.trim()

  if (!n || !e) {
    error.value = t('auth.error.required')
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    error.value = t('auth.error.invalidEmail')
    return
  }

  error.value = ''
  loading.value = true
  const sent = await requestCode(n, e)
  loading.value = false

  if (!sent) {
    error.value = t('auth.error.emailNotSent')
  }

  step.value = 'verify'
  await nextTick()
  digitRefs.value[0]?.focus()
}

async function handleVerify() {
  const code = digits.value.join('')
  if (code.length !== 4) {
    error.value = t('auth.error.incompleteCode')
    return
  }

  error.value = ''
  loading.value = true

  const ok = await verify(name.value.trim(), email.value.trim(), code)
  loading.value = false

  if (ok) {
    settings.userName = name.value.trim()
    settings.userEmail = email.value.trim()
    router.replace('/')
  } else {
    error.value = t('auth.error.invalidCode')
    digits.value = ['', '', '', '']
    await nextTick()
    digitRefs.value[0]?.focus()
  }
}

function onDigitInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/\D/g, '')
  digits.value[index] = val.slice(-1)
  input.value = digits.value[index]

  if (val && index < 3) {
    digitRefs.value[index + 1]?.focus()
  }

  if (digits.value.every(d => d !== '')) {
    handleVerify()
  }
}

function onDigitKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    digitRefs.value[index - 1]?.focus()
  }
}

function onDigitPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 4)
  for (let i = 0; i < 4; i++) digits.value[i] = text[i] || ''
  if (text.length === 4) {
    handleVerify()
  } else {
    const next = digits.value.findIndex(d => !d)
    if (next >= 0) digitRefs.value[next]?.focus()
  }
}

async function handleResend() {
  digits.value = ['', '', '', '']
  error.value = ''
  await requestCode(name.value.trim(), email.value.trim())
  nextTick(() => digitRefs.value[0]?.focus())
}

function handleBack() {
  step.value = 'register'
  digits.value = ['', '', '', '']
  error.value = ''
}

function focusEmail() {
  document.getElementById('auth-email')?.focus()
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
        <p class="auth-subtitle">{{ t('auth.subtitle') }}</p>
      </div>

      <!-- Step 1: Register -->
      <div v-if="step === 'register'" class="auth-form">
        <div class="auth-field">
          <label for="auth-name">{{ t('auth.name') }}</label>
          <InputText
            id="auth-name"
            v-model="name"
            :placeholder="t('auth.namePlaceholder')"
            autocomplete="name"
            @keyup.enter="focusEmail"
          />
        </div>

        <div class="auth-field">
          <label for="auth-email">{{ t('auth.email') }}</label>
          <InputText
            id="auth-email"
            v-model="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
            autocomplete="email"
            @keyup.enter="handleRequestCode"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <Button
          :label="t('auth.requestAccess')"
          :loading="loading"
          class="auth-submit"
          @click="handleRequestCode"
        />
      </div>

      <!-- Step 2: Verify -->
      <div v-else class="auth-form">
        <p class="auth-verify-msg">
          {{ t('auth.codeSent') }}
          <strong>{{ email }}</strong>
        </p>

        <div class="auth-digits" @paste="onDigitPaste">
          <input
            v-for="(_, i) in 4"
            :key="i"
            :ref="(el: any) => { if (el) digitRefs[i] = el as HTMLInputElement }"
            :value="digits[i]"
            type="tel"
            inputmode="numeric"
            maxlength="1"
            class="auth-digit"
            @input="onDigitInput(i, $event)"
            @keydown="onDigitKeydown(i, $event)"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <Button
          :label="t('auth.verify')"
          :loading="loading"
          class="auth-submit"
          @click="handleVerify"
        />

        <div class="auth-links">
          <button class="auth-link" @click="handleResend">
            {{ t('auth.resendCode') }}
          </button>
          <button class="auth-link" @click="handleBack">
            {{ t('auth.changeEmail') }}
          </button>
        </div>
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

/* Brand */
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

/* Form */
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

.auth-field :deep(.p-inputtext) {
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

/* Verify step */
.auth-verify-msg {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.auth-verify-msg strong {
  color: var(--color-text-primary);
  word-break: break-all;
}

.auth-digits {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
}

.auth-digit {
  width: 52px;
  height: 60px;
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  -webkit-appearance: none;
}

.auth-digit:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(55, 65, 81, 0.15);
}

/* Links */
.auth-links {
  display: flex;
  justify-content: center;
  gap: var(--spacing-lg);
}

.auth-link {
  background: none;
  border: none;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs);
  text-decoration: underline;
  text-underline-offset: 2px;
  -webkit-tap-highlight-color: transparent;
}

.auth-link:active {
  color: var(--color-text-primary);
}
</style>
