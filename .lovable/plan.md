

## Melhorias: Tags existentes + Registro de duplicados

### 1. Tags existentes no importador

O código já busca tags do banco e lista como chips clicáveis. Porém, há um filtro em `availableTags` (linha 188) que só mostra tags `global` ou do funil selecionado. No modo "Registrar evento", como `funnelId` pode estar vazio, quase nenhuma tag aparece.

**Correção em `ImportContactsModal.tsx`:**
- No modo `event_only`, mostrar TODAS as tags (sem filtro por funil)
- Adicionar uma seção visual separando "Tags existentes" das que o usuário pode criar
- Manter o input "Nova tag..." como está

### 2. Registro de tentativas duplicadas (signup_count)

Atualmente, duplicados são apenas contados e descartados. A ideia é registrar cada tentativa de cadastro duplicado como dado útil para scoring futuro.

**Mudanças no banco de dados:**
- Adicionar coluna `signup_count` (integer, default 1) na tabela `leads`
- Adicionar coluna `last_signup_at` (timestamp) na tabela `leads`

**Mudanças na edge function `import-leads/index.ts`:**
- Quando um lead duplicado é encontrado (já existe no funil), incrementar `signup_count` e atualizar `last_signup_at` ao invés de simplesmente ignorar
- Retornar no resultado: `duplicates_updated` para indicar quantos foram atualizados

**Mudanças no frontend (`ImportContactsModal.tsx`):**
- Na tela de resultado, ao invés de só "166 duplicados", mostrar algo como "166 duplicados atualizados (contagem de cadastros incrementada)"
- Texto explicativo: "Leads que se cadastraram mais de uma vez têm o contador atualizado"

### Arquivos modificados
1. **Migração SQL** — adicionar `signup_count` e `last_signup_at` em `leads`
2. **`supabase/functions/import-leads/index.ts`** — incrementar signup_count para duplicados
3. **`src/components/leads/ImportContactsModal.tsx`** — corrigir filtro de tags + atualizar tela de resultado

