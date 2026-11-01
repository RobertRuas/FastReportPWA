import { supabase } from './supabase'
import type { Project } from '@/models/types'
import { exportProject } from './exportService'

export async function exportAndEmailLink(
  project: Project,
  email: string,
  onProgress?: (p: { current: number; total: number }) => void
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    const blob = await exportProject(project, 'folders', onProgress)

    const timestamp = Date.now()
    const filePath = `${user.id}/${project.slug || project.id}-${timestamp}.zip`

    const { error: uploadError } = await supabase.storage
      .from('fr-exports')
      .upload(filePath, blob, {
        contentType: 'application/zip',
        upsert: false
      })

    if (uploadError) throw new Error(uploadError.message)

    const { data: signedData, error: signError } = await supabase.storage
      .from('fr-exports')
      .createSignedUrl(filePath, 3600)

    if (signError || !signedData?.signedUrl) throw new Error(signError?.message ?? 'Failed to create download link')

    const downloadUrl = signedData.signedUrl

    try {
      const { error: fnError } = await supabase.functions.invoke('send-export-link', {
        body: { downloadUrl, email, projectName: project.name }
      })
      if (fnError) throw fnError
      return { ok: true }
    } catch {
      return { ok: true, url: downloadUrl }
    }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Export email failed' }
  }
}
