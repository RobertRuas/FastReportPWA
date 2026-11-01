import { supabase } from './supabase'

export const ADMIN_EMAIL = '92ruas@gmail.com'

export interface AccessEntry {
  email: string
  status: 'active' | 'revoked'
  lastAccessAt: string | null
  deviceInfo: string | null
  createdAt: string
}

export function isAdmin(email: string | undefined): boolean {
  return email === ADMIN_EMAIL
}

export async function checkAccess(email: string): Promise<'allowed' | 'revoked' | 'denied'> {
  if (email === ADMIN_EMAIL) return 'allowed'

  const { data, error } = await supabase
    .from('fr_access_list')
    .select('status')
    .eq('email', email)
    .maybeSingle()

  if (error || !data) return 'denied'
  return data.status === 'active' ? 'allowed' : 'revoked'
}

export async function updateLastAccess(email: string) {
  await supabase
    .from('fr_access_list')
    .update({
      last_access_at: new Date().toISOString(),
      device_info: navigator.userAgent
    })
    .eq('email', email)
}

export async function listAllowedUsers(): Promise<AccessEntry[]> {
  const { data, error } = await supabase
    .from('fr_access_list')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row: any) => ({
    email: row.email,
    status: row.status,
    lastAccessAt: row.last_access_at,
    deviceInfo: row.device_info,
    createdAt: row.created_at
  }))
}

export async function addAllowedUser(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('fr_access_list')
    .insert({ email: email.toLowerCase().trim(), status: 'active' })

  if (error) return { error: error.message }
  return { error: null }
}

export async function revokeUser(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('fr_access_list')
    .update({ status: 'revoked' })
    .eq('email', email)

  if (error) return { error: error.message }
  return { error: null }
}

export async function reinstateUser(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('fr_access_list')
    .update({ status: 'active' })
    .eq('email', email)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteAllowedUser(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('fr_access_list')
    .delete()
    .eq('email', email)

  if (error) return { error: error.message }
  return { error: null }
}
