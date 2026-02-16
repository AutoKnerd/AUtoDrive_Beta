

'use client';
import { isToday, subDays } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge, Address, Message, MessageTargetScope, PendingInvitation } from './definitions';
import { lessonCategoriesByRole, noPersonalDevelopmentRoles } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp, Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateTourData } from './tour-data';
import { initializeFirebase } from '@/firebase/init';

// Establish a single, shared database connection for this module.
const { firestore: db, auth } = initializeFirebase();

// --- FAKE DATA INJECTION FOR TOUR ---
let tourData: Awaited<ReturnType<typeof generateTourData>> | null = null;
const getTourData = async () => {
    if (!tourData) {
        tourData = await generateTourData();
    }
    return tourData;
}

const isTouringUser = (userId?: string): boolean => !!userId && userId.startsWith('tour-');


// --- HELPER FUNCTIONS ---
const getDataById = async <T>(db: Firestore, collectionName: string, id: string): Promise<T | null> => {
    const docRef = doc(db, collectionName, id);
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;

        // Normalize Firestore doc IDs into the shape our app expects.
        // Users use `userId` as the primary key; most other collections use `id`.
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


// AUTH
export async function getUserById(userId: string): Promise<User | null> {
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

    // This is a special bridge for the demo user logins.
    // It finds the real user doc to get their email, then maps it to the correct fake tour ID.
    const userDoc = await getDoc(doc(db, 'users', userId)).catch(() => null);
    if (userDoc && userDoc.exists()) {
        const userEmail = userDoc.data()?.email;
        const tourId = tourUserEmails[userEmail];
        if (tourId) {
             const tourUser = (await getTourData()).users.find(u => u.userId === tourId);
             // Return the specific tour user, but inject the REAL Firebase UID so auth state remains valid.
             return tourUser ? { ...tourUser, userId: userId } : null;
        }
    }

    if (isTouringUser(userId)) {
        const { users } = await getTourData();
        return users.find(u => u.userId === userId) || null;
    }
    
    return getDataById<User>(db, 'users', userId);
}


export async function createUserProfile(userId: string, name: string, email: string, role: UserRole, dealershipIds: string[]): Promise<User> {
    
    // If the role is Admin/Dev/Trainer and they are not being assigned to a dealership, assign them to HQ.
    // This no longer creates the dealership document, it just assumes it exists.
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


export async function updateUser(userId: string, data: Partial<Omit<User, 'userId' | 'role' | 'xp' | 'dealershipIds'>>): Promise<User> {
    if (isTouringUser(userId)) {
        const user = (await getTourData()).users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found after update");
        // In tour mode, we just return the user object as if it was updated.
        const updatedUser = { ...user, ...data };
        return updatedUser;
    }

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
     if (isTouringUser(userId)) {
        const user = (await getTourData()).users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found");
        user.dealershipIds = newDealershipIds; // In-memory update
        return user;
    }
    
    // Call the API endpoint with permission checks
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
    if (isTouringUser(userId)) {
        // No-op for tour mode
        return;
    }

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
    // This function is now only used for tour mode.
    // Real dealership creation must go through the /api/admin/createDealership endpoint.
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

    // This will now fail due to security rules, which is the intended behavior.
    // The admin form now uses the API route.
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
    // Invitations are not part of tour mode
    return getDataById<EmailInvitation>(db, 'emailInvitations', token);
}

export async function claimInvitation(token: string): Promise<void> {
    if (isTouringUser(auth.currentUser?.uid)) {
        return; // No-op for tour mode
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("Authentication is required to claim an invitation.");
    }
    
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
        throw new Error(errorData.message || 'Failed to claim invitation. Please try again.');
    }
}

export async function createInvitationLink(
  dealershipId: string,
  email: string,
  role: UserRole,
  inviterId: string,
): Promise<{ url: string }> {
    if (isTouringUser(inviterId)) {
        return { url: `http://localhost:9002/register?token=tour-fake-token-${Math.random()}` };
    }

    const inviter = await getUserById(inviterId);
    if (!inviter) throw new Error("Inviter not found.");
    
    if (!auth.currentUser || auth.currentUser.uid !== inviterId) {
      throw new Error('User not authenticated or mismatch.');
    }
    const idToken = await auth.currentUser.getIdToken(true);

    const response = await fetch('/api/admin/createEmailInvitation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            dealershipId: dealershipId,
            email: email,
            role: role,
        }),
    });

    const rawResponseText = await response.text();

    if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        if (rawResponseText) {
            try {
                const errorJson = JSON.parse(rawResponseText);
                errorMessage = errorJson.message || errorMessage;
            } catch {
                errorMessage += ` - Response: ${rawResponseText.substring(0, 100)}`;
            }
        }
        throw new Error(errorMessage);
    }
    
    if (!rawResponseText) {
        throw new Error('API returned an empty response on success.');
    }

    let responseData;
    try {
        responseData = JSON.parse(rawResponseText);
    } catch (e) {
        throw new Error(`Failed to parse successful API response as JSON. Response: ${rawResponseText.substring(0, 100)}`);
    }

    if (!responseData.inviteUrl) {
        throw new Error('API response successful but did not include an inviteUrl.');
    }
    
    if (['Owner', 'General Manager', 'manager'].includes(inviter.role)) {
        const inviterBadges = await getEarnedBadgesByUserId(inviter.userId);
        if (!inviterBadges.some(b => b.id === 'talent-scout')) {
            const badgeRef = doc(db, `users/${inviter.userId}/earnedBadges`, 'talent-scout');
            try {
                 await setDoc(badgeRef, { badgeId: 'talent-scout', timestamp: Timestamp.fromDate(new Date()) });
            } catch (e) {
                console.warn("Could not award 'talent-scout' badge:", e);
            }
        }
    }
    return { url: responseData.inviteUrl };
}

