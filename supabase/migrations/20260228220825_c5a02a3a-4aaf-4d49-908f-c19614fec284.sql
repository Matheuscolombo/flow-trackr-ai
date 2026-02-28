
-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "edge_workspace_access" ON public.funnel_edges;
DROP POLICY IF EXISTS "edge_workspace_insert" ON public.funnel_edges;
DROP POLICY IF EXISTS "edge_workspace_delete" ON public.funnel_edges;

-- Create a single PERMISSIVE ALL policy with both USING and WITH CHECK
CREATE POLICY "edge_workspace_all"
ON public.funnel_edges
FOR ALL
TO authenticated
USING (
  funnel_id IN (
    SELECT funnels.id FROM funnels
    WHERE funnels.workspace_id IN (
      SELECT workspaces.id FROM workspaces
      WHERE workspaces.owner_id = auth.uid()
    )
  )
)
WITH CHECK (
  funnel_id IN (
    SELECT funnels.id FROM funnels
    WHERE funnels.workspace_id IN (
      SELECT workspaces.id FROM workspaces
      WHERE workspaces.owner_id = auth.uid()
    )
  )
);
