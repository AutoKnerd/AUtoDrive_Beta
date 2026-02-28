# Firebase & Build Stability Fixes

## Root Cause Analysis

### 1. **ChunkLoadError: Layout Chunk Failed → "Creation Failed" on Dealership Addition**
**Root cause:** Firebase Admin SDK was being eagerly imported/required at module load time (even during Next.js build), pulling in transitive `@google-cloud/firestore` dependencies that fail to resolve in certain environments. This prevented both:
- The layout chunk from building (causing "Loading chunk app/layout failed" in browser)
- API routes from initializing at runtime (causing "Firebase Admin not initialized" 500 errors on dealership/invitation creation)

**Impact:** 
- Runtime: "Creation Failed" error with "Firebase Admin not initialized" message when using dealership or invitation features
- Build: Layout chunk generation failures

**Fix:** Refactored `src/firebase/admin.ts` to use **pure lazy initialization**:
- No imports of firebase-admin at module load time
- All requires are inside the `initializeAdmin()` function, only called on first `getAdminDb()` or `getAdminAuth()` call
- Build-time module analysis cannot trigger the require() since getters are never invoked during build
- Stubs created on init failure gracefully handle missing Admin SDK

---

### 2. **Next.js 15 Route Handler Signature Mismatch**
**Root cause:** Next.js 15 changed the route handler signature—`params` is now a `Promise` rather than a synchronous object.

**Impact:** Type errors during typecheck; route handlers may fail at runtime if not awaited.

**Fix:** Updated all API route handlers to await params:
```typescript
// Before (Next.js 14)
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const { token } = params; // Sync access
}

// After (Next.js 15)
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; // Async access
}
```

Applied to:
- `src/app/api/invitations/[token]/route.ts` (GET and POST)
- `src/app/api/auth/resolve-invitation/route.ts` (POST)
- `src/app/api/admin/createDealership/route.ts` (POST)

---

### 3. **Firebase Admin Initialization Failures Not Detectable**
**Root cause:** Admin SDK init errors were caught and logged, but callers had no reliable way to detect and handle them, leading to 500 errors instead of 503 (service unavailable).

**Impact:** Intermittent 500 errors in API routes when Admin SDK fails; unclear failure modes in logs.

**Fixes:**
- Added distinct `AdminNotInitializedError` class with `code: 'admin/not-initialized'` to make failures detectable.
- Exported `isAdminInitialized` and `adminInitErrorMessage` flags.
- Updated all API routes to check for `error.code === 'admin/not-initialized'` and return HTTP 503.
- Added `/api/admin/health` endpoint to check Admin SDK readiness.
- Added detailed error logging in `src/firebase/admin.ts` including stacktraces and module-level error messages.

---

### 4. **Headers API Migration (Next.js 15)**
**Root cause:** In Next.js 15, `headers()` is now async and returns a Promise.

**Impact:** Type errors in `src/app/actions/stripe.ts` at compile-time.

**Fix:** Updated headers usage to await:
```typescript
// Before
const origin = headers().get('origin');

// After
const origin = (await headers()).get('origin');
```

---

## Changes Made

### Files Modified

1. **src/firebase/admin.ts** (Critical)
   - Removed top-level ES imports of firebase-admin modules
   - Moved all `require()` calls inside `initializeAdmin()` function
   - Exported `getAdminDb()` and `getAdminAuth()` lazy-getter functions
   - Exported `isAdminInitialized` and `adminInitErrorMessage` flags
   - Added `AdminNotInitializedError` class with code for error detection
   - Initialization only happens on first getter call (not at module load)

2. **src/app/api/admin/createDealership/route.ts**
   - Updated route signature for Next.js 15 (Promise params)
   - Changed imports to use `getAdminDb()` and `getAdminAuth()` getters
   - Added 503 handling for `admin/not-initialized` errors

3. **src/app/api/admin/createEmailInvitation/route.ts**
   - Dynamic import of `Timestamp` to avoid firebase-admin at build-time
   - Updated route signature for Next.js 15
   - Changed imports to use lazy getters
   - Added 503 handling for admin init failures

4. **src/app/api/invitations/[token]/route.ts**
   - Updated GET and POST signatures for Next.js 15 (Promise params)
   - Dynamic `Timestamp` import via `await import()`
   - Changed to lazy Admin SDK getters
   - Added 503 handling and structured error logging in POST

5. **src/app/api/auth/resolve-invitation/route.ts**
   - Updated POST signature for Next.js 15
   - Changed to lazy Admin SDK getters
   - Enhanced error checking for `admin/not-initialized` code

6. **src/app/api/admin/health/route.ts** (new)
   - Health check endpoint to verify Admin SDK availability
   - Returns 503 if Admin not initialized
   - Safe for use as a deployment readiness probe

7. **src/app/actions/stripe.ts**
   - Updated `headers()` calls to `await headers()` in two functions

8. **src/lib/data.server.ts**
   - Changed import to `getAdminDb()` getter
   - Added fast-fail checks with `isAdminInitialized` flag
   - All functions throw `admin/not-initialized` errors when Admin SDK unavailable

---

## Testing

### Build
```bash
npm run build
```
✓ **Build succeeds.** No module loading errors. All routes compile.

### Dev Server
```bash
npm run dev
```
✓ **Dev server starts.** Layout loads without chunk errors.

### Health Check
```bash
curl http://localhost:3000/api/admin/health
```
Response: `{"ok":true}` with 200 status
- If Admin SDK initialized: `{"ok": true}`
- If Admin SDK failed to init: `{"ok": false, "message": "..."}` with 503 status

### Dealership Creation Flow
The error shown in the screenshot ("Creation Failed") should now:
1. **Build-time:** Not prevent chunk generation
2. **Runtime:** Either
   - Succeed (if `GOOGLE_APPLICATION_CREDENTIALS` or App Hosting provides ADC)
   - Return clear 503 error (if Admin SDK unavailable) instead of 500

---

## Remaining Items

### Known TypeScript Warnings (non-blocking)
Several type mismatches remain unresolved (not addressing per constraints):
- Badge icon component type issues
- Lesson role/category enum mismatches in forms
- User/Lesson/Badge type casting warnings

These do not prevent build or runtime but should be addressed in a separate refactor.

---

## Recommendations for Production

1. **Monitor `/api/admin/health`** in your deployment health checks. Return 503 if not OK.
2. **Set `GOOGLE_APPLICATION_CREDENTIALS`** in your environment:
   - **Local dev:** `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
   - **Firebase App Hosting:** Runtime injection (no configuration needed)
   - **Other platforms:** Set environment variable or provide service account
3. **Test invitation flow** end-to-end:
   ```bash
   # 1. Create invitation from developer dashboard
   # 2. Check /api/admin/health returns {"ok": true}
   # 3. Follow invitation link and claim account
   # 4. Verify user profile created in Firestore
   ```
4. **Logs:** Watch for `[Firebase Admin] Initialization failed` messages; these indicate:
   - Missing/invalid `GOOGLE_APPLICATION_CREDENTIALS`
   - Insufficient permissions for the service account
   - Network/connectivity issues

5. **CI/CD:** Ensure typecheck passes before deploying:
   ```bash
   npm run typecheck
   ```

---

## Key Files to Review

- [src/firebase/admin.ts](src/firebase/admin.ts) — Core lazy initialization (main fix)
- [src/app/api/admin/health/route.ts](src/app/api/admin/health/route.ts) — Readiness probe
- [src/app/api/admin/createDealership/route.ts](src/app/api/admin/createDealership/route.ts) — Example updated route
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — Updated AI agent guidance
