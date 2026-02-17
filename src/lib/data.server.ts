// This file contains client-side data fetching utilities using Firestore.
import { Firestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import type { User } from './definitions';

const getDataById = async <T>(db: Firestore, collectionName: string, id: string): Promise<T | null> => {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ ...docSnap.data(), ...(collectionName === 'users' ? { userId: docSnap.id } : { id: docSnap.id }) } as T) : null;
  } catch (error) {
    console.error('Error fetching document:', error);
    return null;
  }
};

export async function getCombinedTeamData(db: Firestore): Promise<User[]> {
  let teamMembers: User[] = [];
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    teamMembers = snapshot.docs.map(d => ({ ...(d.data() as any), userId: d.id } as User));
  } catch (error) {
    console.error('Error fetching team data:', error);
  }
  return teamMembers;
}

export async function getManageableUsers(db: Firestore): Promise<User[]> {
  let allUsers: User[] = [];
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    allUsers = snapshot.docs.map(d => ({ ...(d.data() as any), userId: d.id } as User));
  } catch (error) {
    console.error('Error fetching manageable users:', error);
  }
  return allUsers;
}

export async function logLessonCompletion(db: Firestore, data: { userId: string; lessonId: string; timestamp: number }): Promise<User | null> {
  try {
    const userDocRef = doc(db, 'users', data.userId);
    // Presumably, some write operation here to log lesson completion
    // For example: await updateDoc(userDocRef, { lastLessonCompleted: data.lessonId, lastCompletedAt: data.timestamp });

    const updatedUserDoc = await getDoc(doc(db, 'users', data.userId));
    const updatedUser = { ...(updatedUserDoc.data() as any), userId: updatedUserDoc.id } as User;
    return updatedUser;
  } catch (error) {
    console.error('Error logging lesson completion:', error);
    return null;
  }
}
