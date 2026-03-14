

## Plano: Puxar foto e nome do contato WhatsApp

Já existe a Edge Function `whatsapp-contact-info` que chama `/chat/details` na UAZAPI e retorna `wa_name` e `image_preview`, mas ela **nunca é chamada** pelo frontend.

### O que fazer

**1. Chamar `whatsapp-contact-info` ao selecionar um chat sem nome/foto**

Em `WhatsAppChatPage.tsx`, quando o usuário seleciona um chat onde `contact_name` e `profile_pic_url` são nulos:
- Disparar chamada à Edge Function `whatsapp-contact-info?instance_id=X&phone=Y`
- Com a resposta (`wa_name`, `image_preview`), atualizar o estado local do chat selecionado
- A função já atualiza o lead no banco automaticamente

**2. Enriquecer novos chats na lista (background)**

Quando `loadChats()` retorna chats sem `contact_name`, disparar chamadas em background (em lote, com limite de concorrência) para `whatsapp-contact-info` para os primeiros N contatos sem nome. Atualizar o estado `chats` com os resultados.

**3. Corrigir auth na Edge Function `whatsapp-contact-info`**

Migrar de `auth.getUser()` para `auth.getClaims(token)` (mesmo fix ES256 aplicado nas outras funções), para evitar o erro 401.

### Arquivos alterados
- `supabase/functions/whatsapp-contact-info/index.ts` — fix auth ES256
- `src/pages/WhatsAppChatPage.tsx` — chamar contact-info ao selecionar chat e em background na lista

