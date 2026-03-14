

## Problema identificado

O botão de abrir o painel de contato e o próprio painel estão com a classe `hidden lg:flex`, que exige viewport >= 1024px. Sua tela atual tem 1008px de largura, então ambos ficam invisíveis.

## Solução

1. **Reduzir o breakpoint** de `lg` (1024px) para `md` (768px) em dois lugares:
   - **Botão de toggle** no header do chat (`WhatsAppChatPage.tsx` ~linha 1493): `hidden lg:flex` → `hidden md:flex`
   - **ContactPanel** container (`ContactPanel.tsx` ~linha 1): `hidden lg:flex` → `hidden md:flex`

2. **Alternativa**: manter `lg` mas o painel será visível apenas em telas >= 1024px. Se quiser suportar telas menores, usar `md`.

## Arquivos alterados
- `src/pages/WhatsAppChatPage.tsx` — botão toggle: `hidden md:flex`
- `src/components/whatsapp/ContactPanel.tsx` — container do painel: `hidden md:flex`

