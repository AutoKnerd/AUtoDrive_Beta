
'use client';
import { isToday, subDays } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge, Address, Message, MessageTargetScope, PendingInvitation, Ratings, InteractionSeverity } from './definitions';
import { lessonCategoriesByRole, noPersonalDevelopmentRoles, allRoles } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp, Firestore, orderBy, limit, runTransaction } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateTourData } from './tour-data';
import { initializeFirebase } from '@/firebase/init';
import { ALPHA, BASELINE, LAMBDA, clampRatings, updateRollingStats } from '@/lib/stats/updateRollingStats';
import { buildAutoRecommendedLesson, buildUniqueRecommendedTestingLesson } from '@/lib/lessons/auto-recommended';
import { clampPppLevel, getPppLessonsForLevel, getPppLevelBadge, getPppLevelXp, PPP_DAILY_PASS_LIMIT, PPP_TOUR_UNLOCKED_LESSON_COUNT } from '@/lib/ppp/definitions';
import { buildDefaultPppState, getNextPppLevel, getPppLevelKey, getPppUtcDateKey, normalizePppUserState } from '@/lib/ppp/state';
import { buildTrialWindow } from '@/lib/billing/trial';
import {
  clampSaasPppLevel,
  getSaasPppLessonsForLevel,
  getSaasPppLessonXp,
  sanitizeSaasLeadChannel,
  type SaasLeadChannel,
  type SaasPppPhase,
} from '@/lib/saas-ppp/definitions';
import {
  buildDefaultSaasPppState,
  getNextSaasPppLevel,
  getSaasPppLevelKey,
  normalizeSaasPppUserState,
} from '@/lib/saas-ppp/state';
import type { EnrollmentScope } from '@/lib/enrollment/role-scope';

// Initialize SDKs lazily or inside functions to ensure stability
const getFirebase = () => initializeFirebase();

let tourData: Awaited<ReturnType<typeof generateTourData>> | null = null;
const getTourData = async () => {
    if (!tourData) {
        tourData = await generateTourData();
    }
    return tourData;
}

const isTouringUser = (userId?: string): boolean => !!userId && userId.startsWith('tour-');
const hasDealershipAssignments = (user?: Pick<User, 'dealershipIds'> | null): boolean => {
    if (!user || !Array.isArray(user.dealershipIds)) return false;
    return user.dealershipIds.length > 0;
};
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

function getClientOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin.replace(/\/$/, '');
    }

    const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (configured) return configured.replace(/\/$/, '');

    return 'http://localhost:3000';
}

function getScopedDealershipIds(user: User, dealershipId?: string | null): string[] {
    if (dealershipId && dealershipId !== 'all') {
        return [dealershipId];
    }

    const combined = [...(user.dealershipIds || [])];
    if (user.selfDeclaredDealershipId) {
        combined.push(user.selfDeclaredDealershipId);
    }

    return Array.from(new Set(combined));
}

function isDealershipPppEnabled(dealership: Partial<Dealership> | null | undefined): boolean {
    return dealership?.status === 'active' && dealership?.enablePppProtocol === true;
}

function isDealershipSaasPppEnabled(dealership: Partial<Dealership> | null | undefined): boolean {
    return dealership?.status === 'active' && dealership?.enableSaasPppTraining === true;
}

export async function getPppAccessForUser(user: User, dealershipId?: string | null): Promise<boolean> {
    if (isTouringUser(user.userId)) {
        // Tour mode always has PPP enabled for guided testing.
        return true;
    }

    const scopedDealershipIds = getScopedDealershipIds(user, dealershipId);
    if (!scopedDealershipIds.length) return false;

    const { firestore: db } = getFirebase();
    const snapshots = await Promise.all(scopedDealershipIds.map((id) => getDoc(doc(db, 'dealerships', id)).catch(() => null)));
    return snapshots.some((snap) => snap?.exists() && isDealershipPppEnabled(snap.data() as Partial<Dealership>));
}

export async function getSaasPppAccessForUser(user: User, dealershipId?: string | null): Promise<boolean> {
    const scopedDealershipIds = getScopedDealershipIds(user, dealershipId);
    if (!scopedDealershipIds.length) return false;

    if (isTouringUser(user.userId)) {
        const { dealerships } = await getTourData();
        const dealershipMap = new Map(dealerships.map((dealership) => [dealership.id, dealership]));
        return scopedDealershipIds.some((id) => isDealershipSaasPppEnabled(dealershipMap.get(id)));
    }

    const { firestore: db } = getFirebase();
    const snapshots = await Promise.all(scopedDealershipIds.map((id) => getDoc(doc(db, 'dealerships', id)).catch(() => null)));
    return snapshots.some((snap) => snap?.exists() && isDealershipSaasPppEnabled(snap.data() as Partial<Dealership>));
}

function cloneUserStats(stats?: Partial<User['stats']>): Partial<User['stats']> | undefined {
    if (!stats) return undefined;
    return {
        empathy: stats.empathy ? { ...stats.empathy } : undefined,
        listening: stats.listening ? { ...stats.listening } : undefined,
        trust: stats.trust ? { ...stats.trust } : undefined,
        followUp: stats.followUp ? { ...stats.followUp } : undefined,
        closing: stats.closing ? { ...stats.closing } : undefined,
        relationship: stats.relationship ? { ...stats.relationship } : undefined,
    };
}

function cloneTourUser(user: User): User {
    const clonedPppLessonsPassed = user.ppp_lessons_passed
        ? Object.fromEntries(
            Object.entries(user.ppp_lessons_passed).map(([level, passed]) => [
                level,
                Array.isArray(passed) ? [...passed] : [],
            ])
        )
        : undefined;
    const clonedSaasPppLessonsPassed = user.saas_ppp_lessons_passed
        ? Object.fromEntries(
            Object.entries(user.saas_ppp_lessons_passed).map(([level, passed]) => [
                level,
                Array.isArray(passed) ? [...passed] : [],
            ])
        )
        : undefined;

    return {
        ...user,
        dealershipIds: [...(user.dealershipIds ?? [])],
        stats: cloneUserStats(user.stats),
        ppp_lessons_passed: clonedPppLessonsPassed,
        saas_ppp_lessons_passed: clonedSaasPppLessonsPassed,
    };
}

type LegacyLessonScores = {
    empathy: number;
    listening: number;
    trust: number;
    followUp: number;
    closing: number;
    relationshipBuilding: number;
};

function buildDefaultUserStats(now: Date = new Date()): User['stats'] {
    return {
        empathy: { score: BASELINE, lastUpdated: now },
        listening: { score: BASELINE, lastUpdated: now },
        trust: { score: BASELINE, lastUpdated: now },
        followUp: { score: BASELINE, lastUpdated: now },
        closing: { score: BASELINE, lastUpdated: now },
        relationship: { score: BASELINE, lastUpdated: now },
    };
}

function clampScore(value: number): number {
    if (!Number.isFinite(value)) return BASELINE;
    return Math.max(0, Math.min(100, value));
}

function toSafeDate(value: unknown, fallback: Date): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }

    if (value && typeof value === 'object') {
        const maybeTimestamp = value as { toDate?: () => Date };
        if (typeof maybeTimestamp.toDate === 'function') {
            const parsed = maybeTimestamp.toDate();
            if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
    }

    return fallback;
}

function applyTourRollingStatsUpdate(
    stats: User['stats'] | undefined,
    ratings: Ratings,
    now: Date
): {
    nextStats: User['stats'];
    before: Ratings;
    after: Ratings;
} {
    const baselineStats = buildDefaultUserStats(now);
    const sourceStats = stats ?? baselineStats;
    const msPerDay = 24 * 60 * 60 * 1000;

    const calc = (key: keyof Ratings) => {
        const currentStat = sourceStats?.[key];
        const before = clampScore(typeof currentStat?.score === 'number' ? currentStat.score : BASELINE);
        const lastUpdated = toSafeDate(currentStat?.lastUpdated, now);
        const deltaDays = Math.max(0, (now.getTime() - lastUpdated.getTime()) / msPerDay);
        const drifted = BASELINE + (before - BASELINE) * Math.exp(-LAMBDA * deltaDays);
        const after = clampScore((1 - ALPHA) * drifted + ALPHA * ratings[key]);

        return {
            before,
            after,
            stat: {
                score: after,
                lastUpdated: now,
            },
        };
    };

    const empathy = calc('empathy');
    const listening = calc('listening');
    const trust = calc('trust');
    const followUp = calc('followUp');
    const closing = calc('closing');
    const relationship = calc('relationship');

    return {
        nextStats: {
            empathy: empathy.stat,
            listening: listening.stat,
            trust: trust.stat,
            followUp: followUp.stat,
            closing: closing.stat,
            relationship: relationship.stat,
        },
        before: {
            empathy: empathy.before,
            listening: listening.before,
            trust: trust.before,
            followUp: followUp.before,
            closing: closing.before,
            relationship: relationship.before,
        },
        after: {
            empathy: empathy.after,
            listening: listening.after,
            trust: trust.after,
            followUp: followUp.after,
            closing: closing.after,
            relationship: relationship.after,
        },
    };
}

function normalizeSeverity(severity?: InteractionSeverity): InteractionSeverity {
    return severity === 'behavior_violation' ? 'behavior_violation' : 'normal';
}

function normalizeRatings(
    ratings?: Partial<Ratings>,
    legacyScores?: LegacyLessonScores
): Ratings {
    if (ratings) {
        return clampRatings(ratings);
    }

    if (legacyScores) {
        return clampRatings({
            empathy: legacyScores.empathy,
            listening: legacyScores.listening,
            trust: legacyScores.trust,
            followUp: legacyScores.followUp,
            closing: legacyScores.closing,
            relationship: legacyScores.relationshipBuilding,
        });
    }

    return clampRatings(undefined);
}

function toLegacyScores(ratings: Ratings): LegacyLessonScores {
    return {
        empathy: ratings.empathy,
        listening: ratings.listening,
        trust: ratings.trust,
        followUp: ratings.followUp,
        closing: ratings.closing,
        relationshipBuilding: ratings.relationship,
    };
}

function buildStatsSeedFromLegacyScores(scores: LegacyLessonScores, timestamp: Timestamp) {
    return {
        empathy: { score: clampRatings({ empathy: scores.empathy }).empathy, lastUpdated: timestamp },
        listening: { score: clampRatings({ listening: scores.listening }).listening, lastUpdated: timestamp },
        trust: { score: clampRatings({ trust: scores.trust }).trust, lastUpdated: timestamp },
        followUp: { score: clampRatings({ followUp: scores.followUp }).followUp, lastUpdated: timestamp },
        closing: { score: clampRatings({ closing: scores.closing }).closing, lastUpdated: timestamp },
        relationship: {
            score: clampRatings({ relationship: scores.relationshipBuilding }).relationship,
            lastUpdated: timestamp,
        },
    };
}

function getExistingRollingStatScores(user: User): number[] | null {
    const stats = user.stats;
    if (!stats) return null;

    const scores = [
        stats.empathy?.score,
        stats.listening?.score,
        stats.trust?.score,
        stats.followUp?.score,
        stats.closing?.score,
        stats.relationship?.score,
    ];

    if (scores.some(score => typeof score !== 'number' || !Number.isFinite(score))) {
        return null;
    }

    return scores as number[];
}

function looksLikeLegacyBootstrapStats(statScores: number[]): boolean {
    const min = Math.min(...statScores);
    const max = Math.max(...statScores);
    const allNearSame = max - min <= 0.25;
    const allNearBaseline = statScores.every(score => Math.abs(score - BASELINE) <= 3);
    return allNearSame && allNearBaseline;
}

