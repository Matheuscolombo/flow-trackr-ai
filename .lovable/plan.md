

## Diagnóstico Confirmado

**Causa raiz**: Os arquivos baixados do CDN do WhatsApp (`mmg.whatsapp.net`) estao **criptografados com E2E** (end-to-end encryption). O payload confirma:
- URLs terminam em `.enc`
- Campos `mediaKey`, `fileEncSHA256`, `fileSHA256` presentes no `content`
- Os bytes baixados sao o blob criptografado, nao a midia real

Os downloads "com sucesso" (76KB, 55KB, 3KB) na verdade salvaram blobs criptografados no Storage. Por isso imagem em branco, audio sem som, PDF vazio.

**O endpoint `/chat/downloadMediaMessage`** deveria descriptografar, mas retorna:
- 405 (Method Not Allowed) em `POST /chat/downloadMediaMessage`
- 404 em `POST /api/chat/downloadMediaMessage`

O 405 indica que o endpoint existe mas o metodo HTTP esta errado. Provavelmente precisa ser **GET** com messageId como path/query param, ou o messageId esta no formato errado (enviamos `554891757743:3EB0...` mas o campo `messageid` no payload e so `3EB0...`).

---

## Plano de Correcao

### 1. Corrigir chamada ao UAZAPI para descriptografia

No `uazapi-webhook/index.ts` e `backfill-media/index.ts`, expandir a matriz de tentativas do `downloadMediaMessage`:

- Tentar **GET** alem de POST
- Tentar messageId **sem prefixo** (so a parte `3EB0...`)
- Tentar paths adicionais: `/message/downloadMedia`, `/chat/getMediaMessage`
- Tentar enviar o `message_id` tanto no body quanto como query param

```text
Tentativas (em ordem):
1. POST /chat/downloadMediaMessage  { messageId: "3EB0..." }     (id curto)
2. GET  /chat/downloadMediaMessage?messageId=3EB0...              (GET)
3. POST /chat/downloadMediaMessage  { messageId: "owner:3EB0..." } (id completo, atual)
4. GET  /message/downloadMedia/3EB0...                            (path param)
5. POST /api/chat/downloadMediaMessage { messageId: "3EB0..." }   (api prefix)
```

### 2. Corrigir mapeamento de extensao/MIME

- Adicionar `"audio/ogg; codecs=opus": "ogg"` ao `MEDIA_EXT_MAP` (ja existe no webhook mas falta no backfill)
- Garantir que o `contentType` no upload use o MIME correto e nao caia em `application/octet-stream`

### 3. Corrigir frontend - imagem, audio e documento

**Imagem:**
- Mostrar thumbnail inline (preview)
- Ao clicar, abrir modal fullscreen com botao de download
- Fallback: se `onError`, mostrar icone + "Imagem indisponivel"

**Audio:**
- Player com `<audio controls preload="auto">` 
- Corrigir `<source type>` para aceitar `audio/ogg; codecs=opus` como `audio/ogg`
- Adicionar botoes de velocidade (1x, 1.5x, 2x)
- Barra de progresso funcional

**Documento:**
- Mostrar nome do arquivo quando disponivel (do `content.fileName` no payload)
- Link de download direto com icone
- Para PDF, tentar mostrar preview inline (iframe ou link)

### 4. Re-executar backfill com logica corrigida

Apos deploy do webhook corrigido, rodar o backfill-media para re-baixar todos os arquivos existentes com a logica de descriptografia correta.

### 5. Limpar arquivos corrompidos do Storage

Deletar os blobs criptografados existentes antes de re-upload, para evitar cache de arquivos invalidos.

---

### Arquivos alterados
- `supabase/functions/uazapi-webhook/index.ts` - expandir tentativas de download
- `supabase/functions/backfill-media/index.ts` - mesma logica + limpeza
- `src/pages/WhatsAppChatPage.tsx` - modal de imagem, player de audio melhorado, preview de documento

### Risco
Se nenhuma variacao do endpoint de download funcionar na UAZAPI v2, a unica alternativa seria descriptografar localmente usando o `mediaKey` do payload (complexo mas possivel). Nesse caso, reportarei o resultado apos o primeiro deploy.

