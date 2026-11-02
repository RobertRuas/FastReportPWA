<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { checkAccess, updateLastAccess } from '@/services/accessService'

const router = useRouter()
const { sendOtp, verifyOtp, updateProfile, logout } = useAuth()
const { t } = useI18n()

type Step = 'email' | 'verify' | 'name'

const step = ref<Step>('email')
const email = ref('')
const name = ref('')
const digits = ref(['', '', '', '', '', ''])
const digitRefs = ref<HTMLInputElement[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')

onMounted(() => {
  setTimeout(() => document.getElementById('auth-email')?.focus(), 150)
})

// --- Send OTP ---

async function handleSendCode() {
  const e = email.value.trim()
  if (!e) { error.value = t('auth.error.required'); return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { error.value = t('auth.error.invalidEmail'); return }

  error.value = ''
  loading.value = true
  const result = await sendOtp(e)
  loading.value = false

  if (result.error) { error.value = result.error; return }

  step.value = 'verify'
  success.value = ''
  await nextTick()
  digitRefs.value[0]?.focus()
}

// --- Verify OTP ---

async function handleVerify() {
  const code = digits.value.join('')
  if (code.length !== 6) { error.value = t('auth.error.incompleteCode'); return }

  error.value = ''
  loading.value = true
  const result = await verifyOtp(email.value.trim(), code)
  loading.value = false

  if (!result.ok) {
    error.value = result.error ?? t('auth.error.invalidCode')
    resetDigits()
    return
  }

  const access = await checkAccess(email.value.trim())
  if (access === 'denied') {
    error.value = t('auth.error.notAuthorized')
    await logout()
    step.value = 'email'
    loading.value = false
    return
  }
  if (access === 'revoked') {
    error.value = t('auth.error.accessRevoked')
    await logout()
    step.value = 'email'
    loading.value = false
    return
  }

  await updateLastAccess(email.value.trim())

  const { currentUser } = useAuth()
  if (!currentUser.value?.name) {
    step.value = 'name'
    await nextTick()
    document.getElementById('auth-name')?.focus()
    return
  }

  router.replace('/')
}

// --- Set Name ---

async function handleSetName() {
  const n = name.value.trim()
  if (!n) { error.value = t('auth.error.required'); return }

  error.value = ''
  loading.value = true
  await updateProfile(n)
  loading.value = false

  router.replace('/')
}

// --- Resend ---

async function handleResend() {
  error.value = ''
  success.value = ''
  loading.value = true
  const result = await sendOtp(email.value.trim())
  loading.value = false
  if (result.error) { error.value = result.error; return }
  success.value = t('auth.codeResent')
  resetDigits()
}

// --- Navigation ---

function goBackToEmail() {
  step.value = 'email'
  error.value = ''
  success.value = ''
  nextTick(() => document.getElementById('auth-email')?.focus())
}

// --- Digit input ---

function resetDigits() {
  digits.value = ['', '', '', '', '', '']
  nextTick(() => digitRefs.value[0]?.focus())
}

function onDigitInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/\D/g, '')
  digits.value[index] = val.slice(-1)
  input.value = digits.value[index]

  if (val && index < 5) {
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
  const text = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6)
  for (let i = 0; i < 6; i++) digits.value[i] = text[i] || ''
  if (text.length === 6) {
    handleVerify()
  } else {
    const next = digits.value.findIndex(d => !d)
    if (next >= 0) digitRefs.value[next]?.focus()
  }
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
          <template v-if="step === 'email'">{{ t('auth.subtitleEmail') }}</template>
          <template v-else-if="step === 'verify'">{{ t('auth.subtitleVerify') }}</template>
          <template v-else>{{ t('auth.subtitleName') }}</template>
        </p>
      </div>

      <!-- STEP 1: Email -->
      <div v-if="step === 'email'" class="auth-form">
        <div class="auth-field">
          <label for="auth-email">{{ t('auth.email') }}</label>
          <InputText
            id="auth-email"
            v-model="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
            autocomplete="email"
            @keyup.enter="handleSendCode"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <Button
          :label="t('auth.sendCode')"
          :loading="loading"
          class="auth-submit"
          @click="handleSendCode"
        />
      </div>

      <!-- STEP 2: Verify OTP -->
      <div v-else-if="step === 'verify'" class="auth-form">
        <p class="auth-verify-msg">
          {{ t('auth.codeSent') }}
          <strong>{{ email }}</strong>
        </p>

        <div class="auth-digits" @paste="onDigitPaste">
          <input
            v-for="(_, i) in 6"
            :key="i"
            :ref="(el: any) => { if (el) digitRefs[i] = el as HTMLInputElement }"
            :value="digits[i]"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            :autocomplete="i === 0 ? 'one-time-code' : 'off'"
            maxlength="1"
            class="auth-digit"
            @input="onDigitInput(i, $event)"
            @keydown="onDigitKeydown(i, $event)"
          />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>
        <p v-if="success" class="auth-success">{{ success }}</p>

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
          <button class="auth-link" @click="goBackToEmail">
            {{ t('auth.changeEmail') }}
          </button>
        </div>
      </div>

      <!-- STEP 3: Name (first time only) -->
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

.auth-success {
  font-size: var(--font-size-xs);
  color: var(--color-success, #16a34a);
  margin: 0;
  text-align: center;
  line-height: 1.4;
}

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
  gap: var(--spacing-xs);
}

.auth-digit {
  width: 44px;
  height: 56px;
  text-align: center;
  font-size: 20px;
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
