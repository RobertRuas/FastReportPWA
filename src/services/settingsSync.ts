import { watch, type Reactive } from 'vue'
import { supabase } from './supabase'
import type { AppSettings } from '@/models/types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { markSyncing, markSynced, markSyncError } from '@/composables/useSyncStatus'

let channel: RealtimeChannel | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let remoteUpdate = false
let stopWatch: (() => void) | null = null
let currentUserId: string | null = null

export async function startSettingsSync(settings: Reactive<AppSettings>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  currentUserId = user.id

  markSyncing()

  const { data, error } = await supabase
    .from('fr_settings')
    .select('cols, lang_pref, ui, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    markSyncError(error.message)
    return
  }

  if (data) {
    remoteUpdate = true
    const cols = data.cols
    settings.cols = typeof cols === 'number' ? cols : 'auto'
    settings.langPref = data.lang_pref as AppSettings['langPref']
    settings.ui = data.ui
    remoteUpdate = false
  } else {
    await upsertSettings(user.id, settings)
  }

  markSynced()

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
      const cols = row.cols
      settings.cols = typeof cols === 'number' ? cols : 'auto'
      settings.langPref = (row.lang_pref as string) as AppSettings['langPref']
      settings.ui = row.ui as number
      remoteUpdate = false
      markSynced()
    })
    .subscribe()

  stopWatch = watch(
    () => ({ cols: settings.cols, langPref: settings.langPref, ui: settings.ui }),
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
  markSyncing()
  const { error } = await supabase.from('fr_settings').upsert({
    user_id: userId,
    cols: settings.cols === 'auto' ? 'auto' : settings.cols,
    lang_pref: settings.langPref,
    ui: settings.ui,
    updated_at: new Date().toISOString()
  })
  if (error) markSyncError(error.message)
  else markSynced()
}

export function stopSettingsSync() {
  if (channel) { supabase.removeChannel(channel); channel = null }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  if (stopWatch) { stopWatch(); stopWatch = null }
  currentUserId = null
}
