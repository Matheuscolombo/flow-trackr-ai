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

  // Auto-generate thumbnail: YouTube → native thumb, otherwise → thum.io mobile
  const getAutoThumb = (url: string): string => {
    // YouTube: extract video ID and use maxresdefault thumbnail
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return `https://image.thum.io/get/width/480/viewportWidth/390/viewportHeight/844/${url}`;
  };
  const effectiveThumb = thumbnailUrl || (pageUrl ? getAutoThumb(pageUrl) : null);
  const showThumbnail = isPage && effectiveThumb && !imgError;

  return (
    <div className="relative group">
      {/* 4-direction handles */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-top-1" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-left-1" />
...
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-bottom-1" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-right-1" />
    </div>
  );
});

FunnelFlowNode.displayName = "FunnelFlowNode";

export default FunnelFlowNode;
