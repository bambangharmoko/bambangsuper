CREATE TABLE IF NOT EXISTS public.ai_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  knowledge_base TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  qa_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  temperature NUMERIC NOT NULL DEFAULT 0.1,
  stale_unassigned_hours INT NOT NULL DEFAULT 24,
  stale_inprogress_hours INT NOT NULL DEFAULT 48,
  wa_admin_phone TEXT NOT NULL DEFAULT '628115404999',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read ai_settings" ON public.ai_settings;
CREATE POLICY "Allow public read ai_settings"
  ON public.ai_settings
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Allow owner to manage ai_settings" ON public.ai_settings;
CREATE POLICY "Allow owner to manage ai_settings"
  ON public.ai_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  );
