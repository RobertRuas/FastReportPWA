import { reactive, watch } from 'vue'
import type { AppSettings } from '@/models/types'
import * as db from '@/services/db'

const defaults: AppSettings = {
  cols: 'auto',
  langPref: 'auto',
  ui: 1,
  userName: '',
  userEmail: ''
}

const settings = reactive<AppSettings>({ ...defaults })
let loaded = false

watch(settings, (val) => {
  if (!loaded) return
  db.saveAllSettings(val)
}, { deep: true })

export function useSettings() {
  async function load() {
    const saved = await db.getSettings()
    Object.assign(settings, saved)
    loaded = true
  }

  function reset() {
    Object.assign(settings, { ...defaults })
  }

  return { settings, load, reset }
}
