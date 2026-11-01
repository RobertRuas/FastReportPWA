import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  name: string
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string) ?? ''
  }
}

export async function checkAuth(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return toAuthUser(session.user)
  return null
}

export async function sendOtp(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  })
  return { error: error?.message ?? null }
}

export async function verifyOtp(
  email: string,
  token: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  })
  if (error) return { user: null, error: error.message }
  return { user: data.user ? toAuthUser(data.user) : null, error: null }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export async function updateProfile(name: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ data: { name } })
  return { error: error?.message ?? null }
}

export function onAuthStateChange(
  callback: (user: AuthUser | null, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? toAuthUser(session.user) : null, session)
  })
}
