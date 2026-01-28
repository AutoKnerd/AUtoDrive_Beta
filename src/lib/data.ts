

import { isToday, subDays, isSameDay } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge, Address, Message, MessageTargetScope } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp, Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateTourData } from './tour-data';
import { initializeFirebase } from '@/firebase/init';


// --- Singleton instances ---
let db: Firestore;
let auth: Auth;
function getFirebase() {
    if (!db || !auth) {
        const services = initializeFirebase();
        db = services.firestore;
        auth = services.auth;
    }
    return { db, auth };
}


// --- FAKE DATA INJECTION FOR TOUR ---
let tourData: ReturnType<typeof generateTourData> | null = null;
const getTourData = () => {
    if (!tourData) {
        tourData = generateTourData();
    }
    return tourData;
}
const isTouringUser = () => {
    if (typeof window === 'undefined') {
        return false;
    }
    const { auth } = getFirebase();
    const email = auth.currentUser?.email;
    if (!email) return false;
    
    const demoUserEmails = [
        'consultant.demo@autodrive.com',
        'service.writer.demo@autodrive.com',
        'manager.demo@autodrive.com',
        'owner.demo@autodrive.com',
    ];
    
    return demoUserEmails.includes(email) || email.endsWith('@autodrive-demo.com');
};


// --- HELPER FUNCTIONS ---

