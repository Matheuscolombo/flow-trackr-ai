
-- Add INSERT policy for funnel_edges (the existing policy only has USING, which doesn't cover INSERT)
CREATE POLICY "edge_workspace_insert"
ON public.funnel_edges
FOR INSERT
WITH CHECK (
  funnel_id IN (
    SELECT funnels.id
    FROM funnels
    WHERE funnels.workspace_id IN (
      SELECT workspaces.id
      FROM workspaces
      WHERE workspaces.owner_id = auth.uid()
    )
  )
);

-- Also add DELETE policy explicitly
CREATE POLICY "edge_workspace_delete"
ON public.funnel_edges
FOR DELETE
USING (
  funnel_id IN (
    SELECT funnels.id
    FROM funnels
    WHERE funnels.workspace_id IN (
      SELECT workspaces.id
      FROM workspaces
      WHERE workspaces.owner_id = auth.uid()
    )
  )
);
