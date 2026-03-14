
Objetivo
- Corrigir definitivamente “Editar” e “Excluir” mensagem no chat para sempre agir na mensagem certa e refletir na UI sem inconsistências.

Diagnóstico (com base nos logs)
- O delete está disparando (request `DELETE .../whatsapp_messages` retornando `204`), mas em alguns cliques ele mira um `id` que não corresponde ao item visível.
- Há warning de React: `Encountered two children with the same key` no thread de mensagens.
- Isso indica estado de mensagens com duplicidade/inconsistência de identidade (chave/ID), causando handlers apontarem para item errado ou stale.

Plano de implementação
1) Estabilizar identidade de mensagem no frontend
- Em `WhatsAppChatPage.tsx`, criar um identificador canônico por mensagem:
  - prioridade: `message_id` (quando existir), fallback `id`.
- Usar esse identificador para:
  - chave de render dos balões (evitar `key` duplicada),
  - estado de edição (não depender só de `id`),
  - resolução da mensagem antes de editar/excluir.

2) Dedupe centralizado do estado de mensagens
- Criar helper `dedupeMessages(messages)` para remover duplicadas por identidade canônica.
- Aplicar esse helper em todos os pontos que alimentam `setMessages`:
  - `loadMessages`,
  - realtime INSERT/UPDATE,
  - optimistic updates de send/edit/delete.
- Ordenar por `timestamp_msg` após dedupe para manter timeline consistente.

3) Tornar Editar/Excluir resilientes (sem “falso sucesso”)
- `handleDeleteMessage`:
  - resolver mensagem atual pelo identificador canônico no estado mais recente;
  - executar delete com fallback (1ª tentativa por `id`; se 0 linhas afetadas, 2ª por `message_id`);
  - só depois sincronizar lista/conversa.
- `saveEditMessage`:
  - resolver mensagem pelo identificador canônico;
  - update com fallback igual (id → message_id);
  - validar retorno afetado; se 0, mostrar erro claro e recarregar mensagens.
- Remover dependência de `phone` no filtro de mutation (usar `workspace_id` + identificador), para não falhar por divergência de formatação.

4) Corrigir acoplamento do modo edição
- Trocar `editingMessageId` por `editingMessageKey` (canônico) para não quebrar quando mensagem otimista é reconciliada com a real.
- Garantir que, ao receber UPDATE/INSERT realtime, a edição continue vinculada à mensagem correta.

5) Melhorar observabilidade para debug rápido
- Logs temporários controlados (`[msg-action]`) com:
  - key canônica,
  - id/message_id usados na mutation,
  - quantidade de linhas afetadas.
- Isso permite confirmar rapidamente se cada clique aciona a linha correta.

Arquivos que serão alterados
- `src/pages/WhatsAppChatPage.tsx` (principal; sem mudança de banco/migração).

Detalhes técnicos
- Sem alteração de schema/RLS.
- Sem mudança em backend function para este fix.
- Foco em consistência de estado React + estratégia robusta de update/delete no client.

Validação (E2E)
1) Abrir conversa com 3+ mensagens outbound/inbound.
2) Excluir uma mensagem antiga e uma recém-enviada.
3) Editar uma mensagem outbound antiga e uma recém-enviada.
4) Confirmar:
- item correto foi alterado/removido,
- preview da conversa atualiza,
- não aparece warning de key duplicada no console,
- “digitando” não trava ao entrar/sair do modo edição.
