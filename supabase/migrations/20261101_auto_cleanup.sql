-- Add archived_at and deletion_notified columns for auto-cleanup
ALTER TABLE fr_projects
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_notified BOOLEAN DEFAULT FALSE;

-- When a project is soft-deleted, set archived_at
CREATE OR REPLACE FUNCTION fr_set_archived_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted = TRUE AND OLD.deleted = FALSE THEN
    NEW.archived_at = NOW();
  END IF;
  IF NEW.deleted = FALSE AND OLD.deleted = TRUE THEN
    NEW.archived_at = NULL;
    NEW.deletion_notified = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_fr_set_archived_at ON fr_projects;
CREATE TRIGGER tr_fr_set_archived_at
  BEFORE UPDATE ON fr_projects
  FOR EACH ROW
  EXECUTE FUNCTION fr_set_archived_at();

-- Function to find projects ready for deletion notification (25 days archived, not yet notified)
CREATE OR REPLACE FUNCTION fr_projects_pending_notification()
RETURNS TABLE (
  id TEXT,
  user_id UUID,
  name TEXT,
  slug TEXT,
  archived_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.user_id, p.name, p.slug, p.archived_at
    FROM fr_projects p
    WHERE p.deleted = TRUE
      AND p.archived_at IS NOT NULL
      AND p.deletion_notified = FALSE
      AND p.archived_at < NOW() - INTERVAL '25 days';
END;
$$ LANGUAGE plpgsql;

-- Function to permanently delete projects older than 30 days
CREATE OR REPLACE FUNCTION fr_cleanup_expired_projects()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM fr_projects
  WHERE deleted = TRUE
    AND archived_at IS NOT NULL
    AND archived_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- Enable pg_cron in Supabase Dashboard > Database > Extensions first
-- Then run:
-- SELECT cron.schedule('fr-cleanup-expired', '0 3 * * *', 'SELECT fr_cleanup_expired_projects()');
-- SELECT cron.schedule('fr-notify-expiring', '0 2 * * *', $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT.supabase.co/functions/v1/notify-expiring-projects',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
--   );
-- $$);
