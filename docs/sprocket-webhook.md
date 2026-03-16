# Sprocket -> AutoDriveCX Webhook Setup

Use this endpoint for Sprocket chat event ingestion:

- `POST /api/sprocket/events`

Production example:

- `https://YOUR_DOMAIN/api/sprocket/events`

## Security (recommended)

Set an environment variable in your app runtime:

- `SPROCKET_WEBHOOK_SECRET=<long-random-secret>`

Then configure Sprocket to send:

- Header: `x-sprocket-secret: <same secret>`

If `SPROCKET_WEBHOOK_SECRET` is not set, the endpoint accepts unsigned requests.

## Required field

- `sessionId` (string)

## Supported payload

```json
{
  "sessionId": "sess_123",
  "name": "Jordan Lee",
  "user_name": "Jordan Lee",
  "role_guess": "sales",
  "lead_status": "new",
  "user_email": "jordan@example.com",
  "dealership_name": "Sunrise Motors",
  "started_at": "2026-03-16T23:20:00Z",
  "last_activity": "2026-03-16T23:22:00Z",
  "message": {
    "id": "msg_1",
    "role": "user",
    "message": "Can I get pricing and a demo?",
    "timestamp": "2026-03-16T23:22:00Z"
  },
  "lead": {
    "id": "lead_1",
    "email": "jordan@example.com",
    "name": "Jordan Lee",
    "dealership": "Sunrise Motors",
    "intent": "pricing + demo",
    "source": "sprocket_chat"
  }
}
```

Notes:

- `message` and `lead` are optional.
- `message.role` accepts `user`, `assistant`, `ai`, `bot`.
- Lead `name` is resolved as: `lead.name` -> `user_name` -> `name`.
- If `message.id` or `lead.id` is omitted, Firestore auto-generates IDs.

## Response

```json
{
  "ok": true,
  "sessionId": "sess_123",
  "messageDocId": "abc123",
  "leadDocId": "xyz789"
}
```

## Pre-launch smoke test

```bash
curl -X POST "https://YOUR_DOMAIN/api/sprocket/events" \
  -H "Content-Type: application/json" \
  -H "x-sprocket-secret: YOUR_SECRET" \
  -d '{
    "sessionId":"go-live-smoke-001",
    "name":"Taylor Morgan",
    "user_email":"taylor@example.com",
    "dealership_name":"Metro Auto Group",
    "message":{"role":"user","message":"Please send pricing"},
    "lead":{"email":"taylor@example.com","intent":"pricing","source":"sprocket_chat"}
  }'
```

