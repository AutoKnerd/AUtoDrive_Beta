import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

let app: App | undefined;
let _adminDb: Firestore | null = null;
let _adminAuth: Auth | null = null;
let initializationAttempted = false;

export let isAdminInitialized = false;
export let adminInitErrorMessage: string | null = null;

class AdminNotInitializedError extends Error {
  code = 'admin/not-initialized';
  constructor(message: string) {
    super(message);
    this.name = 'AdminNotInitializedError';
  }
}

function getEnvServiceAccount():
  | { projectId: string; clientEmail: string; privateKey: string }
  | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // Fall through to split env vars.
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function initializeAdmin() {
  // If already initialized and we have an app instance, we are done.
  if (initializationAttempted && app) {
    return;
  }

  initializationAttempted = true;

  try {
    const appModule = require('firebase-admin/app') as typeof import('firebase-admin/app');
    const firestoreModule = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
    const authModule = require('firebase-admin/auth') as typeof import('firebase-admin/auth');

    const targetProjectId = firebaseConfig.projectId;
    if (!targetProjectId) {
      throw new Error("Missing projectId in firebaseConfig");
    }

    // 1. Try to find an existing app instance that matches our target project ID.
    const existingApps = appModule.getApps();
    app = existingApps.find(a => a.options.projectId === targetProjectId);

    if (!app) {
      const envServiceAccount = getEnvServiceAccount();
      const options: any = {
        projectId: targetProjectId,
      };

      if (envServiceAccount) {
        options.credential = appModule.cert({
          projectId: envServiceAccount.projectId,
          clientEmail: envServiceAccount.clientEmail,
          privateKey: envServiceAccount.privateKey,
        });
      } else {
        options.credential = appModule.applicationDefault();
      }

      // 2. Determine if we can use the default name '[DEFAULT]' or if we need a named app.
      // This is crucial because in some cloud environments, a default app might already be
      // initialized with environment-specific (and potentially wrong) configuration like 'monospace-11'.
      const hasDefaultApp = existingApps.some(a => a.name === '[DEFAULT]');
      
      if (!hasDefaultApp) {
        // No default app exists, we can initialize it safely.
        app = appModule.initializeApp(options);
      } else {
        // A default app exists but its projectId didn't match our target (or we wouldn't be here).
        // Initialize a named app instance to ensure we use the correct Project ID for token verification.
        const appName = `studio-app-${targetProjectId}`;
        app = existingApps.find(a => a.name === appName) || appModule.initializeApp(options, appName);
      }
    }

    if (!app) {
      throw new Error("Failed to resolve or initialize Firebase Admin app instance.");
    }

    // 3. Initialize service instances tied to our specific app instance.
    // verifyIdToken will use app.options.projectId to check the 'aud' claim.
    _adminDb = firestoreModule.getFirestore(app);
    _adminAuth = authModule.getAuth(app);
    
    isAdminInitialized = true;
    adminInitErrorMessage = null;

    console.log(`[Firebase Admin] App initialized: ${app.name} (Project: ${app.options.projectId})`);
  } catch (err: any) {
    const errMsg = err?.message ? String(err.message) : String(err);
    adminInitErrorMessage = errMsg;
    isAdminInitialized = false;

    console.error(
      '[Firebase Admin] Initialization failed:',
      errMsg,
      err?.stack ? err.stack : undefined
    );

    const makeErr = (suffix: string) =>
      new AdminNotInitializedError(
        `Firebase Admin not initialized. ${errMsg}. ${suffix}`
      );

    _adminAuth = {
      verifyIdToken: async () => {
        throw makeErr(
          'Ensure Application Default Credentials are available (GOOGLE_APPLICATION_CREDENTIALS) or run in App Hosting.'
        );
      },
    } as unknown as Auth;

    _adminDb = {
      collection: () => {
        throw makeErr(
          'Ensure Application Default Credentials are available (GOOGLE_APPLICATION_CREDENTIALS) or run in App Hosting.'
        );
      },
      runTransaction: async () => {
        throw makeErr(
          'Ensure Application Default Credentials are available (GOOGLE_APPLICATION_CREDENTIALS) or run in App Hosting.'
        );
      },
    } as unknown as Firestore;
  }
}

export function getAdminDb(): Firestore {
  initializeAdmin();
  return _adminDb as Firestore;
}

export function getAdminAuth(): Auth {
  initializeAdmin();
  return _adminAuth as Auth;
}
