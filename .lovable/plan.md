

## Problema

O `object-cover` corta a imagem para preencher o container — se o card renderizar ligeiramente menor que a imagem (240px vs 260px), ele corta as laterais. Isso é o que está cortando o texto na direita.

## Solução

Trocar para `object-contain object-top` no `<img>` da thumbnail. Isso garante que a imagem inteira seja exibida sem corte nenhum, alinhada ao topo do container. O fundo escuro preenche qualquer espaço sobrando.

### Alteração em `src/components/funnel/FunnelFlowNode.tsx`

**Linha 47** — trocar a classe da imagem:
```
- className="w-full h-full object-cover object-center"
+ className="w-full h-full object-contain object-top"
```

Isso resolve de vez: a imagem é redimensionada para caber inteira dentro do container, mantendo centralização horizontal e alinhamento ao topo, sem cortar nada nas laterais.

