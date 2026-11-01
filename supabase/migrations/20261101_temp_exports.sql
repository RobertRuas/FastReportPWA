-- Function to clean up expired export files (older than 1 hour)
-- Exports are stored in fr-photos bucket under {userId}/exports/ path
CREATE OR REPLACE FUNCTION fr_cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  obj RECORD;
BEGIN
  FOR obj IN
    SELECT name FROM storage.objects
    WHERE bucket_id = 'fr-photos'
      AND name LIKE '%/exports/%'
      AND created_at < NOW() - INTERVAL '1 hour'
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = 'fr-photos' AND name = obj.name;
    deleted_count := deleted_count + 1;
  END LOOP;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every 15 minutes (requires pg_cron)
-- SELECT cron.schedule('fr-cleanup-exports', '*/15 * * * *', 'SELECT fr_cleanup_expired_exports()');
