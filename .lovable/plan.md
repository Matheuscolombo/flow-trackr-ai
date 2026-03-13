
Diagnóstico objetivo (confirmado pelos logs/rede):
1) O envio está falhando no backend, não no frontend.
- Requisição do chat chega em `whatsapp-send` com payload correto.
- Resposta atual: `502 {"error":"All send attempts failed","detail":{"code":405,"message":"Method Not Allowed"}}`.

2) Causa raiz:
- A função `whatsapp-send` está tentando endpoints legados (`/message/sendText/...`, `/message/sendMessage/...`).
- Pela documentação oficial da UAZAPI v2, o endpoint de texto é `POST /send/text` com header `token` e body `{ number, text }`.
- Isso explica o 405 em todas as tentativas atuais.

Plano de correção definitiva:
1) Corrigir `whatsapp-send` para priorizar contrato v2 oficial
- Trocar tentativa principal para:
  - URL: `${baseUrl}/send/text`
  - Método: `POST`
  - Headers: `token` (e fallback controlado para variações de header)
  - Body: `{ number, text }`
- Manter fallback legado apenas como contingência, não como caminho principal.
- Adicionar fallback de base URL com `/api` (ex.: `${baseUrl}/api/send/text`) para ambientes proxyados.

2) Tornar envio robusto e observável
- Refatorar matriz de tentativas com prioridade clara (v2 primeiro).
- Melhorar log por tentativa: URL, header usado, status, trecho da resposta.
- Melhorar parsing de resposta (JSON e texto puro) para não perder diagnóstico.
- Em erro final, retornar lista resumida das tentativas (sem expor segredo), para depuração rápida.

3) Persistência outbound mais correta
- Em sucesso, extrair `message_id` retornado pela API (quando disponível) e salvar no banco.
- Salvar `payload_raw` com resposta real do provedor.
- Se API não retornar id, usar fallback local como hoje.

4) Ajuste UX no chat (evitar frustração)
- Em `WhatsAppChatPage.tsx`, manter o texto no input até confirmar sucesso (hoje limpa antes e restaura no erro).
- Exibir feedback de erro amigável para o usuário (toast/alerta), além do log no console.

Detalhes técnicos (arquivos-alvo):
- `supabase/functions/whatsapp-send/index.ts`
  - Reordenar/atualizar tentativas de endpoint.
  - Implementar helper de tentativas v2 + fallback `/api`.
  - Melhorar parsing/retorno de erro.
- `src/pages/WhatsAppChatPage.tsx`
  - Ajustar fluxo de `handleSend` (limpar input só após sucesso + feedback visual de erro).

Escopo deliberadamente fora desta correção:
- Sem mudanças de schema/RLS.
- Sem mexer em webhook/sync agora (o problema reportado atual é envio; a falha real está no endpoint de send).

Validação fim a fim (após implementar):
1) Teste técnico:
- Chamar `whatsapp-send` com payload real:
  - `instance_id: 7709c758-5db2-4178-bf6f-d27e194c69d7`
  - `remote_jid: 554498685747@s.whatsapp.net`
  - `text: "oi"`
- Esperado: HTTP 200 + `ok: true` + tentativa vencedora em `/send/text` (ou `/api/send/text` fallback).

2) Teste de dados:
- Confirmar nova linha `outbound` em `whatsapp_messages` com `body="oi"` e `status="sent"`.

3) Teste de UI:
- Enviar pelo chat na tela `/whatsapp/chat`.
- Mensagem deve aparecer no thread sem erro 502.
- Em falha real, UI deve mostrar erro claro sem “sumir” com o texto digitado.
