import { getApps, initializeApp, App, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';

let app: App | undefined;
let _adminDb: Firestore | any = null;
let _adminAuth: Auth | any = null;
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
      // fall through to split env vars
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

try {
  if (getApps().length === 0) {
    const envServiceAccount = getEnvServiceAccount();
    if (envServiceAccount) {
      app = initializeApp({
        credential: cert({
          projectId: envServiceAccount.projectId,
          clientEmail: envServiceAccount.clientEmail,
          privateKey: envServiceAccount.privateKey,
        }),
      });
    } else {
      // In managed Google Cloud environments, ADC works with runtime service account.
      // We explicitly set the project ID to match the client-side config.
      app = initializeApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
    }
    console.log(`[Firebase Admin] Initialized with project ID: ${app.options.projectId}`);
    isAdminInitialized = true;
  } else {
    app = getApps()[0];
    isAdminInitialized = true;
  }

  _adminDb = getFirestore(app);
  _adminAuth = getAuth(app);
  } catch (err: any) {
  // Initialization can fail if Application Default Credentials are not available
  // (local dev without GOOGLE_APPLICATION_CREDENTIALS). Avoid throwing during
  // module import so API route handlers can still respond with controlled errors.
  console.error('[Firebase Admin] Initialization failed:', err && err.message ? err.message : err, err && err.stack ? err.stack : undefined);

  const errMsg = (err && err.message) ? err.message : String(err);
  adminInitErrorMessage = errMsg;
  isAdminInitialized = false;

  // Use a distinct Error type/code so API routes can reliably detect an
  // Admin initialization failure and return a 503 (service unavailable).
  const makeErr = (suffix: string) => new AdminNotInitializedError(
    `Firebase Admin not initialized. applicationDefault() failed: ${errMsg}. ${suffix}`
  );

  _adminAuth = {
    verifyIdToken: async () => {
      throw makeErr('Ensure Application Default Credentials are available (GOOGLE_APPLICATION_CREDENTIALS) or run in App Hosting.');
    },
  };

  _adminDb = {
    collection: () => {
      throw makeErr('Ensure Application Default Credentials are available (GOOGLE_APPLICATION_CREDENTIALS) or run in App Hosting.');
    },
    runTransaction: async () => {
      throw makeErr('Ensure Application Default Credentials are available (GOOGLE_APPLICATION_CREDENTIALS) or run in App Hosting.');
    },
  };
}


export function getAdminDb(): Firestore {
  return _adminDb as Firestore;
}

export function getAdminAuth(): Auth {
  return _adminAuth as Auth;
}
export const adminDb = _adminDb as Firestore;
export const adminAuth = _adminAuth as Auth;
