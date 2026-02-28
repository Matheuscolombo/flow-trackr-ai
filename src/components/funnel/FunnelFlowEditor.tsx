import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type Connection,
  type Viewport,
  useNodesState,
  useEdgesState,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  MarkerType,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";
import FunnelFlowNode, { type FlowNodeData } from "./FunnelFlowNode";
import TrafficSourceNode, { type TrafficIconType, type TrafficSourceNodeData } from "./TrafficSourceNode";
import type { FunnelStage, StageTransitionRule } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Instagram, Facebook, Youtube, Mail, Target, Globe, Smartphone, Megaphone, Trash2, MessageCircle, LayoutGrid, Save } from "lucide-react";
import { toast } from "sonner";

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

interface CustomEdge {
  id: string;
  funnel_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
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
  { type: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { type: "custom", label: "Outro", icon: Megaphone },
];

function buildAutoLayout(stages: FunnelStage[]): { x: number; y: number }[] {
  const cols = Math.max(2, Math.ceil(Math.sqrt(stages.length)));
  return stages.map((_, i) => ({
    x: (i % cols) * 300 + 200,
    y: Math.floor(i / cols) * 250,
  }));
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 200;
const SOURCE_NODE_WIDTH = 140;
const SOURCE_NODE_HEIGHT = 120;

function runDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 200, marginx: 50, marginy: 50 });

  nodes.forEach((node) => {
    const isSource = node.type === "source";
    g.setNode(node.id, {
      width: isSource ? SOURCE_NODE_WIDTH : NODE_WIDTH,
      height: isSource ? SOURCE_NODE_HEIGHT : NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const isSource = node.type === "source";
    const w = isSource ? SOURCE_NODE_WIDTH : NODE_WIDTH;
    const h = isSource ? SOURCE_NODE_HEIGHT : NODE_HEIGHT;
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });
}

function FunnelFlowEditorInner({ stages, rules, stageCounts, funnelId }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sourceNodes, setSourceNodes] = useState<SourceNode[]>([]);
  const [customEdges, setCustomEdges] = useState<CustomEdge[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const viewportKey = `funnel-viewport-${funnelId}`;
  const savedViewport = useMemo<Viewport | null>(() => {
    try {
      const raw = localStorage.getItem(viewportKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [viewportKey]);

  const onMoveEnd = useCallback((_: any, viewport: Viewport) => {
    if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
    viewportDebounceRef.current = setTimeout(() => {
      localStorage.setItem(viewportKey, JSON.stringify(viewport));
    }, 300);
  }, [viewportKey]);
  // Load source nodes and custom edges
  useEffect(() => {
    supabase
      .from("funnel_source_nodes" as any)
      .select("*")
      .eq("funnel_id", funnelId)
      .then(({ data }) => {
        if (data) setSourceNodes(data as any as SourceNode[]);
      });

    supabase
      .from("funnel_edges" as any)
      .select("*")
      .eq("funnel_id", funnelId)
      .then(({ data }) => {
        if (data) setCustomEdges(data as any as CustomEdge[]);
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

    // Source → stage edges (legacy connected_stage_id)
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

    // Custom user-drawn edges — preserve sourceHandle/targetHandle
    const userEdges: Edge[] = customEdges.map((ce) => ({
      id: ce.id,
      source: ce.source_node_id,
      target: ce.target_node_id,
      sourceHandle: ce.source_handle ?? undefined,
      targetHandle: ce.target_handle ?? undefined,
      animated: true,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
    }));

    return [...sourceEdges, ...transitionEdges, ...userEdges];
  }, [rules, countMap, sourceNodes, customEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(allNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(allEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Persist edge to funnel_edges table (with handle info)
      supabase
        .from("funnel_edges" as any)
        .insert({
          funnel_id: funnelId,
          source_node_id: connection.source,
          target_node_id: connection.target,
          source_handle: connection.sourceHandle ?? null,
          target_handle: connection.targetHandle ?? null,
        } as any)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error saving edge:", error);
            toast.error("Erro ao salvar conexão");
            return;
          }
          if (data) {
            setCustomEdges((prev) => [...prev, data as any as CustomEdge]);
            toast.success("Conexão salva");
          }
        });

      // Also update legacy connected_stage_id for source nodes
      const isSourceNode = sourceNodes.some((s) => s.id === connection.source);
      if (isSourceNode) {
        supabase
          .from("funnel_source_nodes" as any)
          .update({ connected_stage_id: connection.target } as any)
          .eq("id", connection.source)
          .then(() => {});

        setSourceNodes((prev) =>
          prev.map((s) =>
            s.id === connection.source ? { ...s, connected_stage_id: connection.target } : s
          )
        );
      }

      // Add edge visually
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
          },
          eds
        )
      );
    },
    [sourceNodes, setEdges, funnelId]
  );

  useEffect(() => {
    setNodes(allNodes);
  }, [allNodes, setNodes]);

  useEffect(() => {
    setEdges(allEdges);
  }, [allEdges, setEdges]);

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

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removals = changes.filter((c) => c.type === "remove");
      if (removals.length > 0) {
        removals.forEach((r) => {
          if (r.type === "remove") {
            // Delete from funnel_edges
            supabase
              .from("funnel_edges" as any)
              .delete()
              .eq("id", r.id)
              .then(() => {});
            setCustomEdges((prev) => prev.filter((e) => e.id !== r.id));
          }
        });
      }
      onEdgesChange(changes);
    },
    [onEdgesChange]
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

  const { fitView } = useReactFlow();

  const autoOrganize = useCallback(() => {
    const layouted = runDagreLayout(nodes, edges);
    setNodes(layouted);
    savePositions(layouted);
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [nodes, edges, setNodes, savePositions, fitView]);

  const deleteSourceNode = async (nodeId: string) => {
    await supabase.from("funnel_source_nodes" as any).delete().eq("id", nodeId);
    setSourceNodes((prev) => prev.filter((s) => s.id !== nodeId));
  };

  const saveAll = useCallback(async () => {
    try {
      // Save all node positions
      savePositions(nodes);
      toast.success("Posições salvas com sucesso");
    } catch {
      toast.error("Erro ao salvar");
    }
  }, [nodes, savePositions]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={autoOrganize}>
          <LayoutGrid className="w-3.5 h-3.5" />
          Auto-organizar
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={saveAll}>
          <Save className="w-3.5 h-3.5" />
          Salvar
        </Button>
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
      <div className="w-full h-[700px] rounded-xl border border-border bg-card overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={["Backspace", "Delete"]}
          connectionRadius={60}
          fitView={!savedViewport}
          fitViewOptions={{ padding: 0.15, minZoom: 0.6, maxZoom: 1.2 }}
          defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.3}
          maxZoom={2}
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

export function FunnelFlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FunnelFlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
