import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Globe, Zap, ImageIcon, ExternalLink } from "lucide-react";

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

  // Auto-generate thumbnail: YouTube → native thumb, otherwise → thum.io mobile
  const getAutoThumb = (url: string): string => {
    // YouTube: extract video ID and use maxresdefault thumbnail
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return `https://image.thum.io/get/width/480/crop/600/viewportWidth/390/viewportHeight/844/${url}`;
  };
  const effectiveThumb = thumbnailUrl || (pageUrl ? getAutoThumb(pageUrl) : null);
  const showThumbnail = isPage && effectiveThumb && !imgError;

  return (
    <div className="relative group">
      {/* 4-direction handles */}
      <Handle type="target" position={Position.Top} id="top-target" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-top-1" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-left-1" />

      <div
        className="bg-card border-2 rounded-xl min-w-[240px] max-w-[260px] shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
        style={{ borderColor: color }}
      >
        {/* Thumbnail area */}
        {showThumbnail ? (
          <div className="w-full max-h-[280px] bg-muted/10 relative overflow-hidden flex items-start justify-center">
            <img
              src={effectiveThumb!}
              alt={label}
              className="w-full h-auto"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/50 via-transparent to-transparent" />
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
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] gap-1 px-1.5 py-0 h-4">
              {isPage ? <Globe className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
              {isPage ? "Página" : "Evento"}
            </Badge>
            {isPage && pageUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(pageUrl, "_blank", "noopener,noreferrer");
                }}
                className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary transition-colors bg-muted/50 hover:bg-muted rounded px-1.5 h-4"
                title="Abrir página"
              >
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-bottom-1" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-right-1" />
    </div>
  );
});

FunnelFlowNode.displayName = "FunnelFlowNode";

export default FunnelFlowNode;
