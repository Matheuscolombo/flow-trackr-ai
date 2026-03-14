

## Diagnóstico Confirmado

Os logs da Edge Function mostram o erro exato:

```text
ReferenceError: UAZAPI_API_KEY is not defined
```

A variável `UAZAPI_API_KEY` é usada na linha 337 de `whatsapp-send/index.ts` mas **nunca foi declarada**. Isso causa um crash imediato quando `action` é `edit_message` ou `delete_message`, antes de qualquer tentativa de chamar a UAZAPI.

Há também um segundo problema: a autenticação usa `auth.getUser()` que falha com tokens ES256 (mesmo bug que já foi corrigido em `whatsapp-chats`).

---

## Plano de Correção

### 1. Corrigir `whatsapp-send/index.ts`

**a) Declarar `UAZAPI_API_KEY`** no início da função handler:
```typescript
const UAZAPI_API_KEY = Deno.env.get("UAZAPI_API_KEY") || null;
```

**b) Migrar auth de `getUser()` para `getClaims()`** (mesmo padrão usado em `whatsapp-chats`):
- Extrair token do header Authorization
- Usar `userClient.auth.getClaims(token)` 
- Extrair `userId` de `claimsData.claims.sub`
- Usar `userId` no filtro de workspace ownership

### 2. Deploy e teste

Após deploy, a função conseguirá:
- Autenticar o usuário corretamente (ES256)
- Chamar `POST /message/edit` e `POST /message/delete` na UAZAPI sem crash

### Arquivo alterado
- `supabase/functions/whatsapp-send/index.ts`

