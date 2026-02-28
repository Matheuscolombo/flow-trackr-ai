

## Plan: Expandir área de conexão dos nós

O objetivo é permitir que o usuário arraste uma conexão e solte em qualquer lugar do card, sem precisar acertar exatamente na bolinha (handle).

### Mudanças técnicas

1. **`FunnelFlowNode.tsx`** — Aumentar os handles para cobrir o card inteiro usando handles invisíveis que ocupam toda a área do nó (width/height 100%, opacity 0) além dos handles visuais pequenos existentes.

2. **`TrafficSourceNode.tsx`** — Mesma abordagem: adicionar handles invisíveis de área completa sobrepostos ao card, mantendo os handles visuais pequenos como indicadores.

3. **`FunnelFlowEditor.tsx`** — Adicionar `connectionRadius={40}` no ReactFlow para aumentar o raio de snap da conexão, facilitando a detecção do nó alvo.

A técnica é ter dois conjuntos de handles por posição: um visual (pequeno, visível) e um funcional (grande/invisível, cobrindo o card). Isso permite que o React Flow detecte a conexão ao soltar em qualquer parte do nó.

