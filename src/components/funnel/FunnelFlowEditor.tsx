import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import TrafficSourceNode, { type TrafficIconType, type TrafficSourceNodeData } from "./TrafficSourceNode";
import type { FunnelStage, StageTransitionRule } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Instagram, Facebook, Youtube, Mail, Target, Globe, Smartphone, Megaphone, Trash2 } from "lucide-react";

interface StageCount {
  stage_id: string;
  count: number;
}

interface SourceNode {
  id: string;
  funnel_id: string;
  name: string;
  icon_type: string;
  position_x: number;
  position_y: number;
  connected_stage_id: string | null;
  lead_count: number;
}

interface Props {
  stages: FunnelStage[];
  rules: StageTransitionRule[];
  stageCounts: StageCount[];
  funnelId: string;
}

const nodeTypes = { stage: FunnelFlowNode, source: TrafficSourceNode };

const sourceOptions: { type: TrafficIconType; label: string; icon: React.ElementType }[] = [
  { type: "instagram", label: "Instagram", icon: Instagram },
  { type: "facebook", label: "Facebook", icon: Facebook },
  { type: "youtube", label: "YouTube", icon: Youtube },
  { type: "email", label: "Email", icon: Mail },
  { type: "ads", label: "Ads", icon: Target },
  { type: "organic", label: "Orgânico", icon: Globe },
  { type: "tiktok", label: "TikTok", icon: Smartphone },
  { type: "custom", label: "Outro", icon: Megaphone },
];

function buildAutoLayout(stages: FunnelStage[]): { x: number; y: number }[] {
  const cols = Math.max(2, Math.ceil(Math.sqrt(stages.length)));
  return stages.map((_, i) => ({
    x: (i % cols) * 300 + 200,
    y: Math.floor(i / cols) * 250,
  }));
}

export function FunnelFlowEditor({ stages, rules, stageCounts, funnelId }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sourceNodes, setSourceNodes] = useState<SourceNode[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Load source nodes
  useEffect(() => {
    supabase
      .from("funnel_source_nodes" as any)
      .select("*")
      .eq("funnel_id", funnelId)
      .then(({ data }) => {
        if (data) setSourceNodes(data as any as SourceNode[]);
      });
  }, [funnelId]);

  const countMap = useMemo(() => {
    const m: Record<string, number> = {};
    stageCounts.forEach((c) => { m[c.stage_id] = c.count; });
    return m;
  }, [stageCounts]);

  const allNodes = useMemo<Node[]>(() => {
    const allZero = stages.every((s) => s.position_x === 0 && s.position_y === 0);
    const autoPos = allZero ? buildAutoLayout(stages) : null;

    const stageNodes: Node[] = stages.map((stage, i) => ({
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
        thumbnailUrl: (stage as any).thumbnail_url ?? null,
        orderIndex: stage.order_index,
      } satisfies FlowNodeData,
    }));

    const srcNodes: Node[] = sourceNodes.map((sn) => ({
      id: sn.id,
      type: "source",
      position: { x: sn.position_x, y: sn.position_y },
      data: {
        label: sn.name,
        iconType: sn.icon_type as TrafficIconType,
        leadCount: sn.lead_count,
      } satisfies TrafficSourceNodeData,
    }));

    return [...srcNodes, ...stageNodes];
  }, [stages, countMap, sourceNodes]);

  const allEdges = useMemo<Edge[]>(() => {
    // Stage transition edges
    const transitionEdges: Edge[] = rules
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

    // Source → stage edges
    const sourceEdges: Edge[] = sourceNodes
      .filter((sn) => sn.connected_stage_id)
      .map((sn) => ({
        id: `src-${sn.id}`,
        source: sn.id,
        target: sn.connected_stage_id!,
        label: `${sn.lead_count}`,
        animated: true,
        style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5, strokeDasharray: "5 3" },
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 },
        labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))" },
      }));

    return [...sourceEdges, ...transitionEdges];
  }, [rules, countMap, sourceNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(allNodes);
  const [edges, , onEdgesChange] = useEdgesState(allEdges);

  useEffect(() => {
    setNodes(allNodes);
  }, [allNodes, setNodes]);

  const savePositions = useCallback(
    (updatedNodes: Node[]) => {
      updatedNodes.forEach((n) => {
        const isSource = sourceNodes.some((s) => s.id === n.id);
        if (isSource) {
          supabase
            .from("funnel_source_nodes" as any)
            .update({ position_x: n.position.x, position_y: n.position.y } as any)
            .eq("id", n.id)
            .then(() => {});
        } else {
          supabase
            .from("funnel_stages")
            .update({ position_x: n.position.x, position_y: n.position.y } as any)
            .eq("id", n.id)
            .then(() => {});
        }
      });
    },
    [sourceNodes]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const hasDrag = changes.some((c) => c.type === "position" && !c.dragging);
      if (hasDrag) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setNodes((nds) => {
            savePositions(nds);
            return nds;
          });
        }, 500);
      }
    },
    [onNodesChange, savePositions, setNodes]
  );

  const addSourceNode = async (type: TrafficIconType, label: string) => {
    setPopoverOpen(false);
    const { data, error } = await supabase
      .from("funnel_source_nodes" as any)
      .insert({
        funnel_id: funnelId,
        name: label,
        icon_type: type,
        position_x: 50,
        position_y: sourceNodes.length * 150,
      } as any)
      .select()
      .single();

    if (!error && data) {
      setSourceNodes((prev) => [...prev, data as any as SourceNode]);
    }
  };

  const deleteSourceNode = async (nodeId: string) => {
    await supabase.from("funnel_source_nodes" as any).delete().eq("id", nodeId);
    setSourceNodes((prev) => prev.filter((s) => s.id !== nodeId));
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Fonte de tráfego
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="grid grid-cols-2 gap-1">
              {sourceOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => addSourceNode(opt.type, opt.label)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Source node chips for quick delete */}
        {sourceNodes.map((sn) => (
          <div key={sn.id} className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-[10px] text-muted-foreground">
            <span>{sn.name}</span>
            <button
              onClick={() => deleteSourceNode(sn.id)}
              className="hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Canvas */}
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
    </div>
  );
}
