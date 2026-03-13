

## Plan: Live WhatsApp Chat inside Sentinel

### What we have today
- `whatsapp_instances` table with per-instance `server_url` and `api_token`
- `whatsapp_messages` table storing all messages (inbound/outbound) with `phone`, `direction`, `body`, `message_type`, `timestamp_msg`, `remote_jid`, `instance_id`
- `uazapi-webhook` edge function already receiving and storing inbound messages
- UAZAPI SSE endpoint (`GET /sse?token=X&events=messages`) for real-time events

### What we need to build

**1. Edge Function: `whatsapp-send` (new)**
- Accepts `{ instance_id, remote_jid, text }` via POST
- Looks up instance token + server_url from DB
- Calls UAZAPI `POST /message/sendText` with the token
- Saves the outbound message to `whatsapp_messages`

**2. Edge Function: `whatsapp-chats` (new)**
- `action=list_chats`: Returns distinct conversations (grouped by `phone`) with last message preview, unread count, and contact name (from leads table if available)
- `action=messages`: Returns paginated messages for a specific `phone`/`remote_jid`

**3. Enable Realtime on `whatsapp_messages`**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;`
- Frontend subscribes to `postgres_changes` filtered by `workspace_id` — new messages appear instantly without SSE proxy

**4. Frontend: Chat UI (`src/pages/WhatsAppChatPage.tsx`)**
- Three-panel layout (like the IAutomatize screenshot):
  - **Left panel**: Conversation list (contacts with last message, sorted by recency)
  - **Center panel**: Message thread for selected conversation (bubbles, timestamps)
  - **Right panel** (optional, later): Contact info from leads table
- Real-time updates via Supabase Realtime subscription on `whatsapp_messages`
- Input bar at bottom to send messages via `whatsapp-send` edge function
- Instance selector dropdown (if user has multiple instances)

**5. Routing**
- Add `/whatsapp/chat` route or embed as a tab within the existing WhatsApp page

### Why Supabase Realtime instead of UAZAPI SSE directly?
- SSE from UAZAPI requires the instance token (secret) — can't expose it to the browser
- We already store messages via the webhook — Supabase Realtime on `whatsapp_messages` gives us real-time without proxying SSE
- Simpler architecture: webhook writes → Realtime broadcasts → frontend updates

### Technical flow
```text
Inbound:  UAZAPI → uazapi-webhook → INSERT whatsapp_messages → Realtime → UI updates
Outbound: UI → whatsapp-send → UAZAPI sendText + INSERT whatsapp_messages → Realtime → UI updates
```

### Implementation order
1. DB migration: enable realtime on `whatsapp_messages`
2. Edge function `whatsapp-send` for sending messages
3. Edge function `whatsapp-chats` for listing conversations and message history
4. Frontend chat UI with realtime subscription
5. Add route and navigation

