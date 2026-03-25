# Fresh Up Weekly Digest Scheduler

This project exposes a secure scheduled endpoint for weekly digest generation:

- `POST /api/admin/fresh-up-weekly-digest/scheduled`

## Schedule

- Run time: **Sunday 11:30 PM server time**
- Recommended scheduler payload:
  - `includeSandboxData: false`
  - `force: false`

## Auth

Set environment variable:

- `FRESH_UP_DIGEST_CRON_KEY=<strong-random-secret>`

Send header:

- `x-freshup-cron-key: <same-secret>`

## Example Job Request

```bash
curl -X POST "https://<your-domain>/api/admin/fresh-up-weekly-digest/scheduled" \
  -H "Content-Type: application/json" \
  -H "x-freshup-cron-key: $FRESH_UP_DIGEST_CRON_KEY" \
  -d '{"includeSandboxData": false, "force": false}'
```

## What it generates

- Platform weekly digest
- Dealer weekly digests (for dealers active in the last 7 days)
- Consultant weekly digests (for consultants active in the last 7 days)

All records are saved to:

- `freshUpWeeklyDigests`

