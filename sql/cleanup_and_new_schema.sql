-- ============================================================
-- FastReport PWA — Limpeza completa + Nova estrutura
-- Executar no SQL Editor do Supabase
-- ============================================================
-- IMPORTANTE: Antes de executar este SQL, apague manualmente
-- os ficheiros dos buckets "fr-photos" e "fr-exports" no
-- Dashboard do Supabase (Storage > selecionar bucket > apagar tudo).
-- Depois apague os próprios buckets pelo Dashboard.
-- O Supabase não permite DELETE direto nas tabelas de storage via SQL.
-- ============================================================

-- 1. Limpar dados antigos (se existirem)
-- ============================================================

-- Apagar tabela de projetos antiga (se existir)
DROP TABLE IF EXISTS public.fr_projects CASCADE;

-- 2. Remover políticas antigas do fr-photos
-- ============================================================
DROP POLICY IF EXISTS fr_photos_select ON storage.objects;
DROP POLICY IF EXISTS fr_photos_insert ON storage.objects;
DROP POLICY IF EXISTS fr_photos_update ON storage.objects;
DROP POLICY IF EXISTS fr_photos_delete ON storage.objects;

-- 3. Remover políticas antigas do fr-exports
-- ============================================================
DROP POLICY IF EXISTS "Users upload own exports" ON storage.objects;
DROP POLICY IF EXISTS "Users read own exports" ON storage.objects;
DROP POLICY IF EXISTS "Service role manages exports" ON storage.objects;

-- 4. Remover funções e triggers antigos
-- ============================================================
-- (trigger tr_fr_set_archived_at já removido com fr_projects CASCADE)
DROP FUNCTION IF EXISTS fr_set_archived_at();
DROP FUNCTION IF EXISTS fr_projects_pending_notification();
DROP FUNCTION IF EXISTS fr_cleanup_expired_projects();
DROP FUNCTION IF EXISTS fr_cleanup_expired_exports();
DROP FUNCTION IF EXISTS fr_send_export_email(TEXT, TEXT, TEXT);

-- 6. (Tabela fr_projects já removida no passo 1)

-- 7. Remover tabela fr_config (já não usamos Resend)
-- ============================================================
DROP TABLE IF EXISTS public.fr_config CASCADE;

-- ============================================================
-- NOVA ESTRUTURA — Backups ZIP por e-mail
-- ============================================================

-- 8. Criar bucket fr-backups (privado)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('fr-backups', 'fr-backups', false, 524288000)
ON CONFLICT (id) DO NOTHING;

-- 9. Políticas do bucket fr-backups
--    Estrutura: {email}/{project_slug}.zip
-- ============================================================

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

-- 10. Tabela fr_backups — metadados dos backups
-- ============================================================
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

-- ============================================================
-- Resumo da nova estrutura:
--
-- Storage (fr-backups):
--   email@exemplo.com/
--     projeto-slug.zip
--     outro-projeto.zip
--
-- Tabela fr_backups:
--   id, user_id, user_email, project_name, project_slug,
--   file_path, file_size, synced_at, created_at
--
-- Mantidas:
--   fr_settings (sync em tempo real)
--   fr_access_list (controlo de acesso)
-- ============================================================
