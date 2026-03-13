

## Problema: CSV com schema duplo

O arquivo `desafio_cold.csv` tem duas estruturas misturadas:
- Linha 1: header com 23 colunas (inclui "Nome")
- Linha 3: segundo header com 22 colunas (sem "Nome"), que desloca todos os dados subsequentes em 1 posição

Isso faz com que a coluna "WhatsApp com DDD" receba `{utm_source}` e "Seu e-mail" receba o número de telefone — ambos inválidos para seus campos.

## Solução: Tornar o parser de CSV resiliente a schemas duplos

### Alterações em `supabase/functions/import-leads/index.ts`

1. **Detectar e pular linhas-header duplicadas** no `parseCSV` — se uma linha de dados tiver valores que coincidem com nomes de colunas conhecidos, pular essa linha

2. **Realinhar colunas quando a contagem é diferente** — quando uma linha tem N-1 campos vs N headers, detectar a coluna ausente comparando os valores com os headers da segunda linha-header encontrada, e mapear usando esse header alternativo

3. **Fallback inteligente nos campos de contato** — se email e telefone estão vazios/inválidos após o mapeamento normal, verificar se o campo "nome" contém um email válido (padrão `@`) e se o campo "email" contém apenas dígitos (telefone), e trocar automaticamente

### Detalhes técnicos

No `parseCSV`, adicionar detecção de header duplicado:
```
// Se >50% dos valores da linha coincidem com headers, é uma linha-header → pular
const matchCount = values.filter(v => headers.includes(v.trim())).length;
if (matchCount > headers.length * 0.5) continue;
```

Na lógica de extração de contato (tanto `handleFunnelImport` quanto `handleBackfill`), adicionar fallback:
```
// Se email não tem @ mas parece telefone, e nome parece email → trocar
if (!email.includes("@") && /^\d+$/.test(email)) {
  const nameVal = getFieldValue(row, "nome", ...);
  if (nameVal.includes("@")) {
    phone = normPhone(email);
    email = normEmail(nameVal);
  }
}
```

Isso resolve tanto o CSV atual quanto CSVs futuros com problemas similares de schema misto.

