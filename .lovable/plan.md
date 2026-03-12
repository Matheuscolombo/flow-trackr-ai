

## Integração UAZAPI - Principais Endpoints

A UAZAPI é uma API brasileira para automação do WhatsApp Web. Aqui estão os endpoints mais relevantes para o seu sistema de leads:

### **Endpoints Principais**

| Categoria | Endpoint | Descrição |
|-----------|----------|-----------|
| **Instance** | `POST /instance/create` | Criar instância WhatsApp (QR code) |
| **Instance** | `GET /instance/connectionState` | Verificar status da conexão |
| **Messaging** | `POST /message/sendText` | Enviar mensagem de texto |
| **Messaging** | `POST /message/sendImage` | Enviar imagem (URL ou base64) |
| **Messaging** | `POST /message/sendDocument` | Enviar documento PDF, etc |
| **Messaging** | `POST /message/sendAudio` | Enviar áudio/áudio transcrito |
| **Messaging** | `POST /message/sendButton` | Enviar mensagem com botões |
| **Messaging** | `POST /message/sendList` | Enviar lista de opções |
| **Chat** | `GET /chat/getChat` | Histórico de conversa por número |
| **Chat** | `GET /chat/getAllChats` | Listar todas as conversas |
| **Chat** | `GET /chat/getMessages` | Buscar mensagens específicas |
| **Contact** | `GET /contact/getContact` | Dados de um contato |
| **Contact** | `GET /contact/getProfilePicture` | Foto do perfil |
| **Group** | `POST /group/create` | Criar grupo |
| **Group** | `POST /group/sendText` | Enviar mensagem para grupo |
| **Webhook** | `POST /webhook/configure` | Configurar webhook de eventos |

### **Casos de Uso para Sentinel**

1. **Notificação de novo lead** → `sendText` para número do vendedor
2. **Follow-up automático** → `sendText`/`sendImage` após X horas no estágio
3. **Alerta de conversão** → `sendText` quando lead comprar
4. **Relatório diário** → `sendText` com resumo de métricas
5. **Sincronização de conversas** → `getChat` para histórico completo

### **Implementação Sugerida**

**Backend (Edge Function):**
- Criar `supabase/functions/uazapi-send/index.ts` para enviar mensagens
- Criar `supabase/functions/uazapi-webhook/index.ts` para receber eventos (mensagens recebidas, status de entrega)
- Usar secrets para armazenar API key e instance ID

**Frontend:**
- Adicionar configuração de UAZAPI nas Settings
- Permitir associar número WhatsApp a cada funil/campanha
- Criar templates de mensagens personalizáveis

**O que você quer implementar?**
- Enviar mensagens automáticas quando leads entrarem/converterem?
- Receber webhooks de mensagens recebidas e sincronizar com leads?
- Ambos (sistema bidirecional completo)?

