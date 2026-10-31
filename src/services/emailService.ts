import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || ''
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || ''
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''

const configured = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

if (configured) {
  emailjs.init(PUBLIC_KEY)
}

export async function sendVerificationEmail(
  toEmail: string,
  toName: string,
  code: string
): Promise<boolean> {
  if (!configured) {
    console.warn('[FastReport] EmailJS not configured. Code:', code)
    return false
  }

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      to_name: toName,
      verification_code: code
    })
    return true
  } catch (err) {
    console.error('[FastReport] Email send failed:', err)
    return false
  }
}
