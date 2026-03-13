ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS profile_name text,
  ADD COLUMN IF NOT EXISTS profile_pic_url text;