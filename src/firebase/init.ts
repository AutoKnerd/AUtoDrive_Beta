import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

/**
 * Firebase client SDK bootstrap.
 *
 * Goal:
 * - In Firebase App Hosting: `initializeApp()` (no args) is hydrated by the platform.
 * - In local dev: fall back to `firebaseConfig`.
 * - In local `next build` / SSR where options are missing: do NOT crash the build.
 */

type FirebaseSdks = {
  firebaseApp: FirebaseApp | null;
  auth: Auth;
  firestore: Firestore;
};

let cached: FirebaseSdks | null = null;

function isValidConfig(cfg: any): boolean {
  return !!(
    cfg &&
    typeof cfg === 'object' &&
    typeof cfg.apiKey === 'string' &&
    cfg.apiKey.length > 0 &&
    typeof cfg.projectId === 'string' &&
    cfg.projectId.length > 0 &&
    typeof cfg.appId === 'string' &&
    cfg.appId.length > 0
  );
}

function makeNoopSdks(reason: string): FirebaseSdks {
  const err = () => {
    throw new Error(
      `Firebase client SDK is not available in this environment (${reason}). ` +
        `This usually means a client-only module was imported during SSR/build. ` +
        `Fix by moving Firebase usage behind 'use client' boundaries or lazy-loading it.`
    );
  };

  const throwingProxy = <T extends object>(): T =>
    new Proxy(
      {},
      {
        get() {
          return err;
        },
        apply() {
          err();
        },
      }
    ) as unknown as T;

  return {
    firebaseApp: null,
    auth: throwingProxy<Auth>(),
    firestore: throwingProxy<Firestore>(),
  };
}

export function initializeFirebase(): FirebaseSdks {
  if (cached) return cached;

  const isServer = typeof window === 'undefined';
  const hasHostingEnv =
    !!process.env.FIREBASE_WEBAPP_CONFIG || !!process.env.FIREBASE_CONFIG;
  const canFallbackToLocalConfig = isValidConfig(firebaseConfig);

  // --- SERVER / BUILD SAFETY ---
  // During `next build` / SSR, Firebase App Hosting auto-hydration is NOT available.
  // Never call `initializeApp()` with no args on the server, even if env vars exist.
  if (isServer) {
    try {
      if (!getApps().length) {
        if (canFallbackToLocalConfig) {
          const app = initializeApp(firebaseConfig);
          cached = getSdks(app);
          return cached;
        }

        // No usable config on the server: return a safe proxy that throws only if used.
        cached = makeNoopSdks('server/build with no usable Firebase config');
        return cached;
      }

      cached = getSdks(getApp());
      return cached;
    } catch (e) {
      // Don’t fail the build because a client-only module was imported.
      cached = makeNoopSdks('server/build firebase init failed');
      return cached;
    }
  }

  // --- BROWSER ---
  // Initialize once.
  if (!getApps().length) {
    // 1) Prefer Firebase App Hosting auto hydration (no-args initializeApp)
    if (hasHostingEnv) {
      try {
        const app = initializeApp();
        cached = getSdks(app);
        return cached;
      } catch (e) {
        // This can happen locally or if env vars exist but auto-hydration isn’t present.
        console.warn(
          'Automatic initialization failed. Falling back to firebase config object.',
          e
        );
        // continue to fallback below
      }
    }

    // 2) Local/dev fallback to explicit config
    if (canFallbackToLocalConfig) {
      try {
        const app = initializeApp(firebaseConfig);
        cached = getSdks(app);
        return cached;
      } catch (e) {
        cached = makeNoopSdks('browser firebase init failed');
        return cached;
      }
    }

    // 3) Last resort: prevent hard crash with a clear error if used.
    cached = makeNoopSdks('missing Firebase config');
    return cached;
  }

  cached = getSdks(getApp());
  return cached;
}

export function getSdks(firebaseApp: FirebaseApp): FirebaseSdks {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };
}
