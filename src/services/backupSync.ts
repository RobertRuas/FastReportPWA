import { exportProject, type ExportProgress } from './exportService'
import { checkAuth } from './authService'
import {
  createDoc,
  listAllDocs,
  removeDoc,
  uploadFile,
  downloadFile,
  deleteFile,
  type WindlogDoc
} from './windlog'
import type { Project } from '@/models/types'

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024 // 100 MB — limite da windlog

interface BackupIndexRecord {
  userId: string
  userEmail: string
  projectId: string
  projectName: string
  projectSlug: string
  fileId: string
  fileSize: number
  syncedAt: string
}

export interface RemoteBackup {
  id: string          // id do doc em backup_index
  projectId: string
  projectName: string
  projectSlug: string
  fileId: string
  fileSize: number
  syncedAt: string
}

async function findIndexForProject(
  userId: string,
  projectId: string
): Promise<WindlogDoc<BackupIndexRecord> | null> {
  const docs = await listAllDocs<BackupIndexRecord>('backup_index')
  return docs.find(d => d.data.userId === userId && d.data.projectId === projectId) ?? null
}

export async function syncProject(
  project: Project,
  userEmail: string,
  onProgress?: (p: ExportProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  const user = await checkAuth()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    const blob = await exportProject(project, 'folders', onProgress)

    if (blob.size > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `O backup tem ${(blob.size / 1024 / 1024).toFixed(1)} MB — acima do limite de 100 MB da API.`
      }
    }

    // Remove backup anterior deste projeto (se houver)
    const existing = await findIndexForProject(user.id, project.id)
    if (existing) {
      deleteFile(existing.data.fileId).catch(() => {})
      removeDoc('backup_index', existing.id).catch(() => {})
    }

    const filename = `${project.slug || project.id}.zip`
    const uploadRes = await uploadFile('backups', blob, filename, (uploaded, total) => {
      onProgress?.({ current: uploaded, total })
    })
    if (!uploadRes.ok) return { ok: false, error: uploadRes.error.message }

    const indexRes = await createDoc<BackupIndexRecord>('backup_index', {
      userId: user.id,
      userEmail,
      projectId: project.id,
      projectName: project.name,
      projectSlug: project.slug,
      fileId: uploadRes.data.id,
      fileSize: blob.size,
      syncedAt: new Date().toISOString()
    })
    if (!indexRes.ok) {
      deleteFile(uploadRes.data.id).catch(() => {})
      return { ok: false, error: indexRes.error.message }
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Sync failed' }
  }
}

export async function listRemoteBackups(): Promise<RemoteBackup[]> {
  const user = await checkAuth()
  if (!user) return []

  const docs = await listAllDocs<BackupIndexRecord>('backup_index')
  return docs
    .filter(d => d.data.userId === user.id)
    .map(d => ({
      id: d.id,
      projectId: d.data.projectId,
      projectName: d.data.projectName,
      projectSlug: d.data.projectSlug,
      fileId: d.data.fileId,
      fileSize: d.data.fileSize,
      syncedAt: d.data.syncedAt
    }))
    .sort((a, b) => b.syncedAt.localeCompare(a.syncedAt))
}

export async function downloadBackup(
  backup: RemoteBackup
): Promise<{ ok: boolean; blob?: Blob; error?: string }> {
  const res = await downloadFile(backup.fileId)
  if (!res.ok) return { ok: false, error: res.error.message }
  return { ok: true, blob: res.data }
}

export async function deleteBackup(
  projectId: string,
  _userEmail: string,
  _projectSlug: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await checkAuth()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const entry = await findIndexForProject(user.id, projectId)
  if (!entry) return { ok: true }

  const fileRes = await deleteFile(entry.data.fileId)
  if (!fileRes.ok && fileRes.error.code !== 'NOT_FOUND') {
    return { ok: false, error: fileRes.error.message }
  }
  const idxRes = await removeDoc('backup_index', entry.id)
  if (!idxRes.ok) return { ok: false, error: idxRes.error.message }
  return { ok: true }
}
