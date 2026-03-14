

## Plano: CRM completo no painel de contato do WhatsApp

### Situação atual
- O webhook já auto-cria leads quando recebe mensagem inbound de número desconhecido (linha 551-606 do `uazapi-webhook`)
- O `ContactPanel` já mostra dados do lead, tags e últimas 10 compras
- Porém falta: timeline de eventos (funis), posições em funis, e o painel mostra "Lead não vinculado" quando `lead_id` é null no chat (mesmo que o lead exista no banco)

### Problemas a resolver
1. **Lead existe mas chat não tem `lead_id`** — mensagens antigas sincronizadas antes do lead existir ficam sem `lead_id`. O painel mostra "Lead não vinculado" mesmo com lead no banco
2. **Falta timeline/eventos no painel** — não mostra histórico de funis nem eventos do lead
3. **Falta posições em funis** — não mostra em qual etapa o lead está

### Alterações

#### 1. `ContactPanel.tsx` — buscar lead por telefone quando `leadId` é null
Se `leadId` não vier do chat, buscar o lead pelo telefone normalizado (com variante do 9o dígito). Se encontrar, carregar todos os dados. Se não encontrar, mostrar botão "Criar lead".

#### 2. `ContactPanel.tsx` — adicionar seções de Funis e Timeline
Após as compras, adicionar:
- **Funis**: buscar `lead_funnel_stages` com join em `funnel_stages` e `funnels` para mostrar em quais funis/etapas o lead está
- **Timeline**: buscar últimos 15 `lead_events` do lead, ordenados por `timestamp_event desc`, e renderizar uma mini-timeline (versão compacta do `LeadTimeline`)

#### 3. `ContactPanel.tsx` — botão "Criar lead" quando não existe
Quando não há lead vinculado, mostrar botão que cria o lead com `phone`, `name` (do contato), `source: "whatsapp"` e atualiza o estado local

#### 4. `ContactPanel.tsx` — buscar lead_id atualizado e propagar
Quando o painel encontra/cria um lead, chamar `onLeadLinked(leadId)` para atualizar o `selectedChat.lead_id` no pai

### Arquivo alterado
- `src/components/whatsapp/ContactPanel.tsx`
  - Adicionar prop `onLeadLinked?: (leadId: string) => void`
  - Adicionar prop `workspaceId: string`
  - Buscar lead por telefone quando `leadId` é null
  - Adicionar seção "Funis" com etapas atuais
  - Adicionar seção "Timeline" com últimos eventos
  - Adicionar botão "Criar Lead" quando não existe
- `src/pages/WhatsAppChatPage.tsx`
  - Passar `workspaceId` e `onLeadLinked` para `ContactPanel`
  - `onLeadLinked` atualiza `selectedChat.lead_id` e `chats[].lead_id`

### Visual esperado no painel
```text
┌─────────────────────────┐
│ [foto] Lucas Carli      │
│ +5544998685747          │
│ ✉ lucas@email.com       │
│ 📅 Lead desde 01/01/25  │
├─────────────────────────┤
│ 🏷 Tags: [VIP] [Buyer]  │
├─────────────────────────┤
│ 💰 Compras              │
│  2 compras  R$ 497,00   │
├─────────────────────────┤
│ 🔀 Funis                │
│  Lançamento X → Checkout│
│  Perpétuo Y → Grupo     │
├─────────────────────────┤
│ 📋 Timeline             │
│  • signup (01/01)        │
│  • checkout (02/01)      │
│  • pagamento ✓ (03/01)   │
├─────────────────────────┤
│ 🛒 Últimas Compras      │
│  Curso X - R$ 297,00    │
│  Mentoria - R$ 200,00   │
└─────────────────────────┘
```

