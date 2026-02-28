

## Plano: Aba "Visual" com editor de flowchart interativo no detalhe do funil

### Contexto
Você quer uma aba visual estilo flowchart (como na imagem) onde pode ver e interagir com as etapas do funil como nós conectados, com setas mostrando as transições e contagens de leads. O editor será híbrido: visualização interativa + edição inline ao clicar nos nós.

### O que será feito

**1. Migração de banco — adicionar position_x/y nas etapas**
- Adicionar colunas `position_x` (float, default 0) e `position_y` (float, default 0) na tabela `funnel_stages` para persistir a posição dos nós no canvas

**2. Instalar `@xyflow/react` (React Flow)**
- Biblioteca madura para flowcharts interativos com drag, zoom, pan, conexões visuais

**3. Criar componente `FunnelFlowEditor`**
- Cada `funnel_stage` vira um **nó customizado** mostrando:
  - Nome da etapa + cor
  - Contagem de leads naquele estágio
  - Badge "Página" ou "Evento" (baseado em `page_url`)
- Cada `stage_transition_rule` vira uma **aresta (edge)** com:
  - Label mostrando `event_name`
  - Taxa de conversão entre as etapas (%)
- **Interações:**
  - Arrastar nós → salva `position_x`/`position_y` automaticamente (debounce)
  - Clicar num nó → painel lateral ou popover para editar nome, cor, page_url
  - Zoom/pan no canvas
  - Auto-layout inicial quando as posições são 0,0 (distribui os nós automaticamente)

**4. Adicionar aba "Visual" no `FunnelDetailPage`**
- Nova tab `visual` ao lado de Kanban/Funil/Config/Webhook
- Renderiza o `FunnelFlowEditor` com stages, rules e stageCounts

**5. Atualizar tipo `FunnelStage`**
- Adicionar `position_x: number` e `position_y: number` ao tipo

### Detalhes técnicos

```text
┌─────────────────────────────────────────────┐
│  Aba "Visual"                               │
│                                             │
│  ┌──────────┐    event_name    ┌──────────┐ │
│  │ Etapa 1  │───────────────→  │ Etapa 2  │ │
│  │ 243 leads│   100% (243)     │ 113 leads│ │
│  └──────────┘                  └──────────┘ │
│       │                             │       │
│       │ event_b                     │       │
│       ▼                             ▼       │
│  ┌──────────┐                  ┌──────────┐ │
│  │ Etapa 3  │                  │ Etapa 4  │ │
│  │ 19 leads │                  │ 48 leads │ │
│  └──────────┘                  └──────────┘ │
│                                             │
│  [Canvas com zoom/pan/drag]                 │
└─────────────────────────────────────────────┘
```

### Arquivos impactados
- **Nova migração SQL**: `position_x`, `position_y` em `funnel_stages`
- **Novo**: `src/components/funnel/FunnelFlowEditor.tsx` — componente principal do canvas
- **Novo**: `src/components/funnel/FunnelFlowNode.tsx` — nó customizado
- **Editar**: `src/types/index.ts` — adicionar position_x/y ao FunnelStage
- **Editar**: `src/pages/FunnelDetailPage.tsx` — adicionar aba "Visual"
- **Instalar**: `@xyflow/react`

