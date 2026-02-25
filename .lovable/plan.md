

## Modo "Registrar Evento" no Importador de Leads

Adicionar um segundo modo ao importador existente. O usuario escolhe entre "Importar para funil" (comportamento atual) ou "Registrar evento" (novo). No modo de evento, ele seleciona uma **campanha** (ou opcionalmente um funil especifico), digita o nome do evento, e o sistema localiza os leads pelo email/telefone e registra o evento em todos os funis daquela campanha onde o lead ja esta posicionado.

---

### Fluxo do usuario

1. Abre "Importar Leads", faz upload do CSV normalmente (Step 1 nao muda)
2. No Step 2 (Mapeamento), aparece um seletor no topo com dois modos:
   - **Importar para funil** -- comportamento atual (seleciona funil + etapa)
   - **Registrar evento** -- novo modo
3. Ao escolher "Registrar evento":
   - Os seletores de funil/etapa desaparecem
   - Aparece um seletor de **Campanha** (busca campanhas reais do banco)
   - Aparece um campo de texto para o **nome do evento** (ex: `entry_group`, `confirmou_presenca`)
   - Tags continuam disponiveis (opcional)
   - Botao muda para "Registrar evento para X leads"
4. O resultado mostra: leads encontrados (evento registrado), leads nao encontrados, sem contato, total de eventos criados

### O que acontece no backend

Quando `mode === "event_only"`:
- Recebe `csvText`, `fieldOverrides`, `eventName`, `campaignId` (opcional, se nao informado aplica em todos os funis do lead)
- Para cada linha: normaliza email/telefone, busca o lead existente no workspace
- Se o lead existe: busca todas as posicoes dele em `lead_funnel_stages`
  - Se `campaignId` foi informado: filtra apenas as posicoes cujo `funnel_id` pertence aquela campanha
  - Insere um `lead_events` para cada posicao
- Se o lead nao existe: conta como "nao encontrado"
- Tambem aplica as `stage_transition_rules` se houver regra configurada para aquele evento (movimenta o lead automaticamente)
- Tags sao associadas normalmente se informadas
- Retorna `{ found, not_found, no_contact, events_created }`

---

### Secao Tecnica

**Arquivo: `supabase/functions/import-leads/index.ts`**

Adicionar suporte ao parametro `mode`:
- Novo payload aceita: `{ mode: "event_only", csvText, fieldOverrides, eventName, campaignId?, tagIds? }`
- Quando `mode === "event_only"`:
  - Nao exige `funnelId`/`stageId`
  - Itera as linhas, localiza leads existentes por email/phone no workspace
  - Para cada lead encontrado, busca `lead_funnel_stages` (filtrando por `campaignId` se informado, via join com `funnels.campaign_id`)
  - Insere registro em `lead_events` para cada posicao (com `source: "import"`, `event_name: eventName`)
  - Opcionalmente aplica `stage_transition_rules`: busca regra onde `event_name` bate e `from_stage_id` e null ou igual ao stage atual, e move o lead
  - Retorna `{ found, not_found, no_contact, events_created }`

**Arquivo: `src/components/leads/ImportContactsModal.tsx`**

- Novo estado `importMode`: `"funnel"` (default) ou `"event_only"`
- No Step 2, adicionar toggle entre os dois modos (usando dois botoes estilizados ou tabs)
- Quando `importMode === "event_only"`:
  - Esconder seletores de funil/etapa
  - Mostrar seletor de Campanha (fetch de `campaigns` do banco, com opcao "Todas" para aplicar em todos os funis)
  - Mostrar campo `eventName` (Input com placeholder "ex: entry_group")
  - Validacao: exige pelo menos telefone ou email mapeado + eventName preenchido
  - Botao: "Registrar evento para X leads"
- Na chamada da edge function, enviar `{ mode: "event_only", csvText, fieldOverrides, eventName, campaignId, tagIds }`
- Tela de resultado adaptada: "X encontrados", "X nao encontrados", "X sem contato", "X eventos criados"

Nenhuma migracao de banco necessaria -- a tabela `lead_events` e `stage_transition_rules` ja existem.

