import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

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
  if (initializationAttempted) {
    return;
  }

  initializationAttempted = true;

  try {
    const appModule = require('firebase-admin/app') as typeof import('firebase-admin/app');
    const firestoreModule = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
    const authModule = require('firebase-admin/auth') as typeof import('firebase-admin/auth');

    if (appModule.getApps().length === 0) {
      const envServiceAccount = getEnvServiceAccount();
      if (envServiceAccount) {
        app = appModule.initializeApp({
          credential: appModule.cert({
            projectId: envServiceAccount.projectId,
            clientEmail: envServiceAccount.clientEmail,
            privateKey: envServiceAccount.privateKey,
          }),
        });
      } else {
        // In managed Google Cloud environments, ADC works with runtime service account.
        app = appModule.initializeApp({
          credential: appModule.applicationDefault(),
        });
      }
    } else {
      app = appModule.getApps()[0];
    }

    _adminDb = firestoreModule.getFirestore(app);
    _adminAuth = authModule.getAuth(app);
    isAdminInitialized = true;
    adminInitErrorMessage = null;

    console.log(`[Firebase Admin] Initialized with project ID: ${app.options.projectId ?? 'unknown'}`);
  } catch (err: any) {
    // Initialization can fail if ADC is unavailable during local dev.
    // Keep module import safe so routes can return controlled 503 errors.
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
