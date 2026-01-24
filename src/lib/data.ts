

import { isToday, subDays, isSameDay } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge, Address, Message, MessageTargetScope } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from './firebase'; // Assuming db is your exported Firestore instance

// --- MOCK DATABASE (to be replaced) ---

// --- HELPER FUNCTIONS ---

const usersCollection = collection(db, 'users');
const dealershipsCollection = collection(db, 'dealerships');
const lessonsCollection = collection(db, 'lessons');
const invitationsCollection = collection(db, 'emailInvitations');
const assignmentsCollection = collection(db, 'lessonAssignments');
const messagesCollection = collection(db, 'messages');

const getCollectionData = async <T>(collectionRef: any): Promise<T[]> => {
    const snapshot = await getDocs(collectionRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
};

const getDataById = async <T>(collectionRef: any, id: string): Promise<T | null> => {
    const docRef = doc(collectionRef, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ ...docSnap.data(), id: docSnap.id } as T) : null;
};

// A list of developer and demo emails that can be auto-created.
const seedUserEmails: Record<string, UserRole> = {
    // Quick Login
    'consultant@autodrive.com': 'Sales Consultant',
    'manager@autodrive.com': 'manager',
    'service.writer@autodrive.com': 'Service Writer',
    'service.manager@autodrive.com': 'Service Manager',
    'finance.manager@autodrive.com': 'Finance Manager',
    'parts.consultant@autodrive.com': 'Parts Consultant',
    'parts.manager@autodrive.com': 'Parts Manager',
    'gm@autodrive.com': 'General Manager',
    'owner@autodrive.com': 'Owner',
    'trainer@autoknerd.com': 'Trainer',
    'admin@autoknerd.com': 'Admin',
    // Tour Users
    'consultant.demo@autodrive.com': 'Sales Consultant',
    'service.writer.demo@autodrive.com': 'Service Writer',
    'owner.demo@autodrive.com': 'Owner',
};

async function createSeedUser(email: string, role: UserRole, password: string): Promise<User> {
    const auth = getAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUserId = userCredential.user.uid;

    const isHq = email.endsWith('@autoknerd.com');
    const dealershipQuery = query(dealershipsCollection, where("name", "==", isHq ? "AutoKnerd HQ" : "AutoDrive Demo Dealership"));
    let dealershipId = '';
    const dSnapshot = await getDocs(dealershipQuery);
    if(dSnapshot.empty) {
        const newDealershipRef = doc(dealershipsCollection);
        dealershipId = newDealershipRef.id;
        const newDealership: Dealership = {
            id: dealershipId,
            name: isHq ? "AutoKnerd HQ" : "AutoDrive Demo Dealership",
            status: 'active',
            address: {
                street: '123 AI Lane',
                city: 'Cybertown',
                state: 'CA',
                zip: '90210'
            }
        };
        await setDoc(newDealershipRef, newDealership);
    } else {
        dealershipId = dSnapshot.docs[0].id;
    }


    const name = role.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const newUser: User = {
        userId: newUserId,
        name: `${name} User`,
        email: email,
        role: role,
        dealershipIds: [dealershipId],
        avatarUrl: 'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
        xp: 0,
        brand: 'Ford',
        isPrivate: false,
        isPrivateFromOwner: false,
        memberSince: new Date().toISOString(),
        subscriptionStatus: 'active', // Give seed users active subscription
    };

    await setDoc(doc(usersCollection, newUserId), newUser);
    return newUser;
}


