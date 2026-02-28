

## Plano: Nós estilo Funnelytics com thumbnail de página + nós de fonte de tráfego

### O que muda

**1. Migração de banco — nova tabela `funnel_source_nodes`**
- Tabela para nós de "fonte de tráfego" (Instagram, Facebook Ads, Email, YouTube, etc.) que não são etapas do funil, mas aparecem no canvas visual conectados às etapas de entrada
- Colunas: `id`, `funnel_id`, `name`, `icon_type` (instagram/facebook/youtube/email/ads/organic/tiktok/custom), `position_x`, `position_y`, `connected_stage_id` (FK para funnel_stages), `lead_count` (cache), `created_at`
- Adicionar coluna `thumbnail_url` (text, nullable) na tabela `funnel_stages` para armazenar URL de preview/thumbnail da página

**2. Nó customizado `FunnelFlowNode` — redesign estilo Funnelytics**
- Nós maiores (~200px largura) com fundo escuro e borda colorida (como na imagem 1)
- Se `page_url` existir e tiver `thumbnail_url`: mostrar thumbnail da página como imagem dentro do nó (similar ao Funnelytics com preview de página)
- Se não tiver thumbnail: manter layout atual com nome + contagem + badge
- Handles nas 4 direções (top, bottom, left, right) para conexões flexíveis

**3. Novo nó `TrafficSourceNode`**
- Nó visual diferente para fontes de tráfego (ícone grande + nome + contagem)
- Ícones pré-definidos: Instagram, Facebook, YouTube, Google Ads, Email, TikTok, Orgânico
- Apenas handle `source` (saída) — conecta-se às etapas de entrada do funil
- Exibe contagem de leads vindos daquela fonte (baseado em `utm_source` ou `source` dos leads)

**4. Toolbar no canvas visual**
- Barra lateral ou toolbar acima do canvas com botões para adicionar:
  - "Fonte de tráfego" → abre popover com lista de ícones (Instagram, Ads, etc.)
  - O nó é criado no canvas e pode ser arrastado e conectado a uma etapa
- Botão para adicionar thumbnail a uma etapa (input de URL de imagem)

**5. `FunnelFlowEditor` — atualizado**
- Carregar `funnel_source_nodes` do banco junto com stages
- Renderizar nós de fonte + nós de etapa no mesmo canvas
- Edges entre fontes → etapas mostram contagem de leads daquela fonte
- Persistir posição dos nós de fonte ao arrastar (mesma lógica de debounce)
- Ao conectar fonte → etapa, salvar `connected_stage_id`

**6. Contagem de leads por fonte**
- Query que agrupa leads por `source` ou `utm_source` para cada etapa de entrada
- Exibido como label na edge entre fonte e etapa

### Arquivos impactados
- **Nova migração SQL**: tabela `funnel_source_nodes` + coluna `thumbnail_url` em `funnel_stages`
- **Novo**: `src/components/funnel/TrafficSourceNode.tsx`
- **Editar**: `src/components/funnel/FunnelFlowNode.tsx` — redesign com thumbnail
- **Editar**: `src/components/funnel/FunnelFlowEditor.tsx` — toolbar, source nodes, novos node types
- **Editar**: `src/types/index.ts` — adicionar tipos
- **Editar**: `src/pages/FunnelDetailPage.tsx` — carregar source nodes

### Detalhes técnicos

```text
Canvas Visual (estilo Funnelytics):

  [📸 Instagram]──47──→ ┌──────────────────┐
                        │  ● Cadastrou LP   │
  [📧 Email]────10───→  │  ┌──────────────┐ │
                        │  │  thumbnail   │ │
  [🎯 Ads]─────90────→  │  │  da página   │ │
                        │  └──────────────┘ │
                        │  663 leads        │
                        │  🌐 Página        │
                        └────────┬──────────┘
                                 │
                          event (100%)
                                 │
                        ┌────────▼──────────┐
                        │  ● Entrou Grupo   │
                        │  0 leads          │
                        │  🌐 Página        │
                        └───────────────────┘
```

