

## Limpeza do Banco para Reimportação

Operações de dados a executar:

1. **Deletar todos os `sale_events`** do workspace do usuário
2. **Recalcular stats dos leads** (zerar `total_revenue`, `purchase_count`, etc.)
3. **Deletar leads ghost** (`is_ghost = true`) que foram criados apenas pelo importador de vendas

Isso preserva os leads reais (importados via CSV de contatos ou webhook) e apenas remove as vendas e leads fantasma para reimportação limpa.

### SQL a executar (via insert tool):

```sql
-- 1. Deletar sale_events
DELETE FROM sale_events WHERE workspace_id IN (SELECT id FROM workspaces);

-- 2. Deletar leads ghost
DELETE FROM leads WHERE is_ghost = true;

-- 3. Zerar stats dos leads remanescentes
UPDATE leads SET
  total_revenue = 0,
  purchase_count = 0,
  first_purchase_at = NULL,
  last_purchase_at = NULL,
  is_subscriber = false,
  ltv_days = NULL,
  updated_at = now();
```

