

## Problemas Identificados

1. **Scroll da pagina inteira**: O `<main>` no AppShell tem `overflow-auto`, e o chat nao tem `h-full` + `overflow-hidden` adequado, fazendo o scroll mover a pagina toda em vez de ficar contido no painel de mensagens.

2. **Auto-scroll em atualizacoes realtime**: O polling de 10s em `loadMessages` re-busca TODAS as mensagens e faz `scrollIntoView`, perdendo a posicao do usuario. O realtime tambem faz `scrollIntoView` em cada mensagem nova.

## Plano de Correcao

### 1. Conter o scroll dentro do chat

- Adicionar `h-[calc(100vh-0px)]` ou `h-screen` + `overflow-hidden` ao container principal do WhatsAppChatPage para que ele ocupe toda a area disponivel sem causar scroll na pagina
- O `ScrollArea` das mensagens ja tem `flex-1` mas precisa que o container pai tenha altura fixa

### 2. Corrigir auto-scroll intrusivo

- **Remover polling de mensagens** (linhas 536-540): o realtime ja cuida de novas mensagens, nao precisa re-buscar a cada 10s
- **Remover polling de chats** ou aumentar intervalo sem resetar scroll
- No realtime, so fazer auto-scroll se o usuario ja esta no fundo do chat (dentro de ~100px do final). Se estiver rolando para cima, nao scrollar
- No `loadMessages` inicial (ao selecionar chat), manter o scroll para baixo

### 3. Preservar input ao atualizar chat list

- O polling de `loadChats` usa `setChats` que nao afeta o input. O problema e o `loadMessages` que reseta `messages` e causa re-render. Remover esse polling resolve.

### Arquivos alterados
- `src/pages/WhatsAppChatPage.tsx` — conter scroll, remover polling de mensagens, smart auto-scroll
- `src/components/layout/AppShell.tsx` — possivelmente ajustar overflow para a rota do chat

