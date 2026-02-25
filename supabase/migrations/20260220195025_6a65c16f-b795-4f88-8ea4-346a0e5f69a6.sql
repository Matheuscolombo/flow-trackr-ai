
-- Fase 4: Índice único em lead_funnel_stages (dedup por lead + funil)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lfs_lead_funnel
  ON public.lead_funnel_stages(lead_id, funnel_id);

-- Trigger que atualiza stats do lead automaticamente ao inserir em sale_events
CREATE TRIGGER trg_sale_events_stats
  AFTER INSERT OR UPDATE ON public.sale_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_sale_event_update_lead_stats();
