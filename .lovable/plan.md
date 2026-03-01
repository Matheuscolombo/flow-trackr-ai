

## Problema
A thumbnail continua cortando texto na direita por dois motivos:
1. O card tem largura variável (`min-w-[240px] max-w-[260px]`) — pode renderizar menor que a imagem
2. A imagem fica colada nas bordas do card, sem respiro visual

## Solução

### Alterações em `src/components/funnel/FunnelFlowNode.tsx`

1. **Fixar a largura do card em 260px** — trocar `min-w-[240px] max-w-[260px]` por `w-[260px]` para garantir que o card sempre tenha a mesma largura da imagem capturada

2. **Adicionar padding interno na área da thumbnail** — colocar `p-2` no container da imagem para criar margens visuais dos dois lados, com fundo escuro aparecendo como moldura

3. **Arredondar a imagem** — adicionar `rounded-md` na `<img>` para combinar com o estilo do card

Resultado: a imagem fica centralizada dentro do card com margem uniforme nos 4 lados, sem corte nenhum.

