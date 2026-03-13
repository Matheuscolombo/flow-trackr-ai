

## Diagnóstico e Plano: Corrigir Sync + Mover Chat para o Menu

### Problemas Identificados

1. **Sync não funciona**: Só existe 1 mensagem no banco (a de teste). O botão de sync tenta pegar `instance_id` dos chats existentes, mas todos têm `instance_id: null`. O fallback busca instâncias da API, mas os logs do edge function não mostram nenhuma chamada `sync_messages` — indica que o fluxo pode estar falhando silenciosamente no frontend ou a chamada UAZAPI retorna erro sem logar.

2. **Chat como sub-rota**: O chat está em `/whatsapp/chat` como rota separada. O usuário quer acessar direto pelo menu lateral.

### Mudanças

**1. Sidebar — Adicionar "Chat" como item direto no menu**
- Adicionar entrada "WhatsApp Chat" no `AppSidebar.tsx` com ícone `MessagesSquare` apontando para `/whatsapp/chat`
- Manter "WhatsApp" existente como "WhatsApp Config" ou renomear para "Instâncias WhatsApp"

**2. Corrigir fluxo de sync no frontend (`WhatsAppChatPage.tsx`)**
- Sempre buscar instância do endpoint `uazapi-manage?action=list` (não depender de `instance_id` dos chats, que podem ser null)
- Adicionar `console.log` e toast de erro para feedback quando a sync falha
- Mostrar toast com resultado (ex: "Sincronizadas X mensagens de Y conversas" ou "Erro: ...")

**3. Corrigir sync no edge function (`uazapi-manage`)**
- Adicionar mais logging para debug (log da resposta do UAZAPI ao buscar chats)
- Tentar endpoint alternativo UAZAPI v2: `GET /chat/findChats` com header `token` e também com query param `?instanceName=...`
- Se nenhum chat for encontrado, retornar mensagem clara de erro

**4. Adicionar fallback polling no chat (resiliência)**
- Implementar polling a cada 5s como fallback para o Realtime (baseado na recomendação do stack overflow)
- Se o Realtime estiver funcionando, o polling serve apenas como safety net

### Ordem de Implementação
1. Adicionar Chat ao sidebar
2. Corrigir sync (frontend + edge function com melhor logging)
3. Adicionar polling fallback
4. Re-deploy edge function e testar

