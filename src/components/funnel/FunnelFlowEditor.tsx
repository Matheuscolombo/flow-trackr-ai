import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type NodeChange,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FunnelFlowNode, { type FlowNodeData } from "./FunnelFlowNode";
import type { FunnelStage, StageTransitionRule } from "@/types";
import { supabase } from "@/integrations/supabase/client";

interface StageCount {
  stage_id: string;
  count: number;
}

interface Props {
  stages: FunnelStage[];
  rules: StageTransitionRule[];
  stageCounts: StageCount[];
  funnelId: string;
}

const nodeTypes = { stage: FunnelFlowNode };

function buildAutoLayout(stages: FunnelStage[]): { x: number; y: number }[] {
  const cols = Math.max(2, Math.ceil(Math.sqrt(stages.length)));
  return stages.map((_, i) => ({
    x: (i % cols) * 260,
    y: Math.floor(i / cols) * 200,
  }));
}

export function FunnelFlowEditor({ stages, rules, stageCounts, funnelId }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countMap = useMemo(() => {
    const m: Record<string, number> = {};
    stageCounts.forEach((c) => { m[c.stage_id] = c.count; });
    return m;
  }, [stageCounts]);

  const initialNodes = useMemo<Node[]>(() => {
    const allZero = stages.every((s) => s.position_x === 0 && s.position_y === 0);
    const autoPos = allZero ? buildAutoLayout(stages) : null;

    return stages.map((stage, i) => ({
      id: stage.id,
      type: "stage",
      position: autoPos
        ? { x: autoPos[i].x, y: autoPos[i].y }
        : { x: stage.position_x, y: stage.position_y },
      data: {
        label: stage.name,
        color: stage.color,
        count: countMap[stage.id] ?? 0,
        pageUrl: stage.page_url,
        orderIndex: stage.order_index,
      } satisfies FlowNodeData,
    }));
  }, [stages, countMap]);

  const initialEdges = useMemo<Edge[]>(() => {
    return rules
      .filter((r) => r.from_stage_id)
      .map((rule) => {
        const fromCount = countMap[rule.from_stage_id!] ?? 0;
        const toCount = countMap[rule.to_stage_id] ?? 0;
        const pct = fromCount > 0 ? ((toCount / fromCount) * 100).toFixed(0) : "—";
        return {
          id: rule.id,
          source: rule.from_stage_id!,
          target: rule.to_stage_id,
          label: `${rule.event_name} (${pct}%)`,
          animated: true,
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
          labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
        };
      });
  }, [rules, countMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when stages/counts change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const savePositions = useCallback(
    (updatedNodes: Node[]) => {
      updatedNodes.forEach((n) => {
        supabase
          .from("funnel_stages")
          .update({ position_x: n.position.x, position_y: n.position.y } as any)
          .eq("id", n.id)
          .then(() => {});
      });
    },
    []
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const hasDrag = changes.some((c) => c.type === "position" && !c.dragging);
      if (hasDrag) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          // Get latest nodes from state
          setNodes((nds) => {
            savePositions(nds);
            return nds;
          });
        }, 500);
      }
    },
    [onNodesChange, savePositions, setNodes]
  );

  return (
    <div className="w-full h-[600px] rounded-xl border border-border bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
        <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
      </ReactFlow>
    </div>
  );
}
