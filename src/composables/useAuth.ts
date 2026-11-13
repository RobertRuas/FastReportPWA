import { ref } from 'vue'
import {
  checkAuth,
  login as loginService,
  logout as logoutService,
  updateProfile as updateProfileService
} from '@/services/authService'
import type { AuthUser } from '@/services/authService'

const authenticated = ref(false)
const currentUser = ref<AuthUser | null>(null)
const checked = ref(false)

export function useAuth() {
  async function check(): Promise<boolean> {
    const user = await checkAuth()
    authenticated.value = user !== null
    currentUser.value = user
    checked.value = true
    return authenticated.value
  }

  async function login(email: string, password: string): Promise<{ ok: boolean; error: string | null; needsName?: boolean }> {
    const result = await loginService(email, password)
    if (result.user) {
      authenticated.value = true
      currentUser.value = result.user
    }
    return { ok: !!result.user, error: result.error, needsName: result.needsName }
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

  return { authenticated, currentUser, checked, check, login, logout, updateProfile }
}
