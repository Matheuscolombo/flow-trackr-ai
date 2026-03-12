
-- Tabela para armazenar mensagens recebidas do WhatsApp via UAZAPI
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  remote_jid text NOT NULL,           -- número do remetente (ex: 5511999990001@s.whatsapp.net)
  phone text NOT NULL,                -- número normalizado (ex: 5511999990001)
  message_id text NOT NULL,           -- ID da mensagem no WhatsApp
  direction text NOT NULL DEFAULT 'inbound', -- inbound | outbound
  message_type text NOT NULL DEFAULT 'text', -- text | image | audio | document | video | sticker
  body text,                          -- conteúdo textual da mensagem
  media_url text,                     -- URL da mídia (se houver)
  media_mime_type text,
  status text NOT NULL DEFAULT 'received', -- received | read | delivered | sent | failed
  timestamp_msg timestamp with time zone NOT NULL DEFAULT now(),
  payload_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca por lead
CREATE INDEX idx_wm_lead_id ON public.whatsapp_messages(lead_id);
-- Índice para busca por telefone
CREATE INDEX idx_wm_phone ON public.whatsapp_messages(phone);
-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX idx_wm_message_id ON public.whatsapp_messages(message_id);
-- Índice para workspace
CREATE INDEX idx_wm_workspace ON public.whatsapp_messages(workspace_id);

-- RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wm_workspace_access"
ON public.whatsapp_messages
FOR ALL
TO public
USING (workspace_id IN (
  SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
));