export async function getPendingInvitations(dealershipId: string, user: User): Promise<PendingInvitation[]> {
    if (isTouringUser(user.userId)) {
        return [];
    }

    if (!auth.currentUser || auth.currentUser.uid !== user.userId) {
        throw new Error('User not authenticated or mismatch.');
    }

    const idToken = await auth.currentUser.getIdToken(true);
    const params = new URLSearchParams({ dealershipId });
    const response = await fetch(`/api/admin/pendingInvitations?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Do not block dashboard load if pending invitations are not accessible for this scope.
        if (response.status === 403) {
            return [];
        }
        throw new Error(errorData.message || 'Failed to fetch pending invitations.');
    }

    const data = await response.json();
    const pendingInvitations = Array.isArray(data?.pendingInvitations) ? data.pendingInvitations : [];

    return pendingInvitations.map((invite: any) => ({
        token: invite.token,
        dealershipId: invite.dealershipId,
        dealershipName: invite.dealershipName,
        role: invite.role as UserRole,
        email: invite.email,
        claimed: false,
        inviterId: invite.inviterId,
        createdAt: invite.createdAt ? new Date(invite.createdAt) : undefined,
        expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : undefined,
    } as PendingInvitation));
}

// LESSONS
const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

function formatTraitLabel(trait: CxTrait): string {
    return trait
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
}

function getRoleDisplayName(role: LessonRole): string {
    if (role === 'manager') return 'Sales Manager';
    return role;
}

function toRoleSlug(role: string): string {
    return role.toLowerCase().replace(/\s+/g, '-');
}

function fromRoleToken(roleToken: string): LessonRole | null {
    const decoded = decodeURIComponent(roleToken);
    const roleKeys = Object.keys(lessonCategoriesByRole) as LessonRole[];
    const byExact = roleKeys.find((role) => role === decoded);
    if (byExact) return byExact;
    const bySlug = roleKeys.find((role) => toRoleSlug(role) === decoded);
    if (bySlug) return bySlug;
    return null;
}

function buildRoleStarterLessons(role: LessonRole): Lesson[] {
    if (role === 'global') return [];
    const categories = lessonCategoriesByRole[role] || [];
    if (categories.length === 0) return [];

    return cxTraits.map((trait, index) => ({
        lessonId: `starter-${toRoleSlug(role)}-${trait}`,
        title: `${getRoleDisplayName(role)} ${formatTraitLabel(trait)} Foundations`,
        role,
        category: categories[index % categories.length],
        associatedTrait: trait,
        customScenario: `Role-specific ${formatTraitLabel(trait).toLowerCase()} coaching scenario for ${getRoleDisplayName(role)}.`,
    }));
}

function isLessonCategoryRelevantToRole(lesson: Lesson, role: LessonRole): boolean {
    if (role === 'global') return true;
    const allowedCategories = lessonCategoriesByRole[role] || [];
    if (allowedCategories.length === 0) return false;
    return allowedCategories.includes(lesson.category);
}

function getStarterLessonById(lessonId: string): Lesson | null {
    if (!lessonId.startsWith('starter-')) return null;
    const raw = lessonId.slice('starter-'.length);
    const lastDash = raw.lastIndexOf('-');
    if (lastDash <= 0) return null;

    const roleToken = raw.slice(0, lastDash);
    const traitToken = raw.slice(lastDash + 1);
    const parsedRole = fromRoleToken(roleToken);
    const parsedTrait = traitToken as CxTrait;
    if (!parsedRole) return null;
    if (!cxTraits.includes(parsedTrait)) return null;

    const roleLessons = buildRoleStarterLessons(parsedRole);
    return roleLessons.find(l => l.lessonId === lessonId) || roleLessons.find(l => l.associatedTrait === parsedTrait) || null;
}

export async function getLessons(role: LessonRole, userId?: string): Promise<Lesson[]> {
    if (isTouringUser(userId)) {
        const { lessons } = await getTourData();
        const scopedLessons = lessons.filter(lesson => lesson.role === role || lesson.role === 'global');
        const roleSpecificLessons = scopedLessons.filter(lesson => lesson.role === role);
        const relevantGlobalLessons = scopedLessons.filter(lesson => lesson.role === 'global' && isLessonCategoryRelevantToRole(lesson, role));
        const roleAlignedLessons = roleSpecificLessons.length > 0
            ? [...roleSpecificLessons, ...relevantGlobalLessons]
            : relevantGlobalLessons;
        if (roleAlignedLessons.length > 0) return roleAlignedLessons;
        return buildRoleStarterLessons(role);
    }

    const lessonsCollection = collection(db, 'lessons');
    try {
        const scopedQuery = query(lessonsCollection, where("role", "in", [role, 'global']));
        const scopedSnapshot = await getDocs(scopedQuery);
        if (!scopedSnapshot.empty) {
            const scopedLessons = scopedSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lesson));
            const roleSpecificLessons = scopedLessons.filter(lesson => lesson.role === role);
            const relevantGlobalLessons = scopedLessons.filter(lesson => lesson.role === 'global' && isLessonCategoryRelevantToRole(lesson, role));
            const roleAlignedLessons = roleSpecificLessons.length > 0
                ? [...roleSpecificLessons, ...relevantGlobalLessons]
                : relevantGlobalLessons;
            if (roleAlignedLessons.length > 0) {
                return roleAlignedLessons;
            }
        }

        // No matching role/global lessons in Firestore: use role starter lessons so
        // recommendations stay role-specific for Parts/Service/F&I and other non-sales roles.
        return buildRoleStarterLessons(role);
    } catch(e: any) {
        const contextualError = new FirestorePermissionError({ path: lessonsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
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
        if (dealership) return { ...dealership, status: 'active' };
        return null;
    }
    return getDataById<Dealership>(db, 'dealerships', dealershipId);
}

export async function createLesson(
    lessonData: {
        title: string;
        category: LessonCategory;
        associatedTrait: CxTrait;
        targetRole: UserRole | 'global';
        scenario: string;
    },
    creator: User,
    options?: {
        autoAssignByRole?: boolean;
    }
): Promise<{ lesson: Lesson; autoAssignedCount: number; autoAssignFailed: boolean }> {
    if (isTouringUser(creator.userId)) {
        const { lessons } = await getTourData();
        const newLesson: Lesson = {
            lessonId: `tour-lesson-${Math.random().toString(36).substring(7)}`,
            title: lessonData.title,
            category: lessonData.category,
            associatedTrait: lessonData.associatedTrait,
            role: lessonData.targetRole as LessonRole,
            customScenario: lessonData.scenario,
        };
        lessons.push(newLesson);
        return { lesson: newLesson, autoAssignedCount: 0, autoAssignFailed: false };
    }

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
        if (['Owner', 'General Manager', 'manager', 'Admin', 'Developer'].includes(creator.role)) {
            const creatorBadges = await getEarnedBadgesByUserId(creator.userId);
            if (!creatorBadges.some(b => b.id === 'curriculum-architect')) {
                const badgeRef = doc(db, `users/${creator.userId}/earnedBadges`, 'curriculum-architect');
                await setDoc(badgeRef, { badgeId: 'curriculum-architect', timestamp: Timestamp.fromDate(new Date()) });
            }
        }
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: newLessonRef.path,
            operation: 'create',
            requestResourceData: newLesson,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    let autoAssignedCount = 0;
    let autoAssignFailed = false;
    if (options?.autoAssignByRole) {
        try {
            const excludedRoles = new Set<UserRole>(noPersonalDevelopmentRoles);
            const manageableUsers = await getManageableUsers(creator.userId);
            const recipients = manageableUsers.filter((manageableUser) => {
                if (excludedRoles.has(manageableUser.role)) return false;
                if (lessonData.targetRole === 'global') return true;
                return manageableUser.role === lessonData.targetRole;
            });

            for (const recipient of recipients) {
                await assignLesson(recipient.userId, newLesson.lessonId, creator.userId);
                autoAssignedCount += 1;
            }
        } catch (error) {
            console.warn('Lesson was created but auto-assignment failed.', error);
            autoAssignFailed = true;
        }
    }

    return { lesson: newLesson, autoAssignedCount, autoAssignFailed };
}

export async function getAssignedLessons(userId: string): Promise<Lesson[]> {
    if (isTouringUser(userId)) {
        const { lessonAssignments, lessons } = await getTourData();
        const userAssignments = lessonAssignments.filter(a => a.userId === userId && !a.completed);
        if (userAssignments.length === 0) {
            return [];
        }
        
        const lessonIds = userAssignments.map(a => a.lessonId);
        return lessons.filter(l => lessonIds.includes(l.lessonId));
    }

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

export async function getAllAssignedLessonIds(userId: string): Promise<string[]> {
    if (isTouringUser(userId)) {
        const { lessonAssignments } = await getTourData();
        return Array.from(new Set(
            lessonAssignments
                .filter(a => a.userId === userId)
                .map(a => a.lessonId)
        ));
    }

    const assignmentsCollection = collection(db, 'lessonAssignments');
    const q = query(assignmentsCollection, where("userId", "==", userId));

    try {
        const snapshot = await getDocs(q);
        const lessonIds = snapshot.docs
            .map(doc => (doc.data() as LessonAssignment).lessonId)
            .filter(Boolean);
        return Array.from(new Set(lessonIds));
    } catch (e) {
        const contextualError = new FirestorePermissionError({ path: assignmentsCollection.path, operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }
}

export async function assignLesson(userId: string, lessonId: string, assignerId: string): Promise<LessonAssignment> {
    if (isTouringUser(userId) || isTouringUser(assignerId)) {
        const { lessonAssignments } = await getTourData();
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
    if (isTouringUser(userId)) {
        const { lessonLogs } = await getTourData();
        const userLogs = lessonLogs.filter(log => log.userId === userId);
        return userLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

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
    if (isTouringUser(userId)) {
        const { lessonLogs } = await getTourData();
        const todayLogs = lessonLogs.filter(log => log.userId === userId && isToday(log.timestamp));

        const recommendedTaken = todayLogs.some(log => log.isRecommended);
        const otherTaken = todayLogs.some(log => !log.isRecommended);
        return { recommendedTaken, otherTaken };
    }

    const logsCollection = collection(db, `users/${userId}/lessonLogs`);
    let logs: any[];
    try {
        const snapshot = await getDocs(logsCollection);
        logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch(e: any) {
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
    if (isTouringUser(data.userId)) {
        const tour = await getTourData();
        const user = tour.users.find(u => u.userId === data.userId);
        if (!user) throw new Error('Tour user not found');
        
        user.xp += data.xpGained; // In-memory update
        const newBadges: Badge[] = [];
        
        const badge = allBadges.find(b => b.id === 'first-drive');
        if(badge && !tour.earnedBadges[user.userId]?.some(b => b.badgeId === 'first-drive')) {
            newBadges.push(badge);
            tour.earnedBadges[user.userId].push({badgeId: 'first-drive', userId: user.userId, timestamp: new Date()});
        }
        
        return { updatedUser: user, newBadges: newBadges };
    }

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

    if (user.role === 'Owner' && user.dealershipIds.length > 1) {
        awardBadge('empire-builder');
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
    const updatedUser = { ...(updatedUserDoc.data() as any), userId: updatedUserDoc.id } as User;
    
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
    if (isTouringUser(user?.userId)) {
        return (await getTourData()).dealerships;
    }
    
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

    // Tighten dealership visibility for non-org-wide roles to only assigned dealerships.
    if (user && !['Admin', 'Developer', 'Trainer'].includes(user.role)) {
        const allowedIds = user.dealershipIds || [];
        relevantDealerships = relevantDealerships.filter(d => allowedIds.includes(d.id));
    }

    return relevantDealerships.sort((a, b) => a.name.localeCompare(b.name));
}


export async function getCombinedTeamData(dealershipId: string, user: User): Promise<{
    teamActivity: { consultant: User; lessonsCompleted: number; totalXp: number; avgScore: number; topStrength: CxTrait | null; weakestSkill: CxTrait | null; lastInteraction: Date | null; }[],
    managerStats: { totalLessons: number; avgScores: Record<CxTrait, number> | null }
}> {
    const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];
    const buildTeamRow = (member: User, memberLogs: LessonLog[]) => {
        if (memberLogs.length === 0) {
            return { consultant: member, lessonsCompleted: 0, totalXp: member.xp, avgScore: 0, topStrength: null, weakestSkill: null, lastInteraction: null };
        }

        const totalScore = memberLogs.reduce((sum, log) => {
            return sum + ((log.empathy || 0) + (log.listening || 0) + (log.trust || 0) + (log.followUp || 0) + (log.closing || 0) + (log.relationshipBuilding || 0));
        }, 0);
        const avgScore = Math.round(totalScore / (memberLogs.length * 6));
        const traitAverages = cxTraits.reduce((acc, trait) => {
            const scoreTotal = memberLogs.reduce((sum, log) => sum + (log[trait] || 0), 0);
            acc[trait] = Math.round(scoreTotal / memberLogs.length);
            return acc;
        }, {} as Record<CxTrait, number>);
        const topStrength = cxTraits.reduce((best, trait) =>
            traitAverages[trait] > traitAverages[best] ? trait : best,
            cxTraits[0]
        );
        const weakestSkill = cxTraits.reduce((worst, trait) =>
            traitAverages[trait] < traitAverages[worst] ? trait : worst,
            cxTraits[0]
        );

        return {
            consultant: member,
            lessonsCompleted: memberLogs.length,
            totalXp: member.xp,
            avgScore,
            topStrength,
            weakestSkill,
            lastInteraction: memberLogs[0].timestamp,
        };
    };

    if (isTouringUser(user.userId)) {
        const { users, lessonLogs } = await getTourData();
        const teamRoles = getTeamMemberRoles(user.role);
        if (teamRoles.length === 0) {
            return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
        }
        
        let teamMembers: User[];
        if (dealershipId === 'all') {
            teamMembers = users.filter(u => teamRoles.includes(u.role));
        } else {
            teamMembers = users.filter(u => u.dealershipIds.includes(dealershipId) && teamRoles.includes(u.role));
        }

        const teamActivity = teamMembers
            .map(member => buildTeamRow(member, lessonLogs.filter(log => log.userId === member.userId)))
            .sort((a, b) => a.consultant.name.localeCompare(b.consultant.name));
        
        const allLogs = lessonLogs.filter(log => teamMembers.some(member => member.userId === log.userId));
        if (allLogs.length === 0) {
            return { teamActivity, managerStats: { totalLessons: 0, avgScores: null } };
        }
        const totalLessons = allLogs.length;
        const avgScores = cxTraits.reduce((acc, trait) => {
            const totalScore = allLogs.reduce((sum, log) => sum + (log[trait] || 0), 0);
            acc[trait] = Math.round(totalScore / totalLessons);
            return acc;
        }, {} as Record<CxTrait, number>);

        return { teamActivity, managerStats: { totalLessons, avgScores } };
    }

    const usersCollection = collection(db, 'users');
    const teamRoles = getTeamMemberRoles(user.role);
    if (teamRoles.length === 0) {
        return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
    }
    let userQuery;

    if ((['Admin', 'Trainer', 'Developer'].includes(user.role)) && dealershipId === 'all') {
        userQuery = query(usersCollection, where("role", "in", teamRoles));
    } else if ((['Owner', 'General Manager'].includes(user.role)) && dealershipId === 'all') {
        const allowedDealershipIds = user.dealershipIds || [];
        if (allowedDealershipIds.length === 0) {
            return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
        }

        // Query each managed dealership separately to keep behavior aligned with the single-dealership query path.
        const snapshots = await Promise.all(
            allowedDealershipIds.map(id =>
                getDocs(query(usersCollection, where("dealershipIds", "array-contains", id), where("role", "in", teamRoles)))
            )
        );

        const dedupedMembers = new Map<string, User>();
        snapshots.forEach(snapshot => {
            snapshot.docs.forEach(d => {
                dedupedMembers.set(d.id, { ...(d.data() as any), userId: d.id } as User);
            });
        });

        const teamMembers = Array.from(dedupedMembers.values());

        if (teamMembers.length === 0) {
            return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
        }

        const allLogsPerUserPromises = teamMembers.map(member => getConsultantActivity(member.userId));
        const allLogsPerUser = await Promise.all(allLogsPerUserPromises);

        const allLogsFlat: LessonLog[] = allLogsPerUser.flat();

        const teamActivity = teamMembers
            .map((member, index) => buildTeamRow(member, allLogsPerUser[index]))
            .sort((a, b) => a.consultant.name.localeCompare(b.consultant.name));

        if (allLogsFlat.length === 0) {
            return { teamActivity, managerStats: { totalLessons: 0, avgScores: null } };
        }

        const totalLessons = allLogsFlat.length;
        const avgScores = cxTraits.reduce((acc, trait) => {
            const totalScore = allLogsFlat.reduce((sum, log) => sum + (log[trait] || 0), 0);
            acc[trait] = Math.round(totalScore / totalLessons);
            return acc;
        }, {} as Record<CxTrait, number>);

        return { teamActivity, managerStats: { totalLessons, avgScores } };
    } else {
        const selectedDealership = await getDealershipById(dealershipId, user.userId);
        if (selectedDealership?.status === 'paused') {
            return { teamActivity: [], managerStats: { totalLessons: 0, avgScores: null } };
        }
        userQuery = query(usersCollection, where("dealershipIds", "array-contains", dealershipId), where("role", "in", teamRoles));
    }
    
    let teamMembers: User[];
    try {
        const snapshot = await getDocs(userQuery);
        teamMembers = snapshot.docs.map(d => ({ ...(d.data() as any), userId: d.id } as User));
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
            topStrength: null,
            weakestSkill: null,
            lastInteraction: null,
        })).sort((a,b) => a.consultant.name.localeCompare(b.consultant.name));
        return { teamActivity, managerStats: { totalLessons: -1, avgScores: null }}; // Use -1 as insufficient data flag
    }
    
    const allLogsFlat: LessonLog[] = allLogsPerUser.flat();

    const teamActivity = teamMembers
        .map((member, index) => buildTeamRow(member, allLogsPerUser[index]))
        .sort((a, b) => a.consultant.name.localeCompare(b.consultant.name));

    if (allLogsFlat.length === 0) {
        return { teamActivity, managerStats: { totalLessons: 0, avgScores: null }};
    }
    const totalLessons = allLogsFlat.length;
    const avgScores = cxTraits.reduce((acc, trait) => {
        const totalScore = allLogsFlat.reduce((sum, log) => sum + (log[trait] || 0), 0);
        acc[trait] = Math.round(totalScore / totalLessons);
        return acc;
    }, {} as Record<CxTrait, number>);
    const managerStats = { totalLessons, avgScores };
    
    return { teamActivity, managerStats };
}

export type SystemReportUserRow = {
    userId: string;
    name: string;
    email: string;
    role: UserRole;
    dealershipIds: string[];
    dealershipNames: string[];
    subscriptionStatus?: 'active' | 'inactive';
    lessonsCompleted: number;
    totalXp: number;
    avgScore: number | null;
    lastInteraction: Date | null;
    isActive30d: boolean;
};

export type SystemReport = {
    generatedAt: Date;
    users: {
        total: number;
        active30d: number;
        ownersTotal: number;
        ownersActive30d: number;
    };
    dealerships: {
        total: number;
        active: number;
        paused: number;
        deactivated: number;
    };
    performance: {
        totalLessonsCompleted: number;
        averageScore: number | null;
        totalXp: number;
    };
    roleCounts: Record<string, number>;
    rows: SystemReportUserRow[];
};

export async function getSystemReport(requester: User): Promise<SystemReport> {
    if (!['Admin', 'Developer'].includes(requester.role)) {
        throw new Error('Forbidden: only Admin/Developer can run system reports.');
    }

    const now = new Date();
    const activeSince = subDays(now, 30);
    const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

    if (isTouringUser(requester.userId)) {
        const tour = await getTourData();
        const roleCounts: Record<string, number> = {};
        const dealershipNameById = new Map<string, string>();
        tour.dealerships.forEach((d) => dealershipNameById.set(d.id, d.name));
        tour.users.forEach((u) => {
            roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
        });

        const rows: SystemReportUserRow[] = tour.users.map((u) => {
            const logs = tour.lessonLogs
                .filter((l) => l.userId === u.userId)
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            const lastInteraction = logs[0]?.timestamp || null;
            const isActive30d = !!lastInteraction && lastInteraction > activeSince;
            const avgScore = logs.length
                ? Math.round(
                    logs.reduce((sum, log) => {
                        const total = cxTraits.reduce((acc, trait) => acc + (log[trait] || 0), 0);
                        return sum + total / cxTraits.length;
                    }, 0) / logs.length
                )
                : null;
            return {
                userId: u.userId,
                name: u.name,
                email: u.email,
                role: u.role,
                dealershipIds: u.dealershipIds || [],
                dealershipNames: (u.dealershipIds || []).map((id) => dealershipNameById.get(id) || id),
                subscriptionStatus: u.subscriptionStatus,
                lessonsCompleted: logs.length,
                totalXp: u.xp || 0,
                avgScore,
                lastInteraction,
                isActive30d,
            };
        });

        const owners = rows.filter((r) => r.role === 'Owner');
        const allLogs = tour.lessonLogs;
        const overallAvg = allLogs.length
            ? Math.round(
                allLogs.reduce((sum, log) => {
                    const total = cxTraits.reduce((acc, trait) => acc + (log[trait] || 0), 0);
                    return sum + total / cxTraits.length;
                }, 0) / allLogs.length
            )
            : null;

        return {
            generatedAt: now,
            users: {
                total: rows.length,
                active30d: rows.filter((r) => r.isActive30d).length,
                ownersTotal: owners.length,
                ownersActive30d: owners.filter((r) => r.isActive30d).length,
            },
            dealerships: {
                total: tour.dealerships.length,
                active: tour.dealerships.filter((d) => d.status === 'active').length,
                paused: tour.dealerships.filter((d) => d.status === 'paused').length,
                deactivated: tour.dealerships.filter((d) => d.status === 'deactivated').length,
            },
            performance: {
                totalLessonsCompleted: allLogs.length,
                averageScore: overallAvg,
                totalXp: rows.reduce((sum, r) => sum + r.totalXp, 0),
            },
            roleCounts,
            rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
        };
    }

    const usersCollection = collection(db, 'users');
    const dealershipsCollection = collection(db, 'dealerships');

    let users: User[];
    let dealerships: Dealership[];
    try {
        const [usersSnapshot, dealershipsSnapshot] = await Promise.all([
            getDocs(usersCollection),
            getDocs(dealershipsCollection),
        ]);
        users = usersSnapshot.docs.map((d) => ({ ...(d.data() as any), userId: d.id } as User));
        dealerships = dealershipsSnapshot.docs.map((d) => ({ ...(d.data() as any), id: d.id } as Dealership));
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({ path: 'users/dealerships', operation: 'list' });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const logsPerUser = await Promise.all(users.map((u) => getConsultantActivity(u.userId).catch(() => [] as LessonLog[])));

    const roleCounts: Record<string, number> = {};
    users.forEach((u) => {
        roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
    });
    const dealershipNameById = new Map<string, string>();
    dealerships.forEach((d) => dealershipNameById.set(d.id, d.name));

    const rows: SystemReportUserRow[] = users.map((u, index) => {
        const logs = logsPerUser[index];
        const lastInteraction = logs[0]?.timestamp || null;
        const isActive30d = !!lastInteraction && lastInteraction > activeSince;
        const avgScore = logs.length
            ? Math.round(
                logs.reduce((sum, log) => {
                    const total = cxTraits.reduce((acc, trait) => acc + (log[trait] || 0), 0);
                    return sum + total / cxTraits.length;
                }, 0) / logs.length
            )
            : null;

        return {
            userId: u.userId,
            name: u.name || '',
            email: u.email || '',
            role: u.role,
            dealershipIds: u.dealershipIds || [],
            dealershipNames: (u.dealershipIds || []).map((id) => dealershipNameById.get(id) || id),
            subscriptionStatus: u.subscriptionStatus,
            lessonsCompleted: logs.length,
            totalXp: u.xp || 0,
            avgScore,
            lastInteraction,
            isActive30d,
        };
    });

    const allLogs = logsPerUser.flat();
    const overallAvg = allLogs.length
        ? Math.round(
            allLogs.reduce((sum, log) => {
                const total = cxTraits.reduce((acc, trait) => acc + (log[trait] || 0), 0);
                return sum + total / cxTraits.length;
            }, 0) / allLogs.length
        )
        : null;
    const owners = rows.filter((r) => r.role === 'Owner');

    return {
        generatedAt: now,
        users: {
            total: rows.length,
            active30d: rows.filter((r) => r.isActive30d).length,
            ownersTotal: owners.length,
            ownersActive30d: owners.filter((r) => r.isActive30d).length,
        },
        dealerships: {
            total: dealerships.length,
            active: dealerships.filter((d) => d.status === 'active').length,
            paused: dealerships.filter((d) => d.status === 'paused').length,
            deactivated: dealerships.filter((d) => d.status === 'deactivated').length,
        },
        performance: {
            totalLessonsCompleted: allLogs.length,
            averageScore: overallAvg,
            totalXp: rows.reduce((sum, r) => sum + r.totalXp, 0),
        },
        roleCounts,
        rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
    };
}


export async function getManageableUsers(managerId: string): Promise<User[]> {
    if (isTouringUser(managerId)) {
        const tourData = await getTourData();
        const manager = tourData.users.find(u => u.userId === managerId);
        if (!manager) return [];
        const manageableRoles = getTeamMemberRoles(manager.role);

        return tourData.users.filter(u => {
            if (u.userId === managerId) return false;
            if (!manageableRoles.includes(u.role)) return false;
            if (manager.role === 'Owner' || manager.role === 'Admin' || manager.role === 'Developer') return true; // Can manage across all dealerships
            const inManagedDealership = u.dealershipIds.some(id => manager.dealershipIds.includes(id));
            return inManagedDealership;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const manager = await getUserById(managerId);
    if (!manager) return [];

    const manageableRoles = getTeamMemberRoles(manager.role);
    const usersCollection = collection(db, 'users');
    
    let allUsers: User[];
    try {
        const snapshot = await getDocs(usersCollection);
        allUsers = snapshot.docs.map(d => ({ ...(d.data() as any), userId: d.id } as User));
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
    if (isTouringUser(userId)) {
        const { earnedBadges } = await getTourData();
        const userEarnedBadges = earnedBadges[userId] || [];
        const badgeIds = userEarnedBadges.map(b => b.badgeId);
        return allBadges.filter(b => badgeIds.includes(b.id));
    }
    
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
    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.status = status;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

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
     if (isTouringUser(sender.userId)) {
        // Mock message creation for tour mode
        return {
            id: `tour-msg-${Math.random()}`,
            senderId: sender.userId,
            senderName: sender.name,
            timestamp: new Date(),
            content,
            ...target,
        };
    }
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
     if (isTouringUser(user.userId)) {
        // In tour mode, return a default welcome message.
        return [
            {
                id: 'tour-welcome-msg',
                senderId: 'autodrive-ai',
                senderName: 'AutoDrive System',
                timestamp: new Date(),
                content: `Welcome to your tour as a ${user.role}! Use the Tour Control Panel to explore different features.`,
                scope: 'global',
                targetId: 'all'
            }
        ]
    }
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
