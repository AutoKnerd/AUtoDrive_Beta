# Copilot / Agent Instructions for Firebase Studio

Purpose: give an AI coding agent the minimal, high-value facts to be immediately productive in this codebase.

- **Project type:** Next.js 13 app-router (files under `src/app`) with Tailwind CSS and Firebase backend.
- **Entry points:** UI lives in `src/app/` (see [src/app/layout.tsx](src/app/layout.tsx#L1-L80)).
- **Firebase split:** client SDK is used in the browser (`src/firebase/init.ts`, `src/firebase/client-provider.tsx`) and the Admin SDK is used on the server (`src/firebase/admin.ts`).

Explanation: merge and update the existing Copilot instructions with concise, repo-specific guidance (Firebase init, AI flows, tour-mode, client/server split, and commands).

# Copilot / Agent Instructions — Firebase Studio

Purpose: short, high-value facts to get an AI coding agent productive here.

- **Stack:** Next.js 13 (App Router) with Tailwind, Firebase (Firestore/Auth/Hosting), and Stripe.
- **UI root:** files under [src/app](src/app#L1) and shared components in [src/components](src/components#L1).

## Quick start (dev & checks)

- `npm run dev` — local Next dev server.
- `npm run build` && `npm run start` — production build + start.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — project linting.

## High-level architecture (what to know)

- App Router UI lives in `src/app`; global providers and layout are in [src/app/layout.tsx](src/app/layout.tsx#L1-L80).
- Client code initializes Firebase in [src/firebase/init.ts](src/firebase/init.ts#L1-L120). In production Firebase Hosting injects runtime config; the init deliberately falls back to local `firebaseConfig` only when automatic injection fails — do not change lightly.
- Server-side elevated operations use the Admin SDK in [src/firebase/admin.ts](src/firebase/admin.ts#L1-L40) and rely on Application Default Credentials in production.
- Data helpers are split: use [src/lib/data.client.ts](src/lib/data.client.ts#L1-L40) for browser interactions and [src/lib/data.server.ts](src/lib/data.server.ts#L1-L120) for server/Admin operations.

## AI integrations and patterns

- GenKit config: [src/ai/genkit.ts](src/ai/genkit.ts#L1-L40). Flows live in [src/ai/flows](src/ai/flows) and follow `ai.definePrompt` / `ai.defineFlow` patterns.
- Keep model calls server-side: AI flow files and `src/ai/dev.ts` use `'use server'` for key safety and quota control. New flows should be added under `src/ai/flows` and imported from `src/ai/dev.ts` (flows are loaded for side-effects).

## Project conventions (rules for edits)

- Firebase init: preserve the current `initializeApp()` fallback behavior in `src/firebase/init.ts` (Hosting/runtime injection). If you need to change it, validate against Hosting behavior and local dev with `GOOGLE_APPLICATION_CREDENTIALS`.
- Auth & bootstrap: `src/context/auth-provider.tsx` centralizes login, demo user creation, and admin/developer bootstrap emails — change with care.
- Server vs client: never call Admin SDK in browser. Expose privileged actions via API routes under `src/app/api/*` that validate the caller's ID token (Authorization header).
- Tour/demo mode: code often checks `tour-` user IDs and returns fake/demo data (`src/lib/tour-data.ts` and helpers). Preserve this behavior when modifying client paths.
- Errors: use the existing `FirestorePermissionError` + `src/firebase/error-emitter.ts` pattern to surface permission issues.

## Deployment & env notes

- Production expects ADC for Admin SDK; locally set `GOOGLE_APPLICATION_CREDENTIALS` or emulate accordingly. See [src/firebase/admin.ts](src/firebase/admin.ts#L1-L30).
- Firestore rules are at `firestore.rules` (root) and should match collection shapes in [docs/backend.json](docs/backend.json#L1).

## Where to look first (file pointers)

- Layout & providers: [src/app/layout.tsx](src/app/layout.tsx#L1-L60)
- Firebase init: [src/firebase/init.ts](src/firebase/init.ts#L1-L120)
- Firebase admin: [src/firebase/admin.ts](src/firebase/admin.ts#L1-L40)
- Client data helpers: [src/lib/data.client.ts](src/lib/data.client.ts#L1-L40)
- Server data helpers: [src/lib/data.server.ts](src/lib/data.server.ts#L1-L120)
- AI config & flows: [src/ai/genkit.ts](src/ai/genkit.ts#L1-L20) and [src/ai/flows](src/ai/flows)
- Security + backend model: [docs/backend.json](docs/backend.json#L1)

If any section is unclear or you want this expanded (deployment steps, CI, or a concrete AI-flow example), tell me which area and I'll iterate.
