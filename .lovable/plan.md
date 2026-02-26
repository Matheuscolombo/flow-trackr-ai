

## Diagnóstico Atual

A aplicação **já está 100% conectada ao banco de dados**. Todas as páginas (Dashboard, Leads, Funis, Campanhas) fazem queries reais via Supabase. O arquivo `mock.ts` existe mas é praticamente **não utilizado** — apenas uma função auxiliar em `FunnelChart.tsx` importa dele.

O banco já tem a estrutura completa:
- 12 tabelas criadas com RLS configurado
- 8 database functions (RPCs) funcionando
- 1 workspace + 1 campanha + 1 funil "Base de Compradores" criados automaticamente pelo login

**O problema não é migração de código — é que o banco está vazio.**

## Plano de Ação

### 1. Remover dependência do mock.ts
- Eliminar o import de `getConversionRate` em `FunnelChart.tsx` e implementar o cálculo inline
- O arquivo `mock.ts` pode ser deletado inteiramente depois

### 2. Popular dados via importação
A plataforma já tem os importadores prontos:
- **Importar Vendas** (Eduzz/Hotmart) → cria leads + sale_events automaticamente
- **Importar Leads** (CSV genérico) → cria leads em funis específicos

Basta usar as planilhas reais do seu negócio.

### 3. Sobre "migrar para Supabase externo"
Conforme discutido anteriormente, este projeto roda no Lovable Cloud. Os dados já estão no banco — a infraestrutura é a mesma tecnologia. Não há necessidade de migração técnica.

---

### Seção Técnica

**Arquivo: `src/components/funnel/FunnelChart.tsx`**
- Remover `import { getConversionRate } from "@/data/mock"`
- Substituir por cálculo local: `(conversions / totalLeads * 100)`

**Arquivo: `src/data/mock.ts`**
- Deletar inteiramente (nenhum outro arquivo depende dele)

**Resultado:** aplicação 100% limpa, sem dados fake, pronta para receber dados reais via importadores existentes.

