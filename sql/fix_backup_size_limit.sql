-- ============================================================
-- Fix: aumentar o limite de tamanho do bucket fr-backups
-- Executar no SQL Editor do Supabase
-- ============================================================
-- Causa raiz: o bucket foi criado com file_size_limit baixo
-- (ou nunca atualizado por causa do ON CONFLICT DO NOTHING).
-- O TUS devolve 413 "Maximum size exceeded" quando o ZIP do
-- backup excede esse limite.
--
-- 5 GB cobre projetos com milhares de fotos a 1024 px JPEG.
-- Em Supabase self-hosted, verifica também a env var
-- FILE_SIZE_LIMIT / UPLOAD_FILE_SIZE_LIMIT do container
-- storage-api — esse é o teto absoluto.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 5368709120  -- 5 GB
WHERE id = 'fr-backups';

-- Confirma o valor atual:
SELECT id, name, file_size_limit FROM storage.buckets WHERE id = 'fr-backups';
