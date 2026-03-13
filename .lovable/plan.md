

## Diagnostico

Os screenshots da documentacao UAZAPI v2 revelam o problema exato:

1. **Endpoint correto**: `POST /message/download` com body `{ "id": "messageId" }` -- o codigo atual tenta `/chat/downloadMediaMessage` e `/message/downloadMedia`, ambos errados
2. **Campo de resposta**: A API retorna `fileURL` (com URL maiusculo) e `base64Data` -- o codigo atual procura `fileUrl`, `url`, `mediaUrl` (nenhum bate)
3. **Formato do ID**: O exemplo mostra IDs como `7EB0F01D7244B421048F0706368376E0` sem prefixo owner

Resumo: estamos chamando o endpoint errado e lendo os campos errados da resposta.

## Plano de Correcao

### 1. Corrigir webhook (`uazapi-webhook/index.ts`)

Na funcao `downloadAndStoreMedia`, substituir a lista de tentativas por:

```text
Tentativa principal: POST /message/download { "id": shortId }
Fallback:           POST /message/download { "id": fullId }
```

Na funcao `extractBlobFromResponse`, adicionar suporte aos campos corretos:
- `json.fileURL` (URL publica temporaria do UAZAPI storage)
- `json.base64Data` (conteudo em base64)

### 2. Corrigir backfill (`backfill-media/index.ts`)

Mesma correcao: trocar tentativas para `POST /message/download` com `{ "id": shortId }` e corrigir parsing da resposta.

### 3. Re-executar backfill

Apos deploy, rodar o backfill para re-baixar as midias existentes com o endpoint correto.

### Arquivos alterados
- `supabase/functions/uazapi-webhook/index.ts` -- corrigir endpoint e parsing
- `supabase/functions/backfill-media/index.ts` -- mesma correcao

