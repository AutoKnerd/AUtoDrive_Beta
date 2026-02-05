
import { getApps, initializeApp, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: App;

if (getApps().length === 0) {
  // In Google Cloud environments like Firebase App Hosting, applicationDefault()
  // automatically finds the correct service account credentials.
  // This is the recommended way to initialize for portability and reliability.
  app = initializeApp({
    credential: applicationDefault(),
  });

  // This log is crucial for debugging in App Hosting. It will show which project
  // the Admin SDK has been initialized with, confirming it's correct.
  console.log(`[Firebase Admin] Initialized for project: ${app.options.projectId}`);
} else {
  app = getApps()[0];
}

const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

export { adminDb, adminAuth };
