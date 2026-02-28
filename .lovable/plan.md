

## Adicionar origem nos eventos da timeline

### Problema
Os eventos na timeline nao mostram a origem/source de cada evento. Quando o lead participa de varios funis (ex: "funil api", "funil hot"), nao da pra saber de qual funil veio cada evento.

### Alteracao

**Arquivo:** `src/components/funnel/LeadTimeline.tsx`

Na secao `TimelineEvents`, ao renderizar cada evento real e sintetico, adicionar uma badge com a **source** do evento (ex: `import`, `webhook`, `api`) e, para eventos `signup`/`re_signup`, mostrar o nome do funil no `detail`.

Especificamente:

1. **Eventos reais (`type: "real"`)**: Adicionar badge com `ev.realEvent.source` (ja disponivel no objeto `LeadEvent`) ao lado do label do evento na timeline.

2. **Evento "Lead cadastrado" sintetico**: Ja mostra `via ${lead.source}` — manter como esta.

3. **Eventos signup/re_signup**: Manter o nome do funil no detail (ja existe para signup via `payload_raw.funnel_name`) e adicionar badge de source.

4. Na renderizacao da timeline (linhas 611-631), adicionar a badge de source para eventos do tipo `real`:
   - Exibir `ev.realEvent.source` como badge colorida usando o mapa `sourceColors` existente
   - Posicionar ao lado do label, antes do timeDiff

