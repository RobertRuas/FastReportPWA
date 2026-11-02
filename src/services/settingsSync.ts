import { watch, type Reactive } from 'vue'
import { supabase } from './supabase'
import type { AppSettings } from '@/models/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

let channel: RealtimeChannel | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let remoteUpdate = false
let stopWatch: (() => void) | null = null
let currentUserId: string | null = null

export async function startSettingsSync(settings: Reactive<AppSettings>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  currentUserId = user.id

  const { data, error } = await supabase
    .from('fr_settings')
    .select('lang_pref, ui, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return

  if (data) {
    remoteUpdate = true
    settings.langPref = data.lang_pref as AppSettings['langPref']
    settings.ui = data.ui
    remoteUpdate = false
  } else {
    await upsertSettings(user.id, settings)
  }

  channel = supabase
    .channel('fr-settings-sync')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'fr_settings',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      const row = payload.new as Record<string, unknown>
      if (!row) return
      remoteUpdate = true
      settings.langPref = (row.lang_pref as string) as AppSettings['langPref']
      settings.ui = row.ui as number
      remoteUpdate = false
    })
    .subscribe()

  stopWatch = watch(
    () => ({ langPref: settings.langPref, ui: settings.ui }),
    () => {
      if (remoteUpdate) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (currentUserId) upsertSettings(currentUserId, settings)
      }, 1000)
    },
    { deep: true }
  )
}

async function upsertSettings(userId: string, settings: AppSettings) {
  await supabase.from('fr_settings').upsert({
    user_id: userId,
    lang_pref: settings.langPref,
    ui: settings.ui,
    updated_at: new Date().toISOString()
  })
}

export function stopSettingsSync() {
  if (channel) { supabase.removeChannel(channel); channel = null }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  if (stopWatch) { stopWatch(); stopWatch = null }
  currentUserId = null
}
