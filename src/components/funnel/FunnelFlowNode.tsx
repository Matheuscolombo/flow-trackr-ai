import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Globe, Zap, ImageIcon } from "lucide-react";

export interface FlowNodeData {
  label: string;
  color: string;
  count: number;
  pageUrl: string | null;
  thumbnailUrl: string | null;
  orderIndex: number;
  [key: string]: unknown;
}

const FunnelFlowNode = memo(({ data }: NodeProps) => {
  const { label, color, count, pageUrl, thumbnailUrl } = data as unknown as FlowNodeData;
  const isPage = !!pageUrl;
  const [imgError, setImgError] = useState(false);

  // Auto-generate thumbnail from page_url if no custom thumbnail is set
  const effectiveThumb = thumbnailUrl || (pageUrl ? `https://image.thum.io/get/width/480/viewportWidth/390/viewportHeight/844/${pageUrl}` : null);
  const showThumbnail = isPage && effectiveThumb && !imgError;

  return (
    <div className="relative group">
      {/* 4-direction handles */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-top-1" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-left-1" />

      <div
        className="bg-card border-2 rounded-xl min-w-[240px] max-w-[260px] shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
        style={{ borderColor: color }}
      >
        {/* Thumbnail area */}
        {showThumbnail ? (
          <div className="w-full h-[160px] bg-muted/30 relative overflow-hidden">
            <img
              src={effectiveThumb!}
              alt={label}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
          </div>
        ) : isPage ? (
          <div className="w-full h-[80px] bg-muted/20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
              <ImageIcon className="w-6 h-6" />
              <span className="text-[8px]">Sem thumbnail</span>
            </div>
          </div>
        ) : null}

        {/* Content */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold text-foreground truncate">{label}</span>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">{count}</p>
          <p className="text-[10px] text-muted-foreground mb-2">leads</p>
          <Badge variant="outline" className="text-[9px] gap-1 px-1.5 py-0 h-4">
            {isPage ? <Globe className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
            {isPage ? "Página" : "Evento"}
          </Badge>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-bottom-1" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-right-1" />
    </div>
  );
});

FunnelFlowNode.displayName = "FunnelFlowNode";

export default FunnelFlowNode;
