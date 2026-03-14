

## Plano: Tag da instância na lista de conversas

### Objetivo
Exibir uma badge com o nome da instância WhatsApp em cada conversa na lista lateral. Ao passar o mouse, mostrar o número da instância como tooltip.

### Abordagem

1. **Carregar instâncias ao iniciar** — No `WhatsAppChatPage.tsx`, ao carregar os chats, buscar também as instâncias do workspace (`whatsapp_instances`) e criar um mapa `instanceId → { display_name, phone }` via `useRef` ou `useState`.

2. **Exibir badge na lista de chats** — Abaixo do nome do contato (ou ao lado do telefone), renderizar um `<Badge>` pequeno com o `instance_display_name`. Envolver com `<Tooltip>` do Radix mostrando o número da instância (`phone`) no hover.

3. **Exibir badge no header do chat aberto** — Mesma lógica no header quando um chat está selecionado.

### Arquivos alterados
- `src/pages/WhatsAppChatPage.tsx`
  - Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`
  - Adicionar estado/ref `instanceMap: Record<string, { name: string; phone: string }>`
  - Buscar `whatsapp_instances` via supabase client no `useEffect` inicial
  - Na lista de chats (linha ~1367-1384): adicionar badge com tooltip
  - No header do chat (linha ~1431-1437): adicionar badge com tooltip

### Visual esperado
```text
┌─────────────────────────────┐
│ Lucas Carli                 │
│ +5544998685747              │
│ [matheus-colombo-teste]  ← badge
│ Você: Olá!                  │
└─────────────────────────────┘
         ↑ hover no badge:
    ┌──────────────────┐
    │ +5544999887766   │  ← tooltip com phone da instância
    └──────────────────┘
```

