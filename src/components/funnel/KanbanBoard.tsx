import { useState } from "react";
import type { Lead } from "@/types";
import { LeadCard } from "./LeadCard";
import { LeadTimeline } from "./LeadTimeline";
import type { FunnelStage } from "@/types";

interface KanbanBoardProps {
  stages: FunnelStage[];
  leadsByStage: Record<string, Lead[]>;
  funnelId?: string;
  stageCounts?: Record<string, number>;
  sortBy?: "recent" | "value";
}

export function KanbanBoard({ stages, leadsByStage, funnelId, stageCounts, sortBy = "recent" }: KanbanBoardProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-3 min-h-[320px]">
        {stages.map((stage) => {
          const leads = leadsByStage[stage.id] || [];
          const totalCount = stageCounts?.[stage.id] ?? leads.length;

          // Sort leads client-side based on sortBy
          const sortedLeads = [...leads].sort((a, b) => {
            if (sortBy === "value") {
              return (b.total_revenue ?? 0) - (a.total_revenue ?? 0);
            }
            // "recent": sort by time_in_stage_hours ascending (fewer hours = more recent)
            return (a.time_in_stage_hours ?? 0) - (b.time_in_stage_hours ?? 0);
          });

          const showingSample = stageCounts && totalCount > leads.length;

          return (
            <div key={stage.id} className="flex-shrink-0 w-56">
              {/* Column header */}
              <div className="flex items-start gap-2 mb-2 px-1">
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: stage.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {stage.name}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full tabular-nums">
                      {totalCount.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {showingSample && (
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                      mostrando {leads.length}
                    </p>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[200px] bg-muted/30 rounded-lg p-2 border border-border/50">
                {leads.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[120px]">
                    <p className="text-[10px] text-muted-foreground/50">Nenhum lead</p>
                  </div>
                ) : (
                  sortedLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} funnelId={funnelId ?? stage.funnel_id} onClick={setSelectedLead} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedLead && (
        <LeadTimeline
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </>
  );
}
