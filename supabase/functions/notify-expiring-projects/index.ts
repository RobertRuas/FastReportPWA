import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'https://esm.sh/jszip@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'FastReport <noreply@fastreport.app>'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

Deno.serve(async (_req: Request) => {
  try {
    const { data: projects, error } = await supabase
      .rpc('fr_projects_pending_notification')

    if (error) throw error
    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ message: 'No projects to notify' }), { status: 200 })
    }

    let notified = 0

    for (const project of projects) {
      const { data: userData } = await supabase.auth.admin.getUserById(project.user_id)
      if (!userData?.user?.email) continue

      const zip = new JSZip()
      const basePath = `${project.user_id}/${project.id}`

      const { data: folders } = await supabase.storage.from('fr-photos').list(basePath)
      if (folders) {
        for (const folder of folders) {
          const subPath = `${basePath}/${folder.name}`
          const { data: files } = await supabase.storage.from('fr-photos').list(subPath)
          if (files) {
            for (const file of files) {
              const { data: fileData } = await supabase.storage
                .from('fr-photos')
                .download(`${subPath}/${file.name}`)
              if (fileData) {
                const arrayBuffer = await fileData.arrayBuffer()
                zip.file(`${folder.name}/${file.name}`, arrayBuffer)
              }
            }
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'uint8array' })
      const zipBase64 = btoa(String.fromCharCode(...zipBlob))

      const daysLeft = 5
      const deleteDate = new Date(new Date(project.archived_at).getTime() + 30 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: userData.user.email,
          subject: `FastReport: Projeto "${project.name}" será excluído em ${daysLeft} dias`,
          html: `
            <h2>Projeto "${project.name}" será excluído automaticamente</h2>
            <p>O projeto <strong>${project.name}</strong> foi arquivado e será excluído permanentemente em <strong>${deleteDate}</strong>.</p>
            <p>Em anexo está o ficheiro ZIP com todos os dados do projeto para download.</p>
            <p>Se pretende manter o projeto, aceda à aplicação e restaure-o antes da data indicada.</p>
            <br>
            <p style="color: #6B7280; font-size: 12px;">— FastReport PWA</p>
          `,
          attachments: [{
            filename: `${project.slug || project.name}.zip`,
            content: zipBase64,
            type: 'application/zip'
          }]
        })
      })

      await supabase
        .from('fr_projects')
        .update({ deletion_notified: true })
        .eq('id', project.id)

      notified++
    }

    return new Response(JSON.stringify({ notified }), { status: 200 })
  } catch (err) {
    console.error('Notify error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
