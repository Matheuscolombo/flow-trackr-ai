

## Limpar leads do funil "DISPARO API - DESAFIO PROTOCOLOS ANTI-DOENÇAS"

**Dados encontrados:**
- Funnel ID: `cd1addd9-d63d-4e35-adf3-b0a24d8fdc97`
- 701 posições de leads neste funil
- 641 leads que existem SOMENTE neste funil (serão deletados)
- 60 leads que também estão em outros funis (serão mantidos, só removidos deste funil)

### Plano de execução

Criar uma edge function temporária `clear-funnel-leads` que:

1. Recebe `funnel_id` no body
2. Verifica que o funil pertence ao workspace do usuário autenticado
3. Coleta todos os `lead_id` do funil
4. Deleta todos os registros de `lead_funnel_stages` deste funil
5. Deleta todos os `lead_events` deste funil
6. Identifica leads órfãos (sem posição em nenhum outro funil)
7. Deleta `lead_tags` e `leads` dos órfãos
8. Retorna contagem do que foi deletado

Depois de executar, a edge function pode ser removida ou mantida para uso futuro.

### Arquivos
1. `supabase/functions/clear-funnel-leads/index.ts` — nova edge function

Após deploy, chamarei a function com o funnel_id para executar a limpeza.