function normalizeFlags(flags?: string[]): string[] {
    if (!Array.isArray(flags)) return [];
    return flags.filter(flag => typeof flag === 'string');
}

const MAX_NORMAL_XP_AWARD = 100;
const MAX_BEHAVIOR_XP_PENALTY = 100;

function sanitizeXpDelta(xpGained: number, severity: InteractionSeverity): number {
    const numericXp = Number.isFinite(xpGained) ? Math.round(xpGained) : 0;
    if (severity === 'behavior_violation') {
        if (numericXp > 0) return 0;
        return Math.max(-MAX_BEHAVIOR_XP_PENALTY, numericXp);
    }

    return Math.max(0, Math.min(MAX_NORMAL_XP_AWARD, numericXp));
}

function computeNextXp(currentXp: number, xpDelta: number, severity: InteractionSeverity): number {
    if (severity === 'behavior_violation') {
        return currentXp + xpDelta;
    }

    return Math.max(0, currentXp + xpDelta);
}

type LessonStatChange = {
    before: number;
    after: number;
    delta: number;
    rating: number;
};

export type LessonCompletionDetails = {
    severity: InteractionSeverity;
    ratingsUsed: Ratings;
    statChanges?: {
        empathy: LessonStatChange;
        listening: LessonStatChange;
        trust: LessonStatChange;
        followUp: LessonStatChange;
        closing: LessonStatChange;
        relationshipBuilding: LessonStatChange;
    };
};

export type CxRatingsUpdateDetails = {
    updatedUser: User;
    ratingsUsed: Ratings;
    statChanges: NonNullable<LessonCompletionDetails['statChanges']>;
};

export async function applyCxRatingsToUser(
    userId: string,
    ratings?: Partial<Ratings>
): Promise<CxRatingsUpdateDetails> {
    const normalizedRatings = normalizeRatings(ratings);

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');

        const now = new Date();
        const statsResult = applyTourRollingStatsUpdate(user.stats, normalizedRatings, now);
        user.stats = statsResult.nextStats;

        return {
            updatedUser: cloneTourUser(user),
            ratingsUsed: normalizedRatings,
            statChanges: {
                empathy: {
                    before: statsResult.before.empathy,
                    after: statsResult.after.empathy,
                    delta: statsResult.after.empathy - statsResult.before.empathy,
                    rating: normalizedRatings.empathy,
                },
                listening: {
                    before: statsResult.before.listening,
                    after: statsResult.after.listening,
                    delta: statsResult.after.listening - statsResult.before.listening,
                    rating: normalizedRatings.listening,
                },
                trust: {
                    before: statsResult.before.trust,
                    after: statsResult.after.trust,
                    delta: statsResult.after.trust - statsResult.before.trust,
                    rating: normalizedRatings.trust,
                },
                followUp: {
                    before: statsResult.before.followUp,
                    after: statsResult.after.followUp,
                    delta: statsResult.after.followUp - statsResult.before.followUp,
                    rating: normalizedRatings.followUp,
                },
                closing: {
                    before: statsResult.before.closing,
                    after: statsResult.after.closing,
                    delta: statsResult.after.closing - statsResult.before.closing,
                    rating: normalizedRatings.closing,
                },
                relationshipBuilding: {
                    before: statsResult.before.relationship,
                    after: statsResult.after.relationship,
                    delta: statsResult.after.relationship - statsResult.before.relationship,
                    rating: normalizedRatings.relationship,
                },
            },
        };
    }

    const { firestore: db } = getFirebase();
    const userRef = doc(db, 'users', userId);
    const rollingResult = await updateRollingStats(userId, normalizedRatings);
    const updatedUserSnap = await getDoc(userRef);
    if (!updatedUserSnap.exists()) {
        throw new Error('User not found after CX ratings update.');
    }

    return {
        updatedUser: { ...(updatedUserSnap.data() as User), userId: updatedUserSnap.id },
        ratingsUsed: normalizedRatings,
        statChanges: {
            empathy: {
                before: rollingResult.before.empathy,
                after: rollingResult.after.empathy,
                delta: rollingResult.after.empathy - rollingResult.before.empathy,
                rating: normalizedRatings.empathy,
            },
            listening: {
                before: rollingResult.before.listening,
                after: rollingResult.after.listening,
                delta: rollingResult.after.listening - rollingResult.before.listening,
                rating: normalizedRatings.listening,
            },
            trust: {
                before: rollingResult.before.trust,
                after: rollingResult.after.trust,
                delta: rollingResult.after.trust - rollingResult.before.trust,
                rating: normalizedRatings.trust,
            },
            followUp: {
                before: rollingResult.before.followUp,
                after: rollingResult.after.followUp,
                delta: rollingResult.after.followUp - rollingResult.before.followUp,
                rating: normalizedRatings.followUp,
            },
            closing: {
                before: rollingResult.before.closing,
                after: rollingResult.after.closing,
                delta: rollingResult.after.closing - rollingResult.before.closing,
                rating: normalizedRatings.closing,
            },
            relationshipBuilding: {
                before: rollingResult.before.relationship,
                after: rollingResult.after.relationship,
                delta: rollingResult.after.relationship - rollingResult.before.relationship,
                rating: normalizedRatings.relationship,
            },
        },
    };
}

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
    const { firestore: db, auth } = getFirebase();
    if (isTouringUser(userId)) {
        const { users } = await getTourData();
        const tourUser = users.find(u => u.userId === userId);
        return tourUser ? cloneTourUser(tourUser) : null;
    }

    const authTourId = auth.currentUser?.uid === userId
        ? getTourIdFromEmail(auth.currentUser.email)
        : null;
    if (authTourId) {
        const tourUser = (await getTourData()).users.find(u => u.userId === authTourId);
        if (tourUser) return cloneTourUser(tourUser);
    }

    const userDoc = await getDoc(doc(db, 'users', userId)).catch(() => null);
    if (userDoc && userDoc.exists()) {
        const tourId = getTourIdFromEmail(userDoc.data()?.email);
        if (tourId) {
             const tourUser = (await getTourData()).users.find(u => u.userId === tourId);
             return tourUser ? cloneTourUser(tourUser) : null;
        }
    }
    
    return getDataById<User>(db, 'users', userId);
}

type CreateUserProfileOptions = {
    // For direct individual signups, require Stripe Checkout before trial starts.
    requireCheckoutForTrial?: boolean;
};

export async function createUserProfile(
    userId: string,
    name: string,
    email: string,
    role: UserRole,
    dealershipIds: string[],
    options?: CreateUserProfileOptions
): Promise<User> {
    const { firestore: db } = getFirebase();
    const now = new Date();
    if (['Admin', 'Developer', 'Trainer'].includes(role) && dealershipIds.length === 0) {
        const hqDealershipId = 'autoknerd-hq';
        dealershipIds.push(hqDealershipId);
    }

    let pppEnabled = false;
    let saasPppEnabled = false;
    if (dealershipIds.length > 0) {
        const dealershipSnapshots = await Promise.all(
            Array.from(new Set(dealershipIds)).map((id) => getDoc(doc(db, 'dealerships', id)).catch(() => null))
        );
        pppEnabled = dealershipSnapshots.some((snap) => (
            snap?.exists() && isDealershipPppEnabled(snap.data() as Partial<Dealership>)
        ));
        saasPppEnabled = dealershipSnapshots.some((snap) => (
            snap?.exists() && isDealershipSaasPppEnabled(snap.data() as Partial<Dealership>)
        ));
    }

    const trialWindow = buildTrialWindow(now);
    const isPrivilegedRole = ['Admin', 'Developer'].includes(role);
    const shouldRequireCheckoutForTrial = Boolean(
        options?.requireCheckoutForTrial
        && !isPrivilegedRole
        && dealershipIds.length === 0
    );

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
        memberSince: now.toISOString(),
        subscriptionStatus: isPrivilegedRole
            ? 'active'
            : (shouldRequireCheckoutForTrial ? 'inactive' : 'trialing'),
        trialStartedAt: isPrivilegedRole || shouldRequireCheckoutForTrial
            ? null
            : trialWindow.trialStartedAt,
        trialEndsAt: isPrivilegedRole || shouldRequireCheckoutForTrial
            ? null
            : trialWindow.trialEndsAt,
        stats: buildDefaultUserStats(now),
        ...buildDefaultPppState(pppEnabled),
        ...buildDefaultSaasPppState(saasPppEnabled),
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
    const { firestore: db } = getFirebase();
    if (isTouringUser(userId)) {
        const user = (await getTourData()).users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found after update");
        Object.assign(user, data);
        return { ...user };
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
    const { firestore: db } = getFirebase();
    if (isTouringUser(userId)) {
        const user = (await getTourData()).users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found");
        user.dealershipIds = newDealershipIds;
        return user;
    }
    
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, { dealershipIds: newDealershipIds });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: { dealershipIds: newDealershipIds },
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const updatedUser = await getDataById<User>(db, 'users', userId);
    if (!updatedUser) throw new Error("User not found after update");
    return updatedUser;
}

export async function deleteUser(userId: string): Promise<void> {
    const { firestore: db } = getFirebase();
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
        const trialWindow = buildTrialWindow(new Date());
        const newDealership: Dealership = {
            id: `tour-dealership-${Math.random()}`,
            name: dealershipData.name,
            status: 'active',
            address: dealershipData.address as Address,
            enableRetakeRecommendedTesting: false,
            enableNewRecommendedTesting: false,
            enablePppProtocol: false,
            enableSaasPppTraining: false,
            billingTier: 'sales_fi',
            billingSubscriptionStatus: 'trialing',
            billingTrialStartedAt: trialWindow.trialStartedAt,
            billingTrialEndsAt: trialWindow.trialEndsAt,
            billingUserCount: 0,
            billingOwnerAccountCount: 0,
            billingStoreCount: 1,
        };
        (await getTourData()).dealerships.push(newDealership);
        return newDealership;
    }

    throw new Error('Please use the admin form which calls the secure API endpoint.');
}

export async function getInvitationByToken(token: string): Promise<EmailInvitation | null> {
    const { firestore: db } = getFirebase();
    return getDataById<EmailInvitation>(db, 'emailInvitations', token);
}

export async function claimInvitation(token: string): Promise<void> {
    const { auth } = getFirebase();
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
    const { auth } = getFirebase();
    if (isTouringUser(inviterId)) return { url: `${getClientOrigin()}/register?token=tour-fake-token-${Math.random()}` };

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

export type EnrollmentLinkPreview = {
    token: string;
    dealershipId: string;
    dealershipName: string;
    allowedRoles: UserRole[];
};

export async function createDealershipEnrollmentLink(
    dealershipId: string,
    inviterId: string,
    enrollmentScope?: EnrollmentScope
): Promise<{ url: string; allowedRoles: UserRole[]; enrollmentScope?: EnrollmentScope }> {
    const { auth } = getFirebase();
    if (isTouringUser(inviterId)) {
        return {
            url: `${getClientOrigin()}/enroll?token=tour-enroll-${Math.random()}`,
            allowedRoles: ['Sales Consultant'],
            enrollmentScope: 'manager_and_under',
        };
    }

    const idToken = await auth.currentUser?.getIdToken(true);
    const response = await fetch('/api/admin/createEnrollmentLink', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ dealershipId, enrollmentScope }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'API Error while creating enrollment link.');
    }

    const responseData = await response.json();
    return {
        url: responseData.inviteUrl,
        allowedRoles: responseData.allowedRoles || [],
        enrollmentScope: responseData.enrollmentScope,
    };
}

