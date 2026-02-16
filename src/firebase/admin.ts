import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

let app: App | undefined;
let _adminDb: Firestore | null = null;
let _adminAuth: Auth | null = null;
export let isAdminInitialized = false;
export let adminInitErrorMessage: string | null = null;

// A custom error to easily identify Admin SDK initialization failures.
export class AdminNotInitializedError extends Error {
  public readonly code = 'admin/not-initialized';
  constructor(message: string) {
    super(message);
    this.name = 'AdminNotInitializedError';
  }
}

function initializeAdmin() {
  if (isAdminInitialized) {
    return;
  }
  
  // Use require() here to avoid Next.js trying to bundle firebase-admin on the client.
  const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');

  try {
    const apps = getApps();
    if (apps.length === 0) {
      // In a managed environment (like App Hosting), ADC should be used.
      // Locally, GOOGLE_APPLICATION_CREDENTIALS should be set.
      app = initializeApp({
        credential: applicationDefault(),
        // Explicitly setting projectId prevents mismatches with client-side tokens.
        projectId: firebaseConfig.projectId,
      });
      console.log(`[Firebase Admin] Initialized with project ID: ${app.options.projectId}`);
    } else {
      app = apps[0];
    }
    
    const { getFirestore } = require('firebase-admin/firestore');
    const { getAuth } = require('firebase-admin/auth');
    _adminDb = getFirestore(app);
    _adminAuth = getAuth(app);
    isAdminInitialized = true;
    
  } catch (error: any) {
    console.error('[Firebase Admin] Initialization failed:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
    });
    adminInitErrorMessage = error.message || 'Unknown initialization error';
    isAdminInitialized = false;
  }
}

function ensureInitialized() {
  // This check prevents re-running initialization if it already failed.
  if (!isAdminInitialized && !adminInitErrorMessage) {
    initializeAdmin();
  }
}

function getInitializedAdminSdk<T>(sdk: T | null, sdkName: string): T {
    ensureInitialized();
    if (!isAdminInitialized || !sdk) {
        throw new AdminNotInitializedError(
            `Firebase Admin SDK (${sdkName}) is not initialized. ` +
            `Reason: ${adminInitErrorMessage || 'Unknown'}. ` +
            'Ensure Application Default Credentials are available (e.g., GOOGLE_APPLICATION_CREDENTIALS) or run in a configured Google Cloud environment.'
        );
    }
    return sdk;
}

export function getAdminDb(): Firestore {
    return getInitializedAdminSdk<Firestore>(_adminDb, 'Firestore');
}

export function getAdminAuth(): Auth {
    return getInitializedAdminSdk<Auth>(_adminAuth, 'Auth');
}
