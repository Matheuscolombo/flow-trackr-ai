import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Instagram, Facebook, Youtube, Mail, Target, Globe, Smartphone, Megaphone } from "lucide-react";

export type TrafficIconType = "instagram" | "facebook" | "youtube" | "email" | "ads" | "organic" | "tiktok" | "custom";

export interface TrafficSourceNodeData {
  label: string;
  iconType: TrafficIconType;
  leadCount: number;
  [key: string]: unknown;
}

const iconMap: Record<TrafficIconType, { icon: React.ElementType; color: string }> = {
  instagram: { icon: Instagram, color: "#E1306C" },
  facebook: { icon: Facebook, color: "#1877F2" },
  youtube: { icon: Youtube, color: "#FF0000" },
  email: { icon: Mail, color: "#10B981" },
  ads: { icon: Target, color: "#F59E0B" },
  organic: { icon: Globe, color: "#6366F1" },
  tiktok: { icon: Smartphone, color: "#000000" },
  custom: { icon: Megaphone, color: "#8B5CF6" },
};

const TrafficSourceNode = memo(({ data }: NodeProps) => {
  const { label, iconType, leadCount } = data as unknown as TrafficSourceNodeData;
  const { icon: Icon, color } = iconMap[iconType] || iconMap.custom;

  return (
    <div className="relative">
      <div
        className="bg-card border-2 rounded-2xl px-5 py-4 min-w-[140px] shadow-md hover:shadow-lg transition-shadow cursor-pointer flex flex-col items-center gap-2"
        style={{ borderColor: color }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-foreground text-center">{label}</span>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{leadCount}</p>
          <p className="text-[9px] text-muted-foreground">leads</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-right-1" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-2.5 !h-2.5 !bg-muted-foreground/40 !border-background !-bottom-1" />
    </div>
  );
});

TrafficSourceNode.displayName = "TrafficSourceNode";

export default TrafficSourceNode;
