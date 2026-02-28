

## Adicionar busca de leads no Kanban do funil

### O que muda
Adicionar um campo de busca acima do kanban (ao lado do "Ordenar") que filtra os leads exibidos por nome, email ou telefone em tempo real.

### Implementação

1. **`src/pages/FunnelDetailPage.tsx`**
   - Adicionar state `searchQuery`
   - Adicionar input de busca ao lado dos botões de ordenação
   - Filtrar `leadsByStage` antes de passar ao `KanbanBoard`: para cada stage, filtrar leads cujo `name`, `email` ou `phone` contenham o texto digitado (case-insensitive)
   - Passar os leads filtrados e os counts originais ao KanbanBoard

### Detalhes técnicos
- Filtro client-side sobre os leads já carregados (até 200 por stage)
- Busca por substring em `name`, `email`, `phone`
- Debounce não é necessário pois o dataset é pequeno (max ~2400 leads em memória)
- O campo terá ícone de lupa e botão de limpar

