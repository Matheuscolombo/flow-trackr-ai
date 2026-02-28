

## Problema

Os eventos `signup` e `re_signup` nao estao sendo persistidos no banco porque a tabela `lead_events` **nao tem indice unico na coluna `idempotency_key`**. O codigo usa `.upsert(..., { onConflict: "idempotency_key" })`, que exige esse indice para funcionar. Sem ele, o upsert falha silenciosamente e nenhum evento eh salvo.

## Evidencia

- `pg_indexes` para `lead_events` mostra apenas: `pkey(id)`, `idx_lead_events_funnel`, `idx_lead_events_lead`
- Nenhum indice em `idempotency_key`

## Plano

### 1. Criar indice unico na coluna `idempotency_key`

Migracao SQL:

```sql
CREATE UNIQUE INDEX idx_lead_events_idempotency_key 
ON public.lead_events (idempotency_key) 
WHERE idempotency_key IS NOT NULL;
```

Isso eh um indice parcial — so aplica para registros com `idempotency_key` preenchido (os inserts sem key continuam funcionando normalmente).

### 2. Reimportar

Apos a migracao, o usuario reimporta o CSV e os eventos `signup` / `re_signup` serao persistidos corretamente e aparecerao na timeline.

Nenhuma alteracao de codigo necessaria — o Edge Function e o LeadTimeline ja estao corretos.