// AUTH
export async function authenticateUser(email: string, pass: string): Promise<User | null> {
    const auth = getAuth();
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = await getUserById(userCredential.user.uid);
        return user;
    } catch (error: any) {
        const roleForEmail = seedUserEmails[email.toLowerCase()];

        // If it's not a known seed user, re-throw the original error.
        if (!roleForEmail) {
            console.error(`Authentication failed for ${email}:`, error.message);
            throw error;
        }

        // For seed users, a login failure might mean they need to be created.
        // This handles 'auth/user-not-found' and 'auth/invalid-credential' (in case the user was deleted from auth but not the db, or for enumeration resistance).
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
             try {
                console.log(`Attempting to create seed user '${email}' after login failure.`);
                const newUser = await createSeedUser(email.toLowerCase(), roleForEmail, pass);
                // createUserWithEmailAndPassword automatically signs the user in.
                // The onAuthStateChanged listener will handle app state updates.
                return newUser;
            } catch (creationError: any) {
                // This case happens if the initial error was 'auth/invalid-credential' because the user *does* exist, but with the wrong password.
                if (creationError.code === 'auth/email-already-in-use') {
                    const specificError = new Error(`Login failed for seed user. The user '${email}' exists but the password provided is incorrect. You may need to delete this user from the Firebase Authentication console to allow automatic re-creation with the correct password.`);
                    console.error(specificError.message);
                    throw specificError; // Throw the more descriptive error to the user.
                }
                // Handle other potential errors during creation.
                console.error(`Failed to create seed user '${email}':`, creationError.message);
                throw creationError;
            }
        }
        
        // For any other unhandled errors during the initial sign-in attempt.
        console.error(`Authentication failed for ${email}:`, error.message);
        throw error;
    }
}

export async function getUserById(userId: string): Promise<User | null> {
    return getDataById<User>(usersCollection, userId);
}


export async function findUserByEmail(email: string, requestingUserId: string): Promise<User | null> {
     const q = query(usersCollection, where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);
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

export async function redeemInvitation(token: string, name: string, email: string, brand: string, password: string): Promise<User> {
    const auth = getAuth();
    const invitation = await getDataById<EmailInvitation>(invitationsCollection, token);
    
    if (!invitation) throw new Error("Invalid invitation link.");
    if (invitation.claimed) throw new Error("This invitation has already been used.");
    if (invitation.email.toLowerCase() !== email.toLowerCase()) throw new Error("This invitation is for a different email address.");

    const userQuery = query(usersCollection, where("email", "==", email.toLowerCase()));
    const userSnapshot = await getDocs(userQuery);
    if (!userSnapshot.empty) {
        throw new Error("An account with this email already exists.");
    }
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUserId = userCredential.user.uid;

    const newUser: User = {
        userId: newUserId,
        name: name,
        email: email,
        role: invitation.role,
        dealershipIds: [invitation.dealershipId],
        avatarUrl: 'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
        xp: 0,
        brand: brand,
        isPrivate: false,
        isPrivateFromOwner: false,
        memberSince: new Date().toISOString(),
        subscriptionStatus: 'inactive',
    };

    const batch = writeBatch(db);
    batch.set(doc(usersCollection, newUserId), newUser);
    batch.update(doc(invitationsCollection, token), { claimed: true });
    
    await batch.commit();
    return newUser;
}

export async function getInvitationByToken(token: string): Promise<EmailInvitation | null> {
    return getDataById<EmailInvitation>(invitationsCollection, token);
}

export async function updateUser(userId: string, data: Partial<Omit<User, 'userId' | 'role' | 'xp' | 'dealershipIds'>>): Promise<User> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, data);
    const updatedUser = await getDoc(userRef);
    return { ...updatedUser.data(), id: updatedUser.id } as User;
}

export async function updateUserDealerships(userId: string, newDealershipIds: string[]): Promise<User> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, { dealershipIds: newDealershipIds });
    const updatedUser = await getDoc(userRef);
    return { ...updatedUser.data(), id: updatedUser.id } as User;
}

export async function deleteUser(userId: string): Promise<void> {
    const batch = writeBatch(db);

    batch.delete(doc(usersCollection, userId));

    const logsQuery = query(collection(db, `users/${userId}/lessonLogs`));
    const logsSnapshot = await getDocs(logsQuery);
    logsSnapshot.forEach(logDoc => batch.delete(logDoc.ref));

    const assignmentsQuery = query(assignmentsCollection, where("userId", "==", userId));
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    assignmentsSnapshot.forEach(assignDoc => batch.delete(assignDoc.ref));
    
    const badgesQuery = query(collection(db, `users/${userId}/earnedBadges`));
    const badgesSnapshot = await getDocs(badgesQuery);
    badgesSnapshot.forEach(badgeDoc => batch.delete(badgeDoc.ref));

    await batch.commit();
}


