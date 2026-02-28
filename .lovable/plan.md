

## ✅ Adicionar campo de URL (page_url) nas etapas do funil — CONCLUÍDO

### O que foi feito
1. **Migração:** coluna `page_url` (text, nullable) adicionada em `funnel_stages`
2. **Tipo `FunnelStage`:** atualizado com `page_url: string | null`
3. **FunnelBuilder:** campo inline de URL opcional em cada etapa + badge Página/Evento
4. **FunnelBuilderPage:** passa `page_url` no insert das stages
5. **FunnelConfigTab:** novo componente extraído com inputs editáveis de URL por etapa + botão "Salvar URLs"

### Próximo passo
- Usar `page_url` das etapas na timeline do lead para mostrar a origem/página
