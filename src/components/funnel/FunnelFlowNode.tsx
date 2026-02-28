import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Globe, Zap } from "lucide-react";

export interface FlowNodeData {
  label: string;
  color: string;
  count: number;
  pageUrl: string | null;
  orderIndex: number;
  [key: string]: unknown;
}

const FunnelFlowNode = memo(({ data }: NodeProps) => {
  const { label, color, count, pageUrl } = data as unknown as FlowNodeData;
  const isPage = !!pageUrl;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40 !border-background" />
      <div
        className="bg-card border-2 rounded-xl px-5 py-4 min-w-[160px] shadow-md hover:shadow-lg transition-shadow cursor-pointer"
        style={{ borderColor: color }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{count}</p>
        <p className="text-[10px] text-muted-foreground mb-2">leads</p>
        <Badge variant="outline" className="text-[9px] gap-1 px-1.5 py-0 h-4">
          {isPage ? <Globe className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
          {isPage ? "Página" : "Evento"}
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40 !border-background" />
    </div>
  );
});

FunnelFlowNode.displayName = "FunnelFlowNode";

export default FunnelFlowNode;
