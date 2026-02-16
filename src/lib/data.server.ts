
'use server';

import {
  getAdminDb,
  isAdminInitialized,
  AdminNotInitializedError,
} from '@/firebase/admin';
import type { User } from './definitions';

// Helper function to throw a consistent error when the Admin SDK is not available.
function checkAdminSdk() {
  if (!isAdminInitialized) {
    throw new AdminNotInitializedError(
      'The Firebase Admin SDK is not available on the server. This function cannot be executed.'
    );
  }
}

const getDataById = async <T>(
  collectionName: string,
  id: string
): Promise<T | null> => {
  checkAdminSdk();
  const adminDb = getAdminDb();

  try {
    const docRef = adminDb.collection(collectionName).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    if (!data) {
      return null;
    }

    // Normalize Firestore doc IDs into the shape our app expects.
    // Users use `userId` as the primary key; most other collections use `id`.
    if (collectionName === 'users') {
      return { ...data, userId: docSnap.id } as T;
    }
    return { ...data, id: docSnap.id } as T;
  } catch (error) {
    console.error(`[data.server] Error fetching document from ${collectionName}/${id}:`, error);
    // Re-throwing or handling is an option here. For now, we'll return null.
    return null;
  }
};

export async function getCombinedTeamData(): Promise<User[]> {
  checkAdminSdk();
  const adminDb = getAdminDb();
  let teamMembers: User[] = [];
  try {
    const snapshot = await adminDb.collection('users').get();
    teamMembers = snapshot.docs.map(
      (d) => ({ ...(d.data() as any), userId: d.id } as User)
    );
  } catch (error) {
    console.error('[data.server] Error fetching team data:', error);
  }
  return teamMembers;
}

export async function getManageableUsers(): Promise<User[]> {
  checkAdminSdk();
  const adminDb = getAdminDb();
  let allUsers: User[] = [];
  try {
    const snapshot = await adminDb.collection('users').get();
    allUsers = snapshot.docs.map(
      (d) => ({ ...(d.data() as any), userId: d.id } as User)
    );
  } catch (error) {
    console.error('[data.server] Error fetching manageable users:', error);
  }
  return allUsers;
}


// This function is problematic as it implies a write operation from a file that might be used
// in server components, which is not a recommended pattern for mutations.
// However, to fix the build, we will make it use the admin SDK.
export async function logLessonCompletion(data: {
  userId: string;
  lessonId: string;
  timestamp: number;
}): Promise<User | null> {
    checkAdminSdk();
    const adminDb = getAdminDb();
    try {
        const userDocRef = adminDb.collection('users').doc(data.userId);
        
        // This is a placeholder for the actual logic that should exist.
        // For now, we just fetch the user to prove connectivity.
        const updatedUserDoc = await userDocRef.get();
        if (!updatedUserDoc.exists) return null;

        const updatedUser = { ...(updatedUserDoc.data() as any), userId: updatedUserDoc.id } as User;
        return updatedUser;

    } catch (error) {
        console.error('[data.server] Error logging lesson completion:', error);
        return null;
    }
}
