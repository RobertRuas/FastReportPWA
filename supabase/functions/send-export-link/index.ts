const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'FastReport <noreply@fastreport.app>'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { downloadUrl, email, projectName } = await req.json()

    if (!downloadUrl || !email || !projectName) {
      return new Response(
        JSON.stringify({ error: 'Missing downloadUrl, email, or projectName' }),
        { status: 400 }
      )
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: `FastReport: Download "${projectName}"`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1F2937; margin-bottom: 8px;">Projeto "${projectName}"</h2>
            <p style="color: #6B7280; font-size: 14px;">O seu projeto está pronto para download.</p>
            <a href="${downloadUrl}"
               style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #374151; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">
              Baixar ZIP
            </a>
            <p style="color: #9CA3AF; font-size: 12px;">
              Este link expira em <strong>1 hora</strong>. Após expirar, o ficheiro será descartado automaticamente.
            </p>
            <p style="color: #9CA3AF; font-size: 12px;">O ficheiro ZIP pode ser reimportado diretamente na aplicação FastReport.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 16px 0;">
            <p style="color: #D1D5DB; font-size: 11px;">— FastReport PWA</p>
          </div>
        `
      })
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      throw new Error(`Resend error: ${errBody}`)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('Send export link error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500 }
    )
  }
})
