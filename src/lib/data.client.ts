'use client';
import { isToday, subDays } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge, Address, Message, MessageTargetScope, PendingInvitation } from './definitions';
import { lessonCategoriesByRole, noPersonalDevelopmentRoles } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp, Firestore, orderBy, limit } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateTourData } from './tour-data';
import { initializeFirebase } from '@/firebase/init';

const { firestore: db, auth } = initializeFirebase();

let tourData: Awaited<ReturnType<typeof generateTourData>> | null = null;
const getTourData = async () => {
    if (!tourData) {
        tourData = await generateTourData();
    }
    return tourData;
}

const isTouringUser = (userId?: string): boolean => !!userId && userId.startsWith('tour-');
const tourUserEmails: Record<string, string> = {
    'consultant.demo@autodrive.com': 'tour-consultant',
    'service.writer.demo@autodrive.com': 'tour-service-writer',
    'parts.consultant.demo@autodrive.com': 'tour-parts-consultant',
    'finance.manager.demo@autodrive.com': 'tour-finance-manager',
    'manager.demo@autodrive.com': 'tour-manager',
    'service.manager.demo@autodrive.com': 'tour-service-manager',
    'parts.manager.demo@autodrive.com': 'tour-parts-manager',
    'general.manager.demo@autodrive.com': 'tour-general-manager',
    'owner.demo@autodrive.com': 'tour-owner',
};

const getTourIdFromEmail = (email?: string | null): string | null => {
    if (!email) return null;
    return tourUserEmails[email.toLowerCase()] || null;
};

const getDataById = async <T>(db: Firestore, collectionName: string, id: string): Promise<T | null> => {
    const docRef = doc(db, collectionName, id);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        const base = { ...docSnap.data() } as any;
        if (collectionName === 'users') {
            return ({ ...base, userId: docSnap.id } as T);
        }
        return ({ ...base, id: docSnap.id } as T);
    } catch(e: any) {
         const contextualError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get'
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
};

export async function getUserById(userId: string): Promise<User | null> {
    if (isTouringUser(userId)) {
        const { users } = await getTourData();
        return users.find(u => u.userId === userId) || null;
    }

    const authTourId = auth.currentUser?.uid === userId
        ? getTourIdFromEmail(auth.currentUser.email)
        : null;
    if (authTourId) {
        const tourUser = (await getTourData()).users.find(u => u.userId === authTourId);
        if (tourUser) return tourUser;
    }

    const userDoc = await getDoc(doc(db, 'users', userId)).catch(() => null);
    if (userDoc && userDoc.exists()) {
        const tourId = getTourIdFromEmail(userDoc.data()?.email);
        if (tourId) {
             const tourUser = (await getTourData()).users.find(u => u.userId === tourId);
             return tourUser || null;
        }
    }
    
    return getDataById<User>(db, 'users', userId);
}

export async function createUserProfile(userId: string, name: string, email: string, role: UserRole, dealershipIds: string[]): Promise<User> {
    if (['Admin', 'Developer', 'Trainer'].includes(role) && dealershipIds.length === 0) {
        const hqDealershipId = 'autoknerd-hq';
        dealershipIds.push(hqDealershipId);
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
        showDealerCriticalOnly: false,
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

export async function updateUser(userId: string, data: Partial<Omit<User, 'userId' | 'xp' | 'dealershipIds'>>): Promise<User> {
    if (isTouringUser(userId)) {
        const user = (await getTourData()).users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found after update");
        return { ...user, ...data };
    }

    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
        throw new Error("Authentication required");
    }

    const response = await fetch('/api/admin/updateUser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUserId: userId, data }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update user profile via server API.');
    }

    const updatedUser = await getDataById<User>(db, 'users', userId);
    if (!updatedUser) throw new Error("User not found after update");
    return updatedUser;
}

export async function updateUserDealerships(userId: string, newDealershipIds: string[]): Promise<User> {
     if (isTouringUser(userId)) {
        const user = (await getTourData()).users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found");
        user.dealershipIds = newDealershipIds;
        return user;
    }
    
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
        throw new Error("Authentication required");
    }

    const response = await fetch('/api/admin/updateUserDealerships', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUserId: userId, dealershipIds: newDealershipIds }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user dealerships');
    }

    const updatedUser = await getDataById<User>(db, 'users', userId);
    if (!updatedUser) throw new Error("User not found after update");
    return updatedUser;
}

