

## Diagnostico: Chat "pulando" a cada 10 segundos

### Causa Raiz Identificada

A session replay confirma o problema: **a cada 10 segundos** o chat list mostra spinner (loading) e depois recarrega. Isso acontece porque o polling de `loadChats` (linha 610) chama `setLoadingChats(true)` em TODA chamada, nao apenas na primeira. Isso faz a lista de conversas desaparecer e reaparecer a cada 10s, causando o "pulo".

Problemas encontrados:

1. **`loadChats` mostra spinner a cada poll** (linhas 441-449): `setLoadingChats(true)` e chamado toda vez, fazendo toda a lista de chats piscar/desaparecer e reaparecer
2. **Layout `h-screen` dentro de `overflow-auto`** (AppShell tem `main.overflow-auto` e WhatsAppChatPage usa `h-screen`): isso pode causar scroll no container pai
3. **Realtime handler usa `setSelectedChat` como getter** (linha 558): anti-pattern que pode causar re-renders desnecessarios

### Correcoes

**Arquivo: `src/pages/WhatsAppChatPage.tsx`**

1. **Nao mostrar spinner em polls subsequentes**: Usar um `ref` para saber se ja carregou uma vez. So mostrar loading na primeira carga.
2. **Trocar `h-screen` por `h-full`**: O componente ja esta dentro do `AppShell` que tem `h-screen`, entao deve usar `h-full` para ocupar o espaco disponivel.
3. **Refatorar realtime handler**: Extrair a logica de mensagens do `setSelectedChat` callback, usando `useRef` para acessar `selectedChat` atual sem causar re-render.
4. **Remover `scrollIntoView` agressivo no `loadMessages`**: Ao carregar mensagens iniciais, fazer scroll silencioso (sem animacao) para evitar efeito de "pulo".

### Detalhes tecnicos

```text
Antes (bugado):
  loadChats() → setLoadingChats(true) → spinner → fetch → setLoadingChats(false) → lista reaparece
  (repete a cada 10s)

Depois (corrigido):
  loadChats() → if (firstLoad) setLoadingChats(true) → fetch → setChats(...) → setLoadingChats(false)
  (polls subsequentes atualizam silenciosamente, sem spinner)
```

Mudancas especificas:
- Adicionar `initialLoadDone` ref, so setar `loadingChats=true` quando `!initialLoadDone.current`
- Mudar `h-screen` para `h-full` no container principal
- Usar `selectedChatRef` para acessar `selectedChat` no realtime handler sem closure stale
- `scrollIntoView` no `loadMessages` usar `block: "end"` sem `behavior: "smooth"` na carga inicial