const getDataById = async <T>(db: Firestore, collectionName: string, id: string): Promise<T | null> => {
    const docRef = doc(db, collectionName, id);
    try {
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? ({ ...docSnap.data(), id: docSnap.id } as T) : null;
    } catch(e: any) {
         const contextualError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get'
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
};


// AUTH
export async function getUserById(userId: string): Promise<User | null> {
    const { auth, db } = getFirebase();

    if (isTouringUser()) {
        const { users } = getTourData();
        const currentUser = auth.currentUser;
        
        // This block handles the initial fetch when auth state changes (using Firebase UID).
        if (currentUser?.uid === userId && currentUser.email) {
            const tourUserRoles: Record<string, UserRole> = {
                'consultant.demo@autodrive.com': 'Sales Consultant',
                'service.writer.demo@autodrive.com': 'Service Writer',
                'manager.demo@autodrive.com': 'manager',
                'owner.demo@autodrive.com': 'Owner',
            };
            const role = tourUserRoles[currentUser.email];
            if (role) {
                // Find the representative user for the role. Now 'Owner' will be found.
                const representativeUser = users.find(u => u.role === role);
                if (representativeUser) {
                    return {
                        ...representativeUser,
                        email: currentUser.email, // Always use the auth email for the session
                        name: role === 'Owner' ? 'Demo Owner' : `Demo ${role === 'manager' ? 'Sales Manager' : role}`,
                    };
                }
            }
        }
        
        // This block handles subsequent lookups within the app using the stable tour ID.
        const tourUser = users.find(u => u.userId === userId);
        if (tourUser) {
            return tourUser;
        }
        
        // Fallback for owner, as their user ID might not be a tour ID initially
        const ownerUser = users.find(u => u.role === 'Owner');
        if(ownerUser) return ownerUser;
        
        // If for some reason a user is not found, return null to avoid crashes.
        return null;
    }

    return getDataById<User>(db, 'users', userId);
}


export async function createUserProfile(userId: string, name: string, email: string, role: UserRole, dealershipIds: string[]): Promise<User> {
    const { db } = getFirebase();
    
    // If the role is Admin/Dev/Trainer and they are not being assigned to a dealership, create/assign them to HQ.
    if (['Admin', 'Developer', 'Trainer'].includes(role) && dealershipIds.length === 0) {
        const hqDealershipId = 'autoknerd-hq';
        const dealershipRef = doc(db, 'dealerships', hqDealershipId);
        try {
            const docSnap = await getDoc(dealershipRef);
            if (!docSnap.exists()) {
                const newDealership: Dealership = {
                    id: hqDealershipId,
                    name: "AutoKnerd HQ",
                    status: 'active',
                    address: { street: '123 AI Lane', city: 'Cybertown', state: 'CA', zip: '90210' }
                };
                await setDoc(dealershipRef, newDealership);
            }
            dealershipIds.push(hqDealershipId);
        } catch(e: any) {
             const contextualError = new FirestorePermissionError({ path: dealershipRef.path, operation: 'write' });
             errorEmitter.emit('permission-error', contextualError);
             throw contextualError;
        }
    }

    const newUser: User = {
        userId: userId,
        name: name,
        email: email,
        role: role,
        dealershipIds: dealershipIds,
        avatarUrl: 'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
        xp: 0,
        isPrivate: false,
        isPrivateFromOwner: false,
        memberSince: new Date().toISOString(),
        subscriptionStatus: ['Admin', 'Developer', 'Owner', 'Trainer', 'General Manager'].includes(role) ? 'active' : 'inactive',
    };

    const userDocRef = doc(db, 'users', userId);
    try {
        await setDoc(userDocRef, newUser);
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'create',
            requestResourceData: newUser,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    return newUser;
}


export async function findUserByEmail(email: string, requestingUserId:string): Promise<User | null> {
    const { db } = getFirebase();
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where("email", "==", email.toLowerCase()));
    let querySnapshot;
    try {
        querySnapshot = await getDocs(q);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: usersCollection.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    if (querySnapshot.empty) {
        return null;
    }

    const foundUser = { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as User;

    const requestingUser = await getUserById(requestingUserId);
    if (!requestingUser) {
        return null; 
    }

    if (['Admin', 'Trainer'].includes(requestingUser.role)) {
        return foundUser;
    }

    if (foundUser.dealershipIds.length === 0) {
        return foundUser;
    }

    const inManagedDealership = foundUser.dealershipIds.some(id => requestingUser.dealershipIds.includes(id));
    if (inManagedDealership) {
        return foundUser;
    }

    return null;
}

export async function updateUser(userId: string, data: Partial<Omit<User, 'userId' | 'role' | 'xp' | 'dealershipIds'>>): Promise<User> {
    const { db } = getFirebase();
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, data);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    const updatedUser = await getDataById<User>(db, 'users', userId);
    if (!updatedUser) throw new Error("User not found after update");
    return updatedUser;
}

export async function updateUserDealerships(userId: string, newDealershipIds: string[]): Promise<User> {
    const { db } = getFirebase();
    const userRef = doc(db, 'users', userId);
    const updateData = { dealershipIds: newDealershipIds };
    try {
        await updateDoc(userRef, updateData);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    const updatedUser = await getDataById<User>(db, 'users', userId);
    if (!updatedUser) throw new Error("User not found after update");
    return updatedUser;
}

export async function deleteUser(userId: string): Promise<void> {
    const { db } = getFirebase();
    const batch = writeBatch(db);
    
    batch.delete(doc(db, 'users', userId));

    const logsCollectionRef = collection(db, `users/${userId}/lessonLogs`);
    try {
        const logsSnapshot = await getDocs(logsCollectionRef);
        logsSnapshot.forEach(logDoc => batch.delete(logDoc.ref));
    } catch (e) {
        const contextualError = new FirestorePermissionError({ path: logsCollectionRef.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const assignmentsCollection = collection(db, 'lessonAssignments');
    const assignmentsQuery = query(assignmentsCollection, where("userId", "==", userId));
    try {
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        assignmentsSnapshot.forEach(assignDoc => batch.delete(assignDoc.ref));
    } catch (e) {
        const contextualError = new FirestorePermissionError({ path: assignmentsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    const badgesCollectionRef = collection(db, `users/${userId}/earnedBadges`);
    try {
        const badgesSnapshot = await getDocs(badgesCollectionRef);
        badgesSnapshot.forEach(badgeDoc => batch.delete(badgeDoc.ref));
    } catch (e) {
        const contextualError = new FirestorePermissionError({ path: badgesCollectionRef.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    try {
        await batch.commit();
    } catch (e) {
        const contextualError = new FirestorePermissionError({ path: `users/${userId}`, operation: 'delete' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
}

export async function createDealership(dealershipData: {
    name: string;
    address: Partial<Address>;
    trainerId?: string;
}): Promise<Dealership> {
    const { db } = getFirebase();
    const dealershipRef = doc(collection(db, 'dealerships'));
    const newDealership: Dealership = {
        id: dealershipRef.id,
        name: dealershipData.name,
        status: 'active',
        address: dealershipData.address as Address,
        trainerId: dealershipData.trainerId,
    };
    try {
        await setDoc(dealershipRef, newDealership);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'create',
            requestResourceData: newDealership,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    return newDealership;
}

export async function getInvitationByToken(token: string): Promise<EmailInvitation | null> {
    const { db } = getFirebase();
    return getDataById<EmailInvitation>(db, 'emailInvitations', token);
}

export async function getInvitationByEmail(email: string): Promise<EmailInvitation | null> {
    const { db } = getFirebase();
    const invitationsRef = collection(db, 'emailInvitations');
    const q = query(invitationsRef, where("email", "==", email.toLowerCase()), where("claimed", "==", false));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        return querySnapshot.docs[0].data() as EmailInvitation;
    } catch (e) {
        // This might fail due to permissions, which is okay for this check.
        console.warn("Could not query invitations by email:", e);
        return null;
    }
}

export async function claimInvitation(token: string): Promise<void> {
    const { db } = getFirebase();
    const invitationRef = doc(db, 'emailInvitations', token);
    const updateData = { claimed: true };
     try {
        await updateDoc(invitationRef, updateData);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: invitationRef.path,
            operation: 'update',
            requestResourceData: updateData
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
}

export async function sendInvitation(
  dealershipId: string,
  email: string,
  role: UserRole,
  inviterId: string,
): Promise<void> {
  const { db } = getFirebase();
  const inviter = await getUserById(inviterId);
  if (!inviter) throw new Error("Inviter not found.");

  const dealership = await getDealershipById(dealershipId);
  if (!dealership) throw new Error('Dealership not found.');
  
  const invitationsCollection = collection(db, 'emailInvitations');
  const invitationRef = doc(invitationsCollection);
  const token = invitationRef.id;

  const newInvitation: EmailInvitation = {
    token: token,
    dealershipId: dealership.id,
    dealershipName: dealership.name,
    role: role,
    email: email.toLowerCase(),
    claimed: false,
    inviterId: inviterId,
  };
  
  try {
    await setDoc(invitationRef, newInvitation);
  } catch(e: any) {
      const contextualError = new FirestorePermissionError({
          path: invitationRef.path,
          operation: 'create',
          requestResourceData: newInvitation
      });
      errorEmitter.emit('permission-error', contextualError);
      throw contextualError;
  }
}


export async function updateUserSubscriptionStatus(stripeCustomerId: string, newStatus: 'active' | 'inactive'): Promise<User | null> {
    const { db } = getFirebase();
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where("stripeCustomerId", "==", stripeCustomerId));
    let snapshot;
    try {
        snapshot = await getDocs(q);
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({
            path: usersCollection.path,
            operation: 'list'
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    if (snapshot.empty) return null;

    const userDoc = snapshot.docs[0];
    const userDocRef = userDoc.ref;
    const updateData = { subscriptionStatus: newStatus };
    try {
        await updateDoc(userDocRef, updateData);
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: updateData
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    const updatedUser = await getDoc(userDocRef);
    return { ...updatedUser.data(), id: updatedUser.id } as User;
}


// LESSONS
export async function getLessons(role: LessonRole): Promise<Lesson[]> {
    if (isTouringUser()) {
        const { lessons } = getTourData();
        return lessons.filter(lesson => lesson.role === role || lesson.role === 'global');
    }

    const { db } = getFirebase();
    const lessonsCollection = collection(db, 'lessons');
    const q = query(lessonsCollection, where("role", "in", [role, 'global']));
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lesson));
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({ path: lessonsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
    if (isTouringUser()) {
        const { lessons } = getTourData();
        return lessons.find(l => l.lessonId === lessonId) || null;
    }
    const { db } = getFirebase();
    return getDataById<Lesson>(db, 'lessons', lessonId);
}

export async function getDealershipById(dealershipId: string): Promise<Dealership | null> {
    if (isTouringUser()) {
        const { dealerships } = getTourData();
        const dealership = dealerships.find(d => d.id === dealershipId);
        if (dealership) return { ...dealership, status: 'active' };
        return null;
    }
    const { db } = getFirebase();
    return getDataById<Dealership>(db, 'dealerships', dealershipId);
}

export async function createLesson(lessonData: {
    title: string;
    category: LessonCategory;
    associatedTrait: CxTrait;
    targetRole: UserRole | 'global';
    scenario: string;
}): Promise<Lesson> {
    if (isTouringUser()) {
        const { lessons } = getTourData();
        const newLesson: Lesson = {
            lessonId: `tour-lesson-${Math.random().toString(36).substring(7)}`,
            title: lessonData.title,
            category: lessonData.category,
            associatedTrait: lessonData.associatedTrait,
            role: lessonData.targetRole as LessonRole,
            customScenario: lessonData.scenario,
        };
        lessons.push(newLesson);
        return newLesson;
    }

    const { db } = getFirebase();
    const lessonsCollection = collection(db, 'lessons');
    const newLessonRef = doc(lessonsCollection);
    const newLesson: Lesson = {
        lessonId: newLessonRef.id,
        title: lessonData.title,
        category: lessonData.category,
        associatedTrait: lessonData.associatedTrait,
        role: lessonData.targetRole as LessonRole,
        customScenario: lessonData.scenario,
    };
    try {
        await setDoc(newLessonRef, newLesson);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: newLessonRef.path,
            operation: 'create',
            requestResourceData: newLesson,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    return newLesson;
}

export async function getAssignedLessons(userId: string): Promise<Lesson[]> {
    if (isTouringUser()) {
        const { lessonAssignments, lessons } = getTourData();
        const userAssignments = lessonAssignments.filter(a => a.userId === userId && !a.completed);
        if (userAssignments.length === 0) {
            return [];
        }
        
        const lessonIds = userAssignments.map(a => a.lessonId);
        return lessons.filter(l => lessonIds.includes(l.lessonId));
    }

    const { db } = getFirebase();
    const assignmentsCollection = collection(db, 'lessonAssignments');
    const q = query(assignmentsCollection, where("userId", "==", userId), where("completed", "==", false));
    
    let assignments: LessonAssignment[];
    try {
        const snapshot = await getDocs(q);
        assignments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LessonAssignment));
    } catch (e) {
        const contextualError = new FirestorePermissionError({ path: assignmentsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    if (assignments.length === 0) return [];
    
    const lessonIds = assignments.map(a => a.lessonId);
    if (lessonIds.length === 0) return [];

    const lessonsCollection = collection(db, 'lessons');

    // Firestore 'in' queries are limited to 30 items. We need to chunk the requests.
    if (lessonIds.length > 30) {
        const chunks: string[][] = [];
        for (let i = 0; i < lessonIds.length; i += 30) {
            chunks.push(lessonIds.slice(i, i + 30));
        }
        
        const lessonPromises = chunks.map(chunk => {
            const lessonsQuery = query(lessonsCollection, where("lessonId", "in", chunk));
            return getDocs(lessonsQuery);
        });

        try {
            const snapshotResults = await Promise.all(lessonPromises);
            const allLessons: Lesson[] = [];
            snapshotResults.forEach(snapshot => {
                snapshot.docs.forEach(doc => {
                    allLessons.push({ ...doc.data(), id: doc.id } as Lesson);
                });
            });
            return allLessons;
        } catch(e: any) {
            const contextualError = new FirestorePermissionError({ path: lessonsCollection.path, operation: 'list' });
            errorEmitter.emit('permission-error', contextualError);
            throw contextualError;
        }

    } else {
        const lessonsQuery = query(lessonsCollection, where("lessonId", "in", lessonIds));
        try {
            const snapshot = await getDocs(lessonsQuery);
            return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lesson));
        } catch(e: any) {
            const contextualError = new FirestorePermissionError({ path: lessonsCollection.path, operation: 'list' });
            errorEmitter.emit('permission-error', contextualError);
            throw contextualError;
        }
    }
}

export async function assignLesson(userId: string, lessonId: string, assignerId: string): Promise<LessonAssignment> {
    if (isTouringUser()) {
        const { lessonAssignments } = getTourData();
        const newAssignment: LessonAssignment = {
            assignmentId: `tour-assignment-${Math.random().toString(36).substring(7)}`,
            userId,
            lessonId,
            assignerId,
            timestamp: new Date(),
            completed: false,
        };
        lessonAssignments.push(newAssignment);
        return newAssignment;
    }

    const { db } = getFirebase();
    const assignmentsCollection = collection(db, 'lessonAssignments');
    const assignmentRef = doc(assignmentsCollection);
    const newAssignment: LessonAssignment = {
        assignmentId: assignmentRef.id,
        userId,
        lessonId,
        assignerId,
        timestamp: new Date(),
        completed: false,
    };
    try {
        await setDoc(assignmentRef, newAssignment);
    } catch(e: any) {
         const contextualError = new FirestorePermissionError({
            path: assignmentRef.path,
            operation: 'create',
            requestResourceData: newAssignment
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    return newAssignment;
}


export async function getConsultantActivity(userId: string): Promise<LessonLog[]> {
    if (userId.startsWith('tour-')) {
        const { lessonLogs } = getTourData();
        const userLogs = lessonLogs.filter(log => log.userId === userId);
        return userLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    const { db } = getFirebase();
    const logsCollection = collection(db, `users/${userId}/lessonLogs`);
    try {
        const snapshot = await getDocs(logsCollection);
        const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        return logs.map(log => ({...log, timestamp: log.timestamp.toDate()})).sort((a,b) => b.timestamp - a.timestamp);
    } catch(e) {
        const contextualError = new FirestorePermissionError({ path: logsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
}

export async function getDailyLessonLimits(userId: string): Promise<{ recommendedTaken: boolean, otherTaken: boolean }> {
    const { db } = getFirebase();
    const logsCollection = collection(db, `users/${userId}/lessonLogs`);
    let logs: any[];
    try {
        const snapshot = await getDocs(logsCollection);
        logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch(e) {
        const contextualError = new FirestorePermissionError({ path: logsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    const todayLogs = logs.filter(log => {
      return isToday(log.timestamp.toDate());
    });
    
    const recommendedTaken = todayLogs.some(log => log.isRecommended);
    const otherTaken = todayLogs.some(log => !log.isRecommended);

    return { recommendedTaken, otherTaken };
}

export async function logLessonCompletion(data: {
    userId: string;
    lessonId: string;
    xpGained: number;
    isRecommended: boolean;
    scores: Omit<LessonLog, 'logId' | 'timestamp' | 'userId' | 'lessonId' | 'stepResults' | 'xpGained' | 'isRecommended'>;
}): Promise<{ updatedUser: User, newBadges: Badge[] }> {
    if (isTouringUser()) {
        const user = await getUserById(data.userId);
        if (!user) throw new Error('Tour user not found');
        const updatedUser = { ...user, xp: user.xp + data.xpGained };
        const newBadges: Badge[] = [];
        if (data.xpGained > 80) {
            const badge = allBadges.find(b => b.id === 'top-performer');
            if(badge) newBadges.push(badge);
        }
        return { updatedUser, newBadges };
    }

    const { db } = getFirebase();
    const user = await getUserById(data.userId);
    if (!user) throw new Error('User not found');

    const logRef = doc(collection(db, `users/${data.userId}/lessonLogs`));
    
    const newLogData = {
        logId: logRef.id,
        timestamp: Timestamp.fromDate(new Date()),
        userId: data.userId,
        lessonId: data.lessonId,
        xpGained: data.xpGained,
        isRecommended: data.isRecommended,
        stepResults: { final: 'pass' },
        ...data.scores,
    };

    const userLogs = await getConsultantActivity(data.userId);
    const userBadgeDocs = await getDocs(collection(db, `users/${data.userId}/earnedBadges`));
    const userBadgeIds = userBadgeDocs.docs.map(d => d.id as BadgeId);
    
    const newlyAwardedBadges: Badge[] = [];
    
    const batch = writeBatch(db);
    
    const awardBadge = (badgeId: BadgeId) => {
        if (!userBadgeIds.includes(badgeId)) {
            const badgeRef = doc(db, `users/${data.userId}/earnedBadges`, badgeId);
            batch.set(badgeRef, { badgeId, timestamp: Timestamp.fromDate(new Date()) });
            const badge = allBadges.find(b => b.id === badgeId);
            if (badge) newlyAwardedBadges.push(badge);
        }
    };
    
    if (userLogs.length === 0) awardBadge('first-drive');
    const newXp = user.xp + data.xpGained;
    if (user.xp < 1000 && newXp >= 1000) awardBadge('xp-1000');
    if (user.xp < 5000 && newXp >= 5000) awardBadge('xp-5000');
    if (user.xp < 10000 && newXp >= 10000) awardBadge('xp-10000');

    const levelBefore = calculateLevel(user.xp).level;
    const levelAfter = calculateLevel(newXp).level;
    if (levelBefore < 10 && levelAfter >= 10) awardBadge('level-10');
    if (levelBefore < 25 && levelAfter >= 25) awardBadge('level-25');

    const lessonScore = Object.values(data.scores).reduce((sum, score) => sum + score, 0) / 6;
    if (lessonScore >= 95) awardBadge('top-performer');
    if (lessonScore === 100) awardBadge('perfectionist');
    
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 4) awardBadge('night-owl');
    if (hour >= 4 && hour < 7) awardBadge('early-bird');
    
    const assignmentsCollection = collection(db, 'lessonAssignments');
    const assignmentQuery = query(assignmentsCollection, where("userId", "==", data.userId), where("lessonId", "==", data.lessonId), where("completed", "==", false));
    const assignmentSnapshot = await getDocs(assignmentQuery);
    if (!assignmentSnapshot.empty) {
        const assignmentDoc = assignmentSnapshot.docs[0];
        batch.update(assignmentDoc.ref, { completed: true });
        awardBadge('managers-pick');
    }

    batch.set(logRef, newLogData);
    batch.update(doc(db, 'users', data.userId), { xp: newXp });

    try {
        await batch.commit();
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({
            path: `users/${data.userId}`,
            operation: 'write',
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    const updatedUserDoc = await getDoc(doc(db, 'users', data.userId));
    const updatedUser = { ...updatedUserDoc.data(), id: updatedUserDoc.id } as User;
    
    return { updatedUser, newBadges: newlyAwardedBadges };
}


// MANAGER
export const getTeamMemberRoles = (managerRole: UserRole): UserRole[] => {
    switch (managerRole) {
        case 'manager':
            return ['Sales Consultant'];
        case 'Service Manager':
            return ['Service Writer'];
        case 'Parts Manager':
            return ['Parts Consultant'];
        case 'General Manager':
             return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager'];
        case 'Owner':
             return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager'];
        case 'Trainer':
            return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Developer'];
        case 'Admin':
            return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Trainer', 'Developer', 'Admin'];
        case 'Developer':
             return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Trainer', 'Admin'];
        default:
            return [];
    }
};

export async function getDealerships(user?: User): Promise<Dealership[]> {
    if (isTouringUser()) {
        return getTourData().dealerships;
    }

    const { db } = getFirebase();
    const dealershipsCollection = collection(db, 'dealerships');
    let q = query(dealershipsCollection);
    if (user && user.role === 'Trainer') {
        q = query(dealershipsCollection, where("trainerId", "==", user.userId));
    }
    
    let dealerships: Dealership[];
    try {
        const snapshot = await getDocs(q);
        dealerships = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Dealership));
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({ path: dealershipsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    let relevantDealerships = dealerships.filter(d => d.id !== 'autoknerd-hq');

    if (user && !['Admin', 'Developer'].includes(user.role)) {
        relevantDealerships = relevantDealerships.filter(d => d.status !== 'deactivated');
    }

    return relevantDealerships.sort((a, b) => a.name.localeCompare(b.name));
}


export async function getCombinedTeamData(dealershipId: string, userRole: UserRole): Promise<{
    teamActivity: { consultant: User; lessonsCompleted: number; totalXp: number; avgScore: number; }[],
    managerStats: { totalLessons: number; avgScores: Record<CxTrait, number> | null }
}> {
    if (isTouringUser()) {
        const { users, lessonLogs } = getTourData();
        const teamRoles = getTeamMemberRoles(userRole);
        
        let teamMembers: User[];
        if (dealershipId === 'all') {
            teamMembers = users.filter(u => teamRoles.includes(u.role));
        } else {
            teamMembers = users.filter(u => u.dealershipIds.includes(dealershipId) && teamRoles.includes(u.role));
        }

        const teamActivity = teamMembers.map(member => {
            const memberLogs = lessonLogs.filter(log => log.userId === member.userId);
            if (memberLogs.length === 0) {
                return { consultant: member, lessonsCompleted: 0, totalXp: member.xp, avgScore: 0 };
            }
            const lessonsCompleted = memberLogs.length;
            const totalXp = member.xp;
            const totalScore = memberLogs.reduce((sum, log) => {
                 return sum + ((log.empathy || 0) + (log.listening || 0) + (log.trust || 0) + (log.followUp || 0) + (log.closing || 0) + (log.relationshipBuilding || 0));
            }, 0);
            const avgScore = Math.round(totalScore / (memberLogs.length * 6));
            return { consultant: member, lessonsCompleted, totalXp, avgScore };
        }).sort((a, b) => a.consultant.name.localeCompare(b.consultant.name));
        
        const allLogs = lessonLogs.filter(log => teamMembers.some(member => member.userId === log.userId));
        if (allLogs.length === 0) {
            return { teamActivity, managerStats: { totalLessons: 0, avgScores: null } };
        }
        const totalLessons = allLogs.length;
        const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];
        const avgScores = cxTraits.reduce((acc, trait) => {
            const totalScore = allLogs.reduce((sum, log) => sum + (log[trait] || 0), 0);
            acc[trait] = Math.round(totalScore / totalLessons);
            return acc;
        }, {} as Record<CxTrait, number>);

        return { teamActivity, managerStats: { totalLessons, avgScores } };
    }

    const { db } = getFirebase();
    const usersCollection = collection(db, 'users');
    const teamRoles = getTeamMemberRoles(userRole);
    let userQuery;

    if ((['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(userRole)) && dealershipId === 'all') {
        userQuery = query(usersCollection, where("role", "in", teamRoles));
    } else {
        const selectedDealership = await getDealershipById(dealershipId);
        if (selectedDealership?.status === 'paused') {
            return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
        }
        userQuery = query(usersCollection, where("dealershipIds", "array-contains", dealershipId), where("role", "in", teamRoles));
    }
    
    let teamMembers: User[];
    try {
        const snapshot = await getDocs(userQuery);
        teamMembers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({ path: usersCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    
    if (teamMembers.length === 0) {
        return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
    }

    const allLogsPerUserPromises = teamMembers.map(member => getConsultantActivity(member.userId));
    const allLogsPerUser = await Promise.all(allLogsPerUserPromises);

    const thirtyDaysAgo = subDays(new Date(), 30);
    const activeUserCount = allLogsPerUser.filter(logs => {
        if (logs.length === 0) return false;
        const lastLogDate = logs[0].timestamp; // Assumes logs are sorted descending
        return lastLogDate > thirtyDaysAgo;
    }).length;

    if (activeUserCount < 3 && dealershipId !== 'all') {
        const teamActivity = teamMembers.map(member => ({
            consultant: member,
            lessonsCompleted: 0,
            totalXp: member.xp,
            avgScore: 0,
        })).sort((a,b) => a.consultant.name.localeCompare(b.consultant.name));
        return { teamActivity, managerStats: { totalLessons: -1, avgScores: null }}; // Use -1 as insufficient data flag
    }
    
    const allLogsFlat: LessonLog[] = allLogsPerUser.flat();

    const teamActivity = teamMembers.map((member, index) => {
        const memberLogs = allLogsPerUser[index];
        if (memberLogs.length === 0) {
            return { consultant: member, lessonsCompleted: 0, totalXp: member.xp, avgScore: 0 };
        }

        const lessonsCompleted = memberLogs.length;
        const totalXp = member.xp;
        
        const totalScore = memberLogs.reduce((sum, log) => {
            return sum + ((log.empathy || 0) + (log.listening || 0) + (log.trust || 0) + (log.followUp || 0) + (log.closing || 0) + (log.relationshipBuilding || 0));
        }, 0);
        
        const avgScore = Math.round(totalScore / (memberLogs.length * 6));

        return { consultant: member, lessonsCompleted, totalXp, avgScore };
    }).sort((a, b) => a.consultant.name.localeCompare(b.consultant.name));

    if (allLogsFlat.length === 0) {
        return { teamActivity, managerStats: { totalLessons: 0, avgScores: null }};
    }
    const totalLessons = allLogsFlat.length;
    const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];
    const avgScores = cxTraits.reduce((acc, trait) => {
        const totalScore = allLogsFlat.reduce((sum, log) => sum + (log[trait] || 0), 0);
        acc[trait] = Math.round(totalScore / totalLessons);
        return acc;
    }, {} as Record<CxTrait, number>);
    const managerStats = { totalLessons, avgScores };
    
    return { teamActivity, managerStats };
}


export async function getManageableUsers(managerId: string): Promise<User[]> {
    const { db } = getFirebase();
    const manager = await getUserById(managerId);
    if (!manager) return [];

    if (isTouringUser()) {
        return getTourData().users.filter(u => u.email !== 'owner.demo@autodrive.com');
    }

    const manageableRoles = getTeamMemberRoles(manager.role);
    const usersCollection = collection(db, 'users');
    
    let allUsers: User[];
    try {
        const snapshot = await getDocs(usersCollection);
        allUsers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({ path: usersCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const manageableUsers = allUsers.filter(u => {
        if (u.userId === managerId) return false;
        if (!manageableRoles.includes(u.role)) return false;
        if (u.dealershipIds.length === 0) return true;
        const inManagedDealership = u.dealershipIds.some(id => manager.dealershipIds.includes(id));
        return inManagedDealership;
    });

    return manageableUsers.sort((a, b) => a.name.localeCompare(b.name));
}


// BADGES
export async function getEarnedBadgesByUserId(userId: string): Promise<Badge[]> {
    if (isTouringUser() || userId.startsWith('tour-')) {
        const { earnedBadges } = getTourData();
        const userEarnedBadges = earnedBadges[userId] || [];
        const badgeIds = userEarnedBadges.map(b => b.badgeId);
        return allBadges.filter(b => badgeIds.includes(b.id));
    }
    
    const { db } = getFirebase();
    const badgesCollection = collection(db, `users/${userId}/earnedBadges`);
    
    let badgeDocs: EarnedBadge[];
    try {
        const snapshot = await getDocs(badgesCollection);
        badgeDocs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as EarnedBadge));
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({ path: badgesCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const badgeIds = badgeDocs.map(b => b.badgeId);
    return allBadges.filter(b => badgeIds.includes(b.id));
}

// DEALERSHIPS
export async function updateDealershipStatus(dealershipId: string, status: 'active' | 'paused' | 'deactivated'): Promise<Dealership> {
    const { db } = getFirebase();
    const dealershipsCollection = collection(db, 'dealerships');
    const dealershipRef = doc(dealershipsCollection, dealershipId);

    try {
        await updateDoc(dealershipRef, { status });
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: { status }
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }


    if (status === 'deactivated') {
        const usersCollection = collection(db, 'users');
        const usersToUpdateQuery = query(usersCollection, where("dealershipIds", "array-contains", dealershipId));
        const userSnapshot = await getDocs(usersToUpdateQuery);
        const batch = writeBatch(db);
        userSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            const newIds = userData.dealershipIds.filter(id => id !== dealershipId);
            batch.update(userDoc.ref, { dealershipIds: newIds });
        });
        try {
            await batch.commit();
        } catch (e: any) {
            const contextualError = new FirestorePermissionError({
                path: 'users',
                operation: 'write'
            });
            errorEmitter.emit('permission-error', contextualError);
            throw contextualError;
        }
    }
    
    const updatedDealership = await getDoc(dealershipRef);
    return { ...updatedDealership.data(), id: updatedDealership.id } as Dealership;
}

// MESSENGER
export async function sendMessage(
    sender: User, 
    content: string, 
    target: { scope: MessageTargetScope; targetId: string; targetRole?: UserRole }
): Promise<Message> {
    const { db } = getFirebase();
    const messagesCollection = collection(db, 'messages');
    const messageRef = doc(messagesCollection);
    const newMessage: Message = {
        id: messageRef.id,
        senderId: sender.userId,
        senderName: sender.name,
        timestamp: new Date(),
        content: content,
        scope: target.scope,
        targetId: target.targetId,
        targetRole: target.targetRole,
    };
    try {
        await setDoc(messageRef, { ...newMessage, timestamp: Timestamp.fromDate(newMessage.timestamp) });
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({
            path: messageRef.path,
            operation: 'create',
            requestResourceData: newMessage
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
    return newMessage;
}

export async function getMessagesForUser(user: User): Promise<Message[]> {
    const { db } = getFirebase();
    const messagesCollection = collection(db, 'messages');
    const fourteenDaysAgo = subDays(new Date(), 14);
    let relevantMessages: Message[] = [];
    
    const globalQuery = query(messagesCollection, where("scope", "==", "global"), where("timestamp", ">=", Timestamp.fromDate(fourteenDaysAgo)));
    
    try {
        const globalSnap = await getDocs(globalQuery);
        globalSnap.forEach(doc => relevantMessages.push({ ...doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate()} as Message));
    } catch(e: any) {
        // Fail silently on message fetch is acceptable
    }
    
    if(user.dealershipIds.length > 0) {
        const dealershipQuery = query(messagesCollection, where("scope", "==", "dealership"), where("targetId", "in", user.dealershipIds), where("timestamp", ">=", Timestamp.fromDate(fourteenDaysAgo)));
        try {
            const dealershipSnap = await getDocs(dealershipQuery);
            dealershipSnap.forEach(doc => relevantMessages.push({ ...doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate()} as Message));
        } catch(e: any) {
            // Fail silently
        }


        const departmentQuery = query(messagesCollection, where("scope", "==", "department"), where("targetId", "in", user.dealershipIds), where("targetRole", "==", user.role), where("timestamp", ">=", Timestamp.fromDate(fourteenDaysAgo)));
        try {
            const departmentSnap = await getDocs(departmentQuery);
            departmentSnap.forEach(doc => relevantMessages.push({ ...doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate()} as Message));
        } catch(e: any) {
            // Fail silently
        }
    }
    
    const uniqueMessages = Array.from(new Map(relevantMessages.map(item => [item['id'], item])).values());
    
    return uniqueMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

