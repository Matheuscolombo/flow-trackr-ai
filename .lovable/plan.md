

## Adicionar Ordenação ao Catálogo de Produtos

Adicionar um dropdown/select de ordenação ao lado dos filtros existentes no `ProductCardGrid.tsx`.

### Opções de ordenação
1. **Nome (A-Z)** — padrão atual
2. **Nome (Z-A)**
3. **Receita (maior → menor)**
4. **Receita (menor → maior)**
5. **Vendas (maior → menor)**
6. **Vendas (menor → maior)**
7. **Mais recente** (created_at desc)
8. **Mais vínculos** (quantidade de mappings desc)

### Implementação

**Arquivo:** `src/components/products/ProductCardGrid.tsx`

- Adicionar estado `sortBy` com as opções acima
- Adicionar um `<Select>` compacto ao lado da barra de busca e filtros de plataforma
- Aplicar `.sort()` no array `filtered` antes do render, usando `catalogStats` para ordenar por receita/vendas
- Ícone `ArrowUpDown` do lucide no trigger do select

### Layout da barra de filtros (atualizado)

```text
[🔍 Buscar produto...        ] [Ordenar: Receita ↓ ▾] [Todos] [Eduzz] [Hotmart]
```

Nenhuma mudança em hooks ou banco de dados — apenas lógica de sort no frontend.

