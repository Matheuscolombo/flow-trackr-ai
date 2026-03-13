

## Plano: Suporte a Mídia no Chat WhatsApp

### Problema Atual
- Mensagens de mídia (imagem, áudio, vídeo, documento) aparecem apenas como `[media]` no chat
- O webhook não extrai `media_url` nem `media_mime_type` do payload UAZAPI v2
- Não há como enviar arquivos pelo chat, apenas texto
- O payload_raw contém `message.content.URL` e `message.content.mimetype` mas não são usados

### Evidência (payload real do banco)
```text
message.content.URL = "https://mmg.whatsapp.net/o1/v/t24/..."
message.content.mimetype = "image/jpeg"
chat.wa_lastMessageType = "ImageMessage"
```

---

### Correções

**1. Webhook (`uazapi-webhook`): extrair mídia do v2**
- Ler `message.content.URL` como `media_url`
- Ler `message.content.mimetype` como `media_mime_type`
- Mapear tipo correto: se content tem `URL` + mimetype `image/*` → `image`, `audio/*` → `audio`, `video/*` → `video`, etc.
- Ler caption de `message.content.caption` quando disponível (imagens/vídeos com legenda)

**2. Webhook (`uazapi-manage` sync)**: mesma lógica para mensagens históricas sincronizadas

**3. Backend envio (`whatsapp-send`): suporte a `/send/media`**
- Aceitar parâmetros opcionais: `mediaUrl`, `type` (`image`/`audio`/`document`/`video`), `caption`, `fileName`
- Quando `mediaUrl` presente, usar `POST /send/media` com `{ number, mediaUrl, type, caption, fileName }`
- Manter envio de texto quando só `text` for passado

**4. Frontend (`WhatsAppChatPage.tsx`): renderizar e enviar mídia**
- Renderizar nos bubbles:
  - **Imagem**: `<img>` clicável (abre em nova aba)
  - **Áudio**: `<audio controls>` player nativo
  - **Vídeo**: `<video controls>` player nativo
  - **Documento**: link de download com nome/ícone
  - Caption abaixo da mídia quando existir
- Adicionar botão de anexo (📎) na barra de input:
  - Abre file picker nativo
  - Upload do arquivo para Supabase Storage (bucket `whatsapp-media`)
  - Gera URL pública e envia via `/send/media`
- Chat list preview: mostrar ícone + tipo em vez de `[media]` (ex: "📷 Foto", "🎤 Áudio")

**5. Backfill**: migration SQL para preencher `media_url` e `media_mime_type` de registros existentes usando `payload_raw`

**6. Storage bucket**: criar bucket `whatsapp-media` para uploads de mídia outbound

### Arquivos alterados
- `supabase/functions/uazapi-webhook/index.ts`
- `supabase/functions/uazapi-manage/index.ts`
- `supabase/functions/whatsapp-send/index.ts`
- `supabase/functions/whatsapp-chats/index.ts`
- `src/pages/WhatsAppChatPage.tsx`
- Migration SQL (backfill + storage bucket)

### Nota sobre URLs de mídia
URLs do CDN WhatsApp (`mmg.whatsapp.net`) expiram após algumas horas. Imagens/áudios recentes serão exibidos normalmente. Para mensagens antigas, o fallback será mostrar `[mídia expirada]` com o tipo.

