
-- Mover pg_trgm para schema extensions (boas práticas de segurança)
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA extensions;
