

## Plano: Mostrar primeira dobra mobile iOS nas thumbnails

O objetivo é ajustar a captura e exibição da thumbnail para mostrar exatamente a "primeira dobra" (above the fold) de um iPhone — a área visível sem rolar.

### Mudanças

1. **`FunnelFlowNode.tsx`** — Duas alterações:
   - **URL do thum.io**: Adicionar o parâmetro `crop/480` para que o serviço retorne apenas a parte superior da página (primeira dobra), em vez da página inteira redimensionada. O viewport já está configurado como 390x844 (iPhone), então o crop cortará a área visível inicial.
   - **Altura do container**: Aumentar de `h-[160px]` para `h-[200px]` para dar mais espaço à primeira dobra e mostrar mais conteúdo útil da página.
   - **Remover gradient overlay** parcialmente para não escurecer tanto o conteúdo da thumbnail.

A URL passaria de:
```
https://image.thum.io/get/width/480/viewportWidth/390/viewportHeight/844/{url}
```
Para:
```
https://image.thum.io/get/width/480/crop/600/viewportWidth/390/viewportHeight/844/{url}
```

O `crop/600` instrui o thum.io a capturar apenas os primeiros 600px de altura da página (equivalente à primeira dobra no iPhone), resultando numa imagem mais focada no conteúdo acima da dobra.

