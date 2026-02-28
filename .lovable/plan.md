

## Problema

As páginas do grupo (sndflw.com — link de convite) e do checkout (go.cursosmatheuscolombo.com.br — página com autenticação) não renderizam bem pelo serviço de screenshot automático (thum.io), pois são páginas com redirecionamento, login wall ou conteúdo dinâmico.

## Solução

Adicionar campo para **thumbnail personalizada** por etapa na aba de Configuração, permitindo que o usuário cole a URL de uma imagem para etapas cujo screenshot automático não funciona bem.

### Passos

1. **Adicionar coluna `thumbnail_url`** na tabela `funnel_stages` (se ainda não existir como coluna real — já está sendo lida no código mas precisa verificar se existe no schema).

2. **Adicionar campo de thumbnail no editor de etapas** (`FunnelConfigTab.tsx`): um input de URL abaixo do campo `page_url`, com placeholder "URL da imagem de thumbnail (opcional)".

3. **Salvar `thumbnail_url`** junto com os demais campos ao salvar a configuração da etapa.

4. **Lógica de prioridade no `FunnelFlowNode`** (já implementada):
   - `thumbnail_url` manual → prioridade máxima
   - YouTube → thumbnail nativa do vídeo
   - Outros URLs → thum.io (fallback)

Isso permite ao usuário colar um print/screenshot das páginas de grupo e checkout que o serviço automático não consegue capturar.

