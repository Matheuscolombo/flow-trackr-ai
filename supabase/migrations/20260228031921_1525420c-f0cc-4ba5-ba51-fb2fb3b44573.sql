
ALTER TABLE public.leads ADD COLUMN signup_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.leads ADD COLUMN last_signup_at timestamp with time zone;
