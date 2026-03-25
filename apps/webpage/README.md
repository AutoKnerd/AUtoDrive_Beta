# Antigravity AutoDrive Webpage

Marketing site for AutoDrive, built with React + TypeScript + Vite.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Stripe trial checkout

The `/start-trial` button redirects to `/api/create-checkout-session`, which creates a hosted Stripe Checkout Session for a monthly subscription with a 30-day trial.

Required environment variables (Vercel Project Settings -> Environment Variables):
- `STRIPE_SECRET_KEY` = your Stripe secret key
- `STRIPE_PRICE_ID` = Stripe price ID (defaults in code to `price_1SsMKIIqxH0CMe02hpGHxYq0`)

Optional:
- `PUBLIC_SITE_URL` = canonical site URL used when request headers are unavailable

## Vercel auto-deploy troubleshooting

If Vercel is not deploying when you push to GitHub, use this exact sequence.

### 1) Verify local Git target

Run:

```bash
git remote -v
git branch --show-current
```

Expected for this repo:
- Remote contains `github.com/AutoKnerd/autodrive_web.git`
- Branch is `main` (unless you intentionally deploy another branch)

### 2) Run the project deploy check

```bash
npm run check:vercel
```

This validates:
- Git remote wiring
- Current branch
- Upstream tracking branch
- Ahead/behind status versus origin
- Manual Vercel checks you still need to confirm in the dashboard

### 3) Confirm Vercel Git integration

In Vercel:
- Open `Project -> Settings -> Git`
- Confirm `Connected Git Repository` is the same GitHub repo
- Confirm `Production Branch` matches what you push (`main` by default)
- Confirm `Automatically deploy production branch` is enabled

### 4) Confirm webhook behavior

- Push a tiny commit to GitHub
- Refresh Vercel Deployments
- If no deployment appears, Vercel is likely connected to a different repo

### 5) Clean reset path (if wiring is unclear)

1. Delete the Vercel project
2. Create a new Vercel project
3. Import directly from GitHub (do not deploy manually)
4. Select the correct repo and branch

## Notes

- Most items in this checklist are Vercel dashboard settings, not code settings.
- This repo can validate Git setup locally, but cannot toggle Vercel project settings from source code.
