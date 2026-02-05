import { getApps, initializeApp, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App;

if (getApps().length === 0) {
  app = initializeApp({ credential: applicationDefault() });
  console.log(`[Firebase Admin] Initialized for project: ${app.options.projectId}`);
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);