

## Problema

A lógica `c.contact_name || waName` não substitui o nome quando `contact_name` já contém o número de telefone como string (ex: "+5544998685747"). Como é uma string não-vazia, o `||` nunca aplica o `waName` retornado pela API.

## Correção

Em `src/pages/WhatsAppChatPage.tsx`, na função `enrichContact` e no `useEffect` do `selectedChat`, trocar a lógica para detectar quando `contact_name` é apenas um número de telefone e substituí-lo pelo nome real.

Criar uma função auxiliar:
```typescript
function isPhoneOnly(name: string | null): boolean {
  if (!name) return true;
  return /^\+?\d[\d\s()-]*$/.test(name.trim());
}
```

Substituir:
- `contact_name: c.contact_name || waName` por `contact_name: isPhoneOnly(c.contact_name) ? (waName || c.contact_name) : c.contact_name`

Aplicar nos dois locais:
1. Dentro do `setChats()` na `enrichContact` (linha ~751)
2. Dentro do `setSelectedChat()` no useEffect (linha ~838-845)

### Arquivo alterado
- `src/pages/WhatsAppChatPage.tsx`

