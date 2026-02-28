

## Busca server-side de leads no Kanban

### Problema
A busca atual filtra apenas os leads carregados em memória (200 por stage). Se o funil tem 701 leads e o lead buscado não está nos 200 mais recentes, ele não aparece.

### Solução
Quando o usuário digita uma busca, fazer uma query server-side que busca em **todos** os leads do funil (não só os 200 carregados), e exibir os resultados filtrados no kanban.

### Implementação

1. **`src/pages/FunnelDetailPage.tsx`**
   - Manter a busca client-side para resultados instantâneos nos leads já carregados
   - Adicionar um debounce (300ms) que dispara uma query server-side quando o texto tem 3+ caracteres
   - A query server-side busca em `lead_funnel_stages` JOIN `leads` filtrando por `name ILIKE`, `email ILIKE` ou `phone ILIKE` com `%query%`, limitado a 50 resultados
   - Mesclar resultados server-side com os client-side (sem duplicatas, usando lead.id como chave)
   - Mostrar indicador visual de "buscando..." durante a query server-side
   - Quando a busca é limpa, voltar aos leads originais carregados

### Detalhes técnicos
- Query: `supabase.from("lead_funnel_stages").select("stage_id, entered_at, source, leads(...)").eq("funnel_id", id).or("name.ilike.%q%,email.ilike.%q%,phone.ilike.%q%", { foreignTable: "leads" })` com `.limit(50)`
- Debounce com `setTimeout` / `clearTimeout` no useEffect
- Merge por `lead.id` para evitar duplicatas entre resultados client-side e server-side

