
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Stripe Billing Setup

Billing supports:
- Individual subscriptions (user-level)
- Dealership subscriptions with tiered pricing
- 30-day trial defaults for new users and new dealerships
- Dealership billing override over individual billing

### Required environment variables

Core:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (preferred) or `NEXT_PUBLIC_APP_URL`

Individual plan prices:
- `STRIPE_PRICE_INDIVIDUAL_MONTHLY` (fallback: `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID`)
- `STRIPE_PRICE_INDIVIDUAL_ANNUAL` (fallback: `STRIPE_PRICE_ID_ANNUAL`)

Dealership tier prices:
- `STRIPE_PRICE_DEALERSHIP_SALES_FI_MONTHLY`
- `STRIPE_PRICE_DEALERSHIP_SERVICE_PARTS_MONTHLY`
- `STRIPE_PRICE_DEALERSHIP_OWNER_HQ_MONTHLY`

Dealership add-on prices:
- `STRIPE_PRICE_ADDITIONAL_USER_MONTHLY`
- `STRIPE_PRICE_ADDITIONAL_STORE_MONTHLY`
- `STRIPE_PRICE_ADDITIONAL_OWNER_ACCOUNT_MONTHLY`

Optional:
- `STRIPE_TRIAL_DAYS` (default is 30)

### Firebase App URL

Get your production URL from Firebase Console:
- App Hosting -> your backend -> Domains

Set that domain in `APP_URL` for Stripe success/cancel redirects and portal return URLs.
