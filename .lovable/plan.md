

## Plano: Painel de contato mais largo + correção de overflow

### Problema
O painel de contato (`w-80` = 320px) está cortando conteúdo na lateral direita (ex: "R$ 0,0" truncado). Com 3 colunas (sidebar + chat list + chat + contact panel), o espaço fica apertado.

### Alterações

1. **`ContactPanel.tsx`** — Aumentar largura de `w-80` (320px) para `w-96` (384px). Adicionar `overflow-hidden` no container para evitar conteúdo vazando.

2. **`ContactPanel.tsx`** — Na grid de Compras/Receita, adicionar `overflow-hidden` nos cards e `truncate` no valor da receita para não vazar.

3. **`ContactPanel.tsx`** — Nos cards de Funis, garantir `overflow-hidden` no container pai e `truncate` nos nomes longos de funil.

4. **`WhatsAppChatPage.tsx`** — Reduzir largura da lista de chats de `md:w-80 lg:w-96` para `md:w-72 lg:w-80` para compensar o painel maior e dar mais espaço ao chat.

### Arquivos alterados
- `src/components/whatsapp/ContactPanel.tsx` — largura `w-96`, overflow fixes
- `src/pages/WhatsAppChatPage.tsx` — lista de chats `md:w-72 lg:w-80`

