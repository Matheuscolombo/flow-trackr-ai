
-- Tabela para gerenciar instâncias WhatsApp via UAZAPI
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instance_name text NOT NULL,           -- nome da instância na UAZAPI (slug)
  instance_display_name text NOT NULL,   -- nome amigável
  phone text,                            -- número conectado (preenchido após QR scan)
  status text NOT NULL DEFAULT 'disconnected', -- disconnected | connecting | connected
  api_token text,                        -- token da instância na UAZAPI (se retornado)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, instance_name)
);

-- Índice por workspace
CREATE INDEX idx_wi_workspace ON public.whatsapp_instances(workspace_id);

-- Trigger para updated_at
CREATE TRIGGER set_updated_at_whatsapp_instances
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wi_workspace_access"
ON public.whatsapp_instances
FOR ALL
TO public
USING (workspace_id IN (
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
));

CREATE POLICY "wi_workspace_insert"
ON public.whatsapp_instances
FOR INSERT
TO public
WITH CHECK (workspace_id IN (
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
));

-- Adicionar coluna instance_id na whatsapp_messages para filtrar por instância registrada
ALTER TABLE public.whatsapp_messages ADD COLUMN instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;
CREATE INDEX idx_wm_instance ON public.whatsapp_messages(instance_id);
