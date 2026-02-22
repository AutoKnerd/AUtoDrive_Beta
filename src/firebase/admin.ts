
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
        // Fallback to ADC
        options.credential = appModule.applicationDefault();
      }

      // Check if [DEFAULT] is taken by a different project
      const defaultApp = existingApps.find(a => a.name === '[DEFAULT]');
      if (!defaultApp || defaultApp.options.projectId === targetProjectId) {
        app = appModule.initializeApp(options);
      } else {
        // Use a named app to avoid audience claim mismatches
        const appName = `autodrive-${targetProjectId}`;
        app = existingApps.find(a => a.name === appName) || appModule.initializeApp(options, appName);
      }
    }

    if (!app) {
      throw new Error("Failed to initialize Firebase Admin app instance.");
    }

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
        throw makeErr('Verify application credentials or project ID configuration.');
      },
    } as unknown as Auth;

    _adminDb = {
      collection: () => {
        throw makeErr('Verify application credentials or project ID configuration.');
      },
      runTransaction: async () => {
        throw makeErr('Verify application credentials or project ID configuration.');
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
