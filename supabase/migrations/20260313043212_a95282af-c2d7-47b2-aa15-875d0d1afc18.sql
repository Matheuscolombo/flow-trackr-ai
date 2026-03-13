-- Create whatsapp-media storage bucket for outbound file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow public read access for sent media
CREATE POLICY "Public can read whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

-- Backfill: update media_url and media_mime_type from payload_raw for existing media messages
UPDATE whatsapp_messages
SET 
  media_url = COALESCE(media_url, payload_raw->'message'->'content'->>'URL'),
  media_mime_type = COALESCE(media_mime_type, payload_raw->'message'->'content'->>'mimetype'),
  message_type = CASE 
    WHEN message_type = 'media' AND payload_raw->'message'->'content'->>'mimetype' LIKE 'image/%' THEN 'image'
    WHEN message_type = 'media' AND payload_raw->'message'->'content'->>'mimetype' LIKE 'audio/%' THEN 'audio'
    WHEN message_type = 'media' AND payload_raw->'message'->'content'->>'mimetype' LIKE 'video/%' THEN 'video'
    WHEN message_type = 'media' AND (payload_raw->'message'->'content'->>'mimetype' LIKE 'application/%' OR payload_raw->'message'->'content'->>'mimetype' LIKE 'text/%') THEN 'document'
    ELSE message_type
  END
WHERE message_type != 'text'
  AND media_url IS NULL
  AND payload_raw->'message'->'content'->>'URL' IS NOT NULL;