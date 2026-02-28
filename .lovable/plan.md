

## Diagnóstico: Por que 876 linhas → 796 cadastros no dashboard

### Problema identificado

O CSV tem **876 linhas de dados**. O frontend divide o CSV em **batches de 300 linhas** (BATCH_SIZE = 300 no `ImportContactsModal.tsx`). O edge function `import-leads` roda `countDistinctSignups()` **independentemente em cada batch**, não no CSV inteiro.

**Fluxo atual:**
```text
CSV 876 linhas
  ├── Batch 1 (300 linhas) → imported=236, duplicates=64
  ├── Batch 2 (300 linhas) → imported=222, duplicates=78
  └── Batch 3 (276 linhas) → imported=215, duplicates=61
```

**Dois bugs:**

1. **signup_count calculado por batch, não pelo CSV inteiro**: Se um contato aparece 3x no CSV (linhas 50, 350, 700), cada batch vê apenas 1 ocorrência. O `signup_count` é setado como 1 em cada batch, quando deveria ser 3. Os 80 que "sumiram" (876-796) são duplicatas dentro do mesmo batch (mesmo telefone + mesmo minuto), mas as duplicatas entre batches não incrementam o signup_count.

2. **Contatos cross-batch contados como "duplicates" em vez de incrementar signup_count**: Batch 2 e 3 encontram leads que já estão no funil (inseridos por batch 1) e os contam como `duplicates`, sem atualizar o `signup_count` deles.

**Dados atuais no DB:**
- 559 leads com signup_count=1
- 83 leads com signup_count=2  
- 17 leads com signup_count=3
- 5 leads com signup_count=4
- Total: 664 leads, SUM(signup_count) = 796

### Plano de correção

**Abordagem: Enviar o CSV inteiro em uma única request** (sem batching para o modo funnel/backfill)

O CSV tem 876 linhas — isso é perfeitamente processável em uma única chamada de edge function. O batching de 300 linhas é desnecessariamente pequeno e causa esses bugs de contagem.

#### 1. Aumentar BATCH_SIZE no frontend (`ImportContactsModal.tsx`)
- Mudar `BATCH_SIZE` de 300 para **5000** (ou mais), garantindo que CSVs de até 5000 linhas sejam enviados em uma única request
- Isso resolve os dois bugs de uma vez: o `countDistinctSignups` opera no CSV inteiro

#### 2. Corrigir o handleFunnelImport para leads cross-batch (`import-leads/index.ts`)
- Quando um lead já existe no funil (duplicate), ainda assim verificar se o `signup_count` precisa ser atualizado com base no `contactSignups`
- Atualmente o código faz `continue` e pula a atualização de signup_count para duplicates

#### 3. Limpar e reimportar
- Limpar o funil DISPARO API novamente
- Reimportar o CSV com a lógica corrigida

### Resumo técnico

| Arquivo | Mudança |
|---------|---------|
| `src/components/leads/ImportContactsModal.tsx` | BATCH_SIZE: 300 → 5000 |
| `supabase/functions/import-leads/index.ts` | Atualizar signup_count mesmo para duplicates já no funil |

