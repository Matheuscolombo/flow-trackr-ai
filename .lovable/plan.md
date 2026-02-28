

## Melhorias de UX/UI para o Catálogo de Produtos

Baseado na screenshot atual e no código, aqui estão as melhorias propostas:

### 1. Cards ao invés de tabela pura
Trocar a `<Table>` por **cards** com layout mais visual e espaçoso. Cada produto vira um card com:
- Nome em destaque (font-semibold, tamanho maior)
- Descrição abaixo em texto muted
- Badges de vínculos com mais padding e melhor legibilidade
- Stats (vendas/receita) com ícones e formatação mais clara
- Ações (editar/excluir) como ícones no canto superior direito do card

### 2. Barra de busca + filtro por plataforma
Adicionar acima da lista:
- Input de busca para filtrar produtos por nome
- Chips de filtro por plataforma (Eduzz, Hotmart, etc.) baseados nas plataformas presentes nos mappings

### 3. Melhorias visuais nos badges de vínculo
- Badges maiores com melhor contraste e legibilidade
- Ícone da plataforma (ou letra inicial colorida) ao invés de só texto
- Botão de remover vínculo (X) mais visível com hover state mais claro

### 4. Empty state e loading melhorados
- Skeleton loading ao invés de spinner simples
- Empty state com ilustração/ícone grande e CTA mais claro

### 5. Stats em destaque
- Vendas e receita com mini-ícones (ShoppingCart, DollarSign)
- Números com fonte tabular-nums maior e cor de destaque para receita

### Arquivos a modificar
- `src/components/products/ProductCatalogTable.tsx` — refatorar de tabela para card grid com busca/filtro
- `src/pages/ProductsPage.tsx` — ajustar layout da seção de catálogo

### Abordagem
- Manter a mesma lógica de dados (hooks inalterados)
- Reutilizar os mesmos componentes UI (Badge, Button, Input)
- Manter as funcionalidades de editar/excluir/remover vínculo inline

