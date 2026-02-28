
ALTER TABLE public.funnel_stages
  ADD COLUMN position_x double precision NOT NULL DEFAULT 0,
  ADD COLUMN position_y double precision NOT NULL DEFAULT 0;
