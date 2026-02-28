

## Plano: Registrar TODOS os cadastros como eventos na timeline

### Problema atual

- O primeiro cadastro no funil nao gera nenhum `lead_event` -- so aparece o sintetico "Lead cadastrado" com `lead.created_at`, que pode ser de OUTRO funil
- Apenas re-signups (2o+) geram eventos `re_signup`
- Resultado: lead com 2 cadastros neste funil mostra apenas 1 evento de re_signup, e o "Lead cadastrado" aponta para a data global, nao para este funil

### Mudancas

#### 1. Edge function `import-leads/index.ts`
- Para **novos leads no funil** (nao duplicates, nao cross-batch): criar um evento `signup` para o PRIMEIRO timestamp tambem, nao so os re-signups
- Manter os `re_signup` para os subsequentes
- Para **cross-batch duplicates**: ja cria eventos para todos os timestamps -- manter como esta
- Resultado: cada cadastro neste funil tera um evento real no banco, com a data correta do CSV

#### 2. Timeline `LeadTimeline.tsx`
- Adicionar config para evento `signup` no `eventConfig`: icon UserPlus, dot azul, label "Cadastro no funil"
- O `re_signup` ja esta configurado com label "Re-cadastro" -- manter
- No `detail` do `signup`, mostrar o nome do funil (disponivel no `payload_raw`)

#### 3. Evento sintetico "Lead cadastrado"
- Manter como esta -- ele marca a data de criacao global do lead no sistema
- Os eventos `signup` e `re_signup` mostram os cadastros especificos NESTE funil

### Resumo tecnico

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/import-leads/index.ts` | Criar evento `signup` para o 1o cadastro no funil (alem dos `re_signup` ja existentes) |
| `src/components/funnel/LeadTimeline.tsx` | Adicionar `signup` ao `eventConfig` com label "Cadastro no funil" |

