

## Fase 1 — Identificacao de Contato + Auto-Sync de Leads

### O que muda

**1. Webhook auto-cria lead quando nao existe**
- No `uazapi-webhook/index.ts`, apos normalizar o phone e buscar o lead, se nao encontrar:
  - Buscar tambem variante com/sem 9o digito (13 vs 12 digitos)
  - Se ainda nao existir, criar lead automaticamente com `source: 'whatsapp'`, `name` extraido do payload (`wa_contactName`, `wa_name`, `pushName`)
  - Chamar `/chat/details` da UAZAPI (com `preview: true`) para puxar foto e nome verificado
  - Salvar `profile_pic_url` no campo metadata do lead (ou nova coluna)

**2. Nova coluna `profile_pic_url` na tabela `leads`**
- Migracao SQL: `ALTER TABLE leads ADD COLUMN profile_pic_url text;`

**3. Nova Edge Function `whatsapp-contact-info`**
- Recebe `instance_id` + `phone`
- Chama `/chat/details` com `{ number, preview: true }`
- Retorna `wa_name`, `wa_contactName`, `imagePreview`, `phone`
- Usado pelo frontend para enriquecer contatos on-demand

**4. Chat list enriquecido com foto e nome**
- `whatsapp-chats` ja enriquece com lead name — agora tambem retorna `profile_pic_url` do lead
- Frontend mostra avatar real (foto do WhatsApp) no lugar do icone generico `<User>`
- Na lista de chats e no header do chat selecionado

**5. Painel direito colapsavel — Info do Contato**
- Novo componente `ContactPanel` ao lado do thread de mensagens
- Mostra: foto grande, nome, telefone, tags do lead, historico de compras, funnel stage
- Botao para abrir/fechar no header do chat
- Componente `src/components/whatsapp/ContactPanel.tsx`

**6. Normalizacao de phone com/sem 9o digito**
- Tanto no webhook quanto no whatsapp-send, ao buscar lead por phone:
  - Tentar phone exato primeiro
  - Se nao achar, gerar variante: se tem 13 digitos (55+DDD+9+8), tentar sem o 9 (12 digitos) e vice-versa

---

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/uazapi-webhook/index.ts` | Auto-criar lead + buscar foto via `/chat/details` + normalizacao 9o digito |
| `supabase/functions/whatsapp-contact-info/index.ts` | Nova edge function |
| `supabase/functions/whatsapp-chats/index.ts` | Retornar `profile_pic_url` do lead no chat list |
| `src/pages/WhatsAppChatPage.tsx` | Avatar real, botao painel direito, integrar ContactPanel |
| `src/components/whatsapp/ContactPanel.tsx` | Novo componente — painel lateral do contato |
| Migracao SQL | `ALTER TABLE leads ADD COLUMN profile_pic_url text` |

### Migracao SQL

```sql
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS profile_pic_url text;
```

### Ordem de execucao

1. Migracao SQL (adicionar coluna)
2. Edge Function `whatsapp-contact-info` (criar e deploy)
3. Atualizar `uazapi-webhook` (auto-create lead + foto)
4. Atualizar `whatsapp-chats` (retornar foto)
5. Frontend: avatar real + ContactPanel

