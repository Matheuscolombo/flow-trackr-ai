CREATE UNIQUE INDEX idx_lead_events_idempotency_key 
ON public.lead_events (idempotency_key) 
WHERE idempotency_key IS NOT NULL;