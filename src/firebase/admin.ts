import { getApps, initializeApp, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App;

if (getApps().length === 0) {
  // In a managed Google Cloud environment like App Hosting, applicationDefault() 
  // automatically uses the runtime service account. The projectId is inferred 
  // from the environment, so we don't need to specify it manually.
  app = initializeApp({
    credential: applicationDefault(),
  });
  console.log(`[Firebase Admin] Initialized with project ID: ${app.options.projectId}`);
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
