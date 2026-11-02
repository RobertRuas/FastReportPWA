-- ============================================================
-- Fix: Criar tabela fr_backups se não existir
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Tabela fr_backups — metadados dos backups
CREATE TABLE IF NOT EXISTS public.fr_backups (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    TEXT NOT NULL,
  project_name  TEXT NOT NULL,
  project_slug  TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT NOT NULL DEFAULT 0,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fr_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fr_backups_user_select ON public.fr_backups;
CREATE POLICY fr_backups_user_select ON public.fr_backups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fr_backups_user_insert ON public.fr_backups;
CREATE POLICY fr_backups_user_insert ON public.fr_backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fr_backups_user_update ON public.fr_backups;
CREATE POLICY fr_backups_user_update ON public.fr_backups
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fr_backups_user_delete ON public.fr_backups;
CREATE POLICY fr_backups_user_delete ON public.fr_backups
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas do bucket fr-backups (idempotente)
DROP POLICY IF EXISTS fr_backups_select ON storage.objects;
CREATE POLICY fr_backups_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fr-backups' AND
    (storage.foldername(name))[1] = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS fr_backups_insert ON storage.objects;
CREATE POLICY fr_backups_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fr-backups' AND
    (storage.foldername(name))[1] = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS fr_backups_update ON storage.objects;
CREATE POLICY fr_backups_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fr-backups' AND
    (storage.foldername(name))[1] = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS fr_backups_delete ON storage.objects;
CREATE POLICY fr_backups_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fr-backups' AND
    (storage.foldername(name))[1] = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
