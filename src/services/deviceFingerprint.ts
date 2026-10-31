export async function generateFingerprint(): Promise<string> {
  const components: string[] = []

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#374151'
      ctx.fillText('FastReport PWA', 2, 2)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillRect(75, 1, 100, 20)
      components.push(canvas.toDataURL())
    }
  } catch { /* canvas not supported */ }

  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        components.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '')
        components.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      }
    }
  } catch { /* webgl not supported */ }

  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)
  components.push(navigator.language)
  components.push(navigator.platform || '')
  components.push(String(navigator.hardwareConcurrency || 0))
  components.push(String((navigator as unknown as { deviceMemory?: number }).deviceMemory || 0))
  components.push(String(navigator.maxTouchPoints || 0))

  const raw = components.join('|||')

  if (crypto.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return 'fb' + Math.abs(hash).toString(16).padStart(14, '0')
}
