
Diagnóstico confirmado com evidência real:
- O frontend está atualizando (polling chama `whatsapp-chats` a cada 10s), mas o backend devolve mensagens novas com `body: null` (snapshot de rede e banco).
- O webhook recebe eventos e grava (`stored inbound text`), porém o parser atual não lê o formato UAZAPI v2 “flat” (`message.content`, `message.text`, `message.fromMe`), então salva sem texto.
- O envio ainda falha em parte dos casos (`405` em `whatsapp-send`) por combinação de endpoint/header/payload.

Plano de correção definitiva (sem paliativo):
1) Unificar parser de mensagem UAZAPI v2 (webhook + sync histórico)
- Atualizar `uazapi-webhook` para extrair:
  - texto de `message.content`, `message.text`, `message.content.text` e legados.
  - direção de `message.fromMe` (além de `key.fromMe`).
  - tipo via `message.type | message.messageType | message.mediaType`.
  - timestamp ms/s corretamente.
- Aplicar a mesma lógica no `uazapi-manage?action=sync_messages`.
- Normalizar telefone sempre com a mesma função (evitar chats duplicados `+55...` vs `55...`).

2) Corrigir backlog já salvo com `body null`
- Criar migration de backfill em `whatsapp_messages`:
  - preencher `body` a partir de `payload_raw` (paths v2 + legado).
  - corrigir `direction` quando `payload_raw.message.fromMe = true`.
- Resultado: histórico antigo passa a aparecer com texto imediatamente.

3) Tornar envio resiliente e compatível com o padrão documentado
- Em `whatsapp-send`:
  - normalizar destinatário para número limpo (sem `@s.whatsapp.net`).
  - tentar matriz de envio com fallback (endpoint + header + payload), incluindo padrão pesquisado:
    - `POST /message/sendText/:instanceName`
    - body com `{ number, textMessage: { text } }` e variações compatíveis.
  - incluir logs por tentativa (URL, auth mode, status, trecho da resposta) e erro final detalhado.

4) Blindar frontend para refletir update real
- `WhatsAppChatPage.tsx`:
  - `fetchApi/postApi` passam a lançar erro em `!res.ok` (hoje falha silenciosa).
  - `handleSend` com toast de sucesso/erro e fallback de `instance_id` quando chat legado vier `null`.
  - realtime ouvir `INSERT` e `UPDATE` (upsert pode gerar update sem insert).

5) Fallback de exibição para não “sumir texto”
- Em `whatsapp-chats`, quando `body` vier nulo em mensagem de texto, derivar texto de `payload_raw` (somente para resposta), garantindo UX mesmo antes/entre sincronizações.

Arquivos que serão alterados:
- `supabase/functions/uazapi-webhook/index.ts`
- `supabase/functions/uazapi-manage/index.ts`
- `supabase/functions/whatsapp-send/index.ts`
- `supabase/functions/whatsapp-chats/index.ts`
- `src/pages/WhatsAppChatPage.tsx`
- `supabase/migrations/<timestamp>_backfill_whatsapp_message_body.sql`

Validação final (fim a fim):
```text
1) Enviar mensagem real para o número da instância.
2) Confirmar: entra no banco com body preenchido.
3) Confirmar: aparece no chat sem refresh manual.
4) Enviar pelo painel e validar retorno 200 + mensagem no thread.
5) Rodar sync histórico e verificar textos antigos preenchidos.
```

Observação de segurança/backend:
- Não haverá mudança de RLS/tabelas novas; apenas correção de parsing, envio e backfill de dados já existentes.
