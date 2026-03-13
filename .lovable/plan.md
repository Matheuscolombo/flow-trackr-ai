

## Plan: Add Server URL field to Import dialog

The import failed with 404 because the instance lives on `https://tracker1.uazapi.com` but the edge function uses the global `UAZAPI_URL` secret, which may point to a different server.

### Changes

**1. Frontend (`WhatsAppPage.tsx`)**
- Add a "Server URL" field to the Import dialog (pre-filled with default `https://tracker1.uazapi.com`)
- Pass `server_url` in the import request body

**2. Edge Function (`uazapi-manage/index.ts`)**
- In the `import` action, use `body.server_url` (if provided) instead of the global `UAZAPI_URL` for the validation call
- Store the server URL in the DB so future status/connect calls use the correct server per instance

**3. Database migration**
- Add `server_url` column (nullable text) to `whatsapp_instances`
- Update the `status` and `connect` actions to use `inst.server_url || UAZAPI_URL` as the base URL, so imported instances with a custom server work correctly

### Flow
```text
Import dialog: Name + Display Name + Token + Server URL
  → Edge function validates against that specific server
  → Saves server_url to DB
  → Future status/connect calls use per-instance server_url
```

