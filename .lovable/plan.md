

## Adicionar campo de URL (page_url) nas etapas do funil

### Problema
As etapas do funil nao tem um campo para associar a URL/pagina correspondente (ex: link da LP, link do grupo, link da live). Isso impede de mostrar a origem/pagina na timeline do lead quando ele entra numa etapa.

### Alteracoes

#### 1. Migracao: adicionar coluna `page_url` na tabela `funnel_stages`

```sql
ALTER TABLE public.funnel_stages 
ADD COLUMN page_url text DEFAULT NULL;
```

#### 2. Tela de Configuracao (aba Config do FunnelDetailPage)

Na listagem de etapas (linhas 608-614), tornar editavel: adicionar um campo de input para `page_url` em cada etapa, com placeholder "https://..." e um icone de link. Mostrar badge "Evento" quando nao tem URL e badge "Pagina" quando tem.

Adicionar botao de salvar alteracoes nas etapas (salva os page_url de todas as etapas de uma vez via update).

#### 3. FunnelBuilder (criacao de novo funil)

Adicionar campo `page_url` opcional em cada etapa no builder. O campo aparece inline na row da etapa, com placeholder "Link da pagina (opcional)".

Passar `page_url` no insert das stages na FunnelBuilderPage.

#### 4. Tipos

Atualizar `FunnelStage` em `src/types/index.ts` para incluir `page_url: string | null`.

### Fluxo do usuario
- Na aba Configuracao, cada etapa mostra o nome + campo editavel de URL
- Etapas como "Cadastrou LP" recebem o link da landing page
- Etapas como "Pix Gerado" ficam sem URL (apenas evento)
- O campo `page_url` fica disponivel para uso futuro na timeline (mostrar origem do lead)

