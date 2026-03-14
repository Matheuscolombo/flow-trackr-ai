

## Presenca (digitando/gravando) + Excluir/Editar mensagens

### 1. Presenca "composing" / "recording"

A UAZAPI tem endpoint `POST /message/presence` com `{number, presence, delay}`.
- `composing` = digitando
- `recording` = gravando audio
- `paused` = cancela

**Implementacao:**

- **Nova edge function `whatsapp-presence/index.ts`**: Recebe `{instance_id, remote_jid, presence, delay}`, busca instancia, faz `POST /message/presence` na UAZAPI.
- **Frontend**: 
  - Ao usuario comecar a digitar (`onChange` do input), enviar `composing` com delay de 30s. Usar debounce (so enviar 1x a cada 25s enquanto digita).
  - Ao selecionar arquivo de audio (.ogg), enviar `recording` antes do upload.
  - A UAZAPI cancela automaticamente ao enviar a mensagem, entao nao precisa enviar `paused` manualmente.

### 2. Excluir mensagem individual

- **Frontend**: Adicionar menu de contexto (hover ou long-press) em cada mensagem com opcao "Excluir".
- **Acao**: `DELETE` na tabela `whatsapp_messages` pelo `id` da mensagem, atualizando o state local.
- Nao envia comando para a UAZAPI (a mensagem ja foi enviada no WhatsApp, so remove do sistema local).

### 3. Editar mensagem de texto

- **Frontend**: No menu de contexto, opcao "Editar" so para mensagens outbound do tipo `text`.
- **Acao**: Abre o texto no input para edicao, faz `UPDATE` no `body` da `whatsapp_messages`.
- Edicao local apenas (WhatsApp nao suporta edicao via API).

### Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/whatsapp-presence/index.ts` | Nova edge function |
| `supabase/config.toml` | Adicionar `[functions.whatsapp-presence]` verify_jwt = false |
| `src/pages/WhatsAppChatPage.tsx` | Debounced presence, menu contexto msg, delete/edit msg |

### Detalhes tecnicos

**Edge function `whatsapp-presence`**:
- Auth: valida JWT do usuario
- Busca instancia + verifica workspace ownership
- `POST ${baseUrl}/message/presence` com header `token`
- Payload: `{number, presence, delay}`

**Frontend presence debounce**:
- `useRef` para timestamp do ultimo envio de presence
- So reenvia se passaram 25s desde o ultimo
- Para audio: envia `recording` antes do upload iniciar

**Menu de mensagem**:
- Botao com icone `MoreVertical` aparece no hover do balao
- Dropdown com "Excluir" (todas) e "Editar" (so outbound text)
- Excluir: `supabase.from("whatsapp_messages").delete().eq("id", msg.id)`
- Editar: seta estado `editingMessageId`, popula input, no submit faz `update({body}).eq("id", editingMessageId)`

