-- ============================================================================
-- VIDA MODERNA NEWS (Modern Life Residence) — CONFIGURAÇÃO DO SUPABASE GRATUITO
-- ============================================================================
-- Copie e cole este código no "SQL Editor" do seu projeto no Supabase:
-- https://supabase.com/dashboard/project/buzjnfppicexlpgyllvp/sql/new
-- e clique no botão verde "Run".
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vidamoderna_sync (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativa o Row Level Security (RLS)
ALTER TABLE public.vidamoderna_sync ENABLE ROW LEVEL SECURITY;

-- Libera as permissões da tabela para a chave pública (anon / publishable)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vidamoderna_sync TO anon, authenticated;

-- Políticas de leitura e gravação
DROP POLICY IF EXISTS "Leitura Publica Vida Moderna News" ON public.vidamoderna_sync;
CREATE POLICY "Leitura Publica Vida Moderna News"
  ON public.vidamoderna_sync
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Insercao Publica Vida Moderna News" ON public.vidamoderna_sync;
CREATE POLICY "Insercao Publica Vida Moderna News"
  ON public.vidamoderna_sync
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Atualizacao Publica Vida Moderna News" ON public.vidamoderna_sync;
CREATE POLICY "Atualizacao Publica Vida Moderna News"
  ON public.vidamoderna_sync
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
