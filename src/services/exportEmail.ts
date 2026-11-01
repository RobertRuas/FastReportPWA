import { supabase } from './supabase'
import type { Project } from '@/models/types'
import { exportProject } from './exportService'

function buildDownloadPageUrl(signedUrl: string, projectName: string): string {
  const base = window.location.origin + window.location.pathname
  const params = new URLSearchParams({ url: signedUrl, name: projectName })
  return `${base}#/download?${params.toString()}`
}

export async function exportAndEmailLink(
  project: Project,
  email: string,
  onProgress?: (p: { current: number; total: number }) => void
): Promise<{ ok: boolean; error?: string }> {
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

    const downloadPageUrl = buildDownloadPageUrl(signedData.signedUrl, project.name)

    const { data, error: rpcError } = await supabase.rpc('fr_send_export_email', {
      p_download_url: downloadPageUrl,
      p_email: email,
      p_project_name: project.name
    })

    if (rpcError) throw new Error(rpcError.message)
    if (data && !data.ok) throw new Error(data.error || 'Email send failed')

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Export email failed' }
  }
}
