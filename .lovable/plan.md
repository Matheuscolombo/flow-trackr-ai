

## Problema Identificado

Na linha 317 do importador:
```typescript
if (!parsed.email && !parsed.phone) { noContact++; ignored++; continue; }
```

Linhas sem email/telefone são descartadas. Mas essas linhas podem ser:
- **Order bumps** (produto adicional no mesmo pedido)
- **Renovações de assinatura** (plataforma não repete dados do comprador)
- **Upsells** vinculados ao mesmo invoice

Isso explica a diferença: R$ 981.839 importados vs R$ 1.037.946 esperados = **~R$ 56k perdidos**.

## Solução

Quando uma linha não tem email/telefone, ao invés de ignorar, tentar vincular pelo `external_invoice_id` (fatura/pedido) a uma venda que já tem lead vinculado. Plataformas como Hotmart e Eduzz usam o mesmo número de pedido para o produto principal e os bumps.

### Mudanças no `import-sales/index.ts`

1. **Remover o `continue` da linha 317** — não descartar linhas sem contato
2. **Criar um segundo passo**: após processar todas as linhas com contato, voltar nas linhas sem contato e tentar vincular por invoice prefix ou por posição (linha anterior no CSV geralmente é o pedido principal)
3. **Estratégia de fallback**: se a linha sem contato tem o mesmo `external_invoice_id` base (ex: `12345` e `12345-bump`), vincular ao mesmo lead. Se não, usar o buyer_email/phone da linha anterior no CSV como fallback (padrão comum em exports de plataforma)
4. **Último recurso**: criar a venda como "órfã" (`lead_id = null`) para não perder receita — pelo menos aparece nos totais

### Mudança na RPC `get_leads_metrics`

Incluir vendas órfãs (sem lead_id) no total de receita, somando diretamente de `sale_events` ao invés de depender do campo `total_revenue` da tabela `leads`.

### Resultado Esperado

Após reimportação com a lógica corrigida, a receita total deve bater com R$ 1.037.946,70.