export async function deleteUser(userId: string): Promise<void> {
    if (isTouringUser(userId)) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId));

    const logsCollectionRef = collection(db, `users/${userId}/lessonLogs`);
    try {
        const logsSnapshot = await getDocs(logsCollectionRef);
        logsSnapshot.forEach(logDoc => batch.delete(logDoc.ref));
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: logsCollectionRef.path, operation: 'list' }));
    }

    const assignmentsCollection = collection(db, 'lessonAssignments');
    const assignmentsQuery = query(assignmentsCollection, where("userId", "==", userId));
    try {
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        assignmentsSnapshot.forEach(assignDoc => batch.delete(assignDoc.ref));
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: assignmentsCollection.path, operation: 'list' }));
    }
    
    const badgesCollectionRef = collection(db, `users/${userId}/earnedBadges`);
    try {
        const badgesSnapshot = await getDocs(badgesCollectionRef);
        badgesSnapshot.forEach(badgeDoc => batch.delete(badgeDoc.ref));
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: badgesCollectionRef.path, operation: 'list' }));
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
    if (isTouringUser(dealershipData.trainerId)) {
        const newDealership: Dealership = {
            id: `tour-dealership-${Math.random()}`,
            name: dealershipData.name,
            status: 'active',
            address: dealershipData.address as Address,
        };
        (await getTourData()).dealerships.push(newDealership);
        return newDealership;
    }

    throw new Error('Please use the admin form which calls the secure API endpoint.');
}

export async function getInvitationByToken(token: string): Promise<EmailInvitation | null> {
    return getDataById<EmailInvitation>(db, 'emailInvitations', token);
}

export async function claimInvitation(token: string): Promise<void> {
    if (isTouringUser(auth.currentUser?.uid)) return;

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Authentication required.");
    
    const idToken = await currentUser.getIdToken(true);
    const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to claim invitation.');
    }
}

export async function createInvitationLink(dealershipId: string, email: string, role: UserRole, inviterId: string): Promise<{ url: string }> {
    if (isTouringUser(inviterId)) return { url: `http://localhost:9002/register?token=tour-fake-token-${Math.random()}` };

    const inviter = await getUserById(inviterId);
    if (!inviter) throw new Error("Inviter not found.");
    
    const idToken = await auth.currentUser?.getIdToken(true);
    const response = await fetch('/api/admin/createEmailInvitation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ dealershipId, email, role }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'API Error while creating invitation.');
    }
    
    const responseData = await response.json();
    return { url: responseData.inviteUrl };
}

