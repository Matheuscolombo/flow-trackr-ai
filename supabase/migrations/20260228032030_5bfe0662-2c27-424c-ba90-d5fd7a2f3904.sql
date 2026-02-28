
CREATE OR REPLACE FUNCTION public.increment_signup_count(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.leads
  SET signup_count = signup_count + 1,
      last_signup_at = now(),
      updated_at = now()
  WHERE id = p_lead_id;
END;
$$;
