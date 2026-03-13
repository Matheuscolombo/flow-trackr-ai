

## Diagnóstico

Dois problemas identificados:

### 1. Sync falhando: `instance_name` errado no banco
Na última alteração, mudamos o `instance_name` para `joao-001`, mas o nome real na UAZAPI é `matheus-colombo-teste` (visível nos logs do webhook). O endpoint de sync usa o `instance_name` na URL (`/chat/findChats/matheus-colombo-teste`), então com `joao-001` não encontra nada.

### 2. Mensagens não atualizando em tempo real
O polling de 10s recarrega apenas a lista de chats, mas NÃO recarrega as mensagens do chat aberto. Se o Realtime falhar, o chat fica estático.

---

### Correções

**1. Reverter instance_name para `matheus-colombo-teste`**
- Migration SQL: `UPDATE whatsapp_instances SET instance_name = 'matheus-colombo-teste' WHERE id = '7709c758-...'`

**2. Melhorar sync com logging detalhado**
- Adicionar `console.log` para cada tentativa de endpoint (URL, status code, resposta)
- Se UAZAPI v2 não usa instanceName no path, tentar endpoint sem path param

**3. Polling recarregar mensagens do chat aberto**
- No intervalo de 10s, se houver chat selecionado, recarregar mensagens também (não só a lista de chats)

