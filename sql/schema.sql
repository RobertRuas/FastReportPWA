-- FastReport PWA — Supabase Schema
-- Prefixo fr_ para isolamento multi-tenant
-- Executar no SQL Editor do Supabase (https://pwa.windlog.org)

-- ============================================================
-- 1. Tabela de Settings (sync em tempo real)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fr_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cols       JSONB NOT NULL DEFAULT '"auto"',
  lang_pref  TEXT NOT NULL DEFAULT 'auto' CHECK (lang_pref IN ('auto','pt','en')),
  ui         INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY fr_settings_select ON public.fr_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY fr_settings_insert ON public.fr_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY fr_settings_update ON public.fr_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Realtime para sync entre dispositivos
ALTER PUBLICATION supabase_realtime ADD TABLE public.fr_settings;

-- ============================================================
-- 2. Tabela de Projetos (sync manual)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fr_projects (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  map_id      TEXT NOT NULL,
  photos      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  exported_at TIMESTAMPTZ,
  deleted     BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (id, user_id)
);

ALTER TABLE public.fr_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY fr_projects_select ON public.fr_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY fr_projects_insert ON public.fr_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY fr_projects_update ON public.fr_projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY fr_projects_delete ON public.fr_projects
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. Storage bucket para fotos (privado)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('fr-photos', 'fr-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas: utilizador só acede à sua pasta {user_id}/
CREATE POLICY fr_photos_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fr-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY fr_photos_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fr-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY fr_photos_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fr-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY fr_photos_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fr-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 4. Controlo de acesso (whitelist de utilizadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fr_access_list (
  email       TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_access_at TIMESTAMPTZ,
  device_info TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fr_access_list ENABLE ROW LEVEL SECURITY;

-- Admin pode fazer tudo
CREATE POLICY fr_access_admin ON public.fr_access_list
  FOR ALL USING (auth.jwt() ->> 'email' = '92ruas@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = '92ruas@gmail.com');

-- Qualquer utilizador autenticado pode ler a sua própria linha
CREATE POLICY fr_access_self_select ON public.fr_access_list
  FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Qualquer utilizador autenticado pode atualizar o seu último acesso
CREATE POLICY fr_access_self_update ON public.fr_access_list
  FOR UPDATE USING (auth.jwt() ->> 'email' = email);

-- Inserir admin como primeiro utilizador
INSERT INTO public.fr_access_list (email, status)
VALUES ('92ruas@gmail.com', 'active')
ON CONFLICT (email) DO NOTHING;
