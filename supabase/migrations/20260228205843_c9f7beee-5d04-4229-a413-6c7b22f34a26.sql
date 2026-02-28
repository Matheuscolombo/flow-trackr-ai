
CREATE TABLE public.funnel_edges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  source_node_id text NOT NULL,
  target_node_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edge_workspace_access" ON public.funnel_edges
  AS RESTRICTIVE FOR ALL
  USING (funnel_id IN (
    SELECT funnels.id FROM funnels
    WHERE funnels.workspace_id IN (
      SELECT workspaces.id FROM workspaces WHERE workspaces.owner_id = auth.uid()
    )
  ));

CREATE UNIQUE INDEX idx_funnel_edges_unique ON public.funnel_edges (funnel_id, source_node_id, target_node_id);
