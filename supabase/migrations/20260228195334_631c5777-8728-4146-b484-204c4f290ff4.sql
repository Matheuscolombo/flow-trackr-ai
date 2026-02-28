
-- Add thumbnail_url to funnel_stages
ALTER TABLE public.funnel_stages
  ADD COLUMN thumbnail_url text;

-- Create funnel_source_nodes table
CREATE TABLE public.funnel_source_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon_type text NOT NULL DEFAULT 'custom',
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  connected_stage_id uuid REFERENCES public.funnel_stages(id) ON DELETE SET NULL,
  lead_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.funnel_source_nodes ENABLE ROW LEVEL SECURITY;

-- RLS policy matching funnel workspace access pattern
CREATE POLICY "source_node_workspace_access"
ON public.funnel_source_nodes
FOR ALL
USING (
  funnel_id IN (
    SELECT funnels.id FROM funnels
    WHERE funnels.workspace_id IN (
      SELECT workspaces.id FROM workspaces
      WHERE workspaces.owner_id = auth.uid()
    )
  )
);