export async function getPendingInvitations(dealershipId: string, user: User): Promise<PendingInvitation[]> {
    if (isTouringUser(user.userId)) return [];

    const idToken = await auth.currentUser?.getIdToken(true);
    const params = new URLSearchParams({ dealershipId });
    const response = await fetch(`/api/admin/pendingInvitations?${params.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Failed to fetch pending invitations.';
        if (errorMessage.includes('"aud" (audience) claim')) {
            console.warn(`[data.client] Suppressing audience claim error. Check backend config.`);
            return [];
        }
        if (response.status === 403) return [];
        throw new Error(errorMessage);
    }

    const data = await response.json();
    return (data?.pendingInvitations || []).map((invite: any) => ({
        ...invite,
        createdAt: invite.createdAt ? new Date(invite.createdAt) : undefined,
        expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : undefined,
    } as PendingInvitation));
}

export async function getLessons(role: LessonRole, userId?: string): Promise<Lesson[]> {
    if (isTouringUser(userId)) {
        const { lessons } = await getTourData();
        const scoped = lessons.filter(l => l.role === role || l.role === 'global');
        return scoped.length > 0 ? scoped : buildRoleStarterLessons(role);
    }

    const lessonsCollection = collection(db, 'lessons');
    try {
        const scopedSnapshot = await getDocs(query(lessonsCollection, where("role", "in", [role, 'global'])));
        if (!scopedSnapshot.empty) {
            return scopedSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lesson));
        }
        return buildRoleStarterLessons(role);
    } catch(e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: lessonsCollection.path, operation: 'list' }));
        return buildRoleStarterLessons(role);
    }
}

export async function getLessonById(lessonId: string, userId?: string): Promise<Lesson | null> {
    const starterLesson = getStarterLessonById(lessonId);
    if (starterLesson) return starterLesson;
    if (isTouringUser(userId) || lessonId.startsWith('tour-')) {
        const { lessons } = await getTourData();
        return lessons.find(l => l.lessonId === lessonId) || null;
    }
    return getDataById<Lesson>(db, 'lessons', lessonId);
}

export async function getDealershipById(dealershipId: string, userId?: string): Promise<Dealership | null> {
    if (isTouringUser(userId) || dealershipId.startsWith('tour-')) {
        const { dealerships } = await getTourData();
        const dealership = dealerships.find(d => d.id === dealershipId);
        return dealership ? { ...dealership, status: 'active' } : null;
    }
    return getDataById<Dealership>(db, 'dealerships', dealershipId);
}

export async function createLesson(lessonData: { title: string; category: LessonCategory; associatedTrait: CxTrait; targetRole: UserRole | 'global'; scenario: string; }, creator: User, options?: { autoAssignByRole?: boolean; }): Promise<{ lesson: Lesson; autoAssignedCount: number; autoAssignFailed: boolean }> {
    if (isTouringUser(creator.userId)) {
        const { lessons } = await getTourData();
        const newLesson: Lesson = {
            lessonId: `tour-lesson-${Math.random().toString(36).substring(7)}`,
            ...lessonData,
            role: lessonData.targetRole as LessonRole,
            customScenario: lessonData.scenario,
            createdByUserId: creator.userId,
        };
        lessons.push(newLesson);
        return { lesson: newLesson, autoAssignedCount: 0, autoAssignFailed: false };
    }

    const newLessonRef = doc(collection(db, 'lessons'));
    const newLesson: Lesson = {
        lessonId: newLessonRef.id,
        title: lessonData.title,
        category: lessonData.category,
        associatedTrait: lessonData.associatedTrait,
        role: lessonData.targetRole as LessonRole,
        customScenario: lessonData.scenario,
        createdByUserId: creator.userId,
    };
    await setDoc(newLessonRef, newLesson);

    let autoAssignedCount = 0;
    if (options?.autoAssignByRole) {
        try {
            const recipients = (await getManageableUsers(creator.userId)).filter(u => 
                !noPersonalDevelopmentRoles.includes(u.role) && (lessonData.targetRole === 'global' || u.role === lessonData.targetRole)
            );
            for (const recipient of recipients) {
                await assignLesson(recipient.userId, newLesson.lessonId, creator.userId);
                autoAssignedCount++;
            }
        } catch (error) {
            console.warn('Auto-assignment failed.', error);
        }
    }
    return { lesson: newLesson, autoAssignedCount, autoAssignFailed: false };
}

export async function getAssignedLessons(userId: string): Promise<Lesson[]> {
    if (isTouringUser(userId)) {
        const { lessonAssignments, lessons } = await getTourData();
        const ids = lessonAssignments.filter(a => a.userId === userId && !a.completed).map(a => a.lessonId);
        return lessons.filter(l => ids.includes(l.lessonId));
    }

    const q = query(collection(db, 'lessonAssignments'), where("userId", "==", userId), where("completed", "==", false));
    const snap = await getDocs(q);
    const ids = snap.docs.map(d => (d.data() as LessonAssignment).lessonId);
    if (ids.length === 0) return [];

    const lessonsSnap = await getDocs(query(collection(db, 'lessons'), where("lessonId", "in", ids.slice(0, 30))));
    return lessonsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Lesson));
}

export async function getAllAssignedLessonIds(userId: string): Promise<string[]> {
    if (isTouringUser(userId)) {
        const { lessonAssignments } = await getTourData();
        return Array.from(new Set(lessonAssignments.filter(a => a.userId === userId).map(a => a.lessonId)));
    }
    const snap = await getDocs(query(collection(db, 'lessonAssignments'), where("userId", "==", userId)));
    return Array.from(new Set(snap.docs.map(d => (d.data() as LessonAssignment).lessonId)));
}

export async function assignLesson(userId: string, lessonId: string, assignerId: string): Promise<LessonAssignment> {
    if (isTouringUser(userId) || isTouringUser(assignerId)) {
        const { lessonAssignments } = await getTourData();
        const newA: LessonAssignment = { assignmentId: `tour-a-${Math.random()}`, userId, lessonId, assignerId, timestamp: new Date(), completed: false };
        lessonAssignments.push(newA);
        return newA;
    }
    const ref = doc(collection(db, 'lessonAssignments'));
    const newA: LessonAssignment = { assignmentId: ref.id, userId, lessonId, assignerId, timestamp: new Date(), completed: false };
    await setDoc(ref, newA);
    return newA;
}

export async function getConsultantActivity(userId: string): Promise<LessonLog[]> {
    if (isTouringUser(userId)) {
        const { lessonLogs } = await getTourData();
        return lessonLogs.filter(log => log.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    const snapshot = await getDocs(collection(db, `users/${userId}/lessonLogs`));
    return snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return { ...data, id: doc.id, timestamp: data.timestamp.toDate() };
    }).sort((a, b) => b.timestamp - a.timestamp);
}

export async function getDailyLessonLimits(userId: string): Promise<{ recommendedTaken: boolean, otherTaken: boolean }> {
    const logs = await getConsultantActivity(userId);
    const todayLogs = logs.filter(log => isToday(log.timestamp));
    return { recommendedTaken: todayLogs.some(l => l.isRecommended), otherTaken: todayLogs.some(l => !l.isRecommended) };
}

export async function logLessonCompletion(data: { userId: string; lessonId: string; xpGained: number; isRecommended: boolean; scores: any; }): Promise<{ updatedUser: User, newBadges: Badge[] }> {
    if (isTouringUser(data.userId)) {
        const tour = await getTourData();
        const user = tour.users.find(u => u.userId === data.userId);
        if (!user) throw new Error('Tour user not found');
        user.xp += data.xpGained;
        return { updatedUser: user, newBadges: [] };
    }

    const user = await getUserById(data.userId);
    if (!user) throw new Error('User not found');

    const batch = writeBatch(db);
    const logRef = doc(collection(db, `users/${data.userId}/lessonLogs`));
    batch.set(logRef, { ...data.scores, logId: logRef.id, timestamp: Timestamp.fromDate(new Date()), ...data });
    
    const newXp = user.xp + data.xpGained;
    batch.update(doc(db, 'users', data.userId), { xp: newXp });
    await batch.commit();

    const updated = await getUserById(data.userId);
    return { updatedUser: updated!, newBadges: [] };
}

export const getTeamMemberRoles = (managerRole: UserRole): UserRole[] => {
    switch (managerRole) {
        case 'manager': return ['Sales Consultant'];
        case 'Service Manager': return ['Service Writer'];
        case 'Parts Manager': return ['Parts Consultant'];
        case 'General Manager':
        case 'Owner':
        case 'Trainer':
        case 'Admin':
        case 'Developer':
            return allRoles.filter(r => !['Admin', 'Developer', 'Trainer'].includes(r));
        default: return [];
    }
};

export async function getDealerships(user?: User): Promise<Dealership[]> {
    if (isTouringUser(user?.userId)) return (await getTourData()).dealerships;
    const snap = await getDocs(collection(db, 'dealerships'));
    const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Dealership));
    if (user && !['Admin', 'Developer', 'Trainer'].includes(user.role)) {
        return all.filter(d => user.dealershipIds.includes(d.id) && d.status !== 'deactivated');
    }
    return all.filter(d => d.id !== 'autoknerd-hq').sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCombinedTeamData(dealershipId: string, user: User): Promise<any> {
    const roles = getTeamMemberRoles(user.role);
    const usersSnap = await getDocs(query(collection(db, 'users'), where("role", "in", roles)));
    const members = usersSnap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
    const filtered = dealershipId === 'all' ? members : members.filter(m => m.dealershipIds.includes(dealershipId));
    
    return {
        teamActivity: filtered.map(m => ({ consultant: m, lessonsCompleted: 0, totalXp: m.xp, avgScore: 0, lastInteraction: null })),
        managerStats: { totalLessons: 0, avgScores: null }
    };
}

export async function getManageableUsers(managerId: string): Promise<User[]> {
    const manager = await getUserById(managerId);
    if (!manager) return [];
    const isAdmin = ['Admin', 'Developer'].includes(manager.role);
    const snap = await getDocs(collection(db, 'users'));
    const all = snap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
    if (isAdmin) return all.filter(u => u.userId !== managerId).sort((a, b) => a.name.localeCompare(b.name));
    
    const roles = getTeamMemberRoles(manager.role);
    return all.filter(u => u.userId !== managerId && roles.includes(u.role) && u.dealershipIds.some(id => manager.dealershipIds.includes(id))).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEarnedBadgesByUserId(userId: string): Promise<Badge[]> {
    if (isTouringUser(userId)) {
        const { earnedBadges } = await getTourData();
        const ids = (earnedBadges[userId] || []).map(b => b.badgeId);
        return allBadges.filter(b => ids.includes(b.id));
    }
    const snap = await getDocs(collection(db, `users/${userId}/earnedBadges`));
    const ids = snap.docs.map(d => (d.data() as EarnedBadge).badgeId);
    return allBadges.filter(b => ids.includes(b.id));
}

export async function updateDealershipStatus(dealershipId: string, status: 'active' | 'paused' | 'deactivated'): Promise<Dealership> {
    const ref = doc(db, 'dealerships', dealershipId);
    await updateDoc(ref, { status });
    return (await getDoc(ref)).data() as Dealership;
}

export async function sendMessage(sender: User, content: string, target: any): Promise<Message> {
    const ref = doc(collection(db, 'messages'));
    const msg: Message = { id: ref.id, senderId: sender.userId, senderName: sender.name, timestamp: new Date(), content, ...target };
    await setDoc(ref, { ...msg, timestamp: Timestamp.fromDate(msg.timestamp) });
    return msg;
}

export async function getMessagesForUser(user: User): Promise<Message[]> {
    const snap = await getDocs(query(collection(db, 'messages'), where("scope", "==", "global")));
    return snap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: d.data().timestamp.toDate() } as Message));
}

export type CreatedLessonStatus = {
  lesson: Lesson;
  assignedUserCount: number;
  takenUserCount: number;
  lastAssignedAt: Date | null;
  assignees: Array<{ userId: string; name: string; role: string; taken: boolean; completedAt?: Date }>;
};

export async function getCreatedLessonStatuses(creatorId: string): Promise<CreatedLessonStatus[]> {
  const isTour = isTouringUser(creatorId);
  const lessonsRef = collection(db, 'lessons');
  const q = query(lessonsRef, where('createdByUserId', '==', creatorId), orderBy('title', 'asc'));
  const snap = isTour ? { docs: (await getTourData()).lessons.filter(l => l.createdByUserId === creatorId) } : await getDocs(q);
  
  const results: CreatedLessonStatus[] = [];
  const assignmentsRef = collection(db, 'lessonAssignments');
  const logsRef = collection(db, 'lessonLogs'); // Note: Global collection check might fail, using subcollections instead

  for (const docSnap of (snap.docs as any[])) {
    const lesson = isTour ? docSnap : { ...docSnap.data(), lessonId: docSnap.id } as Lesson;
    
    // Fetch all assignments for this lesson
    const aSnap = await getDocs(query(assignmentsRef, where('lessonId', '==', lesson.lessonId)));
    const assignments = aSnap.docs.map(d => d.data() as LessonAssignment);
    
    const assignees: CreatedLessonStatus['assignees'] = [];
    let takenCount = 0;
    let lastAssigned: Date | null = null;

    for (const a of assignments) {
      if (!lastAssigned || a.timestamp > lastAssigned) lastAssigned = a.timestamp;
      
      const user = await getUserById(a.userId);
      if (!user) continue;

      // Check if user has a log for this lesson
      const logSnap = await getDocs(query(collection(db, `users/${user.userId}/lessonLogs`), where('lessonId', '==', lesson.lessonId), limit(1)));
      const isTaken = !logSnap.empty;
      if (isTaken) takenCount++;

      assignees.push({
        userId: user.userId,
        name: user.name,
        role: user.role,
        taken: isTaken,
        completedAt: isTaken ? (logSnap.docs[0].data().timestamp as Timestamp).toDate() : undefined
      });
    }

    results.push({
      lesson,
      assignedUserCount: assignments.length,
      takenUserCount: takenCount,
      lastAssignedAt: lastAssigned,
      assignees
    });
  }

  return results;
}

export async function getSystemReport(actor: User): Promise<SystemReport> {
  if (!['Admin', 'Developer'].includes(actor.role)) throw new Error('Unauthorized');
  
  const usersSnap = await getDocs(collection(db, 'users'));
  const dealershipsSnap = await getDocs(collection(db, 'dealerships'));
  
  const users = usersSnap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
  const dealerships = dealershipsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Dealership));
  
  const reportRows: SystemReportRow[] = [];
  const thirtyDaysAgo = subDays(new Date(), 30);
  
  let totalLessons = 0;
  let totalXp = 0;
  let sumScores = 0;
  let scoreCount = 0;

  for (const user of users) {
    const logsSnap = await getDocs(collection(db, `users/${user.userId}/lessonLogs`));
    const logs = logsSnap.docs.map(d => d.data() as LessonLog);
    
    const lessonsCompleted = logs.length;
    const userTotalXp = user.xp || 0;
    const lastLog = logs.sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
    const lastInteraction = lastLog ? lastLog.timestamp.toDate() : null;
    const isActive30d = lastInteraction ? lastInteraction > thirtyDaysAgo : false;
    
    let userAvgScore = 0;
    if (lessonsCompleted > 0) {
      const uSum = logs.reduce((s, l) => s + ((l.empathy + l.listening + l.trust + l.followUp + l.closing + l.relationshipBuilding) / 6), 0);
      userAvgScore = Math.round(uSum / lessonsCompleted);
      sumScores += userAvgScore;
      scoreCount++;
    }

    totalLessons += lessonsCompleted;
    totalXp += userTotalXp;

    reportRows.push({
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      dealershipIds: user.dealershipIds || [],
      dealershipNames: (user.dealershipIds || []).map(id => dealerships.find(d => d.id === id)?.name || 'Unknown'),
      subscriptionStatus: user.subscriptionStatus,
      lessonsCompleted,
      totalXp: userTotalXp,
      avgScore: lessonsCompleted > 0 ? userAvgScore : null,
      lastInteraction,
      isActive30d
    });
  }

  return {
    generatedAt: new Date(),
    users: {
      total: users.length,
      active30d: reportRows.filter(r => r.isActive30d).length,
      ownersTotal: users.filter(u => u.role === 'Owner').length,
      ownersActive30d: reportRows.filter(r => r.role === 'Owner' && r.isActive30d).length,
    },
    dealerships: {
      total: dealerships.length,
      active: dealerships.filter(d => d.status === 'active').length,
      paused: dealerships.filter(d => d.status === 'paused').length,
      deactivated: dealerships.filter(d => d.status === 'deactivated').length,
    },
    performance: {
      totalLessonsCompleted: totalLessons,
      averageScore: scoreCount > 0 ? Math.round(sumScores / scoreCount) : null,
      totalXp
    },
    rows: reportRows
  };
}

export type SystemReportRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  dealershipIds: string[];
  dealershipNames: string[];
  subscriptionStatus?: string;
  lessonsCompleted: number;
  totalXp: number;
  avgScore: number | null;
  lastInteraction: Date | null;
  isActive30d: boolean;
};

export type SystemReport = {
  generatedAt: Date;
  users: { total: number; active30d: number; ownersTotal: number; ownersActive30d: number };
  dealerships: { total: number; active: number; paused: number; deactivated: number };
  performance: { totalLessonsCompleted: number; averageScore: number | null; totalXp: number };
  rows: SystemReportRow[];
};

const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

function cxTraitLabel(trait: string): string {
    return trait.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}
function buildRoleStarterLessons(role: LessonRole): Lesson[] {
    const cats = lessonCategoriesByRole[role] || [];
    return cats.length ? cxTraits.map((t, i) => ({ lessonId: `starter-${role}-${t}`, title: `${role} ${cxTraitLabel(t)} Foundations`, role, category: cats[i % cats.length], associatedTrait: t })) : [];
}
function getStarterLessonById(id: string): Lesson | null {
    if (!id.startsWith('starter-')) return null;
    const parts = id.split('-');
    if (parts.length < 3) return null;
    const role = parts[1] as LessonRole;
    const trait = parts[2] as CxTrait;
    return buildRoleStarterLessons(role).find(l => l.associatedTrait === trait) || null;
}
