ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS src text;
ALTER TABLE sale_events ADD COLUMN IF NOT EXISTS sck text;