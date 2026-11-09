import * as tus from 'tus-js-client'
import { supabase } from './supabase'
import { exportProject, type ExportProgress } from './exportService'
import type { Project } from '@/models/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

async function tusUpload(
  blob: Blob,
  bucketName: string,
  objectName: string,
  accessToken: string,
  onProgress?: (p: ExportProgress) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(blob as unknown as File, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'true'
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName,
        contentType: 'application/zip',
        cacheControl: '3600'
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (uploaded, total) => {
        onProgress?.({ current: uploaded, total })
      },
      onSuccess: () => resolve()
    })
    upload.start()
  })
}

export interface RemoteBackup {
  id: string
  projectName: string
  projectSlug: string
  filePath: string
  fileSize: number
  syncedAt: string
}

export async function syncProject(
  project: Project,
  userEmail: string,
  onProgress?: (p: ExportProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session?.user || !session.access_token) return { ok: false, error: 'Not authenticated' }
  const user = session.user

  try {
    const blob = await exportProject(project, 'folders', onProgress)

    const filePath = `${userEmail}/${project.slug}.zip`

    await tusUpload(blob, 'fr-backups', filePath, session.access_token, onProgress)

    const { error: dbError } = await supabase.from('fr_backups').upsert({
      id: project.id,
      user_id: user.id,
      user_email: userEmail,
      project_name: project.name,
      project_slug: project.slug,
      file_path: filePath,
      file_size: blob.size,
      synced_at: new Date().toISOString()
    })

    if (dbError) throw new Error(dbError.message)

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sync failed' }
  }
}

export async function listRemoteBackups(): Promise<RemoteBackup[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('fr_backups')
    .select('*')
    .eq('user_id', user.id)
    .order('synced_at', { ascending: false })

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id,
    projectName: row.project_name,
    projectSlug: row.project_slug,
    filePath: row.file_path,
    fileSize: row.file_size,
    syncedAt: row.synced_at
  }))
}

export async function downloadBackup(
  backup: RemoteBackup
): Promise<{ ok: boolean; blob?: Blob; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('fr-backups')
      .download(backup.filePath)

    if (error || !data) throw new Error(error?.message ?? 'Download failed')

    return { ok: true, blob: data }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Download failed' }
  }
}

export async function deleteBackup(
  projectId: string,
  userEmail: string,
  projectSlug: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    const filePath = `${userEmail}/${projectSlug}.zip`
    await supabase.storage.from('fr-backups').remove([filePath])
    await supabase.from('fr_backups').delete().eq('id', projectId).eq('user_id', user.id)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Delete failed' }
  }
}

export async function getShareUrl(
  userEmail: string,
  projectSlug: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const filePath = `${userEmail}/${projectSlug}.zip`
    const { data, error } = await supabase.storage
      .from('fr-backups')
      .createSignedUrl(filePath, 3600)

    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Failed to create link')

    return { ok: true, url: data.signedUrl }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Failed to create link' }
  }
}
