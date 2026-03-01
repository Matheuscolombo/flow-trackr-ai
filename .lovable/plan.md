

## Funcionalidade: Apagar Funil

Atualmente não existe opção para excluir um funil. Vou adicionar essa funcionalidade em dois lugares: na listagem de funis e na página de detalhe do funil.

### O que será feito

1. **Adicionar opção "Apagar" no menu do card de funil** (`FunnelsPage.tsx`)
   - Novo item "Apagar" no DropdownMenu existente (ao lado de "Duplicar")
   - Ao clicar, abre um AlertDialog de confirmação com aviso de que leads órfãos serão removidos

2. **Lógica de exclusão** (diretamente no frontend)
   - Deleta em cascata: `funnel_edges`, `funnel_source_nodes`, `stage_transition_rules`, `lead_funnel_stages`, `lead_events`, `funnel_stages`, e por fim o `funnels` registro
   - Usa a edge function `clear-funnel-leads` já existente para limpar leads antes de apagar o funil em si
   - Após limpar leads, deleta `funnel_edges`, `funnel_source_nodes`, `stage_transition_rules`, `funnel_stages` e o próprio `funnels`

3. **Confirmação visual**
   - AlertDialog com título "Apagar funil?" e descrição clara do impacto
   - Botão vermelho "Apagar" com estado de loading
   - Toast de sucesso/erro após a operação

### Arquivos alterados

- `src/pages/FunnelsPage.tsx` — adicionar item "Apagar" no dropdown + AlertDialog + lógica de exclusão

### Detalhes técnicos

A exclusão segue esta ordem para respeitar foreign keys:
1. Chamar `clear-funnel-leads` (limpa lead_funnel_stages, lead_events, leads órfãos)
2. `DELETE funnel_edges WHERE funnel_id`
3. `DELETE funnel_source_nodes WHERE funnel_id`
4. `DELETE stage_transition_rules WHERE funnel_id`
5. `DELETE funnel_stages WHERE funnel_id`
6. `DELETE funnels WHERE id`