export async function updateUserSubscriptionStatus(stripeCustomerId: string, newStatus: 'active' | 'inactive'): Promise<User | null> {
    const q = query(usersCollection, where("stripeCustomerId", "==", stripeCustomerId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const userDoc = snapshot.docs[0];
    await updateDoc(userDoc.ref, { subscriptionStatus: newStatus });
    return { ...userDoc.data(), id: userDoc.id, subscriptionStatus: newStatus } as User;
}


// LESSONS
export async function getLessons(role: LessonRole): Promise<Lesson[]> {
    const q = query(lessonsCollection, where("role", "in", [role, 'global']));
    return getCollectionData<Lesson>(q);
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
    return getDataById<Lesson>(lessonsCollection, lessonId);
}

export async function getDealershipById(dealershipId: string): Promise<Dealership | null> {
    return getDataById<Dealership>(dealershipsCollection, dealershipId);
}

export async function createLesson(lessonData: {
    title: string;
    category: LessonCategory;
    associatedTrait: CxTrait;
    targetRole: UserRole | 'global';
    scenario: string;
}): Promise<Lesson> {
    const newLessonRef = doc(lessonsCollection);
    const newLesson: Lesson = {
        lessonId: newLessonRef.id,
        title: lessonData.title,
        category: lessonData.category,
        associatedTrait: lessonData.associatedTrait,
        role: lessonData.targetRole as LessonRole,
        customScenario: lessonData.scenario,
    };
    await setDoc(newLessonRef, newLesson);
    return newLesson;
}

export async function getAssignedLessons(userId: string): Promise<Lesson[]> {
    const q = query(assignmentsCollection, where("userId", "==", userId), where("completed", "==", false));
    const assignments = await getCollectionData<LessonAssignment>(q);
    if (assignments.length === 0) return [];
    
    const lessonIds = assignments.map(a => a.lessonId);
    const lessonsQuery = query(lessonsCollection, where("lessonId", "in", lessonIds));
    return getCollectionData<Lesson>(lessonsQuery);
}

export async function assignLesson(userId: string, lessonId: string, assignerId: string): Promise<LessonAssignment> {
    const assignmentRef = doc(assignmentsCollection);
    const newAssignment: LessonAssignment = {
        assignmentId: assignmentRef.id,
        userId,
        lessonId,
        assignerId,
        timestamp: new Date(),
        completed: false,
    };
    await setDoc(assignmentRef, newAssignment);
    return newAssignment;
}


export async function getConsultantActivity(userId: string): Promise<LessonLog[]> {
    const logsCollection = collection(db, `users/${userId}/lessonLogs`);
    const logs = await getCollectionData<any>(logsCollection);
    return logs.map(log => ({...log, timestamp: log.timestamp.toDate()})).sort((a,b) => b.timestamp - a.timestamp);
}

export async function getDailyLessonLimits(userId: string): Promise<{ recommendedTaken: boolean, otherTaken: boolean }> {
    const logsCollection = collection(db, `users/${userId}/lessonLogs`);
    const logs = await getCollectionData<any>(logsCollection);
    
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
    
    const assignmentQuery = query(assignmentsCollection, where("userId", "==", data.userId), where("lessonId", "==", data.lessonId), where("completed", "==", false));
    const assignmentSnapshot = await getDocs(assignmentQuery);
    if (!assignmentSnapshot.empty) {
        const assignmentDoc = assignmentSnapshot.docs[0];
        batch.update(assignmentDoc.ref, { completed: true });
        awardBadge('managers-pick');
    }

    batch.set(logRef, newLogData);
    batch.update(doc(usersCollection, data.userId), { xp: newXp });

    await batch.commit();
    
    const updatedUserDoc = await getDoc(doc(usersCollection, data.userId));
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
            return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner'];
        case 'Admin':
            return ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Trainer'];
        default:
            return [];
    }
};

export async function getDealerships(user?: User): Promise<Dealership[]> {
    let q = query(dealershipsCollection);
    if (user && user.role === 'Trainer') {
        q = query(dealershipsCollection, where("trainerId", "==", user.userId));
    }
    
    const dealerships = await getCollectionData<Dealership>(q);
    
    let relevantDealerships = dealerships.filter(d => d.id !== 'autoknerd-hq');

    if (user && user.role !== 'Admin') {
        relevantDealerships = relevantDealerships.filter(d => d.status !== 'deactivated');
    }

    return relevantDealerships.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getManagerStats(dealershipId: string, userRole: UserRole): Promise<{ totalLessons: number; avgScores: Record<CxTrait, number> | null }> {
    const selectedDealership = await getDealershipById(dealershipId);
    if (selectedDealership?.status === 'paused') {
        return { totalLessons: 0, avgScores: null };
    }

    const teamRoles = getTeamMemberRoles(userRole);
    let userQuery;

    if ((['Owner', 'Admin', 'Trainer', 'General Manager'].includes(userRole)) && dealershipId === 'all') {
        userQuery = query(usersCollection, where("role", "in", teamRoles));
    } else {
        userQuery = query(usersCollection, where("dealershipIds", "array-contains", dealershipId), where("role", "in", teamRoles));
    }
    
    const teamUsers = await getCollectionData<User>(userQuery);
    if (teamUsers.length === 0) return { totalLessons: 0, avgScores: null };

    const teamUserIds = teamUsers.map(u => u.userId);
    let allLogs: LessonLog[] = [];
    
    for(const userId of teamUserIds) {
        const userLogs = await getConsultantActivity(userId);
        allLogs = allLogs.concat(userLogs);
    }
    
    if (allLogs.length === 0) {
        return { totalLessons: 0, avgScores: null };
    }

    const totalLessons = allLogs.length;
    const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

    const avgScores = cxTraits.reduce((acc, trait) => {
        const totalScore = allLogs.reduce((sum, log) => sum + log[trait], 0);
        acc[trait] = Math.round(totalScore / totalLessons);
        return acc;
    }, {} as Record<CxTrait, number>);

    return { totalLessons, avgScores };
}

export async function getTeamActivity(dealershipId: string, userRole: UserRole): Promise<{ consultant: User; lessonsCompleted: number; totalXp: number; avgScore: number; }[]> {
    const selectedDealership = await getDealershipById(dealershipId);
    if (selectedDealership?.status === 'paused') {
        return [];
    }

    const teamRoles = getTeamMemberRoles(userRole);
    let userQuery;

    if (['Owner', 'Admin', 'Trainer', 'General Manager'].includes(userRole) && dealershipId === 'all') {
        userQuery = query(usersCollection, where("role", "in", teamRoles));
    } else {
        userQuery = query(usersCollection, where("dealershipIds", "array-contains", dealershipId), where("role", "in", teamRoles));
    }
    const teamMembers = await getCollectionData<User>(userQuery);
    
    const activityPromises = teamMembers.map(async (member) => {
        const memberLogs = await getConsultantActivity(member.userId);
        if (memberLogs.length === 0) {
            return { consultant: member, lessonsCompleted: 0, totalXp: member.xp, avgScore: 0 };
        }

        const lessonsCompleted = memberLogs.length;
        const totalXp = member.xp;
        
        const totalScore = memberLogs.reduce((sum, log) => {
            return sum + (log.empathy + log.listening + log.trust + log.followUp + log.closing + log.relationshipBuilding);
        }, 0);
        
        const avgScore = Math.round(totalScore / (memberLogs.length * 6));

        return { consultant: member, lessonsCompleted, totalXp, avgScore };
    });

    const activity = await Promise.all(activityPromises);
    return activity.sort((a, b) => b.totalXp - a.totalXp);
}

export async function getManageableUsers(managerId: string): Promise<User[]> {
    const manager = await getUserById(managerId);
    if (!manager) return [];

    const manageableRoles = getTeamMemberRoles(manager.role);
    const allUsers = await getCollectionData<User>(usersCollection);

    const manageableUsers = allUsers.filter(u => {
        if (u.userId === managerId) return false;
        if (!manageableRoles.includes(u.role)) return false;
        if (u.dealershipIds.length === 0) return true;
        const inManagedDealership = u.dealershipIds.some(id => manager.dealershipIds.includes(id));
        return inManagedDealership;
    });

    return manageableUsers.sort((a, b) => a.name.localeCompare(b.name));
}


export async function sendInvitation(
    dealershipName: string, 
    userEmail: string, 
    role: UserRole,
    creatorId: string,
    address?: Partial<Address>
): Promise<void> {
    const dQuery = query(dealershipsCollection, where("name", "==", dealershipName));
    const dSnapshot = await getDocs(dQuery);

    let dealershipId: string;

    if (dSnapshot.empty) {
        const creator = await getUserById(creatorId);
        if (!creator || !['Admin', 'Trainer'].includes(creator.role)) {
            throw new Error('You do not have permission to create a new dealership.');
        }
        
        const newDealershipRef = doc(dealershipsCollection);
        dealershipId = newDealershipRef.id;

        const newDealership: Dealership = {
            id: dealershipId,
            name: dealershipName,
            status: 'active',
            address: address as Address,
            trainerId: creator.role === 'Trainer' ? creatorId : undefined
        };
        await setDoc(newDealershipRef, newDealership);
    } else {
        dealershipId = dSnapshot.docs[0].id;
    }

    const token = doc(invitationsCollection).id;
    
    const newInvitation: EmailInvitation = {
        token,
        dealershipId: dealershipId,
        role: role,
        email: userEmail,
        claimed: false,
    };
    
    await setDoc(doc(invitationsCollection, token), newInvitation);
    console.log(`Invitation created with token: ${token}`);
}


// BADGES
export async function getEarnedBadgesByUserId(userId: string): Promise<Badge[]> {
    const badgesCollection = collection(db, `users/${userId}/earnedBadges`);
    const badgeDocs = await getCollectionData<EarnedBadge>(badgesCollection);
    const badgeIds = badgeDocs.map(b => b.badgeId);
    return allBadges.filter(b => badgeIds.includes(b.id));
}

// DEALERSHIPS
export async function updateDealershipStatus(dealershipId: string, status: 'active' | 'paused' | 'deactivated'): Promise<Dealership> {
    const dealershipRef = doc(dealershipsCollection, dealershipId);
    await updateDoc(dealershipRef, { status });

    if (status === 'deactivated') {
        const usersToUpdateQuery = query(usersCollection, where("dealershipIds", "array-contains", dealershipId));
        const userSnapshot = await getDocs(usersToUpdateQuery);
        const batch = writeBatch(db);
        userSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            const newIds = userData.dealershipIds.filter(id => id !== dealershipId);
            batch.update(userDoc.ref, { dealershipIds: newIds });
        });
        await batch.commit();
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
    await setDoc(messageRef, { ...newMessage, timestamp: Timestamp.fromDate(newMessage.timestamp) });
    return newMessage;
}

export async function getMessagesForUser(user: User): Promise<Message[]> {
    const fourteenDaysAgo = subDays(new Date(), 14);
    let relevantMessages: Message[] = [];
    
    const globalQuery = query(messagesCollection, where("scope", "==", "global"), where("timestamp", ">=", Timestamp.fromDate(fourteenDaysAgo)));
    const globalSnap = await getDocs(globalQuery);
    globalSnap.forEach(doc => relevantMessages.push({ ...doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate()} as Message));
    
    if(user.dealershipIds.length > 0) {
        const dealershipQuery = query(messagesCollection, where("scope", "==", "dealership"), where("targetId", "in", user.dealershipIds), where("timestamp", ">=", Timestamp.fromDate(fourteenDaysAgo)));
        const dealershipSnap = await getDocs(dealershipQuery);
        dealershipSnap.forEach(doc => relevantMessages.push({ ...doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate()} as Message));

        const departmentQuery = query(messagesCollection, where("scope", "==", "department"), where("targetId", "in", user.dealershipIds), where("targetRole", "==", user.role), where("timestamp", ">=", Timestamp.fromDate(fourteenDaysAgo)));
        const departmentSnap = await getDocs(departmentQuery);
        departmentSnap.forEach(doc => relevantMessages.push({ ...doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate()} as Message));
    }
    
    const uniqueMessages = Array.from(new Map(relevantMessages.map(item => [item['id'], item])).values());
    
    return uniqueMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
