import { ref } from 'vue'
import {
  checkAuth,
  sendOtp as sendOtpService,
  verifyOtp as verifyOtpService,
  logout as logoutService,
  updateProfile as updateProfileService,
  onAuthStateChange
} from '@/services/authService'
import type { AuthUser } from '@/services/authService'

const authenticated = ref(false)
const currentUser = ref<AuthUser | null>(null)
const checked = ref(false)
let listenerSetup = false

function setupListener() {
  if (listenerSetup) return
  listenerSetup = true
  onAuthStateChange((user) => {
    currentUser.value = user
    authenticated.value = user !== null
  })
}

export function useAuth() {
  setupListener()

  async function check(): Promise<boolean> {
    const user = await checkAuth()
    authenticated.value = user !== null
    currentUser.value = user
    checked.value = true
    return authenticated.value
  }

  async function sendOtp(email: string): Promise<{ error: string | null }> {
    return sendOtpService(email)
  }

  async function verifyOtp(email: string, token: string): Promise<{ ok: boolean; error: string | null }> {
    const result = await verifyOtpService(email, token)
    if (result.user) {
      authenticated.value = true
      currentUser.value = result.user
    }
    return { ok: !result.error, error: result.error }
  }

  async function logout(): Promise<void> {
    await logoutService()
    authenticated.value = false
    currentUser.value = null
    checked.value = false
    localStorage.removeItem('fr_device_initialized')
  }

  async function updateProfile(name: string): Promise<{ error: string | null }> {
    const result = await updateProfileService(name)
    if (!result.error && currentUser.value) {
      currentUser.value = { ...currentUser.value, name }
    }
    return result
  }

  return { authenticated, currentUser, checked, check, sendOtp, verifyOtp, logout, updateProfile }
}
