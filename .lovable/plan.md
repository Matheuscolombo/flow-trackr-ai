

## Exibir signup_count (cadastros repetidos) no LeadCard e LeadTimeline

### Problema
O campo `signup_count` existe no banco mas não é buscado nem exibido. Um lead que se cadastrou 5x não mostra nenhuma indicação visual disso.

### Implementação

1. **`src/types/index.ts`** — Adicionar `signup_count?: number` e `last_signup_at?: string | null` na interface `Lead`

2. **`src/pages/FunnelDetailPage.tsx`**
   - Adicionar `signup_count` ao select das queries (tanto a principal quanto a de busca server-side)
   - Passar `signup_count` no `adaptLeadForKanban`

3. **`src/components/funnel/LeadCard.tsx`** — Quando `signup_count > 1`, mostrar badge discreto com ícone `UserPlus` e texto tipo "5x cadastros", em cor amarela/warning para chamar atenção

4. **`src/components/funnel/LeadTimeline.tsx`** — Na seção de header do drawer, adicionar badge "5x cadastros" ao lado das tags existentes quando `signup_count > 1`. Opcionalmente mostrar `last_signup_at` como dado extra na seção de atribuição

