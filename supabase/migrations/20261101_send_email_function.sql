-- Enable pg_net for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Config table for API keys (only accessible via SECURITY DEFINER functions)
CREATE TABLE IF NOT EXISTS fr_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE fr_config ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service_role and SECURITY DEFINER functions can read

-- Function to send export email via Resend API
CREATE OR REPLACE FUNCTION fr_send_export_email(
  p_download_url TEXT,
  p_email TEXT,
  p_project_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_api_key TEXT;
  v_from_email TEXT;
  v_html TEXT;
BEGIN
  SELECT value INTO v_api_key FROM fr_config WHERE key = 'resend_api_key';
  IF v_api_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Resend API key not configured');
  END IF;

  SELECT COALESCE(
    (SELECT value FROM fr_config WHERE key = 'from_email'),
    'FastReport <onboarding@resend.dev>'
  ) INTO v_from_email;

  v_html := '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;">'
    || '<h2 style="color:#1F2937;margin-bottom:8px;">Projeto "' || p_project_name || '"</h2>'
    || '<p style="color:#6B7280;font-size:14px;">O seu projeto está pronto para download.</p>'
    || '<a href="' || p_download_url || '" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#374151;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;">Baixar ZIP</a>'
    || '<p style="color:#9CA3AF;font-size:12px;">Este link expira em <strong>1 hora</strong>.</p>'
    || '<p style="color:#9CA3AF;font-size:12px;">O ficheiro ZIP pode ser reimportado no FastReport.</p>'
    || '<hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0;">'
    || '<p style="color:#D1D5DB;font-size:11px;">— FastReport PWA</p></div>';

  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', v_from_email,
      'to', p_email,
      'subject', 'FastReport: Download "' || p_project_name || '"',
      'html', v_html
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fr_send_export_email(TEXT, TEXT, TEXT) TO authenticated;
