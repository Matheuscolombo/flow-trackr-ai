

## Plan: Add "Import Existing Instance" to WhatsApp Management

The user wants to manually link an existing UAZAPI instance (e.g., "matheus-colombo-teste" with token `eec09ca7-...`) into Sentinel, without creating a new one via API.

### Changes

**1. Edge Function (`uazapi-manage/index.ts`) — new `import` action**
- Accepts `name`, `display_name`, and `token` in the POST body
- Validates the token by calling `GET /instance/connectionState` on UAZAPI with that token
- Extracts phone number and status from the response
- Saves the instance to `whatsapp_instances` with the provided token and detected status/phone

**2. Frontend (`WhatsAppPage.tsx`) — "Import Instance" dialog**
- Add a second button next to "Nova Instância" (or inside a dropdown): "Importar Instância"
- Dialog with 3 fields: Display Name, Instance Name (slug), and Instance Token
- On submit, calls `callManage("import", {}, { name, display_name, token })`
- After success, refreshes the list and auto-checks status

### Flow
```text
User clicks "Importar" → fills name + token → edge function validates token 
against UAZAPI → saves to DB with real status/phone → instance appears in list
```

