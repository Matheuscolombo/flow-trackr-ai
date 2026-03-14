

## Problema: Enriquecimento instavel (nome/foto aparece e some)

Dois bugs causam o comportamento intermitente:

### Bug 1: Backend nao atualiza nome do lead quando ja tem telefone como nome
A Edge Function `whatsapp-contact-info` (linha 160) so atualiza o nome do lead quando `!lead.name`. Mas o lead ja tem `name = "+5544998685747"` (o telefone), entao a condicao `!lead.name` e `false` e nunca grava o nome real "Lucas Carli" no banco.

**Fix**: Adicionar logica `isPhoneOnly` na Edge Function para tambem atualizar quando o nome e apenas um numero de telefone.

### Bug 2: Frontend sobrescreve dados enriquecidos a cada polling
`loadChats()` faz `setChats(data.chats || [])` a cada 10s, substituindo completamente o estado local. Como o servidor ainda retorna `contact_name: "+5544998685747"` (porque o Bug 1 impediu a gravacao), o nome enriquecido localmente some.

**Fix**: Em `loadChats()`, fazer merge dos dados do servidor com o cache de enriquecimento local. Usar um `enrichedCacheRef` para guardar nomes/fotos ja obtidos e aplica-los sobre os dados do servidor.

### Arquivos alterados
1. `supabase/functions/whatsapp-contact-info/index.ts` -- adicionar `isPhoneOnly` e usá-la na condicao de update do lead name
2. `src/pages/WhatsAppChatPage.tsx` -- criar cache de enriquecimento e aplicar merge no `loadChats` em vez de substituir cegamente

