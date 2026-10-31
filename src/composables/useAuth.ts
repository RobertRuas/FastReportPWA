import { ref } from 'vue'
import {
  checkAuth,
  requestVerificationCode,
  verifyCode,
  logout as logoutService
} from '@/services/authService'
import type { DeviceAuth } from '@/services/authService'

const authenticated = ref(false)
const currentUser = ref<DeviceAuth | null>(null)
const checked = ref(false)

export function useAuth() {
  async function check(): Promise<boolean> {
    const auth = await checkAuth()
    authenticated.value = auth !== null
    currentUser.value = auth
    checked.value = true
    return authenticated.value
  }

  async function requestCode(name: string, email: string): Promise<boolean> {
    return requestVerificationCode(name, email)
  }

  async function verify(name: string, email: string, code: string): Promise<boolean> {
    const auth = await verifyCode(name, email, code)
    if (auth) {
      authenticated.value = true
      currentUser.value = auth
      return true
    }
    return false
  }

  async function logout(): Promise<void> {
    await logoutService()
    authenticated.value = false
    currentUser.value = null
    checked.value = false
  }

  return { authenticated, currentUser, checked, check, requestCode, verify, logout }
}