export async function getEnrollmentLinkByToken(token: string): Promise<EnrollmentLinkPreview> {
    const response = await fetch(`/api/enrollment/${encodeURIComponent(token)}`, {
        cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Enrollment link is invalid or expired.');
    }

    return payload as EnrollmentLinkPreview;
}

export async function claimDealershipEnrollment(token: string, role: UserRole): Promise<void> {
    const { auth } = getFirebase();
    const idToken = await auth.currentUser?.getIdToken(true);
    const response = await fetch(`/api/enrollment/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token, role }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'Failed to claim enrollment link.');
    }
}

export async function getPendingInvitations(dealershipId: string, user: User): Promise<PendingInvitation[]> {
    const { auth } = getFirebase();
    if (isTouringUser(user.userId)) return [];
    if (!hasDealershipAssignments(user)) return [];

    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return [];

        const idToken = await currentUser.getIdToken(true);
        const params = new URLSearchParams({ dealershipId });
        const response = await fetch(`/api/admin/pendingInvitations?${params.toString()}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${idToken}` },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || 'Failed to fetch pending invitations.';
            
            // Soft handle common environment/auth errors
            if (errorMessage.includes('"aud" (audience) claim') || 
                errorMessage.includes('refresh access token') ||
                response.status === 503) {
                console.warn(`[getPendingInvitations] Degraded state: ${errorMessage}`);
                return [];
            }
            
            if (response.status === 403) return [];
            return []; // Graceful return
        }

        const data = await response.json();
        return (data?.pendingInvitations || []).map((invite: any) => ({
            ...invite,
            createdAt: invite.createdAt ? new Date(invite.createdAt) : undefined,
            expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : undefined,
        } as PendingInvitation));
    } catch (e) {
        console.warn('[getPendingInvitations] API error caught:', e);
        return [];
    }
}

export async function getLessons(role: LessonRole, userId?: string): Promise<Lesson[]> {
    const { firestore: db } = getFirebase();
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

export async function ensureDailyRecommendedLesson(
    role: LessonRole,
    trait: CxTrait,
    userId: string
): Promise<Lesson | null> {
    if (role === 'global') return null;
    const { auth } = getFirebase();

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const lesson = buildAutoRecommendedLesson(role, trait, userId);
        const existing = tour.lessons.find(l => l.lessonId === lesson.lessonId);
        if (existing) return existing;
        tour.lessons.push(lesson);
        return lesson;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        return null;
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/lessons/ensureDailyRecommended', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role, trait }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Failed to ensure daily recommended lesson.';
        console.warn('[ensureDailyRecommendedLesson] API request failed', { message, role, trait, userId });
        return null;
    }

    const lesson = await response.json();
    return lesson as Lesson;
}

export async function createUniqueRecommendedTestingLesson(
    role: LessonRole,
    trait: CxTrait,
    userId: string
): Promise<Lesson | null> {
    if (role === 'global') return null;
    const { auth } = getFirebase();

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const lesson = buildUniqueRecommendedTestingLesson(role, trait);
        tour.lessons.push(lesson);
        return lesson;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        return null;
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/lessons/createUniqueRecommendedTesting', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role, trait }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Failed to create unique recommended testing lesson.';
        console.warn('[createUniqueRecommendedTestingLesson] API request failed', { message, role, trait, userId });
        return null;
    }

    const lesson = await response.json();
    return lesson as Lesson;
}

export async function getLessonById(lessonId: string, userId?: string): Promise<Lesson | null> {
    const { firestore: db } = getFirebase();
    const starterLesson = getStarterLessonById(lessonId);
    if (starterLesson) return starterLesson;
    if (isTouringUser(userId) || lessonId.startsWith('tour-')) {
        const { lessons } = await getTourData();
        return lessons.find(l => l.lessonId === lessonId) || null;
    }
    return getDataById<Lesson>(db, 'lessons', lessonId);
}

export async function getDealershipById(dealershipId: string, userId?: string): Promise<Dealership | null> {
    const { firestore: db } = getFirebase();
    if (isTouringUser(userId) || dealershipId.startsWith('tour-')) {
        const { dealerships } = await getTourData();
        const dealership = dealerships.find(d => d.id === dealershipId);
        return dealership ? { ...dealership, status: 'active' } : null;
    }
    return getDataById<Dealership>(db, 'dealerships', dealershipId);
}

export async function createLesson(lessonData: { title: string; category: LessonCategory; associatedTrait: CxTrait; targetRole: UserRole | 'global'; scenario: string; }, creator: User, options?: { autoAssignByRole?: boolean; }): Promise<{ lesson: Lesson; autoAssignedCount: number; autoAssignFailed: boolean }> {
    const { firestore: db } = getFirebase();
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
    const { firestore: db } = getFirebase();
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
    const { firestore: db } = getFirebase();
    if (isTouringUser(userId)) {
        const { lessonAssignments } = await getTourData();
        return Array.from(new Set(lessonAssignments.filter(a => a.userId === userId).map(a => a.lessonId)));
    }
    const snap = await getDocs(query(collection(db, 'lessonAssignments'), where("userId", "==", userId)));
    return Array.from(new Set(snap.docs.map(d => (d.data() as LessonAssignment).lessonId)));
}

export async function assignLesson(userId: string, lessonId: string, assignerId: string): Promise<LessonAssignment> {
    const { firestore: db } = getFirebase();
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
    const { firestore: db } = getFirebase();
    if (isTouringUser(userId)) {
        const { lessonLogs } = await getTourData();
        return lessonLogs.filter(log => log.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    const snapshot = await getDocs(collection(db, `users/${userId}/lessonLogs`));
    return snapshot.docs
        .map(doc => {
            const data = doc.data() as any;
            return {
                ...data,
                id: doc.id,
                timestamp: toSafeDate(data.timestamp, new Date(0)),
            };
        })
        .filter(log => log.timestamp.getTime() > 0)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function getDailyLessonLimits(userId: string): Promise<{ recommendedTaken: boolean, otherTaken: boolean }> {
    if (isTouringUser(userId)) {
        // Guided tours should remain repeatable and never be blocked by "daily" limits.
        return { recommendedTaken: false, otherTaken: false };
    }

    const logs = await getConsultantActivity(userId);
    const todayLogs = logs.filter(log => isToday(log.timestamp));
    return { recommendedTaken: todayLogs.some(l => l.isRecommended), otherTaken: todayLogs.some(l => !l.isRecommended) };
}

export async function logLessonCompletion(data: {
    userId: string;
    lessonId: string;
    xpGained: number;
    isRecommended: boolean;
    ratings?: Partial<Ratings>;
    severity?: InteractionSeverity;
    flags?: string[];
    scores?: LegacyLessonScores;
    trainedTrait?: string;
    coachSummary?: string;
    recommendedNextFocus?: string;
}): Promise<{ updatedUser: User, newBadges: Badge[] } & LessonCompletionDetails> {
    const { firestore: db } = getFirebase();
    const severity = normalizeSeverity(data.severity);
    const normalizedRatings = normalizeRatings(data.ratings, data.scores);
    const normalizedScores = toLegacyScores(normalizedRatings);
    const xpDelta = sanitizeXpDelta(data.xpGained, severity);
    const flags = normalizeFlags(data.flags);
    const isBaselineAssessment = String(data.lessonId || '').startsWith('baseline-');

    if (isTouringUser(data.userId)) {
        const tour = await getTourData();
        const user = tour.users.find(u => u.userId === data.userId);
        if (!user) throw new Error('Tour user not found');

        const now = new Date();
        let statsResult: ReturnType<typeof applyTourRollingStatsUpdate>;
        if (isBaselineAssessment) {
            const currentStats = user.stats || buildDefaultUserStats(now);
            const nextStats: User['stats'] = {
                empathy: { score: normalizedRatings.empathy, lastUpdated: now },
                listening: { score: normalizedRatings.listening, lastUpdated: now },
                trust: { score: normalizedRatings.trust, lastUpdated: now },
                followUp: { score: normalizedRatings.followUp, lastUpdated: now },
                closing: { score: normalizedRatings.closing, lastUpdated: now },
                relationship: { score: normalizedRatings.relationship, lastUpdated: now },
            };
            statsResult = {
                nextStats,
                before: {
                    empathy: clampScore(currentStats.empathy?.score ?? BASELINE),
                    listening: clampScore(currentStats.listening?.score ?? BASELINE),
                    trust: clampScore(currentStats.trust?.score ?? BASELINE),
                    followUp: clampScore(currentStats.followUp?.score ?? BASELINE),
                    closing: clampScore(currentStats.closing?.score ?? BASELINE),
                    relationship: clampScore(currentStats.relationship?.score ?? BASELINE),
                },
                after: {
                    empathy: normalizedRatings.empathy,
                    listening: normalizedRatings.listening,
                    trust: normalizedRatings.trust,
                    followUp: normalizedRatings.followUp,
                    closing: normalizedRatings.closing,
                    relationship: normalizedRatings.relationship,
                },
            };
            user.stats = nextStats;
        } else {
            const existingStatScores = getExistingRollingStatScores(user);
            const shouldSeedStatsFromLegacyScores = !!data.scores && (
                !existingStatScores || looksLikeLegacyBootstrapStats(existingStatScores)
            );
            const seededStats = shouldSeedStatsFromLegacyScores && data.scores
                ? buildStatsSeedFromLegacyScores(data.scores, Timestamp.fromDate(now))
                : user.stats;

            statsResult = applyTourRollingStatsUpdate(seededStats, normalizedRatings, now);
            user.stats = statsResult.nextStats;
        }
        user.xp = computeNextXp(user.xp, xpDelta, severity);

        const scoreDelta = {
            empathy: statsResult.after.empathy - statsResult.before.empathy,
            listening: statsResult.after.listening - statsResult.before.listening,
            trust: statsResult.after.trust - statsResult.before.trust,
            followUp: statsResult.after.followUp - statsResult.before.followUp,
            closing: statsResult.after.closing - statsResult.before.closing,
            relationshipBuilding: statsResult.after.relationship - statsResult.before.relationship,
        };

        const newTourLog: LessonLog = {
            logId: `tour-log-${data.userId}-${now.getTime()}`,
            timestamp: now,
            userId: data.userId,
            lessonId: data.lessonId,
            stepResults: { final: 'pass' },
            xpGained: xpDelta,
            empathy: normalizedScores.empathy,
            listening: normalizedScores.listening,
            trust: normalizedScores.trust,
            followUp: normalizedScores.followUp,
            closing: normalizedScores.closing,
            relationshipBuilding: normalizedScores.relationshipBuilding,
            ratings: normalizedRatings,
            severity,
            flags,
            trainedTrait: data.trainedTrait,
            coachSummary: data.coachSummary,
            recommendedNextFocus: data.recommendedNextFocus,
            scoreDelta,
            isRecommended: data.isRecommended,
        };
        tour.lessonLogs.push(newTourLog);

        if (data.isRecommended) {
            const assignment = tour.lessonAssignments.find(a =>
                a.userId === data.userId &&
                a.lessonId === data.lessonId &&
                !a.completed
            );
            if (assignment) {
                assignment.completed = true;
            }
        }

        const newBadges: Badge[] = [];
        
        const badge = allBadges.find(b => b.id === 'first-drive');
        if(badge && !tour.earnedBadges[user.userId]?.some(b => b.badgeId === 'first-drive')) {
            newBadges.push(badge);
            tour.earnedBadges[user.userId].push({badgeId: 'first-drive', userId: user.userId, timestamp: new Date()});
        }
        
        return {
            updatedUser: cloneTourUser(user),
            newBadges: newBadges,
            severity,
            ratingsUsed: normalizedRatings,
            statChanges: {
                empathy: {
                    before: statsResult.before.empathy,
                    after: statsResult.after.empathy,
                    delta: scoreDelta.empathy,
                    rating: normalizedRatings.empathy,
                },
                listening: {
                    before: statsResult.before.listening,
                    after: statsResult.after.listening,
                    delta: scoreDelta.listening,
                    rating: normalizedRatings.listening,
                },
                trust: {
                    before: statsResult.before.trust,
                    after: statsResult.after.trust,
                    delta: scoreDelta.trust,
                    rating: normalizedRatings.trust,
                },
                followUp: {
                    before: statsResult.before.followUp,
                    after: statsResult.after.followUp,
                    delta: scoreDelta.followUp,
                    rating: normalizedRatings.followUp,
                },
                closing: {
                    before: statsResult.before.closing,
                    after: statsResult.after.closing,
                    delta: scoreDelta.closing,
                    rating: normalizedRatings.closing,
                },
                relationshipBuilding: {
                    before: statsResult.before.relationship,
                    after: statsResult.after.relationship,
                    delta: scoreDelta.relationshipBuilding,
                    rating: normalizedRatings.relationship,
                },
            },
        };
    }

    const user = await getUserById(data.userId);
    if (!user) throw new Error('User not found');

    const batch = writeBatch(db);
    const logRef = doc(collection(db, `users/${data.userId}/lessonLogs`));
    
    const newLogData: Record<string, unknown> = {
        logId: logRef.id,
        timestamp: Timestamp.fromDate(new Date()),
        userId: data.userId,
        lessonId: data.lessonId,
        xpGained: xpDelta,
        isRecommended: data.isRecommended,
        stepResults: { final: 'pass' },
        ...normalizedScores,
        ratings: normalizedRatings,
        severity,
        flags,
    };
    if (typeof data.trainedTrait === 'string' && data.trainedTrait.trim().length > 0) {
        newLogData.trainedTrait = data.trainedTrait;
    }
    if (typeof data.coachSummary === 'string' && data.coachSummary.trim().length > 0) {
        newLogData.coachSummary = data.coachSummary;
    }
    if (typeof data.recommendedNextFocus === 'string' && data.recommendedNextFocus.trim().length > 0) {
        newLogData.recommendedNextFocus = data.recommendedNextFocus;
    }

    const userLogs = await getConsultantActivity(data.userId);
    const userBadgeDocs = await getDocs(collection(db, `users/${data.userId}/earnedBadges`));
    const userBadgeIds = userBadgeDocs.docs.map(d => d.id as BadgeId);
    
    const newlyAwardedBadges: Badge[] = [];
    
    const awardBadge = (badgeId: BadgeId) => {
        if (!userBadgeIds.includes(badgeId)) {
            const badgeRef = doc(db, `users/${data.userId}/earnedBadges`, badgeId);
            batch.set(badgeRef, { badgeId, timestamp: Timestamp.fromDate(new Date()) });
            const badge = allBadges.find(b => b.id === badgeId);
            if (badge) newlyAwardedBadges.push(badge);
        }
    };
    
    if (userLogs.length === 0) awardBadge('first-drive');
    const newXp = computeNextXp(user.xp, xpDelta, severity);
    if (user.xp < 1000 && newXp >= 1000) awardBadge('xp-1000');
    if (user.xp < 5000 && newXp >= 5000) awardBadge('xp-5000');
    if (user.xp < 10000 && newXp >= 10000) awardBadge('xp-10000');

    const levelBefore = calculateLevel(user.xp).level;
    const levelAfter = calculateLevel(newXp).level;
    if (levelBefore < 10 && levelAfter >= 10) awardBadge('level-10');
    if (levelBefore < 25 && levelAfter >= 25) awardBadge('level-25');

    const lessonScore = Object.values(normalizedScores).reduce((sum, score) => sum + score, 0) / 6;
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

    const existingStatScores = getExistingRollingStatScores(user);
    const shouldSeedStatsFromLegacyScores = isBaselineAssessment || (!!data.scores && (
        !existingStatScores || looksLikeLegacyBootstrapStats(existingStatScores)
    ));
    const seedTimestamp = Timestamp.fromDate(new Date());

    if (shouldSeedStatsFromLegacyScores) {
        batch.set(
            doc(db, 'users', data.userId),
            { stats: buildStatsSeedFromLegacyScores(normalizedScores, seedTimestamp) },
            { merge: true }
        );
    }

    batch.set(logRef, newLogData);
    batch.set(doc(db, 'users', data.userId), { xp: newXp }, { merge: true });

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

    let statChanges: LessonCompletionDetails['statChanges'];

    try {
        if (isBaselineAssessment) {
            const beforeScores = {
                empathy: clampScore(user.stats?.empathy?.score ?? BASELINE),
                listening: clampScore(user.stats?.listening?.score ?? BASELINE),
                trust: clampScore(user.stats?.trust?.score ?? BASELINE),
                followUp: clampScore(user.stats?.followUp?.score ?? BASELINE),
                closing: clampScore(user.stats?.closing?.score ?? BASELINE),
                relationship: clampScore(user.stats?.relationship?.score ?? BASELINE),
            };

            statChanges = {
                empathy: {
                    before: beforeScores.empathy,
                    after: normalizedRatings.empathy,
                    delta: normalizedRatings.empathy - beforeScores.empathy,
                    rating: normalizedRatings.empathy,
                },
                listening: {
                    before: beforeScores.listening,
                    after: normalizedRatings.listening,
                    delta: normalizedRatings.listening - beforeScores.listening,
                    rating: normalizedRatings.listening,
                },
                trust: {
                    before: beforeScores.trust,
                    after: normalizedRatings.trust,
                    delta: normalizedRatings.trust - beforeScores.trust,
                    rating: normalizedRatings.trust,
                },
                followUp: {
                    before: beforeScores.followUp,
                    after: normalizedRatings.followUp,
                    delta: normalizedRatings.followUp - beforeScores.followUp,
                    rating: normalizedRatings.followUp,
                },
                closing: {
                    before: beforeScores.closing,
                    after: normalizedRatings.closing,
                    delta: normalizedRatings.closing - beforeScores.closing,
                    rating: normalizedRatings.closing,
                },
                relationshipBuilding: {
                    before: beforeScores.relationship,
                    after: normalizedRatings.relationship,
                    delta: normalizedRatings.relationship - beforeScores.relationship,
                    rating: normalizedRatings.relationship,
                },
            };
        } else {
            const rollingResult = await updateRollingStats(data.userId, normalizedRatings);
            statChanges = {
                empathy: {
                    before: rollingResult.before.empathy,
                    after: rollingResult.after.empathy,
                    delta: rollingResult.after.empathy - rollingResult.before.empathy,
                    rating: normalizedRatings.empathy,
                },
                listening: {
                    before: rollingResult.before.listening,
                    after: rollingResult.after.listening,
                    delta: rollingResult.after.listening - rollingResult.before.listening,
                    rating: normalizedRatings.listening,
                },
                trust: {
                    before: rollingResult.before.trust,
                    after: rollingResult.after.trust,
                    delta: rollingResult.after.trust - rollingResult.before.trust,
                    rating: normalizedRatings.trust,
                },
                followUp: {
                    before: rollingResult.before.followUp,
                    after: rollingResult.after.followUp,
                    delta: rollingResult.after.followUp - rollingResult.before.followUp,
                    rating: normalizedRatings.followUp,
                },
                closing: {
                    before: rollingResult.before.closing,
                    after: rollingResult.after.closing,
                    delta: rollingResult.after.closing - rollingResult.before.closing,
                    rating: normalizedRatings.closing,
                },
                relationshipBuilding: {
                    before: rollingResult.before.relationship,
                    after: rollingResult.after.relationship,
                    delta: rollingResult.after.relationship - rollingResult.before.relationship,
                    rating: normalizedRatings.relationship,
                },
            };
        }

        if (statChanges) {
            await updateDoc(logRef, {
                scoreDelta: {
                    empathy: statChanges.empathy.delta,
                    listening: statChanges.listening.delta,
                    trust: statChanges.trust.delta,
                    followUp: statChanges.followUp.delta,
                    closing: statChanges.closing.delta,
                    relationshipBuilding: statChanges.relationshipBuilding.delta,
                },
            });
        }
    } catch (error) {
        console.error('[logLessonCompletion] Failed to update rolling stats', {
            userId: data.userId,
            lessonId: data.lessonId,
            error,
        });
    }
    
    const updatedUserDoc = await getDoc(doc(db, 'users', data.userId));
    const updatedUser = { ...(updatedUserDoc.data() as any), userId: updatedUserDoc.id } as User;
    
    return {
        updatedUser,
        newBadges: newlyAwardedBadges,
        severity,
        ratingsUsed: normalizedRatings,
        statChanges,
    };
}

export const getTeamMemberRoles = (managerRole: UserRole): UserRole[] => {
    switch (managerRole) {
        case 'manager': return ['Sales Consultant'];
        case 'Service Manager': return ['Service Writer'];
        case 'Parts Manager': return ['Parts Consultant'];
        case 'Finance Manager': return ['Finance Manager'];
        case 'General Manager':
        case 'Owner':
        case 'Trainer':
        case 'Admin':
        case 'Developer':
            return allRoles.filter(r => !['Admin', 'Developer', 'Trainer'].includes(r));
        default: return [];
    }
};

type TeamActivityRow = {
    consultant: User;
    lessonsCompleted: number;
    totalXp: number;
    avgScore: number;
    topStrength: CxTrait | null;
    weakestSkill: CxTrait | null;
    lastInteraction: Date | null;
};

type ManagerStats = {
    totalLessons: number;
    avgScores: Record<CxTrait, number> | null;
};

function hasUsableStats(user: User): boolean {
    if (!user.stats) return false;
    const stats = user.stats as Record<string, any>;
    const keys = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationship'];
    return keys.some((key) => {
        const value = stats[key];
        if (typeof value === 'number') return Number.isFinite(value);
        if (value && typeof value === 'object' && typeof value.score === 'number') {
            return Number.isFinite(value.score);
        }
        return false;
    });
}

function extractStatScore(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return clampScore(value);
    }

    if (value && typeof value === 'object' && 'score' in (value as Record<string, unknown>)) {
        const nested = (value as Record<string, unknown>).score;
        if (typeof nested === 'number' && Number.isFinite(nested)) {
            return clampScore(nested);
        }
    }

    return null;
}

function getTraitScoresFromUserStats(user: User): Record<CxTrait, number> | null {
    const stats = user.stats;
    if (!stats) return null;

    const empathy = extractStatScore(stats.empathy);
    const listening = extractStatScore(stats.listening);
    const trust = extractStatScore(stats.trust);
    const followUp = extractStatScore(stats.followUp);
    const closing = extractStatScore(stats.closing);
    const relationship = extractStatScore(
        (stats as Record<string, unknown>).relationship
        ?? (stats as Record<string, unknown>).relationshipBuilding
    );

    if (
        empathy === null
        && listening === null
        && trust === null
        && followUp === null
        && closing === null
        && relationship === null
    ) {
        return null;
    }

    return {
        empathy: empathy ?? BASELINE,
        listening: listening ?? BASELINE,
        trust: trust ?? BASELINE,
        followUp: followUp ?? BASELINE,
        closing: closing ?? BASELINE,
        relationshipBuilding: relationship ?? BASELINE,
    };
}

function buildStatsFromTraitScores(scores: Record<CxTrait, number>, timestamp: Date): User['stats'] {
    return {
        empathy: { score: clampScore(scores.empathy), lastUpdated: timestamp },
        listening: { score: clampScore(scores.listening), lastUpdated: timestamp },
        trust: { score: clampScore(scores.trust), lastUpdated: timestamp },
        followUp: { score: clampScore(scores.followUp), lastUpdated: timestamp },
        closing: { score: clampScore(scores.closing), lastUpdated: timestamp },
        relationship: { score: clampScore(scores.relationshipBuilding), lastUpdated: timestamp },
    };
}

function buildTeamActivityRow(consultant: User, logs: LessonLog[]): TeamActivityRow {
    const consultantSnapshot = cloneTourUser(consultant);
    const traits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

    if (!logs.length) {
        const traitScores = getTraitScoresFromUserStats(consultantSnapshot);
        if (traitScores) {
            if (!hasUsableStats(consultantSnapshot)) {
                consultantSnapshot.stats = buildStatsFromTraitScores(traitScores, new Date());
            }

            const topStrength = traits.reduce((best, trait) => (
                traitScores[trait] > traitScores[best] ? trait : best
            ), traits[0]);
            const weakestSkill = traits.reduce((weakest, trait) => (
                traitScores[trait] < traitScores[weakest] ? trait : weakest
            ), traits[0]);
            const avgScore = Math.round(
                traits.reduce((sum, trait) => sum + traitScores[trait], 0) / traits.length
            );

            return {
                consultant: consultantSnapshot,
                lessonsCompleted: 0,
                totalXp: consultant.xp,
                avgScore,
                topStrength,
                weakestSkill,
                lastInteraction: null,
            };
        }

        return {
            consultant: consultantSnapshot,
            lessonsCompleted: 0,
            totalXp: consultant.xp,
            avgScore: 0,
            topStrength: null,
            weakestSkill: null,
            lastInteraction: null,
        };
    }

    const totals = logs.reduce((acc, log) => {
        acc.empathy += log.empathy || 0;
        acc.listening += log.listening || 0;
        acc.trust += log.trust || 0;
        acc.followUp += log.followUp || 0;
        acc.closing += log.closing || 0;
        acc.relationshipBuilding += log.relationshipBuilding || 0;
        return acc;
    }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

    const count = logs.length;
    const avgByTrait: Record<CxTrait, number> = {
        empathy: Math.round(totals.empathy / count),
        listening: Math.round(totals.listening / count),
        trust: Math.round(totals.trust / count),
        followUp: Math.round(totals.followUp / count),
        closing: Math.round(totals.closing / count),
        relationshipBuilding: Math.round(totals.relationshipBuilding / count),
    };

    const topStrength = traits.reduce((best, trait) => (
        avgByTrait[trait] > avgByTrait[best] ? trait : best
    ), traits[0]);

    const weakestSkill = traits.reduce((weakest, trait) => (
        avgByTrait[trait] < avgByTrait[weakest] ? trait : weakest
    ), traits[0]);

    const lastInteraction = logs.reduce<Date | null>((latest, log) => {
        if (!latest || log.timestamp > latest) return log.timestamp;
        return latest;
    }, null);

    if (!hasUsableStats(consultantSnapshot)) {
        const statsTimestamp = lastInteraction || new Date();
        consultantSnapshot.stats = {
            empathy: { score: avgByTrait.empathy, lastUpdated: statsTimestamp },
            listening: { score: avgByTrait.listening, lastUpdated: statsTimestamp },
            trust: { score: avgByTrait.trust, lastUpdated: statsTimestamp },
            followUp: { score: avgByTrait.followUp, lastUpdated: statsTimestamp },
            closing: { score: avgByTrait.closing, lastUpdated: statsTimestamp },
            relationship: { score: avgByTrait.relationshipBuilding, lastUpdated: statsTimestamp },
        };
    }

    return {
        consultant: consultantSnapshot,
        lessonsCompleted: count,
        totalXp: consultant.xp,
        avgScore: Math.round((Object.values(avgByTrait).reduce((sum, value) => sum + value, 0) / traits.length)),
        topStrength,
        weakestSkill,
        lastInteraction,
    };
}

function buildManagerStatsFromRows(rows: TeamActivityRow[], logsByUserId: Map<string, LessonLog[]>): ManagerStats {
    const snapshotScores = rows
        .map((row) => getTraitScoresFromUserStats(row.consultant))
        .filter((scores): scores is Record<CxTrait, number> => scores !== null);

    if (snapshotScores.length) {
        const totals = snapshotScores.reduce((acc, score) => {
            acc.empathy += score.empathy;
            acc.listening += score.listening;
            acc.trust += score.trust;
            acc.followUp += score.followUp;
            acc.closing += score.closing;
            acc.relationshipBuilding += score.relationshipBuilding;
            return acc;
        }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

        const memberCount = snapshotScores.length;
        return {
            totalLessons: rows.reduce((sum, row) => sum + row.lessonsCompleted, 0),
            avgScores: {
                empathy: Math.round(totals.empathy / memberCount),
                listening: Math.round(totals.listening / memberCount),
                trust: Math.round(totals.trust / memberCount),
                followUp: Math.round(totals.followUp / memberCount),
                closing: Math.round(totals.closing / memberCount),
                relationshipBuilding: Math.round(totals.relationshipBuilding / memberCount),
            },
        };
    }

    const memberLogs = rows.flatMap(row => logsByUserId.get(row.consultant.userId) || []);
    if (!memberLogs.length) {
        return { totalLessons: 0, avgScores: null };
    }

    const totals = memberLogs.reduce((acc, log) => {
        acc.empathy += log.empathy || 0;
        acc.listening += log.listening || 0;
        acc.trust += log.trust || 0;
        acc.followUp += log.followUp || 0;
        acc.closing += log.closing || 0;
        acc.relationshipBuilding += log.relationshipBuilding || 0;
        return acc;
    }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

    const totalLessons = memberLogs.length;
    return {
        totalLessons,
        avgScores: {
            empathy: Math.round(totals.empathy / totalLessons),
            listening: Math.round(totals.listening / totalLessons),
            trust: Math.round(totals.trust / totalLessons),
            followUp: Math.round(totals.followUp / totalLessons),
            closing: Math.round(totals.closing / totalLessons),
            relationshipBuilding: Math.round(totals.relationshipBuilding / totalLessons),
        },
    };
}

export async function getDealerships(user?: User): Promise<Dealership[]> {
    const { firestore: db } = getFirebase();
    if (isTouringUser(user?.userId)) return (await getTourData()).dealerships;
    if (user && !hasDealershipAssignments(user)) return [];
    const snap = await getDocs(collection(db, 'dealerships'));
    const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Dealership));
    if (user && !['Admin', 'Developer', 'Trainer'].includes(user.role)) {
        return all.filter(d => user.dealershipIds.includes(d.id) && d.status !== 'deactivated');
    }
    return all.filter(d => d.id !== 'autoknerd-hq').sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCombinedTeamData(dealershipId: string, user: User): Promise<any> {
    const { firestore: db } = getFirebase();
    const isPrivilegedViewer = ['Admin', 'Developer', 'Trainer'].includes(user.role);
    const scopedDealershipIds = Array.isArray(user.dealershipIds) ? user.dealershipIds : [];
    if (!scopedDealershipIds.length) {
        return {
            teamActivity: [],
            managerStats: { totalLessons: 0, avgScores: null },
        };
    }

    if (isTouringUser(user.userId)) {
        const tour = await getTourData();
        const roles = getTeamMemberRoles(user.role);
        if (!roles.length) {
            return {
                teamActivity: [],
                managerStats: { totalLessons: 0, avgScores: null },
            };
        }
        const members = tour.users.filter((member) => (
            member.userId !== user.userId &&
            roles.includes(member.role)
        ));
        const filtered = dealershipId === 'all'
            ? (isPrivilegedViewer
                ? members
                : members.filter((member) => member.dealershipIds.some((id) => scopedDealershipIds.includes(id))))
            : members.filter((member) => member.dealershipIds.includes(dealershipId));

        const logsByUserId = new Map<string, LessonLog[]>();
        for (const log of tour.lessonLogs) {
            const existing = logsByUserId.get(log.userId);
            if (existing) {
                existing.push(log);
            } else {
                logsByUserId.set(log.userId, [log]);
            }
        }

        const teamActivity = filtered.map((member) => (
            buildTeamActivityRow(member, logsByUserId.get(member.userId) || [])
        ));

        return {
            teamActivity,
            managerStats: buildManagerStatsFromRows(teamActivity, logsByUserId),
        };
    }

    const roles = getTeamMemberRoles(user.role);
    if (!roles.length) {
        return {
            teamActivity: [],
            managerStats: { totalLessons: 0, avgScores: null },
        };
    }

    const usersSnap = await getDocs(query(collection(db, 'users'), where("role", "in", roles)));
    const members = usersSnap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
    const filtered = dealershipId === 'all'
        ? (isPrivilegedViewer
            ? members
            : members.filter((member) => member.dealershipIds.some((id) => scopedDealershipIds.includes(id))))
        : members.filter((member) => member.dealershipIds.includes(dealershipId));
    
    return {
        teamActivity: filtered.map((member) => buildTeamActivityRow(member, [])),
        managerStats: { totalLessons: 0, avgScores: null }
    };
}

export async function getManageableUsers(managerId: string): Promise<User[]> {
    const { firestore: db } = getFirebase();
    const manager = await getUserById(managerId);
    if (!manager) return [];
    if (!hasDealershipAssignments(manager)) return [];

    if (isTouringUser(managerId)) {
        const tour = await getTourData();
        const isAdmin = ['Admin', 'Developer'].includes(manager.role);

        if (isAdmin) {
            return tour.users
                .filter(user => user.userId !== managerId)
                .map(cloneTourUser)
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        const roles = getTeamMemberRoles(manager.role);
        return tour.users
            .filter((user) => (
                user.userId !== managerId &&
                roles.includes(user.role) &&
                user.dealershipIds.some((id) => manager.dealershipIds.includes(id))
            ))
            .map(cloneTourUser)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    const isAdmin = ['Admin', 'Developer'].includes(manager.role);
    
    const snap = await getDocs(collection(db, 'users'));
    const all = snap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
    
    if (isAdmin) {
        return all.filter(u => u.userId !== managerId).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const roles = getTeamMemberRoles(manager.role);
    return all.filter(u => 
        u.userId !== managerId && 
        roles.includes(u.role) && 
        u.dealershipIds.some(id => manager.dealershipIds.includes(id))
    ).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEarnedBadgesByUserId(userId: string): Promise<Badge[]> {
    const { firestore: db } = getFirebase();
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
    const { firestore: db } = getFirebase();
    const ref = doc(db, 'dealerships', dealershipId);
    await updateDoc(ref, { status });
    const snap = await getDoc(ref);
    return { ...snap.data(), id: snap.id } as Dealership;
}

export async function updateDealershipRetakeTestingAccess(
    dealershipId: string,
    enabled: boolean
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.enableRetakeRecommendedTesting = enabled;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

    const dealershipsCollection = collection(db, 'dealerships');
    const dealershipRef = doc(dealershipsCollection, dealershipId);

    try {
        await updateDoc(dealershipRef, { enableRetakeRecommendedTesting: enabled });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: { enableRetakeRecommendedTesting: enabled },
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const updatedDealership = await getDoc(dealershipRef);
    return { ...updatedDealership.data(), id: updatedDealership.id } as Dealership;
}

export async function updateDealershipNewRecommendedTestingAccess(
    dealershipId: string,
    enabled: boolean
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.enableNewRecommendedTesting = enabled;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

    const dealershipsCollection = collection(db, 'dealerships');
    const dealershipRef = doc(dealershipsCollection, dealershipId);

    try {
        await updateDoc(dealershipRef, { enableNewRecommendedTesting: enabled });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: { enableNewRecommendedTesting: enabled },
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const updatedDealership = await getDoc(dealershipRef);
    return { ...updatedDealership.data(), id: updatedDealership.id } as Dealership;
}

export async function updateDealershipPppAccess(
    dealershipId: string,
    enabled: boolean
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.enablePppProtocol = enabled;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

    const dealershipsCollection = collection(db, 'dealerships');
    const dealershipRef = doc(dealershipsCollection, dealershipId);

    try {
        await updateDoc(dealershipRef, { enablePppProtocol: enabled });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: { enablePppProtocol: enabled },
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const updatedDealership = await getDoc(dealershipRef);
    return { ...updatedDealership.data(), id: updatedDealership.id } as Dealership;
}

export async function updateDealershipSaasPppAccess(
    dealershipId: string,
    enabled: boolean
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.enableSaasPppTraining = enabled;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

    const dealershipsCollection = collection(db, 'dealerships');
    const dealershipRef = doc(dealershipsCollection, dealershipId);

    try {
        await updateDoc(dealershipRef, { enableSaasPppTraining: enabled });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: { enableSaasPppTraining: enabled },
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const updatedDealership = await getDoc(dealershipRef);
    return { ...updatedDealership.data(), id: updatedDealership.id } as Dealership;
}

function toSafeNonNegativeInt(value: number | undefined): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value as number));
}

export async function updateDealershipBillingConfig(
    dealershipId: string,
    payload: {
        billingTier: Dealership['billingTier'];
        billingUserCount?: number;
        billingOwnerAccountCount?: number;
        billingStoreCount?: number;
    }
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    const billingTier = payload.billingTier || 'sales_fi';
    const billingUserCount = toSafeNonNegativeInt(payload.billingUserCount);
    const billingOwnerAccountCount = toSafeNonNegativeInt(payload.billingOwnerAccountCount);
    const billingStoreCount = Math.max(1, toSafeNonNegativeInt(payload.billingStoreCount));

    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.billingTier = billingTier;
            dealership.billingUserCount = billingUserCount;
            dealership.billingOwnerAccountCount = billingOwnerAccountCount;
            dealership.billingStoreCount = billingStoreCount;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

    const dealershipRef = doc(collection(db, 'dealerships'), dealershipId);
    const patch: Partial<Dealership> = {
        billingTier,
        billingUserCount,
        billingOwnerAccountCount,
        billingStoreCount,
    };

    try {
        await updateDoc(dealershipRef, patch);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: patch,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw contextualError;
    }

    const updatedDealership = await getDoc(dealershipRef);
    return { ...updatedDealership.data(), id: updatedDealership.id } as Dealership;
}

type PppSystemConfig = {
  enabled: boolean;
  updatedUsers?: number;
};

export async function getPppSystemConfig(): Promise<PppSystemConfig> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Authentication required.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/pppConfig', {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Failed to load PPP settings.');
    }

    return {
        enabled: payload?.enabled === true,
        updatedUsers: typeof payload?.updatedUsers === 'number' ? payload.updatedUsers : undefined,
    };
}

export async function updatePppSystemConfig(enabled: boolean): Promise<PppSystemConfig> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Authentication required.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/pppConfig', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ enabled }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Failed to update PPP settings.');
    }

    return {
        enabled: payload?.enabled === true,
        updatedUsers: typeof payload?.updatedUsers === 'number' ? payload.updatedUsers : undefined,
    };
}

export type PppLessonPassResult = {
    updatedUser: User;
    xpAwarded: number;
    alreadyPassed: boolean;
    levelAdvanced: boolean;
    certified: boolean;
};

export async function completePppLessonPass(
    userId: string,
    level: number,
    lessonId: string
): Promise<PppLessonPassResult> {
    const { firestore: db } = getFirebase();
    const safeLevel = clampPppLevel(level);

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');
        user.ppp_enabled = true;

        const normalized = normalizePppUserState(user);
        if (normalized.level !== safeLevel) {
            throw new Error('Complete all lessons in your current PPP level before advancing.');
        }

        const levelKey = getPppLevelKey(normalized.level);
        const lessonsPassed = { ...normalized.lessonsPassed };
        const passedSet = new Set(lessonsPassed[levelKey] || []);
        if (passedSet.has(lessonId)) {
            return {
                updatedUser: cloneTourUser(user),
                xpAwarded: 0,
                alreadyPassed: true,
                levelAdvanced: false,
                certified: normalized.certified,
            };
        }

        const lessonsForLevel = getPppLessonsForLevel(normalized.level, user.role);
        const lessonIndex = lessonsForLevel.findIndex((entry) => entry.lessonId === lessonId);
        if (lessonIndex >= PPP_TOUR_UNLOCKED_LESSON_COUNT) {
            throw new Error('Tour PPP unlocks only the first two lessons.');
        }
        const lessonIds = new Set(lessonsForLevel.map((entry) => entry.lessonId));
        if (!lessonIds.has(lessonId)) {
            throw new Error('Invalid PPP lesson for this level.');
        }

        const todayKey = getPppUtcDateKey();
        const dailyPassDate = typeof user.ppp_daily_pass_date === 'string' ? user.ppp_daily_pass_date : '';
        const rawDailyPassCount = Math.max(0, Math.round(Number(user.ppp_daily_pass_count || 0)));
        const dailyPassCount = dailyPassDate === todayKey ? rawDailyPassCount : 0;
        if (dailyPassCount >= PPP_DAILY_PASS_LIMIT) {
            throw new Error(`Daily PPP limit reached (${PPP_DAILY_PASS_LIMIT} lessons). Come back tomorrow.`);
        }

        passedSet.add(lessonId);
        lessonsPassed[levelKey] = Array.from(passedSet);

        const allPassed = lessonsForLevel.every((entry) => passedSet.has(entry.lessonId));
        const levelAdvanced = allPassed && normalized.level < 10;
        const certified = normalized.certified || (allPassed && normalized.level === 10);
        const nextLevel = levelAdvanced ? getNextPppLevel(normalized.level) : normalized.level;
        const nextProgress = allPassed ? (certified ? 100 : 0) : Math.round((passedSet.size / lessonsForLevel.length) * 100);
        const xpAwarded = getPppLevelXp(normalized.level);

        user.xp = (user.xp || 0) + xpAwarded;
        user.ppp_level = nextLevel;
        user.ppp_lessons_passed = lessonsPassed;
        user.ppp_progress_percentage = nextProgress;
        user.ppp_badge = getPppLevelBadge(nextLevel, certified);
        user.ppp_certified = certified;
        user.ppp_daily_pass_date = todayKey;
        user.ppp_daily_pass_count = dailyPassCount + 1;

        return {
            updatedUser: cloneTourUser(user),
            xpAwarded,
            alreadyPassed: false,
            levelAdvanced,
            certified,
        };
    }

    const userRef = doc(db, 'users', userId);
    let transactionResult: Omit<PppLessonPassResult, 'updatedUser'> = {
        xpAwarded: 0,
        alreadyPassed: false,
        levelAdvanced: false,
        certified: false,
    };

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
            throw new Error('User not found.');
        }

        const user = ({ ...(userSnap.data() as User), userId: userSnap.id } as User);
        const scopedDealershipIds = getScopedDealershipIds(user);
        if (!scopedDealershipIds.length) {
            throw new Error('PPP is not enabled for this dealership.');
        }

        const dealershipRefs = scopedDealershipIds.map((id) => doc(db, 'dealerships', id));
        const dealershipSnaps = await Promise.all(dealershipRefs.map((ref) => transaction.get(ref)));
        const hasPppAccess = dealershipSnaps.some((snap) => (
            snap.exists() && isDealershipPppEnabled(snap.data() as Partial<Dealership>)
        ));
        if (!hasPppAccess) {
            throw new Error('PPP is not enabled for this dealership.');
        }

        const normalized = normalizePppUserState(user);
        if (normalized.level !== safeLevel) {
            throw new Error('Complete all lessons in your current PPP level before advancing.');
        }

        const levelKey = getPppLevelKey(normalized.level);
        const lessonsPassed = { ...normalized.lessonsPassed };
        const passedSet = new Set(lessonsPassed[levelKey] || []);
        if (passedSet.has(lessonId)) {
            transaction.update(userRef, { ppp_enabled: hasPppAccess });
            transactionResult = {
                xpAwarded: 0,
                alreadyPassed: true,
                levelAdvanced: false,
                certified: normalized.certified,
            };
            return;
        }

        const lessonsForLevel = getPppLessonsForLevel(normalized.level, user.role);
        const lessonIds = new Set(lessonsForLevel.map((entry) => entry.lessonId));
        if (!lessonIds.has(lessonId)) {
            throw new Error('Invalid PPP lesson for this level.');
        }

        const todayKey = getPppUtcDateKey();
        const dailyPassDate = typeof user.ppp_daily_pass_date === 'string' ? user.ppp_daily_pass_date : '';
        const rawDailyPassCount = Math.max(0, Math.round(Number(user.ppp_daily_pass_count || 0)));
        const dailyPassCount = dailyPassDate === todayKey ? rawDailyPassCount : 0;
        if (dailyPassCount >= PPP_DAILY_PASS_LIMIT) {
            throw new Error(`Daily PPP limit reached (${PPP_DAILY_PASS_LIMIT} lessons). Come back tomorrow.`);
        }

        passedSet.add(lessonId);
        lessonsPassed[levelKey] = Array.from(passedSet);

        const allPassed = lessonsForLevel.every((entry) => passedSet.has(entry.lessonId));
        const levelAdvanced = allPassed && normalized.level < 10;
        const certified = normalized.certified || (allPassed && normalized.level === 10);
        const nextLevel = levelAdvanced ? getNextPppLevel(normalized.level) : normalized.level;
        const nextProgress = allPassed ? (certified ? 100 : 0) : Math.round((passedSet.size / lessonsForLevel.length) * 100);
        const xpAwarded = getPppLevelXp(normalized.level);
        const nextXp = (typeof user.xp === 'number' ? user.xp : 0) + xpAwarded;

        transaction.update(userRef, {
            xp: nextXp,
            ppp_enabled: hasPppAccess,
            ppp_level: nextLevel,
            ppp_lessons_passed: lessonsPassed,
            ppp_progress_percentage: nextProgress,
            ppp_badge: getPppLevelBadge(nextLevel, certified),
            ppp_certified: certified,
            ppp_daily_pass_date: todayKey,
            ppp_daily_pass_count: dailyPassCount + 1,
        });

        transactionResult = {
            xpAwarded,
            alreadyPassed: false,
            levelAdvanced,
            certified,
        };
    });

    const updatedUserSnap = await getDoc(userRef);
    if (!updatedUserSnap.exists()) {
        throw new Error('User not found after PPP update.');
    }

    return {
        updatedUser: { ...(updatedUserSnap.data() as User), userId: updatedUserSnap.id },
        ...transactionResult,
    };
}

export async function incrementPppAbandonmentCounter(userId: string): Promise<number> {
    const { firestore: db } = getFirebase();

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');
        const scopedDealershipIds = getScopedDealershipIds(user);
        const dealershipMap = new Map(tour.dealerships.map((dealership) => [dealership.id, dealership]));
        const hasPppAccess = scopedDealershipIds.some((id) => isDealershipPppEnabled(dealershipMap.get(id)));
        if (!hasPppAccess) throw new Error('PPP is not enabled for this dealership.');

        user.ppp_enabled = hasPppAccess;
        const current = Math.max(0, Math.round(Number(user.ppp_abandonment_counter || 0)));
        const next = current + 1;
        user.ppp_abandonment_counter = next;
        return next;
    }

    const userRef = doc(db, 'users', userId);
    let nextValue = 0;

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');
        const data = userSnap.data() as User;

        const scopedDealershipIds = getScopedDealershipIds(data as User);
        if (!scopedDealershipIds.length) {
            throw new Error('PPP is not enabled for this dealership.');
        }

        const dealershipRefs = scopedDealershipIds.map((id) => doc(db, 'dealerships', id));
        const dealershipSnaps = await Promise.all(dealershipRefs.map((ref) => transaction.get(ref)));
        const hasPppAccess = dealershipSnaps.some((snap) => (
            snap.exists() && isDealershipPppEnabled(snap.data() as Partial<Dealership>)
        ));
        if (!hasPppAccess) {
            throw new Error('PPP is not enabled for this dealership.');
        }

        const current = Math.max(0, Math.round(Number(data.ppp_abandonment_counter || 0)));
        nextValue = current + 1;
        transaction.update(userRef, { ppp_enabled: hasPppAccess, ppp_abandonment_counter: nextValue });
    });

    return nextValue;
}

type SaasPppLessonContext = {
    phase: SaasPppPhase;
    lessons: ReturnType<typeof getSaasPppLessonsForLevel>;
    levelKey: string;
};

function getSaasPppLessonContext(user: User, level: number): SaasPppLessonContext {
    const normalized = normalizeSaasPppUserState(user);
    const safeLevel = clampSaasPppLevel(level);
    const phase: SaasPppPhase = safeLevel === 2 ? normalized.l2Phase : 'primary';

    if (safeLevel === 2) {
        if (!normalized.primaryChannel) {
            throw new Error('Select your primary lead channel to start LVL 2.');
        }
        if (phase === 'secondary' && !normalized.secondaryChannel) {
            throw new Error('Select your secondary lead channel to continue LVL 2.');
        }
    }

    const lessons = getSaasPppLessonsForLevel(safeLevel, {
        primaryChannel: normalized.primaryChannel,
        secondaryChannel: normalized.secondaryChannel,
        phase,
    });
    if (!lessons.length) {
        throw new Error('No SaaS PPP lessons are available for your current level.');
    }

    const levelKey = getSaasPppLevelKey(safeLevel, phase);
    return { phase, lessons, levelKey };
}

type SaasPppPatchResult = {
    patch: Partial<User>;
    xpAwarded: number;
    alreadyPassed: boolean;
    levelAdvanced: boolean;
    certified: boolean;
    phaseCompleted: boolean;
    currentLevel: number;
    currentPhase: SaasPppPhase;
};

function computeSaasPppPassPatch(user: User, level: number, lessonId: string, nowIso: string): SaasPppPatchResult {
    const normalized = normalizeSaasPppUserState(user);
    const safeLevel = clampSaasPppLevel(level);

    if (normalized.currentLevel !== safeLevel) {
        throw new Error('Complete all lessons in your current SaaS PPP level before advancing.');
    }

    const { phase, lessons, levelKey } = getSaasPppLessonContext(user, safeLevel);
    const lessonIds = new Set(lessons.map((entry) => entry.lessonId));
    if (!lessonIds.has(lessonId)) {
        throw new Error('Invalid SaaS PPP lesson for this level.');
    }

    const lessonsPassed = { ...normalized.lessonsPassed };
    const passedSet = new Set(lessonsPassed[levelKey] || []);
    if (passedSet.has(lessonId)) {
        return {
            patch: { saas_ppp_enabled: true },
            xpAwarded: 0,
            alreadyPassed: true,
            levelAdvanced: false,
            certified: !!normalized.certifiedTimestamp,
            phaseCompleted: false,
            currentLevel: normalized.currentLevel,
            currentPhase: phase,
        };
    }

    passedSet.add(lessonId);
    lessonsPassed[levelKey] = Array.from(passedSet);

    const currentXp = typeof user.xp === 'number' ? user.xp : 0;
    const allPassedInPhase = lessons.every((entry) => passedSet.has(entry.lessonId));
    const xpAwarded = getSaasPppLessonXp(safeLevel, lessons.length, safeLevel === 2 ? phase : undefined);

    let nextLevelCompleted = normalized.levelCompleted;
    let nextCurrentLevel = normalized.currentLevel;
    let nextProgress = allPassedInPhase ? 0 : Math.round((passedSet.size / lessons.length) * 100);
    let nextPhase: SaasPppPhase = phase;
    let nextCertifiedTimestamp = normalized.certifiedTimestamp;
    let levelAdvanced = false;
    let phaseCompleted = allPassedInPhase;

    if (safeLevel === 2) {
        if (phase === 'primary' && allPassedInPhase) {
            nextPhase = 'secondary';
            nextProgress = 0;
            const secondaryKey = getSaasPppLevelKey(2, 'secondary');
            lessonsPassed[secondaryKey] = Array.from(new Set(lessonsPassed[secondaryKey] || []));
        } else if (phase === 'secondary' && allPassedInPhase) {
            nextLevelCompleted = Math.max(nextLevelCompleted, 2);
            nextCurrentLevel = getNextSaasPppLevel(2);
            nextPhase = 'primary';
            nextProgress = 0;
            levelAdvanced = true;
        }
    } else if (allPassedInPhase) {
        nextLevelCompleted = Math.max(nextLevelCompleted, safeLevel);
        if (safeLevel >= 5) {
            nextCurrentLevel = 5;
            nextCertifiedTimestamp = nextCertifiedTimestamp || nowIso;
            nextProgress = 100;
        } else {
            nextCurrentLevel = getNextSaasPppLevel(safeLevel);
            nextProgress = 0;
            levelAdvanced = true;
        }
    }

    const patch: Partial<User> = {
        xp: currentXp + xpAwarded,
        saas_ppp_enabled: true,
        saas_ppp_level_completed: nextLevelCompleted,
        saas_ppp_current_level: nextCurrentLevel,
        saas_ppp_current_level_progress: nextProgress,
        saas_ppp_primary_channel: normalized.primaryChannel || '',
        saas_ppp_secondary_channel: normalized.secondaryChannel ?? null,
        saas_ppp_certified_timestamp: nextCertifiedTimestamp,
        saas_ppp_l2_phase: nextPhase,
        saas_ppp_lessons_passed: lessonsPassed,
    };

    return {
        patch,
        xpAwarded,
        alreadyPassed: false,
        levelAdvanced,
        certified: !!nextCertifiedTimestamp,
        phaseCompleted,
        currentLevel: nextCurrentLevel,
        currentPhase: nextPhase,
    };
}

function computeSaasLevelProgress(
    level: number,
    phase: SaasPppPhase,
    lessonsPassed: Record<string, string[]>,
    primaryChannel: SaasLeadChannel | null,
    secondaryChannel: SaasLeadChannel | null
): number {
    const lessons = getSaasPppLessonsForLevel(level, {
        primaryChannel,
        secondaryChannel,
        phase,
    });
    if (!lessons.length) return 0;
    const levelKey = getSaasPppLevelKey(level, phase);
    const passedSet = new Set(lessonsPassed[levelKey] || []);
    const passedCount = lessons.reduce((count, lesson) => (passedSet.has(lesson.lessonId) ? count + 1 : count), 0);
    return Math.round((passedCount / lessons.length) * 100);
}

export type SaasPppLessonPassResult = {
    updatedUser: User;
    xpAwarded: number;
    alreadyPassed: boolean;
    levelAdvanced: boolean;
    certified: boolean;
    phaseCompleted: boolean;
    currentLevel: number;
    currentPhase: SaasPppPhase;
};

export async function completeSaasPppLessonPass(
    userId: string,
    level: number,
    lessonId: string
): Promise<SaasPppLessonPassResult> {
    const { firestore: db } = getFirebase();
    const safeLevel = clampSaasPppLevel(level);
    const nowIso = new Date().toISOString();

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');

        const scopedDealershipIds = getScopedDealershipIds(user);
        const dealershipMap = new Map(tour.dealerships.map((dealership) => [dealership.id, dealership]));
        const hasAccess = scopedDealershipIds.some((id) => isDealershipSaasPppEnabled(dealershipMap.get(id)));
        if (!hasAccess) throw new Error('SaaS PPP is not enabled for this dealership.');

        user.saas_ppp_enabled = hasAccess;
        const result = computeSaasPppPassPatch(user, safeLevel, lessonId, nowIso);
        Object.assign(user, result.patch);

        return {
            updatedUser: cloneTourUser(user),
            xpAwarded: result.xpAwarded,
            alreadyPassed: result.alreadyPassed,
            levelAdvanced: result.levelAdvanced,
            certified: result.certified,
            phaseCompleted: result.phaseCompleted,
            currentLevel: result.currentLevel,
            currentPhase: result.currentPhase,
        };
    }

    const userRef = doc(db, 'users', userId);
    let transactionResult: Omit<SaasPppLessonPassResult, 'updatedUser'> = {
        xpAwarded: 0,
        alreadyPassed: false,
        levelAdvanced: false,
        certified: false,
        phaseCompleted: false,
        currentLevel: safeLevel,
        currentPhase: 'primary',
    };

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');
        const user = ({ ...(userSnap.data() as User), userId: userSnap.id } as User);

        const scopedDealershipIds = getScopedDealershipIds(user);
        if (!scopedDealershipIds.length) {
            throw new Error('SaaS PPP is not enabled for this dealership.');
        }

        const dealershipRefs = scopedDealershipIds.map((id) => doc(db, 'dealerships', id));
        const dealershipSnaps = await Promise.all(dealershipRefs.map((ref) => transaction.get(ref)));
        const hasAccess = dealershipSnaps.some((snap) => (
            snap.exists() && isDealershipSaasPppEnabled(snap.data() as Partial<Dealership>)
        ));
        if (!hasAccess) {
            throw new Error('SaaS PPP is not enabled for this dealership.');
        }

        const result = computeSaasPppPassPatch(user, safeLevel, lessonId, nowIso);
        transaction.update(userRef, {
            ...result.patch,
            saas_ppp_enabled: hasAccess,
        });

        transactionResult = {
            xpAwarded: result.xpAwarded,
            alreadyPassed: result.alreadyPassed,
            levelAdvanced: result.levelAdvanced,
            certified: result.certified,
            phaseCompleted: result.phaseCompleted,
            currentLevel: result.currentLevel,
            currentPhase: result.currentPhase,
        };
    });

    const updatedUserSnap = await getDoc(userRef);
    if (!updatedUserSnap.exists()) {
        throw new Error('User not found after SaaS PPP update.');
    }

    return {
        updatedUser: { ...(updatedUserSnap.data() as User), userId: updatedUserSnap.id },
        ...transactionResult,
    };
}

export async function setSaasPppPrimaryChannel(userId: string, channel: SaasLeadChannel): Promise<User> {
    const sanitized = sanitizeSaasLeadChannel(channel);
    if (!sanitized) {
        throw new Error('Invalid primary channel.');
    }

    const { firestore: db } = getFirebase();
    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');

        const scopedDealershipIds = getScopedDealershipIds(user);
        const dealershipMap = new Map(tour.dealerships.map((dealership) => [dealership.id, dealership]));
        const hasAccess = scopedDealershipIds.some((id) => isDealershipSaasPppEnabled(dealershipMap.get(id)));
        if (!hasAccess) throw new Error('SaaS PPP is not enabled for this dealership.');

        const normalized = normalizeSaasPppUserState(user);
        if (normalized.currentLevel !== 2) {
            throw new Error('Primary channel selection is available when you reach LVL 2.');
        }
        const primaryKey = getSaasPppLevelKey(2, 'primary');
        const existingPassed = new Set(normalized.lessonsPassed[primaryKey] || []);
        if (existingPassed.size > 0 && normalized.primaryChannel && normalized.primaryChannel !== sanitized) {
            throw new Error('Primary channel is locked after passing LVL 2 primary lessons.');
        }

        const nextLessonsPassed = { ...normalized.lessonsPassed };
        nextLessonsPassed[primaryKey] = Array.from(existingPassed);
        const phase = normalized.l2Phase;
        const progress = computeSaasLevelProgress(2, phase, nextLessonsPassed, sanitized, normalized.secondaryChannel);

        Object.assign(user, {
            saas_ppp_enabled: hasAccess,
            saas_ppp_primary_channel: sanitized,
            saas_ppp_l2_phase: phase,
            saas_ppp_lessons_passed: nextLessonsPassed,
            saas_ppp_current_level_progress: progress,
        });
        return cloneTourUser(user);
    }

    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');
        const user = ({ ...(userSnap.data() as User), userId: userSnap.id } as User);

        const scopedDealershipIds = getScopedDealershipIds(user);
        if (!scopedDealershipIds.length) throw new Error('SaaS PPP is not enabled for this dealership.');
        const dealershipRefs = scopedDealershipIds.map((id) => doc(db, 'dealerships', id));
        const dealershipSnaps = await Promise.all(dealershipRefs.map((ref) => transaction.get(ref)));
        const hasAccess = dealershipSnaps.some((snap) => (
            snap.exists() && isDealershipSaasPppEnabled(snap.data() as Partial<Dealership>)
        ));
        if (!hasAccess) throw new Error('SaaS PPP is not enabled for this dealership.');

        const normalized = normalizeSaasPppUserState(user);
        if (normalized.currentLevel !== 2) {
            throw new Error('Primary channel selection is available when you reach LVL 2.');
        }
        const primaryKey = getSaasPppLevelKey(2, 'primary');
        const existingPassed = new Set(normalized.lessonsPassed[primaryKey] || []);
        if (existingPassed.size > 0 && normalized.primaryChannel && normalized.primaryChannel !== sanitized) {
            throw new Error('Primary channel is locked after passing LVL 2 primary lessons.');
        }

        const nextLessonsPassed = { ...normalized.lessonsPassed };
        nextLessonsPassed[primaryKey] = Array.from(existingPassed);
        const phase = normalized.l2Phase;
        const progress = computeSaasLevelProgress(2, phase, nextLessonsPassed, sanitized, normalized.secondaryChannel);

        transaction.update(userRef, {
            saas_ppp_enabled: hasAccess,
            saas_ppp_primary_channel: sanitized,
            saas_ppp_l2_phase: phase,
            saas_ppp_lessons_passed: nextLessonsPassed,
            saas_ppp_current_level_progress: progress,
        });
    });

    const updatedUserSnap = await getDoc(userRef);
    if (!updatedUserSnap.exists()) throw new Error('User not found after SaaS PPP update.');
    return { ...(updatedUserSnap.data() as User), userId: updatedUserSnap.id };
}

export async function setSaasPppSecondaryChannel(userId: string, channel: SaasLeadChannel): Promise<User> {
    const sanitized = sanitizeSaasLeadChannel(channel);
    if (!sanitized) {
        throw new Error('Invalid secondary channel.');
    }

    const { firestore: db } = getFirebase();
    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');

        const scopedDealershipIds = getScopedDealershipIds(user);
        const dealershipMap = new Map(tour.dealerships.map((dealership) => [dealership.id, dealership]));
        const hasAccess = scopedDealershipIds.some((id) => isDealershipSaasPppEnabled(dealershipMap.get(id)));
        if (!hasAccess) throw new Error('SaaS PPP is not enabled for this dealership.');

        const normalized = normalizeSaasPppUserState(user);
        if (normalized.currentLevel !== 2 || normalized.l2Phase !== 'secondary') {
            throw new Error('Secondary channel selection unlocks after LVL 2 primary mastery.');
        }
        if (!normalized.primaryChannel) {
            throw new Error('Select your primary channel first.');
        }
        if (normalized.primaryChannel === sanitized) {
            throw new Error('Secondary channel must be different from your primary channel.');
        }
        const secondaryKey = getSaasPppLevelKey(2, 'secondary');
        const existingPassed = new Set(normalized.lessonsPassed[secondaryKey] || []);
        if (existingPassed.size > 0 && normalized.secondaryChannel && normalized.secondaryChannel !== sanitized) {
            throw new Error('Secondary channel is locked after passing LVL 2 secondary lessons.');
        }

        const nextLessonsPassed = { ...normalized.lessonsPassed };
        nextLessonsPassed[secondaryKey] = Array.from(existingPassed);
        const progress = computeSaasLevelProgress(2, 'secondary', nextLessonsPassed, normalized.primaryChannel, sanitized);

        Object.assign(user, {
            saas_ppp_enabled: hasAccess,
            saas_ppp_secondary_channel: sanitized,
            saas_ppp_l2_phase: 'secondary',
            saas_ppp_lessons_passed: nextLessonsPassed,
            saas_ppp_current_level_progress: progress,
        });
        return cloneTourUser(user);
    }

    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');
        const user = ({ ...(userSnap.data() as User), userId: userSnap.id } as User);

        const scopedDealershipIds = getScopedDealershipIds(user);
        if (!scopedDealershipIds.length) throw new Error('SaaS PPP is not enabled for this dealership.');
        const dealershipRefs = scopedDealershipIds.map((id) => doc(db, 'dealerships', id));
        const dealershipSnaps = await Promise.all(dealershipRefs.map((ref) => transaction.get(ref)));
        const hasAccess = dealershipSnaps.some((snap) => (
            snap.exists() && isDealershipSaasPppEnabled(snap.data() as Partial<Dealership>)
        ));
        if (!hasAccess) throw new Error('SaaS PPP is not enabled for this dealership.');

        const normalized = normalizeSaasPppUserState(user);
        if (normalized.currentLevel !== 2 || normalized.l2Phase !== 'secondary') {
            throw new Error('Secondary channel selection unlocks after LVL 2 primary mastery.');
        }
        if (!normalized.primaryChannel) {
            throw new Error('Select your primary channel first.');
        }
        if (normalized.primaryChannel === sanitized) {
            throw new Error('Secondary channel must be different from your primary channel.');
        }

        const secondaryKey = getSaasPppLevelKey(2, 'secondary');
        const existingPassed = new Set(normalized.lessonsPassed[secondaryKey] || []);
        if (existingPassed.size > 0 && normalized.secondaryChannel && normalized.secondaryChannel !== sanitized) {
            throw new Error('Secondary channel is locked after passing LVL 2 secondary lessons.');
        }

        const nextLessonsPassed = { ...normalized.lessonsPassed };
        nextLessonsPassed[secondaryKey] = Array.from(existingPassed);
        const progress = computeSaasLevelProgress(2, 'secondary', nextLessonsPassed, normalized.primaryChannel, sanitized);

        transaction.update(userRef, {
            saas_ppp_enabled: hasAccess,
            saas_ppp_secondary_channel: sanitized,
            saas_ppp_l2_phase: 'secondary',
            saas_ppp_lessons_passed: nextLessonsPassed,
            saas_ppp_current_level_progress: progress,
        });
    });

    const updatedUserSnap = await getDoc(userRef);
    if (!updatedUserSnap.exists()) throw new Error('User not found after SaaS PPP update.');
    return { ...(updatedUserSnap.data() as User), userId: updatedUserSnap.id };
}

export async function incrementSaasPppAbandonmentCounter(userId: string): Promise<number> {
    const { firestore: db } = getFirebase();

    if (isTouringUser(userId)) {
        const tour = await getTourData();
        const user = tour.users.find((entry) => entry.userId === userId);
        if (!user) throw new Error('Tour user not found');
        const scopedDealershipIds = getScopedDealershipIds(user);
        const dealershipMap = new Map(tour.dealerships.map((dealership) => [dealership.id, dealership]));
        const hasAccess = scopedDealershipIds.some((id) => isDealershipSaasPppEnabled(dealershipMap.get(id)));
        if (!hasAccess) throw new Error('SaaS PPP is not enabled for this dealership.');

        user.saas_ppp_enabled = hasAccess;
        const current = Math.max(0, Math.round(Number(user.saas_ppp_abandonment_counter || 0)));
        const next = current + 1;
        user.saas_ppp_abandonment_counter = next;
        return next;
    }

    const userRef = doc(db, 'users', userId);
    let nextValue = 0;

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');
        const data = userSnap.data() as User;

        const scopedDealershipIds = getScopedDealershipIds(data as User);
        if (!scopedDealershipIds.length) {
            throw new Error('SaaS PPP is not enabled for this dealership.');
        }

        const dealershipRefs = scopedDealershipIds.map((id) => doc(db, 'dealerships', id));
        const dealershipSnaps = await Promise.all(dealershipRefs.map((ref) => transaction.get(ref)));
        const hasAccess = dealershipSnaps.some((snap) => (
            snap.exists() && isDealershipSaasPppEnabled(snap.data() as Partial<Dealership>)
        ));
        if (!hasAccess) {
            throw new Error('SaaS PPP is not enabled for this dealership.');
        }

        const current = Math.max(0, Math.round(Number(data.saas_ppp_abandonment_counter || 0)));
        nextValue = current + 1;
        transaction.update(userRef, { saas_ppp_enabled: hasAccess, saas_ppp_abandonment_counter: nextValue });
    });

    return nextValue;
}

export async function sendMessage(
    sender: User, 
    content: string, 
    target: { scope: MessageTargetScope; targetId: string; targetRole?: UserRole }
): Promise<Message> {
    const { firestore: db } = getFirebase();
     if (isTouringUser(sender.userId)) {
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
    const { firestore: db } = getFirebase();
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
  const { firestore: db } = getFirebase();
  const isTour = isTouringUser(creatorId);
  const lessonsRef = collection(db, 'lessons');
  const q = query(lessonsRef, where('createdByUserId', '==', creatorId), orderBy('title', 'asc'));
  const snap = isTour ? { docs: (await getTourData()).lessons.filter(l => l.createdByUserId === creatorId) } : await getDocs(q);
  
  const results: CreatedLessonStatus[] = [];
  const assignmentsRef = collection(db, 'lessonAssignments');

  for (const docSnap of (snap.docs as any[])) {
    const lesson = isTour ? docSnap : { ...docSnap.data(), lessonId: docSnap.id } as Lesson;
    
    const aSnap = await getDocs(query(assignmentsRef, where('lessonId', '==', lesson.lessonId)));
    const assignments = aSnap.docs.map(d => d.data() as LessonAssignment);
    
    const assignees: CreatedLessonStatus['assignees'] = [];
    let takenCount = 0;
    let lastAssigned: Date | null = null;

    for (const a of assignments) {
      if (!lastAssigned || a.timestamp > lastAssigned) lastAssigned = a.timestamp;
      
      const user = await getUserById(a.userId);
      if (!user) continue;

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
  const { firestore: db } = getFirebase();
  if (!['Admin', 'Developer'].includes(actor.role) || !hasDealershipAssignments(actor)) {
    throw new Error('Unauthorized');
  }
  
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
