-- Create fr-exports bucket for temporary export ZIPs
INSERT INTO storage.buckets (id, name, public)
VALUES ('fr-exports', 'fr-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users upload own exports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fr-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow service role to manage (for cleanup)
CREATE POLICY "Service role manages exports"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'fr-exports');

-- Function to clean up expired export files (older than 1 hour)
CREATE OR REPLACE FUNCTION fr_cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  obj RECORD;
BEGIN
  FOR obj IN
    SELECT name FROM storage.objects
    WHERE bucket_id = 'fr-exports'
      AND created_at < NOW() - INTERVAL '1 hour'
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = 'fr-exports' AND name = obj.name;
    deleted_count := deleted_count + 1;
  END LOOP;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every 15 minutes (requires pg_cron)
-- SELECT cron.schedule('fr-cleanup-exports', '*/15 * * * *', 'SELECT fr_cleanup_expired_exports()');
