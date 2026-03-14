

## Fase 2 Parcial — Correcao do Bug de Audio + PTT

### Problemas Identificados

**1. Mensagem duplicada (o "bug" do chat)**
Quando o frontend envia um arquivo, ele cria uma mensagem otimista com `message_id: tempId`. A edge function insere no banco (disparando realtime INSERT) ANTES de retornar a resposta ao frontend. O realtime chega e o frontend nao encontra o `message_id` real na lista (ainda tem o tempId), entao adiciona duplicata.

**2. Audio .ogg nao vai como "gravado"**
O `detectMediaType` retorna `"audio"` mas a UAZAPI precisa receber `type: "ptt"` para que apareca como mensagem de voz no WhatsApp. Arquivos .ogg devem usar tipo `ptt`.

---

### Correcoes

**Frontend (`WhatsAppChatPage.tsx`)**:
1. `detectMediaType`: retornar `"ptt"` para arquivos `.ogg` e `audio/ogg`
2. Realtime INSERT handler: alem de checar `message_id`, tambem ignorar se existe mensagem `pending` do mesmo phone com timestamp proximo (< 10s) — isso evita duplicata durante a race condition
3. Na resposta do `postApi` para arquivo, marcar a mensagem otimista com flag para que o realtime a reconheca

**Backend (`whatsapp-send/index.ts`)**:
1. Quando `mediaType === "audio"` e o arquivo e `.ogg`, usar `type: "ptt"` nos payloads da UAZAPI
2. Salvar `message_type: "audio"` no banco (para o player funcionar), mas enviar `ptt` para a API

### Arquivos modificados
- `src/pages/WhatsAppChatPage.tsx` — fix duplicata + detectMediaType ptt
- `supabase/functions/whatsapp-send/index.ts` — enviar como ptt quando audio ogg

