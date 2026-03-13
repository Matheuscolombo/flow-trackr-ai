

## Plan: Sync Historical Messages from UAZAPI

### Problem
The chat only shows messages received AFTER the webhook was set up. Historical messages from the UAZAPI instance aren't synced — so the conversation in the Sentinel chat is nearly empty even though the real WhatsApp has many messages.

### Solution
Add a "sync messages" feature that pulls existing chat history from UAZAPI and stores it in `whatsapp_messages`.

### Changes

**1. Edge Function `uazapi-manage` — new action `sync_messages`**
- Accepts `{ instance_id }` 
- Calls UAZAPI endpoints to fetch chat history (try multiple patterns):
  - `GET /chat/fetchAllChats` or `GET /chat/findChats` — get all conversations
  - `POST /chat/findMessages/{instanceName}` with `{ where: { key: { remoteJid } } }` — get messages per chat
- For each message found, upserts into `whatsapp_messages` (using `message_id` conflict key to avoid duplicates)
- Returns count of synced messages

**2. Frontend — "Sync" button on WhatsAppChatPage**
- Add a sync/refresh button in the chat list header
- On click, calls `uazapi-manage?action=sync_messages` with the first connected instance
- Shows loading state and toast with result count
- Reloads chat list after sync

**3. Auto-sync on import**
- After importing an instance, automatically trigger `sync_messages` so historical data is immediately available

### UAZAPI Endpoints (from research)
```text
GET  /chat/findChats/{instanceName}     → list all chats
POST /chat/findMessages/{instanceName}  → { where: { key: { remoteJid: "..." } }, limit: 100 }
```
Headers: `token: <api_token>`

### Flow
```text
User clicks Sync → uazapi-manage?action=sync_messages
  → GET /chat/findChats → list of remoteJids
  → For each chat: POST /chat/findMessages → upsert into whatsapp_messages
  → Return { synced: N }
```

### Implementation order
1. Add `sync_messages` action to `uazapi-manage` edge function
2. Add sync button to `WhatsAppChatPage.tsx` header
3. Trigger auto-sync after instance import

