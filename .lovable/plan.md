

## Plan: Editable WhatsApp Instance Profile

Allow editing profile picture, display name, and status text directly from the instance card by clicking on the photo or name.

### UAZAPI Endpoints (based on research)

UAZAPI exposes profile management via these likely endpoints (will try multiple patterns with fallback):
- **Update Name**: `PUT /profile/setProfileName` with `{ name: "New Name" }` (token header)
- **Update Status**: `PUT /profile/setStatus` with `{ status: "Available" }` (token header)
- **Update Picture**: `POST /profile/setProfilePicture` with base64 image in body (token header)

### Changes

**1. Edge Function (`uazapi-manage/index.ts`) — new action `update_profile`**
- Accepts `{ instance_id, profile_name?, status_text?, profile_pic_base64? }`
- Looks up instance token + server_url
- Calls UAZAPI endpoints for each field provided (tries multiple URL patterns)
- Updates local DB with new values
- Returns updated profile data

**2. Frontend (`WhatsAppPage.tsx`) — interactive profile editing**
- **Click on photo**: Opens a hidden file input to select a new image, converts to base64, calls update_profile
- **Click on name**: Inline editable text field (click to edit, Enter/blur to save)
- **Status text**: Small editable "About" field under the name
- Show loading spinner on the photo/field while updating
- Update local state on success

**3. Database**
- Add `status_text` column to `whatsapp_instances` (for the "About" field)

### UI Behavior
```text
┌─────────────────────────────────┐
│  [📷 photo]  Profile Name  ✏️  │  ← click photo to upload, click name to edit
│             @instance-slug      │
│             +5511999999999      │
│             "Available 24h" ✏️  │  ← editable status/about
│  [token...]  [copy]             │
│  [QR] [Status] [🗑️]            │
└─────────────────────────────────┘
```

