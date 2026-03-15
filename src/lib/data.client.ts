
'use client';
import { differenceInCalendarDays, format, isToday, startOfDay, subDays } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge, Address, Message, MessageTargetScope, PendingInvitation, Ratings, InteractionSeverity, UserStats } from './definitions';
import { lessonCategoriesByRole, noPersonalDevelopmentRoles, allRoles } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, query, where, Timestamp, Firestore, orderBy, limit, runTransaction } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { generateTourData } from './tour-data';
import { initializeFirebase } from '@/firebase/init';
import {
    BASELINE,
    LAMBDA,
    DEFAULT_CX_AGGRESSIVENESS,
    DEFAULT_CX_DELTA_GAIN,
    MAX_CX_DELTA_PER_LESSON,
    clampRatings,
    updateRollingStats,
} from '@/lib/stats/updateRollingStats';
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
import type { CxScope } from '@/lib/cx/scope';
import type { CxSkillId } from '@/lib/cx/skills';
import {
    buildFreshUpLesson,
    computeUpMeterIncrement,
    evaluateUpMeterState,
    FRESH_UP_LESSON_ID,
    FRESH_UP_MAX_XP,
    FRESH_UP_MIN_XP,
    FRESH_UP_SKILL_WEIGHT,
    maybeUnlockFreshUp,
    resetUpMeterAfterFreshUp,
} from '@/lib/fresh-up';
import {
    ADAPTIVE_IMPROVEMENT_TARGET,
    ADAPTIVE_LESSON_MAP,
    ADAPTIVE_MONITORING_WINDOW,
    ADAPTIVE_RECOMMENDATION_COOLDOWN_HOURS,
    emptyAdaptiveSkillAverages,
    pickLowestGapSkill,
    toAdaptiveSkillFromTrait,
    type AdaptiveSkillAverages,
    type AdaptiveSkillKey,
} from '@/lib/adaptive-coaching';

function resolveFreshUpOutcomeTag(input: {
    explicitOutcomeTag?: string;
    outcome?: LessonLog['outcome'];
    coachingTag?: LessonLog['coachingTag'];
    summaryTag?: LessonLog['summaryTag'];
    severity?: InteractionSeverity;
}): LessonLog['outcomeTag'] {
    const explicit = (input.explicitOutcomeTag || '').trim();
    if (
        explicit === 'Customer Engaged' ||
        explicit === 'Trust Established' ||
        explicit === 'Appointment Set' ||
        explicit === 'Lost Momentum' ||
        explicit === 'Conversation Breakdown'
    ) {
        return explicit;
    }

    if (input.severity === 'behavior_violation') return 'Conversation Breakdown';

    const tag = input.summaryTag ?? input.coachingTag;
    if (tag === 'weak_follow_up') return 'Lost Momentum';
    if (tag === 'premature_close') return 'Lost Momentum';
    if (tag === 'strong_relationship') return 'Customer Engaged';
    if (tag === 'strong_empathy') return 'Trust Established';
    if (tag === 'trust_builder') return 'Trust Established';
    if (tag === 'closing_strength') return 'Appointment Set';

    if (input.outcome === 'successful') return 'Appointment Set';
    if (input.outcome === 'mixed') return 'Customer Engaged';
    return 'Lost Momentum';
}

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

function getCanonicalPublicOrigin(): string {
    const configured = process.env.NEXT_PUBLIC_INVITE_BASE_URL
        || process.env.INVITE_BASE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || process.env.APP_URL
        || 'https://autodrivecx.com';
    return configured.replace(/\/$/, '');
}

function alignInviteUrlToCurrentOrigin(rawUrl?: string): string {
    if (!rawUrl) return '';

    const clientOrigin = getClientOrigin();
    try {
        const target = new URL(rawUrl, clientOrigin);
        const isEnrollmentPath = target.pathname.startsWith('/enroll') || target.pathname.startsWith('/register');
        if (isEnrollmentPath) {
            const canonical = new URL(getCanonicalPublicOrigin());
            target.protocol = canonical.protocol;
            target.host = canonical.host;
        }

        return target.toString();
    } catch {
        return rawUrl;
    }
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
    now: Date,
    skillWeightMultiplier: number = 1
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
        const rawBefore = clampScore(typeof currentStat?.score === 'number' ? currentStat.score : BASELINE);
        const before = Math.round(rawBefore);
        const lastUpdated = toSafeDate(currentStat?.lastUpdated, now);
        const deltaDays = Math.max(0, (now.getTime() - lastUpdated.getTime()) / msPerDay);
        const drifted = BASELINE + (before - BASELINE) * Math.exp(-LAMBDA * deltaDays);
        const driftDelta = drifted - before;
        const ratingDelta = ratings[key] - before;
        const rawDelta = driftDelta + ratingDelta * DEFAULT_CX_DELTA_GAIN * skillWeightMultiplier;
        const stepDelta = Math.max(-MAX_CX_DELTA_PER_LESSON, Math.min(MAX_CX_DELTA_PER_LESSON, Math.round(rawDelta)));
        const after = clampScore(before + stepDelta);

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

function sanitizeXpDelta(
    xpGained: number,
    severity: InteractionSeverity,
    maxNormalXpAward: number = MAX_NORMAL_XP_AWARD
): number {
    const numericXp = Number.isFinite(xpGained) ? Math.round(xpGained) : 0;
    if (severity === 'behavior_violation') {
        if (numericXp > 0) return 0;
        return Math.max(-MAX_BEHAVIOR_XP_PENALTY, numericXp);
    }

    return Math.max(0, Math.min(maxNormalXpAward, numericXp));
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

function isFreshUpLessonInput(data: {
    lessonId: string;
    activitySource?: LessonLog['activitySource'];
}): boolean {
    return data.activitySource === 'fresh-up' || data.lessonId === FRESH_UP_LESSON_ID;
}

function getSkillWeightMultiplier(data: {
    skillWeightMultiplier?: number;
    activitySource?: LessonLog['activitySource'];
    lessonId: string;
}): number {
    const explicit = Number(data.skillWeightMultiplier);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return isFreshUpLessonInput(data) ? FRESH_UP_SKILL_WEIGHT : 1;
}

function getStreakBonus(now: Date, priorLogs: LessonLog[]): number {
    const priorCoreLogs = priorLogs.filter((log) => log.activitySource === 'core');
    if (!priorCoreLogs.length) return 0;

    const mostRecent = priorCoreLogs[0];
    const dayGap = differenceInCalendarDays(startOfDay(now), startOfDay(mostRecent.timestamp));
    return dayGap === 1 ? 20 : 0;
}

function buildNextFreshUpState(input: {
    user: User;
    now: Date;
    priorLogs: LessonLog[];
    ratings: Ratings;
    activitySource?: LessonLog['activitySource'];
    lessonId: string;
}): Pick<User, 'freshUpMeter' | 'freshUpAvailable' | 'freshUpLastTriggeredAt' | 'freshUpLastCompletedAt' | 'freshUpCompletedCount'> {
    // Up Meter progression: every core lesson moves the meter (weak/normal/strong + streak),
    // then probabilistic thresholds decide Fresh Up availability until 100 guarantees unlock.
    const currentMeter = Math.max(0, Math.round(Number(input.user.freshUpMeter ?? 0)));
    const currentAvailable = input.user.freshUpAvailable === true;
    const isFreshUp = isFreshUpLessonInput(input);

    if (isFreshUp) {
        return {
            freshUpMeter: resetUpMeterAfterFreshUp(currentMeter),
            freshUpAvailable: false,
            freshUpLastTriggeredAt: input.user.freshUpLastTriggeredAt ?? null,
            freshUpLastCompletedAt: input.now.toISOString(),
            freshUpCompletedCount: Math.max(0, Number(input.user.freshUpCompletedCount ?? 0)) + 1,
        };
    }

    if (input.activitySource !== 'core') {
        return {
            freshUpMeter: currentMeter,
            freshUpAvailable: currentAvailable,
            freshUpLastTriggeredAt: input.user.freshUpLastTriggeredAt ?? null,
            freshUpLastCompletedAt: input.user.freshUpLastCompletedAt ?? null,
            freshUpCompletedCount: Math.max(0, Number(input.user.freshUpCompletedCount ?? 0)),
        };
    }

    const averageRating = Math.round((
        input.ratings.empathy +
        input.ratings.listening +
        input.ratings.trust +
        input.ratings.followUp +
        input.ratings.closing +
        input.ratings.relationship
    ) / 6);
    const streakBonus = getStreakBonus(input.now, input.priorLogs);
    const nextMeter = currentMeter + computeUpMeterIncrement(averageRating, streakBonus);
    const unlocked = currentAvailable || maybeUnlockFreshUp(nextMeter);

    return {
        freshUpMeter: nextMeter,
        freshUpAvailable: unlocked,
        freshUpLastTriggeredAt: unlocked && !currentAvailable ? input.now.toISOString() : (input.user.freshUpLastTriggeredAt ?? null),
        freshUpLastCompletedAt: input.user.freshUpLastCompletedAt ?? null,
        freshUpCompletedCount: Math.max(0, Number(input.user.freshUpCompletedCount ?? 0)),
    };
}

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
    // Captures selected role from public signup for marketing attribution.
    signupRoleInterest?: UserRole;
    // Captures consultant referral attribution from URL/local storage.
    consultantReferral?: string;
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
        signupRoleInterest: options?.signupRoleInterest,
        consultant_referral: options?.consultantReferral?.trim().toLowerCase() || undefined,
        dealershipIds: dealershipIds,
        avatarUrl: 'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
        xp: 0,
        isPrivate: false,
        isPrivateFromOwner: false,
        showDealerCriticalOnly: true,
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
        freshUpMeter: 0,
        freshUpAvailable: false,
        freshUpLastTriggeredAt: null,
        freshUpLastCompletedAt: null,
        freshUpCompletedCount: 0,
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
        const tour = await getTourData();
        const user = tour.users.find(u => u.userId === userId);
        if (!user) throw new Error("Tour user not found after update");
        const shouldEnforceCriticalOnly = (data.showDealerCriticalOnly === false)
            && (Array.isArray(user.dealershipIds) ? user.dealershipIds : []).some((dealershipId) => {
                const dealership = (tour.dealerships || []).find((d) => d.id === dealershipId);
                return dealership?.disableManagementPrivateDataViewing === true;
            });
        if (shouldEnforceCriticalOnly) {
            data = { ...data, showDealerCriticalOnly: true };
        }
        Object.assign(user, data);
        return { ...user };
    }

    const userRef = doc(db, 'users', userId);
    let nextData = { ...data };
    if (data.showDealerCriticalOnly === false) {
        const existingUser = await getDataById<User>(db, 'users', userId);
        const dealershipIds = Array.isArray(existingUser?.dealershipIds) ? existingUser.dealershipIds : [];
        if (dealershipIds.length > 0) {
            const dealershipSnapshots = await Promise.all(
                Array.from(new Set(dealershipIds)).map((id) => getDoc(doc(db, 'dealerships', id)).catch(() => null))
            );
            const policyLocked = dealershipSnapshots.some((snapshot) => (
                snapshot?.exists() && snapshot.data()?.disableManagementPrivateDataViewing === true
            ));
            if (policyLocked) {
                nextData = { ...nextData, showDealerCriticalOnly: true };
            }
        }
    }
    try {
        await updateDoc(userRef, nextData);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: nextData,
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

export async function convertUserToSingleUser(targetUserId: string): Promise<void> {
    const { auth } = getFirebase();
    if (isTouringUser(targetUserId)) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to update this user.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/convertUserToSingleUser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ targetUserId }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || 'Failed to convert user to single-user mode.');
    }
}

export async function clearDealershipAssignedLessons(dealershipId: string): Promise<number> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to clear assignments.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/clearDealershipAssignments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ dealershipId }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Failed to clear assigned lessons for this dealership.');
    }

    return Number(payload?.deletedCount || 0);
}

export async function recalculateDealershipData(dealershipId: string): Promise<{ updatedUsers: number }> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to recalculate dealership data.');
    }
    if (!dealershipId || dealershipId === 'all') {
        throw new Error('Please select a specific dealership.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/recalculateDealershipData', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ dealershipId }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Failed to recalculate dealership data.');
    }

    return { updatedUsers: Number(payload?.updatedUsers || 0) };
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
        const tour = await getTourData();
        const trialWindow = buildTrialWindow(new Date());
        const newDealership: Dealership = {
            id: `tour-dealership-${Math.random()}`,
            name: dealershipData.name,
            status: 'active',
            address: dealershipData.address as Address,
            enableRetakeRecommendedTesting: false,
            enableNewRecommendedTesting: false,
            disableManagementPrivateDataViewing: false,
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
        tour.dealerships.push(newDealership);
        const groupedIds = tour.dealerships.map((dealership) => dealership.id);
        tour.dealerships.forEach((dealership) => {
            dealership.groupDealershipIds = groupedIds;
        });
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
    return { url: alignInviteUrlToCurrentOrigin(responseData.inviteUrl) };
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
        url: alignInviteUrlToCurrentOrigin(responseData.inviteUrl),
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

export async function claimDealershipEnrollment(token: string, role: UserRole, acceptPrivacyPolicy: boolean): Promise<void> {
    const { auth } = getFirebase();
    const idToken = await auth.currentUser?.getIdToken(true);
    const response = await fetch(`/api/enrollment/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token, role, acceptPrivacyPolicy }),
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

export type DealershipLeaderboardEntry = {
    userId: string;
    name: string;
    totalXp: number;
    level: number;
    readiness: 'green' | 'yellow' | 'red';
    readinessLabel: string;
};

export type TrendDirection = 'up' | 'down' | 'stable';

export type DealerFreshUpMetric = {
    score: number;
    trend: TrendDirection;
};

export type DealerFreshUpSkillAlert = {
    skill: 'Empathy' | 'Listening' | 'Trust Building' | 'Relationship Building' | 'Closing Ability';
    recommendation: string;
};

export type DealerFreshUpInsights = {
    available: boolean;
    periodDays: number;
    averageEmpathy: DealerFreshUpMetric;
    averageListening: DealerFreshUpMetric;
    averageTrust: DealerFreshUpMetric;
    averageRelationship: DealerFreshUpMetric;
    averageClosing: DealerFreshUpMetric;
    averageUpMeterPeak: number;
    upMeterEngagementLabel: string;
    totalFreshUpSessions: number;
    averageConversationLength: number;
    skillAlerts: DealerFreshUpSkillAlert[];
};

export type WeeklyFreshUpDigestEntityType = 'dealer' | 'consultant' | 'platform';

export type WeeklyFreshUpDigestRecord = {
    digestId: string;
    entityType: WeeklyFreshUpDigestEntityType;
    entityId: string;
    entityName: string;
    weekStart: Date;
    weekEnd: Date;
    headline: string;
    keyInsights: string[];
    recommendedAction: string;
    narrativeSummary?: string;
    metricsSnapshot: Record<string, unknown>;
    createdAt: Date;
    environment: 'sandbox' | 'production';
};

export type FreshUpRiskRadarRecord = {
    riskId: string;
    riskType: string;
    entityType: string;
    entityId: string;
    entityName: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidenceLevel: 'low' | 'medium' | 'high';
    timeRange: string;
    message: string;
    recommendedAction: string;
    supportingMetrics: Record<string, unknown>;
    createdAt: Date;
    resolvedAt?: Date;
    isActive: boolean;
    environment: 'sandbox' | 'production';
};

export type FreshUpCommandCenterResult = {
    generatedAt: string;
    entityMode: 'dealer' | 'consultant' | 'platform' | 'version';
    entityId: string;
    entityName: string;
    weeklyDigestSummary: {
        headline: string;
        topInsights: string[];
        recommendedAction: string;
    };
    activeRiskRadarSummary: {
        totalActiveRisks: number;
        topRisks: Array<{
            riskId: string;
            riskType: string;
            riskLevel: 'low' | 'medium' | 'high' | 'critical';
            message: string;
            recommendedAction: string;
        }>;
    };
    goalsAndTargetsSummary: {
        activeGoals: number;
        onTrack: number;
        atRisk: number;
        exceeded: number;
        stalled: number;
        topGoalsNeedingAttention: Array<{
            goalId: string;
            goalTitle: string;
            currentValue: number;
            targetValue: number;
            progressPercent: number;
            status: 'on_track' | 'at_risk' | 'exceeded' | 'stalled';
        }>;
    };
    activeAlertsSummary: {
        totalActiveAlerts: number;
        highSeverityAlerts: number;
        goalRelatedAlerts: number;
        versionRelatedAlerts: number;
        topAlerts: Array<{
            alertId: string;
            alertType: string;
            severity: string;
            message: string;
            recommendedAction: string;
        }>;
    };
    freshUpPerformanceSnapshot: {
        totalFreshUpSessions: number;
        averageUpMeterPeak: number;
        averageTrustShift: number;
        averageConversationLength: number;
        averageEmpathy: number;
        averageListening: number;
        averageTrust: number;
        averageFollowUp: number;
        averageClosing: number;
        averageRelationship: number;
    };
    coachingIntelligence?: {
        coachingId?: string;
        priorityLevel: 'low' | 'medium' | 'high' | 'critical';
        coachingTopic: string;
        message: string;
        supportingEvidence: string;
        recommendedPractice: string;
        suggestedAutoForgeModule: string;
    };
    coachingPrioritySummary: string;
    autoForgeRecommendationSummary: {
        module: string;
        why: string;
        action: string;
    };
    trendHighlights: Array<{ label: string; delta: number; direction: 'up' | 'down' | 'stable' }>;
    benchmarkSnapshot: {
        benchmarkType: string;
        highlights: Array<{ metricName: string; difference: number; interpretationLabel: string }>;
    };
    narrativeSummary?: {
        title: string;
        narrative: string;
        interpretationLabels: string[];
    };
    environment: 'sandbox' | 'production';
};

export type FreshUpCoachingInsight = {
    coachingId: string;
    entityType: 'consultant' | 'dealer' | 'team' | 'platform';
    entityId: string;
    entityName: string;
    priorityLevel: 'low' | 'medium' | 'high' | 'critical';
    priorityScore: number;
    coachingTopic: string;
    message: string;
    supportingEvidence: string;
    recommendedPractice: string;
    suggestedAutoForgeModule: string;
    createdAt: Date;
    resolvedAt?: Date;
    environment: 'sandbox' | 'production';
};

export type AdaptiveCoachingRecommendation = {
    skill: AdaptiveSkillKey;
    skillLabel: string;
    averageScore: number;
    recommendedLessonTitle: string;
    estimatedMinutes: number;
    associatedTrait: CxTrait;
    status: 'active' | 'improved';
    generatedAt: Date | null;
    lessonCompletedAt: Date | null;
    monitoringRemaining: number;
    improvedAt: Date | null;
    coachingMessage: string;
};

type AdaptiveCoachingDoc = {
    userId: string;
    dealerId?: string;
    status: 'active' | 'improved';
    skill: AdaptiveSkillKey;
    baselineScore: number;
    generatedAt: Date | null;
    lastSkillAverages: AdaptiveSkillAverages;
    recommendation: {
        title: string;
        estimatedMinutes: number;
        associatedTrait: CxTrait;
    };
    assignmentSource?: 'engine' | 'manager';
    moduleType?: 'lesson' | 'autoforge';
    lessonCompletedAt: Date | null;
    monitoringRemaining: number;
    monitoredScores: number[];
    improvedAt: Date | null;
};

const FRESH_UP_ALERT_RECOMMENDATIONS: Record<DealerFreshUpSkillAlert['skill'], string> = {
    'Empathy': 'Run AutoForge Module "Empathy in Motion"',
    'Listening': 'Run AutoForge Module "Active Listening Under Pressure"',
    'Trust Building': 'Run AutoForge Module "Trust Through Discovery"',
    'Relationship Building': 'Run AutoForge Module "Relationship Momentum"',
    'Closing Ability': 'Run AutoForge Module "Confidence to Commitment"',
};

function asMetricTrend(current: number, previous: number): TrendDirection {
    const delta = current - previous;
    if (Math.abs(delta) <= 1.5) return 'stable';
    return delta > 0 ? 'up' : 'down';
}

function roundToTenth(value: number): number {
    return Math.round(value * 10) / 10;
}

function getEngagementLabel(peak: number): string {
    if (peak <= 40) return 'Customer trust difficult to establish';
    if (peak <= 70) return 'Moderate engagement';
    return 'High trust conversations';
}

function normalizeAdaptiveDoc(raw: Record<string, unknown> | undefined, userId: string): AdaptiveCoachingDoc | null {
    if (!raw) return null;
    const skill = String(raw.skill || '') as AdaptiveSkillKey;
    if (!(skill in ADAPTIVE_LESSON_MAP)) return null;

    const suggestion = ADAPTIVE_LESSON_MAP[skill];
    const recommendationRaw = (raw.recommendation as Record<string, unknown> | undefined) || {};
    const averagesRaw = (raw.lastSkillAverages as Record<string, unknown> | undefined) || {};

    const averages = emptyAdaptiveSkillAverages();
    (Object.keys(averages) as AdaptiveSkillKey[]).forEach((key) => {
        const value = Number(averagesRaw[key] ?? 0);
        averages[key] = Number.isFinite(value) ? value : 0;
    });

    return {
        userId: String(raw.userId || userId),
        dealerId: String(raw.dealerId || ''),
        status: raw.status === 'improved' ? 'improved' : 'active',
        skill,
        baselineScore: Number(raw.baselineScore || 0),
        generatedAt: toSafeDate(raw.generatedAt, new Date(0)),
        lastSkillAverages: averages,
        recommendation: {
            title: String(recommendationRaw.title || suggestion.recommendedLessonTitle),
            estimatedMinutes: Number(recommendationRaw.estimatedMinutes ?? suggestion.estimatedMinutes),
            associatedTrait: (recommendationRaw.associatedTrait as CxTrait | undefined) || suggestion.associatedTrait,
        },
        assignmentSource: raw.assignmentSource === 'manager' ? 'manager' : 'engine',
        moduleType: raw.moduleType === 'autoforge' ? 'autoforge' : 'lesson',
        lessonCompletedAt: raw.lessonCompletedAt ? toSafeDate(raw.lessonCompletedAt, new Date(0)) : null,
        monitoringRemaining: Math.max(0, Math.round(Number(raw.monitoringRemaining ?? ADAPTIVE_MONITORING_WINDOW))),
        monitoredScores: Array.isArray(raw.monitoredScores)
            ? raw.monitoredScores.map((value) => Number(value)).filter((value) => Number.isFinite(value))
            : [],
        improvedAt: raw.improvedAt ? toSafeDate(raw.improvedAt, new Date(0)) : null,
    };
}

function buildAdaptiveCoachingMessage(skillLabel: string): string {
    return `Your recent Fresh Up conversations show an opportunity to improve ${skillLabel}.`;
}

function scoreFromAdaptiveSkill(ratings: Ratings, skill: AdaptiveSkillKey): number {
    if (skill === 'empathy') return ratings.empathy;
    if (skill === 'listening') return ratings.listening;
    if (skill === 'trust') return ratings.trust;
    if (skill === 'relationship') return ratings.relationship;
    return ratings.closing;
}

async function calculateAdaptiveAveragesFromFreshUps(db: Firestore, userId: string): Promise<{
    averages: AdaptiveSkillAverages;
    sessionCount: number;
}> {
    const empty = { averages: emptyAdaptiveSkillAverages(), sessionCount: 0 };
    const snap = await getDocs(query(
        collection(db, 'freshUpSessions'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(5)
    ));
    if (snap.empty) return empty;

    const rows = snap.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
    const totals = rows.reduce<AdaptiveSkillAverages>((acc, row) => {
        const scores = (row.scores as Record<string, unknown> | undefined) || {};
        acc.empathy += Number(scores.empathy || 0);
        acc.listening += Number(scores.listening || 0);
        acc.trust += Number(scores.trust || 0);
        acc.relationship += Number(scores.relationship || 0);
        acc.closing += Number(scores.closing || 0);
        return acc;
    }, emptyAdaptiveSkillAverages());
    const count = rows.length;

    return {
        sessionCount: count,
        averages: {
            empathy: count > 0 ? totals.empathy / count : 0,
            listening: count > 0 ? totals.listening / count : 0,
            trust: count > 0 ? totals.trust / count : 0,
            relationship: count > 0 ? totals.relationship / count : 0,
            closing: count > 0 ? totals.closing / count : 0,
        },
    };
}

async function updateAdaptiveCoachingAfterLesson(input: {
    db: Firestore;
    userId: string;
    dealerId?: string;
    activitySource: LessonLog['activitySource'];
    completionStatus: LessonLog['completionStatus'];
    trainedTrait?: string;
    ratings: Ratings;
    now: Date;
}): Promise<void> {
    if (input.completionStatus !== 'completed') return;

    const recommendationRef = doc(input.db, 'adaptiveCoachingRecommendations', input.userId);
    const currentSnap = await getDoc(recommendationRef);
    const currentDoc = normalizeAdaptiveDoc(currentSnap.exists() ? currentSnap.data() as Record<string, unknown> : undefined, input.userId);

    if (input.activitySource !== 'fresh-up') {
        if (!currentDoc || currentDoc.status !== 'active' || currentDoc.lessonCompletedAt) return;
        const completedSkill = toAdaptiveSkillFromTrait(input.trainedTrait);
        if (!completedSkill || completedSkill !== currentDoc.skill) return;

        await setDoc(recommendationRef, {
            userId: input.userId,
            dealerId: input.dealerId || currentDoc.dealerId || '',
            status: 'active',
            skill: currentDoc.skill,
            baselineScore: currentDoc.baselineScore,
            generatedAt: currentDoc.generatedAt ? Timestamp.fromDate(currentDoc.generatedAt) : Timestamp.fromDate(input.now),
            recommendation: {
                title: currentDoc.recommendation.title,
                estimatedMinutes: currentDoc.recommendation.estimatedMinutes,
                associatedTrait: currentDoc.recommendation.associatedTrait,
            },
            assignmentSource: currentDoc.assignmentSource || 'engine',
            moduleType: currentDoc.moduleType || 'lesson',
            lessonCompletedAt: Timestamp.fromDate(input.now),
            monitoringRemaining: ADAPTIVE_MONITORING_WINDOW,
            monitoredScores: [],
            improvedAt: null,
            lastSkillAverages: currentDoc.lastSkillAverages,
            updatedAt: Timestamp.fromDate(input.now),
        }, { merge: true });
        return;
    }

    let nextDoc = currentDoc;
    if (nextDoc && nextDoc.status === 'active' && nextDoc.lessonCompletedAt && nextDoc.monitoringRemaining > 0) {
        const trackedScore = scoreFromAdaptiveSkill(input.ratings, nextDoc.skill);
        const monitored = [...nextDoc.monitoredScores, trackedScore].slice(0, ADAPTIVE_MONITORING_WINDOW);
        const monitoringRemaining = Math.max(0, ADAPTIVE_MONITORING_WINDOW - monitored.length);
        const averageAfterTraining = monitored.length > 0
            ? monitored.reduce((sum, value) => sum + value, 0) / monitored.length
            : 0;
        const improved = monitored.length >= ADAPTIVE_MONITORING_WINDOW
            && (averageAfterTraining - nextDoc.baselineScore) >= ADAPTIVE_IMPROVEMENT_TARGET;

        await setDoc(recommendationRef, {
            monitoredScores: monitored,
            monitoringRemaining,
            improvedAt: improved ? Timestamp.fromDate(input.now) : null,
            status: improved ? 'improved' : 'active',
            updatedAt: Timestamp.fromDate(input.now),
        }, { merge: true });

        nextDoc = {
            ...nextDoc,
            monitoredScores: monitored,
            monitoringRemaining,
            improvedAt: improved ? input.now : null,
            status: improved ? 'improved' : 'active',
        };
    }

    const { averages, sessionCount } = await calculateAdaptiveAveragesFromFreshUps(input.db, input.userId);
    if (sessionCount === 0) return;
    const gapSkill = pickLowestGapSkill(averages);
    if (!gapSkill) return;

    const suggestion = ADAPTIVE_LESSON_MAP[gapSkill];
    const generatedAt = nextDoc?.generatedAt && nextDoc.generatedAt.getTime() > 0
        ? nextDoc.generatedAt
        : null;
    const stillCoolingDown = !!generatedAt
        && ((input.now.getTime() - generatedAt.getTime()) < (ADAPTIVE_RECOMMENDATION_COOLDOWN_HOURS * 60 * 60 * 1000))
        && nextDoc?.skill === gapSkill;
    if (stillCoolingDown) {
        await setDoc(recommendationRef, {
            lastSkillAverages: averages,
            updatedAt: Timestamp.fromDate(input.now),
        }, { merge: true });
        return;
    }

    await setDoc(recommendationRef, {
        userId: input.userId,
        dealerId: input.dealerId || nextDoc?.dealerId || '',
        status: 'active',
        skill: gapSkill,
        baselineScore: averages[gapSkill],
        generatedAt: Timestamp.fromDate(input.now),
        recommendation: {
            title: suggestion.recommendedLessonTitle,
            estimatedMinutes: suggestion.estimatedMinutes,
            associatedTrait: suggestion.associatedTrait,
        },
        assignmentSource: nextDoc?.assignmentSource || 'engine',
        moduleType: nextDoc?.moduleType || 'lesson',
        lessonCompletedAt: nextDoc?.skill === gapSkill ? (nextDoc.lessonCompletedAt ? Timestamp.fromDate(nextDoc.lessonCompletedAt) : null) : null,
        monitoringRemaining: nextDoc?.skill === gapSkill ? nextDoc.monitoringRemaining : ADAPTIVE_MONITORING_WINDOW,
        monitoredScores: nextDoc?.skill === gapSkill ? nextDoc.monitoredScores : [],
        improvedAt: nextDoc?.skill === gapSkill && nextDoc.status === 'improved' && nextDoc.improvedAt
            ? Timestamp.fromDate(nextDoc.improvedAt)
            : null,
        lastSkillAverages: averages,
        updatedAt: Timestamp.fromDate(input.now),
    }, { merge: true });
}

export async function getDealershipLeaderboard(dealershipId: string): Promise<DealershipLeaderboardEntry[]> {
    const { auth } = getFirebase();
    if (!dealershipId || dealershipId === 'all') return [];

    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    try {
        const idToken = await currentUser.getIdToken(true);
        const params = new URLSearchParams({ dealershipId });
        const response = await fetch(`/api/dealership/leaderboard?${params.toString()}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${idToken}` },
        });

        if (!response.ok) return [];
        const payload = await response.json().catch(() => ({}));
        return Array.isArray(payload?.leaderboard) ? payload.leaderboard as DealershipLeaderboardEntry[] : [];
    } catch (e) {
        console.warn('[getDealershipLeaderboard] API error caught:', e);
        return [];
    }
}

export async function getDealerFreshUpInsights(dealerId: string): Promise<DealerFreshUpInsights> {
    const empty: DealerFreshUpInsights = {
        available: false,
        periodDays: 30,
        averageEmpathy: { score: 0, trend: 'stable' },
        averageListening: { score: 0, trend: 'stable' },
        averageTrust: { score: 0, trend: 'stable' },
        averageRelationship: { score: 0, trend: 'stable' },
        averageClosing: { score: 0, trend: 'stable' },
        averageUpMeterPeak: 0,
        upMeterEngagementLabel: 'Customer trust difficult to establish',
        totalFreshUpSessions: 0,
        averageConversationLength: 0,
        skillAlerts: [],
    };

    if (!dealerId || dealerId === 'all') return empty;

    const { firestore: db } = getFirebase();
    const now = new Date();
    const currentStart = subDays(now, 30);
    const previousStart = subDays(now, 60);

    try {
        const snap = await getDocs(query(
            collection(db, 'freshUpSessions'),
            where('dealerId', '==', dealerId),
            where('timestamp', '>=', Timestamp.fromDate(previousStart))
        ));

        const records = snap.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            const timestamp = toSafeDate(data.timestamp, new Date(0));
            return {
                timestamp,
                conversationLength: Number(data.conversationLength || 0),
                scores: {
                    empathy: Number(data.scores?.empathy || 0),
                    listening: Number(data.scores?.listening || 0),
                    trust: Number(data.scores?.trust || 0),
                    relationship: Number(data.scores?.relationship || 0),
                    closing: Number(data.scores?.closing || 0),
                },
                upMeterPeak: Number(data.upMeter?.peak || 0),
            };
        }).filter((entry) => entry.timestamp.getTime() > 0);

        const current = records.filter((entry) => entry.timestamp >= currentStart);
        const previous = records.filter((entry) => entry.timestamp >= previousStart && entry.timestamp < currentStart);

        const summarize = (items: typeof current) => {
            if (!items.length) {
                return {
                    empathy: 0,
                    listening: 0,
                    trust: 0,
                    relationship: 0,
                    closing: 0,
                    upMeterPeak: 0,
                    conversationLength: 0,
                };
            }
            const totals = items.reduce((acc, item) => {
                acc.empathy += item.scores.empathy;
                acc.listening += item.scores.listening;
                acc.trust += item.scores.trust;
                acc.relationship += item.scores.relationship;
                acc.closing += item.scores.closing;
                acc.upMeterPeak += item.upMeterPeak;
                acc.conversationLength += item.conversationLength;
                return acc;
            }, {
                empathy: 0,
                listening: 0,
                trust: 0,
                relationship: 0,
                closing: 0,
                upMeterPeak: 0,
                conversationLength: 0,
            });
            const count = items.length;
            return {
                empathy: totals.empathy / count,
                listening: totals.listening / count,
                trust: totals.trust / count,
                relationship: totals.relationship / count,
                closing: totals.closing / count,
                upMeterPeak: totals.upMeterPeak / count,
                conversationLength: totals.conversationLength / count,
            };
        };

        const currentSummary = summarize(current);
        const previousSummary = summarize(previous);

        const insights: DealerFreshUpInsights = {
            available: current.length > 0,
            periodDays: 30,
            averageEmpathy: {
                score: roundToTenth(currentSummary.empathy),
                trend: asMetricTrend(currentSummary.empathy, previousSummary.empathy),
            },
            averageListening: {
                score: roundToTenth(currentSummary.listening),
                trend: asMetricTrend(currentSummary.listening, previousSummary.listening),
            },
            averageTrust: {
                score: roundToTenth(currentSummary.trust),
                trend: asMetricTrend(currentSummary.trust, previousSummary.trust),
            },
            averageRelationship: {
                score: roundToTenth(currentSummary.relationship),
                trend: asMetricTrend(currentSummary.relationship, previousSummary.relationship),
            },
            averageClosing: {
                score: roundToTenth(currentSummary.closing),
                trend: asMetricTrend(currentSummary.closing, previousSummary.closing),
            },
            averageUpMeterPeak: roundToTenth(currentSummary.upMeterPeak),
            upMeterEngagementLabel: getEngagementLabel(currentSummary.upMeterPeak),
            totalFreshUpSessions: current.length,
            averageConversationLength: roundToTenth(currentSummary.conversationLength),
            skillAlerts: [],
        };

        const scoreChecks: Array<{ skill: DealerFreshUpSkillAlert['skill']; score: number }> = [
            { skill: 'Empathy', score: currentSummary.empathy },
            { skill: 'Listening', score: currentSummary.listening },
            { skill: 'Trust Building', score: currentSummary.trust },
            { skill: 'Relationship Building', score: currentSummary.relationship },
            { skill: 'Closing Ability', score: currentSummary.closing },
        ];
        insights.skillAlerts = scoreChecks
            .filter((entry) => entry.score < 50)
            .map((entry) => ({
                skill: entry.skill,
                recommendation: FRESH_UP_ALERT_RECOMMENDATIONS[entry.skill],
            }));

        return insights;
    } catch (error) {
        console.warn('[getDealerFreshUpInsights] Failed to load insights', { dealerId, error });
        return empty;
    }
}

export async function getWeeklyFreshUpDigests(input: {
    entityType?: WeeklyFreshUpDigestEntityType;
    entityId?: string;
    dateFrom?: string;
    dateTo?: string;
    includeSandboxData?: boolean;
    latestOnly?: boolean;
    ensureCurrentWeek?: boolean;
    limit?: number;
}): Promise<{ records: WeeklyFreshUpDigestRecord[]; latest: WeeklyFreshUpDigestRecord | null }> {
    const empty = { records: [] as WeeklyFreshUpDigestRecord[], latest: null as WeeklyFreshUpDigestRecord | null };
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) return empty;

    try {
        const idToken = await currentUser.getIdToken(true);
        const params = new URLSearchParams();
        if (input.entityType) params.set('entityType', input.entityType);
        if (input.entityId) params.set('entityId', input.entityId);
        if (input.dateFrom) params.set('dateFrom', input.dateFrom);
        if (input.dateTo) params.set('dateTo', input.dateTo);
        if (input.includeSandboxData) params.set('includeSandboxData', 'true');
        if (input.latestOnly) params.set('latest', 'true');
        if (input.ensureCurrentWeek) params.set('ensureCurrentWeek', 'true');
        if (input.limit && Number.isFinite(input.limit)) params.set('limit', String(Math.max(1, input.limit)));

        const response = await fetch(`/api/admin/fresh-up-weekly-digest?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });
        if (!response.ok) return empty;

        const payload = await response.json();
        const recordsRaw = Array.isArray(payload?.records) ? payload.records : [];
        const records = recordsRaw.map((row: any) => ({
            digestId: String(row.digestId || ''),
            entityType: (String(row.entityType || 'platform') as WeeklyFreshUpDigestEntityType),
            entityId: String(row.entityId || ''),
            entityName: String(row.entityName || ''),
            weekStart: row.weekStart ? new Date(row.weekStart) : new Date(0),
            weekEnd: row.weekEnd ? new Date(row.weekEnd) : new Date(0),
            headline: String(row.headline || ''),
            keyInsights: Array.isArray(row.keyInsights) ? row.keyInsights.map((item: unknown) => String(item)) : [],
            recommendedAction: String(row.recommendedAction || ''),
            narrativeSummary: row.narrativeSummary ? String(row.narrativeSummary) : '',
            metricsSnapshot: row.metricsSnapshot && typeof row.metricsSnapshot === 'object' ? row.metricsSnapshot as Record<string, unknown> : {},
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(0),
            environment: String(row.environment || 'production') === 'sandbox' ? 'sandbox' : 'production',
        })) as WeeklyFreshUpDigestRecord[];

        return {
            records,
            latest: records[0] || null,
        };
    } catch (error) {
        console.warn('[getWeeklyFreshUpDigests] Failed to fetch weekly digests', error);
        return empty;
    }
}

export async function getFreshUpRiskRadar(input: {
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    riskType?: string;
    dealerId?: string;
    consultantId?: string;
    archetype?: string;
    concern?: string;
    version?: string;
    dateFrom?: string;
    dateTo?: string;
    isActive?: boolean;
    includeSandboxData?: boolean;
}): Promise<FreshUpRiskRadarRecord[]> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) return [];
    try {
        const token = await currentUser.getIdToken(true);
        const params = new URLSearchParams();
        if (input.riskLevel) params.set('riskLevel', input.riskLevel);
        if (input.riskType) params.set('riskType', input.riskType);
        if (input.dealerId) params.set('dealer', input.dealerId);
        if (input.consultantId) params.set('consultant', input.consultantId);
        if (input.archetype) params.set('archetype', input.archetype);
        if (input.concern) params.set('concern', input.concern);
        if (input.version) params.set('version', input.version);
        if (input.dateFrom) params.set('dateFrom', input.dateFrom);
        if (input.dateTo) params.set('dateTo', input.dateTo);
        if (typeof input.isActive === 'boolean') params.set('isActive', String(input.isActive));
        if (input.includeSandboxData) params.set('environment', 'sandbox');

        const response = await fetch(`/api/admin/fresh-up-risk-radar?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) return [];
        const payload = await response.json();
        const rows = Array.isArray(payload?.risks) ? payload.risks : [];
        return rows.map((row: any) => ({
            riskId: String(row.riskId || ''),
            riskType: String(row.riskType || ''),
            entityType: String(row.entityType || ''),
            entityId: String(row.entityId || ''),
            entityName: String(row.entityName || ''),
            riskLevel: (String(row.riskLevel || 'low') as FreshUpRiskRadarRecord['riskLevel']),
            confidenceLevel: (String(row.confidenceLevel || 'low') as FreshUpRiskRadarRecord['confidenceLevel']),
            timeRange: String(row.timeRange || ''),
            message: String(row.message || ''),
            recommendedAction: String(row.recommendedAction || ''),
            supportingMetrics: row.supportingMetrics && typeof row.supportingMetrics === 'object' ? row.supportingMetrics as Record<string, unknown> : {},
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(0),
            resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
            isActive: row.isActive !== false,
            environment: String(row.environment || 'production') === 'sandbox' ? 'sandbox' : 'production',
        }));
    } catch (error) {
        console.warn('[getFreshUpRiskRadar] Failed to load risk radar', error);
        return [];
    }
}

export async function getFreshUpCommandCenter(input: {
    entityMode: 'dealer' | 'consultant' | 'platform' | 'version';
    entityId?: string;
    comparisonEntityId?: string;
    filters?: {
        dateFrom?: string;
        dateTo?: string;
        dealerId?: string;
        userId?: string;
        freshUpVersionId?: string;
        environment?: 'sandbox' | 'production';
        includeSandboxData?: boolean;
    };
}): Promise<FreshUpCommandCenterResult | null> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    try {
        const token = await currentUser.getIdToken(true);
        const response = await fetch('/api/admin/fresh-up-command-center', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                entityMode: input.entityMode,
                entityId: input.entityId,
                comparisonEntityId: input.comparisonEntityId,
                filters: {
                    includeSandboxData: false,
                    ...(input.filters || {}),
                },
            }),
        });
        if (!response.ok) return null;
        const payload = await response.json();
        return payload as FreshUpCommandCenterResult;
    } catch (error) {
        console.warn('[getFreshUpCommandCenter] Failed to load command center', error);
        return null;
    }
}

export async function getFreshUpCoachingInsight(input: {
    entityType: 'consultant' | 'dealer' | 'team' | 'platform';
    entityId?: string;
    includeResolved?: boolean;
    includeSandboxData?: boolean;
    limit?: number;
}): Promise<FreshUpCoachingInsight[]> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) return [];
    try {
        const token = await currentUser.getIdToken(true);
        const params = new URLSearchParams();
        params.set('entityType', input.entityType);
        if (input.entityId) params.set('entityId', input.entityId);
        if (input.includeResolved) params.set('includeResolved', 'true');
        if (input.includeSandboxData) params.set('includeSandboxData', 'true');
        if (input.limit && Number.isFinite(input.limit)) params.set('limit', String(Math.max(1, input.limit)));

        const response = await fetch(`/api/admin/fresh-up-coaching-intelligence?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) return [];
        const payload = await response.json();
        const rows = Array.isArray(payload?.records) ? payload.records : [];
        return rows.map((row: any) => ({
            coachingId: String(row.coachingId || ''),
            entityType: String(row.entityType || 'consultant') as FreshUpCoachingInsight['entityType'],
            entityId: String(row.entityId || ''),
            entityName: String(row.entityName || ''),
            priorityLevel: String(row.priorityLevel || 'low') as FreshUpCoachingInsight['priorityLevel'],
            priorityScore: Number(row.priorityScore || 0),
            coachingTopic: String(row.coachingTopic || ''),
            message: String(row.message || ''),
            supportingEvidence: String(row.supportingEvidence || ''),
            recommendedPractice: String(row.recommendedPractice || ''),
            suggestedAutoForgeModule: String(row.suggestedAutoForgeModule || ''),
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(0),
            resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
            environment: String(row.environment || 'production') === 'sandbox' ? 'sandbox' : 'production',
        })) as FreshUpCoachingInsight[];
    } catch (error) {
        console.warn('[getFreshUpCoachingInsight] Failed to load coaching insight', error);
        return [];
    }
}

export async function getAdaptiveCoachingRecommendation(userId: string): Promise<AdaptiveCoachingRecommendation | null> {
    if (!userId || isTouringUser(userId)) return null;

    const { firestore: db } = getFirebase();
    const now = new Date();
    try {
        const recommendationRef = doc(db, 'adaptiveCoachingRecommendations', userId);
        const recommendationSnap = await getDoc(recommendationRef);
        const currentDoc = normalizeAdaptiveDoc(
            recommendationSnap.exists() ? recommendationSnap.data() as Record<string, unknown> : undefined,
            userId
        );

        const { averages, sessionCount } = await calculateAdaptiveAveragesFromFreshUps(db, userId);
        if (sessionCount === 0) return null;

        const gapSkill = pickLowestGapSkill(averages);
        if (!gapSkill) return null;

        const suggestion = ADAPTIVE_LESSON_MAP[gapSkill];
        const nowTs = Timestamp.fromDate(now);
        let effectiveDoc = currentDoc;

        const generatedAtMs = currentDoc?.generatedAt?.getTime() ?? 0;
        const withinCooldown = generatedAtMs > 0
            && ((now.getTime() - generatedAtMs) < (ADAPTIVE_RECOMMENDATION_COOLDOWN_HOURS * 60 * 60 * 1000));
        const shouldCreateNew =
            !currentDoc
            || currentDoc.skill !== gapSkill
            || generatedAtMs <= 0
            || !withinCooldown;

        if (shouldCreateNew) {
            await setDoc(recommendationRef, {
                userId,
                dealerId: currentDoc?.dealerId || '',
                status: 'active',
                skill: gapSkill,
                baselineScore: averages[gapSkill],
                generatedAt: nowTs,
                recommendation: {
                    title: suggestion.recommendedLessonTitle,
                    estimatedMinutes: suggestion.estimatedMinutes,
                    associatedTrait: suggestion.associatedTrait,
                },
                assignmentSource: currentDoc?.assignmentSource || 'engine',
                moduleType: currentDoc?.moduleType || 'lesson',
                lessonCompletedAt: null,
                monitoringRemaining: ADAPTIVE_MONITORING_WINDOW,
                monitoredScores: [],
                improvedAt: null,
                lastSkillAverages: averages,
                updatedAt: nowTs,
            }, { merge: true });

            effectiveDoc = {
                userId,
                dealerId: currentDoc?.dealerId || '',
                status: 'active',
                skill: gapSkill,
                baselineScore: averages[gapSkill],
                generatedAt: now,
                recommendation: {
                    title: suggestion.recommendedLessonTitle,
                    estimatedMinutes: suggestion.estimatedMinutes,
                    associatedTrait: suggestion.associatedTrait,
                },
                assignmentSource: currentDoc?.assignmentSource || 'engine',
                moduleType: currentDoc?.moduleType || 'lesson',
                lessonCompletedAt: null,
                monitoringRemaining: ADAPTIVE_MONITORING_WINDOW,
                monitoredScores: [],
                improvedAt: null,
                lastSkillAverages: averages,
            };
        } else {
            await setDoc(recommendationRef, {
                lastSkillAverages: averages,
                updatedAt: nowTs,
            }, { merge: true });
        }

        if (!effectiveDoc) return null;
        const currentSuggestion = ADAPTIVE_LESSON_MAP[effectiveDoc.skill];

        return {
            skill: effectiveDoc.skill,
            skillLabel: currentSuggestion.skillLabel,
            averageScore: Math.round((averages[effectiveDoc.skill] || 0) * 10) / 10,
            recommendedLessonTitle: effectiveDoc.recommendation.title,
            estimatedMinutes: effectiveDoc.recommendation.estimatedMinutes,
            associatedTrait: effectiveDoc.recommendation.associatedTrait,
            status: effectiveDoc.status,
            generatedAt: effectiveDoc.generatedAt && effectiveDoc.generatedAt.getTime() > 0 ? effectiveDoc.generatedAt : null,
            lessonCompletedAt: effectiveDoc.lessonCompletedAt && effectiveDoc.lessonCompletedAt.getTime() > 0 ? effectiveDoc.lessonCompletedAt : null,
            monitoringRemaining: effectiveDoc.monitoringRemaining,
            improvedAt: effectiveDoc.improvedAt && effectiveDoc.improvedAt.getTime() > 0 ? effectiveDoc.improvedAt : null,
            coachingMessage: buildAdaptiveCoachingMessage(currentSuggestion.skillLabel),
        };
    } catch (error) {
        console.warn('[getAdaptiveCoachingRecommendation] Failed to load recommendation', { userId, error });
        return null;
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
    if (lessonId === FRESH_UP_LESSON_ID) {
        const user = userId ? await getUserById(userId) : null;
        const lessonRole = user && user.role !== 'Owner' && user.role !== 'Admin' ? user.role : 'Sales Consultant';
        return buildFreshUpLesson(lessonRole as LessonRole);
    }
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

export async function createLesson(
    lessonData: { title: string; category: LessonCategory; associatedTrait: CxTrait; targetRole: UserRole | 'global'; scenario: string; },
    creator: User,
    options?: { autoAssignByRole?: boolean; scopedDealershipId?: string | null; }
): Promise<{ lesson: Lesson; autoAssignedCount: number; autoAssignFailed: boolean }> {
    const { firestore: db } = getFirebase();
    const scopedLessonDealershipIds = options?.scopedDealershipId && options.scopedDealershipId !== 'all'
        ? [options.scopedDealershipId]
        : Array.from(new Set([...(creator.dealershipIds || []), ...(creator.selfDeclaredDealershipId ? [creator.selfDeclaredDealershipId] : [])]));
    if (isTouringUser(creator.userId)) {
        const { lessons } = await getTourData();
        const newLesson: Lesson = {
            lessonId: `tour-lesson-${Math.random().toString(36).substring(7)}`,
            ...lessonData,
            role: lessonData.targetRole as LessonRole,
            customScenario: lessonData.scenario,
            createdByUserId: creator.userId,
            dealershipIds: scopedLessonDealershipIds,
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
        dealershipIds: scopedLessonDealershipIds,
    };
    await setDoc(newLessonRef, newLesson);

    let autoAssignedCount = 0;
    if (options?.autoAssignByRole) {
        try {
            const autoAssignedUserIds = new Set<string>();
            const recipients = (await getManageableUsers(creator.userId)).filter(u => 
                !noPersonalDevelopmentRoles.includes(u.role) &&
                (lessonData.targetRole === 'global' || u.role === lessonData.targetRole) &&
                (
                    scopedLessonDealershipIds.length === 0 ||
                    (Array.isArray(u.dealershipIds) ? u.dealershipIds : []).some((id) => scopedLessonDealershipIds.includes(id))
                )
            );
            for (const recipient of recipients) {
                await assignLesson(recipient.userId, newLesson.lessonId, creator.userId);
                autoAssignedCount++;
                autoAssignedUserIds.add(recipient.userId);
            }

            // Also assign to creator so it appears in their "Today's Lessons > Assigned" card.
            const creatorMatchesTargetRole = lessonData.targetRole === 'global' || creator.role === lessonData.targetRole;
            if (
                creatorMatchesTargetRole &&
                !noPersonalDevelopmentRoles.includes(creator.role) &&
                !autoAssignedUserIds.has(creator.userId)
            ) {
                await assignLesson(creator.userId, newLesson.lessonId, creator.userId);
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
        const viewer = await getUserById(userId);
        const viewerDealershipIds = Array.from(new Set([...(viewer?.dealershipIds || []), ...(viewer?.selfDeclaredDealershipId ? [viewer.selfDeclaredDealershipId] : [])]));
        return lessons.filter((l) => {
            if (!ids.includes(l.lessonId)) return false;
            if (!Array.isArray(l.dealershipIds) || l.dealershipIds.length === 0) return true;
            return l.dealershipIds.some((id) => viewerDealershipIds.includes(id));
        });
    }

    const q = query(collection(db, 'lessonAssignments'), where("userId", "==", userId), where("completed", "==", false));
    const snap = await getDocs(q);
    const ids = snap.docs.map(d => (d.data() as LessonAssignment).lessonId);
    if (ids.length === 0) return [];

    const lessonsSnap = await getDocs(query(collection(db, 'lessons'), where("lessonId", "in", ids.slice(0, 30))));
    const viewer = await getUserById(userId);
    const viewerDealershipIds = Array.from(new Set([...(viewer?.dealershipIds || []), ...(viewer?.selfDeclaredDealershipId ? [viewer.selfDeclaredDealershipId] : [])]));
    return lessonsSnap.docs
        .map(d => ({ ...d.data(), id: d.id } as Lesson))
        .filter((lesson) => {
            if (!Array.isArray(lesson.dealershipIds) || lesson.dealershipIds.length === 0) return true;
            return lesson.dealershipIds.some((id) => viewerDealershipIds.includes(id));
        });
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
    const [assignee, lesson] = await Promise.all([
        getUserById(userId),
        getLessonById(lessonId, assignerId),
    ]);
    if (!assignee) throw new Error('Assignee not found.');
    if (!lesson) throw new Error('Lesson not found.');

    const lessonDealershipIds = Array.isArray(lesson.dealershipIds) ? lesson.dealershipIds : [];
    if (lessonDealershipIds.length > 0) {
        const assigneeDealershipIds = Array.from(new Set([...(assignee.dealershipIds || []), ...(assignee.selfDeclaredDealershipId ? [assignee.selfDeclaredDealershipId] : [])]));
        const sharesScopedDealership = lessonDealershipIds.some((id) => assigneeDealershipIds.includes(id));
        if (!sharesScopedDealership) {
            throw new Error('Cannot assign this lesson outside its dealership scope.');
        }
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
                startedAt: data.startedAt ? toSafeDate(data.startedAt, new Date(0)) : undefined,
            };
        })
        .filter(log => log.timestamp.getTime() > 0)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export type CxTrendSample = {
    date: string;
    scores: Record<CxSkillId, number>;
};

type CxScoreSnapshot = Record<CxSkillId, number>;

function getScopeStatsScores(user: User): Record<CxSkillId, number> | null {
    const stats = user.stats as Record<string, any> | undefined;
    if (!stats) return null;

    const read = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return clampScore(value);
        if (value && typeof value === 'object' && typeof (value as any).score === 'number') {
            return clampScore((value as any).score);
        }
        return null;
    };

    const empathy = read(stats.empathy);
    const listening = read(stats.listening);
    const trust = read(stats.trust);
    const followUp = read(stats.followUp);
    const closing = read(stats.closing);
    const relationship = read(stats.relationship ?? stats.relationshipBuilding);

    if (
        empathy === null ||
        listening === null ||
        trust === null ||
        followUp === null ||
        closing === null ||
        relationship === null
    ) {
        return null;
    }

    return { empathy, listening, trust, followUp, closing, relationship };
}

function toDayKey(date: Date): string {
    return format(startOfDay(date), 'yyyy-MM-dd');
}

function getLessonLogScores(log: LessonLog): CxScoreSnapshot {
    const ratings = log.ratings;
    return {
        empathy: clampScore(Number(ratings?.empathy ?? log.empathy ?? 0)),
        listening: clampScore(Number(ratings?.listening ?? log.listening ?? 0)),
        trust: clampScore(Number(ratings?.trust ?? log.trust ?? 0)),
        followUp: clampScore(Number(ratings?.followUp ?? log.followUp ?? 0)),
        closing: clampScore(Number(ratings?.closing ?? log.closing ?? 0)),
        relationship: clampScore(Number(ratings?.relationship ?? log.relationshipBuilding ?? 0)),
    };
}

function averageSnapshots(samples: CxScoreSnapshot[]): CxScoreSnapshot | null {
    if (!samples.length) return null;

    const totals = samples.reduce((acc, sample) => {
        acc.empathy += sample.empathy;
        acc.listening += sample.listening;
        acc.trust += sample.trust;
        acc.followUp += sample.followUp;
        acc.closing += sample.closing;
        acc.relationship += sample.relationship;
        return acc;
    }, {
        empathy: 0,
        listening: 0,
        trust: 0,
        followUp: 0,
        closing: 0,
        relationship: 0,
    });

    const count = samples.length;
    return {
        empathy: Number((totals.empathy / count).toFixed(1)),
        listening: Number((totals.listening / count).toFixed(1)),
        trust: Number((totals.trust / count).toFixed(1)),
        followUp: Number((totals.followUp / count).toFixed(1)),
        closing: Number((totals.closing / count).toFixed(1)),
        relationship: Number((totals.relationship / count).toFixed(1)),
    };
}

async function buildHistoricalTrendSeries(users: User[], safeDays: number, today: Date): Promise<CxTrendSample[]> {
    const rangeStart = startOfDay(subDays(today, safeDays - 1));
    const orderedDates = Array.from({ length: safeDays }, (_, idx) => (
        format(subDays(today, safeDays - 1 - idx), 'yyyy-MM-dd')
    ));

    const userLogs = await Promise.all(users.map(async (user) => ({
        userId: user.userId,
        logs: (await getConsultantActivity(user.userId)).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    })));

    const currentSnapshots = new Map<string, CxScoreSnapshot>();

    userLogs.forEach(({ userId, logs }) => {
        const priorLog = [...logs]
            .reverse()
            .find((log) => startOfDay(log.timestamp).getTime() < rangeStart.getTime());
        if (priorLog) {
            currentSnapshots.set(userId, getLessonLogScores(priorLog));
        }
    });

    const series = orderedDates.map((date) => {
        userLogs.forEach(({ userId, logs }) => {
            const dailyLogs = logs.filter((log) => toDayKey(log.timestamp) === date);
            if (!dailyLogs.length) return;

            const dailyAverage = averageSnapshots(dailyLogs.map(getLessonLogScores));
            if (dailyAverage) {
                currentSnapshots.set(userId, dailyAverage);
            }
        });

        const scopeAverage = averageSnapshots(Array.from(currentSnapshots.values()));
        return scopeAverage ? { date, scores: scopeAverage } : null;
    });

    return series.filter((sample): sample is CxTrendSample => sample !== null);
}

function buildTourTrendSeries(
    buckets: Map<string, {
        empathy: number;
        listening: number;
        trust: number;
        followUp: number;
        closing: number;
        relationship: number;
        count: number;
    }>,
    safeDays: number,
    today: Date
): CxTrendSample[] {
    const orderedDates = Array.from({ length: safeDays }, (_, idx) => (
        format(subDays(today, safeDays - 1 - idx), 'yyyy-MM-dd')
    ));

    const seededStart = {
        empathy: 72,
        listening: 71,
        trust: 74,
        followUp: 68,
        closing: 66,
        relationship: 78,
    };

    const upliftByRange = safeDays <= 7
        ? { empathy: 2.6, listening: 2.1, trust: 1.8, followUp: 2.9, closing: 2.4, relationship: 1.7 }
        : safeDays <= 30
            ? { empathy: 4.8, listening: 4.1, trust: 3.5, followUp: 5.6, closing: 4.4, relationship: 3.8 }
            : { empathy: 7.2, listening: 6.4, trust: 5.7, followUp: 8.1, closing: 6.9, relationship: 6.1 };

    return orderedDates.map((date, index) => {
        const progress = orderedDates.length <= 1 ? 1 : index / (orderedDates.length - 1);
        const bucket = buckets.get(date);
        const syntheticScores = {
            empathy: Number((seededStart.empathy + upliftByRange.empathy * progress).toFixed(1)),
            listening: Number((seededStart.listening + upliftByRange.listening * progress).toFixed(1)),
            trust: Number((seededStart.trust + upliftByRange.trust * progress).toFixed(1)),
            followUp: Number((seededStart.followUp + upliftByRange.followUp * progress).toFixed(1)),
            closing: Number((seededStart.closing + upliftByRange.closing * progress).toFixed(1)),
            relationship: Number((seededStart.relationship + upliftByRange.relationship * progress).toFixed(1)),
        };

        if (!bucket) {
            return { date, scores: syntheticScores };
        }

        const actualScores = {
            empathy: Number((bucket.empathy / bucket.count).toFixed(1)),
            listening: Number((bucket.listening / bucket.count).toFixed(1)),
            trust: Number((bucket.trust / bucket.count).toFixed(1)),
            followUp: Number((bucket.followUp / bucket.count).toFixed(1)),
            closing: Number((bucket.closing / bucket.count).toFixed(1)),
            relationship: Number((bucket.relationship / bucket.count).toFixed(1)),
        };

        return {
            date,
            scores: {
                empathy: Math.max(actualScores.empathy, syntheticScores.empathy),
                listening: Math.max(actualScores.listening, syntheticScores.listening),
                trust: Math.max(actualScores.trust, syntheticScores.trust),
                followUp: Math.max(actualScores.followUp, syntheticScores.followUp),
                closing: Math.max(actualScores.closing, syntheticScores.closing),
                relationship: Math.max(actualScores.relationship, syntheticScores.relationship),
            },
        };
    });
}

async function getScopeUsers(scope: CxScope): Promise<User[]> {
    if (isTouringUser(scope.userId) || String(scope.storeId || '').startsWith('tour-') || String(scope.comparisonStoreId || '').startsWith('tour-')) {
        const { users, dealerships } = await getTourData();
        if (scope.userId) return users.filter((u) => u.userId === scope.userId);
        if (scope.storeId) {
            return users.filter((u) => (Array.isArray(u.dealershipIds) ? u.dealershipIds : []).includes(scope.storeId as string));
        }
        if (scope.comparisonStoreId) {
            const anchorDealership = dealerships.find((d) => d.id === scope.comparisonStoreId);
            const groupIds = Array.from(new Set([
                scope.comparisonStoreId,
                ...((anchorDealership?.groupDealershipIds || []) as string[]),
            ]));
            return users.filter((u) => {
                const ids = Array.isArray(u.dealershipIds) ? u.dealershipIds : [];
                return ids.some((id) => groupIds.includes(id));
            });
        }
        return users;
    }

    if (scope.userId) {
        const user = await getUserById(scope.userId);
        return user ? [user] : [];
    }

    const { firestore: db } = getFirebase();
    if (scope.comparisonStoreId && !scope.storeId) {
        const anchorRef = doc(db, 'dealerships', scope.comparisonStoreId);
        const anchorSnap = await getDoc(anchorRef).catch(() => null);
        const anchorData = anchorSnap?.exists() ? (anchorSnap.data() as Dealership) : null;
        const groupIds = Array.from(new Set([
            scope.comparisonStoreId,
            ...((anchorData?.groupDealershipIds || []) as string[]),
        ])).filter(Boolean);
        if (!groupIds.length) return [];

        // Firestore array-contains-any supports up to 10 values per query.
        const chunks: string[][] = [];
        for (let i = 0; i < groupIds.length; i += 10) chunks.push(groupIds.slice(i, i + 10));

        const snapshots = await Promise.all(
            chunks.map((chunk) =>
                getDocs(query(collection(db, 'users'), where('dealershipIds', 'array-contains-any', chunk)))
            )
        );

        const byUserId = new Map<string, User>();
        snapshots.forEach((snap) => {
            snap.docs.forEach((doc) => {
                byUserId.set(doc.id, { ...doc.data(), userId: doc.id } as User);
            });
        });

        return Array.from(byUserId.values()).filter((member) => !['Admin', 'Developer', 'Trainer'].includes(member.role));
    }

    const usersSnap = scope.storeId
        ? await getDocs(query(collection(db, 'users'), where('dealershipIds', 'array-contains', scope.storeId)))
        : await getDocs(collection(db, 'users'));

    return usersSnap.docs
        .map((doc) => ({ ...doc.data(), userId: doc.id } as User))
        .filter((member) => !['Admin', 'Developer', 'Trainer'].includes(member.role));
}

export async function getCxTrendForScope(scope: CxScope, days: number = 30): Promise<CxTrendSample[]> {
    const safeDays = Math.max(1, Math.min(90, Math.round(days)));
    const today = startOfDay(new Date());
    const isTourScope = isTouringUser(scope.userId) || String(scope.storeId || '').startsWith('tour-');
    if (isTourScope) {
        const rangeStart = startOfDay(subDays(today, safeDays - 1));
        const rangeEnd = new Date(today);
        rangeEnd.setHours(23, 59, 59, 999);

        const users = await getScopeUsers(scope);
        const allowedUserIds = new Set(users.map((u) => u.userId));
        if (!allowedUserIds.size) return [];

        const { lessonLogs } = await getTourData();
        const buckets = new Map<string, {
            empathy: number;
            listening: number;
            trust: number;
            followUp: number;
            closing: number;
            relationship: number;
            count: number;
        }>();

        lessonLogs.forEach((log) => {
            if (!allowedUserIds.has(log.userId)) return;
            if (log.timestamp < rangeStart || log.timestamp > rangeEnd) return;
            const key = toDayKey(log.timestamp);
            const existing = buckets.get(key) || {
                empathy: 0,
                listening: 0,
                trust: 0,
                followUp: 0,
                closing: 0,
                relationship: 0,
                count: 0,
            };
            existing.empathy += clampScore(Number(log.empathy || 0));
            existing.listening += clampScore(Number(log.listening || 0));
            existing.trust += clampScore(Number(log.trust || 0));
            existing.followUp += clampScore(Number(log.followUp || 0));
            existing.closing += clampScore(Number(log.closing || 0));
            existing.relationship += clampScore(Number(log.relationshipBuilding || 0));
            existing.count += 1;
            buckets.set(key, existing);
        });

        if (buckets.size > 0) {
            return buildTourTrendSeries(buckets, safeDays, today);
        }
        // In tour mode, avoid falling back to static scorecard snapshots when
        // the selected range has no activity; surface as "no data" instead.
        return [];
    }

    const users = await getScopeUsers(scope);
    if (!users.length) return [];

    const historicalSeries = await buildHistoricalTrendSeries(users, safeDays, today);
    if (historicalSeries.length) return historicalSeries;

    const snapshots = users
        .map((user) => getScopeStatsScores(user))
        .filter((scores): scores is Record<CxSkillId, number> => scores !== null);
    const fallbackScores = averageSnapshots(snapshots);
    if (!fallbackScores) return [];

    return Array.from({ length: safeDays }, (_, idx) => ({
        date: format(subDays(today, safeDays - 1 - idx), 'yyyy-MM-dd'),
        scores: fallbackScores,
    }));
}

export async function getDailyLessonLimits(userId: string): Promise<{ recommendedTaken: boolean, otherTaken: boolean }> {
    if (isTouringUser(userId)) {
        // Guided tours should remain repeatable and never be blocked by "daily" limits.
        return { recommendedTaken: false, otherTaken: false };
    }

    const logs = await getConsultantActivity(userId);
    const todayLogs = logs.filter((log) => (
        isToday(log.timestamp) &&
        log.activitySource !== 'fresh-up' &&
        log.activitySource !== 'ppp' &&
        log.activitySource !== 'saas-ppp'
    ));
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
    activitySource?: LessonLog['activitySource'];
    startedAt?: Date;
    completionStatus?: LessonLog['completionStatus'];
    conversationLength?: number;
    messagesSent?: number;
    aiResponseCount?: number;
    upMeterStart?: number;
    upMeterPeak?: number;
    upMeterEnd?: number;
    outcome?: LessonLog['outcome'];
    outcomeTag?: LessonLog['outcomeTag'];
    freshUpId?: string;
    characterName?: string;
    coachingTag?: LessonLog['coachingTag'];
    summaryTag?: LessonLog['summaryTag'];
    sprocketCoachingLine?: string;
    difficulty?: number;
    sourceType?: LessonLog['sourceType'];
    personalityType?: string;
    buyingStage?: string;
    primaryConcern?: string;
    secondaryConcern?: string;
    communicationStyle?: string;
    vehicleInterest?: string;
    difficultyLevel?: string;
    startingEmotionalState?: string;
    endingEmotionalState?: string;
    finalCustomerResponse?: string;
    endingType?: LessonLog['endingType'];
    recommendedNextStep?: LessonLog['recommendedNextStep'];
    trustShift?: number;
    archetypeId?: string;
    archetypeName?: string;
    archetypeCategory?: LessonLog['archetypeCategory'];
    humorLevel?: 0 | 1 | 2 | 3;
    guardrailFlags?: string[];
    contentValidationPassed?: boolean;
    validationFailureReasons?: string[];
    skillWeightMultiplier?: number;
    sandboxMode?: boolean;
    saveSessionToLiveAnalytics?: boolean;
    memoryDebugState?: Record<string, unknown>;
    scoringDebugState?: Record<string, unknown>;
    scenarioGenerationDetails?: Record<string, unknown>;
    freshUpVersionId?: string;
    freshUpVersionName?: string;
    isExperimental?: boolean;
    environment?: 'sandbox' | 'production';
    roleType?: LessonLog['roleType'];
    interactionDisplayLabel?: LessonLog['interactionDisplayLabel'];
    concernCategoryRoleSpecific?: LessonLog['concernCategoryRoleSpecific'];
    nextStepType?: LessonLog['nextStepType'];
    roleLanguageVersion?: LessonLog['roleLanguageVersion'];
}): Promise<{ updatedUser: User, newBadges: Badge[], freshUpSessionStored?: boolean, freshUpSessionId?: string } & LessonCompletionDetails> {
    const { firestore: db } = getFirebase();
    const severity = normalizeSeverity(data.severity);
    const normalizedRatings = normalizeRatings(data.ratings, data.scores);
    const normalizedScores = toLegacyScores(normalizedRatings);
    const flags = normalizeFlags(data.flags);
    const isBaselineAssessment = String(data.lessonId || '').startsWith('baseline-');
    const activitySource = data.activitySource ?? (isFreshUpLessonInput(data) ? 'fresh-up' : 'core');
    const skillWeightMultiplier = getSkillWeightMultiplier({ ...data, activitySource });
    const freshUpOutcomeTag = isFreshUpLessonInput(data)
        ? resolveFreshUpOutcomeTag({
            explicitOutcomeTag: data.outcomeTag,
            outcome: data.outcome,
            coachingTag: data.coachingTag,
            summaryTag: data.summaryTag,
            severity,
        })
        : undefined;
    const sanitizedXpDelta = sanitizeXpDelta(
        data.xpGained,
        severity,
        activitySource === 'fresh-up' ? FRESH_UP_MAX_XP : MAX_NORMAL_XP_AWARD
    );
    const xpDelta = (!isBaselineAssessment && severity === 'normal' && sanitizedXpDelta === 0)
        ? (activitySource === 'fresh-up' ? FRESH_UP_MIN_XP : 10)
        : sanitizedXpDelta;

    if (isTouringUser(data.userId)) {
        const tour = await getTourData();
        const user = tour.users.find(u => u.userId === data.userId);
        if (!user) throw new Error('Tour user not found');

        const now = new Date();
        const priorLogs = tour.lessonLogs
            .filter((log) => log.userId === data.userId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        let statsResult: ReturnType<typeof applyTourRollingStatsUpdate>;
        if (isBaselineAssessment) {
            const currentStats = (user.stats ?? buildDefaultUserStats(now)) as Partial<UserStats>;
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

            statsResult = applyTourRollingStatsUpdate(seededStats, normalizedRatings, now, skillWeightMultiplier);
            user.stats = statsResult.nextStats;
        }
        user.xp = computeNextXp(user.xp, xpDelta, severity);
        Object.assign(user, buildNextFreshUpState({
            user,
            now,
            priorLogs,
            ratings: normalizedRatings,
            activitySource,
            lessonId: data.lessonId,
        }));

        const scoreDelta = {
            empathy: statsResult.after.empathy - statsResult.before.empathy,
            listening: statsResult.after.listening - statsResult.before.listening,
            trust: statsResult.after.trust - statsResult.before.trust,
            followUp: statsResult.after.followUp - statsResult.before.followUp,
            closing: statsResult.after.closing - statsResult.before.closing,
            relationshipBuilding: statsResult.after.relationship - statsResult.before.relationship,
        };
        const dealerId = user.dealershipIds?.[0] || user.selfDeclaredDealershipId;

        // Fresh Up logging keeps explicit metric deltas for future dealer/character analytics.
        const newTourLog: LessonLog = {
            logId: `tour-log-${data.userId}-${now.getTime()}`,
            timestamp: now,
            userId: data.userId,
            dealerId,
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
            activitySource,
            scoreDelta,
            isRecommended: data.isRecommended,
            startedAt: data.startedAt,
            completionStatus: data.completionStatus ?? 'completed',
            conversationLength: data.conversationLength,
            outcome: data.outcome,
            outcomeTag: freshUpOutcomeTag,
            freshUpId: data.freshUpId,
            characterName: data.characterName,
            coachingTag: data.coachingTag,
            summaryTag: data.summaryTag,
            sprocketCoachingLine: data.sprocketCoachingLine,
            difficulty: data.difficulty,
            sourceType: data.sourceType,
            personalityType: data.personalityType,
            buyingStage: data.buyingStage,
            primaryConcern: data.primaryConcern,
            secondaryConcern: data.secondaryConcern,
            communicationStyle: data.communicationStyle,
            vehicleInterestLabel: data.vehicleInterest,
            difficultyLevel: data.difficultyLevel,
            startingEmotionalState: data.startingEmotionalState,
            endingEmotionalState: data.endingEmotionalState,
            finalCustomerResponse: data.finalCustomerResponse,
            endingType: data.endingType,
            recommendedNextStep: data.recommendedNextStep,
            trustShift: data.trustShift,
            archetypeId: data.archetypeId,
            archetypeName: data.archetypeName,
            archetypeCategory: data.archetypeCategory,
            humorLevel: data.humorLevel,
            guardrailFlags: Array.isArray(data.guardrailFlags) ? data.guardrailFlags : undefined,
            contentValidationPassed: typeof data.contentValidationPassed === 'boolean' ? data.contentValidationPassed : undefined,
            validationFailureReasons: Array.isArray(data.validationFailureReasons) ? data.validationFailureReasons : undefined,
            skillWeightMultiplier,
            freshUpVersionId: data.freshUpVersionId,
            freshUpVersionName: data.freshUpVersionName,
            isExperimental: typeof data.isExperimental === 'boolean' ? data.isExperimental : undefined,
            environment: data.environment,
            roleType: data.roleType,
            interactionDisplayLabel: data.interactionDisplayLabel,
            concernCategoryRoleSpecific: data.concernCategoryRoleSpecific,
            nextStepType: data.nextStepType,
            roleLanguageVersion: data.roleLanguageVersion,
            empathyDelta: scoreDelta.empathy,
            listeningDelta: scoreDelta.listening,
            trustDelta: scoreDelta.trust,
            followUpDelta: scoreDelta.followUp,
            closingDelta: scoreDelta.closing,
            relationshipDelta: scoreDelta.relationshipBuilding,
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
    const priorLogs = await getConsultantActivity(data.userId);
    const dealerId = user.dealershipIds?.[0] || user.selfDeclaredDealershipId;

    const batch = writeBatch(db);
    const logRef = doc(collection(db, `users/${data.userId}/lessonLogs`));
    
    const newLogData: Record<string, unknown> = {
        logId: logRef.id,
        timestamp: Timestamp.fromDate(new Date()),
        userId: data.userId,
        dealerId,
        lessonId: data.lessonId,
        xpGained: xpDelta,
        isRecommended: data.isRecommended,
        stepResults: { final: 'pass' },
        ...normalizedScores,
        ratings: normalizedRatings,
        severity,
        flags,
        activitySource,
        completionStatus: data.completionStatus ?? 'completed',
        skillWeightMultiplier,
    };
    if (data.startedAt instanceof Date) {
        newLogData.startedAt = Timestamp.fromDate(data.startedAt);
    }
    if (typeof data.conversationLength === 'number' && Number.isFinite(data.conversationLength)) {
        newLogData.conversationLength = Math.max(0, Math.round(data.conversationLength));
    }
    if (typeof data.outcome === 'string') {
        newLogData.outcome = data.outcome;
    }
    if (typeof freshUpOutcomeTag === 'string') {
        newLogData.outcomeTag = freshUpOutcomeTag;
    }
    if (typeof data.messagesSent === 'number' && Number.isFinite(data.messagesSent)) {
        newLogData.messagesSent = Math.max(0, Math.round(data.messagesSent));
    }
    if (typeof data.aiResponseCount === 'number' && Number.isFinite(data.aiResponseCount)) {
        newLogData.aiResponseCount = Math.max(0, Math.round(data.aiResponseCount));
    }
    if (typeof data.freshUpId === 'string' && data.freshUpId.trim().length > 0) {
        newLogData.freshUpId = data.freshUpId;
    }
    if (typeof data.characterName === 'string' && data.characterName.trim().length > 0) {
        newLogData.characterName = data.characterName;
    }
    if (typeof data.coachingTag === 'string' && data.coachingTag.trim().length > 0) {
        newLogData.coachingTag = data.coachingTag;
    }
    if (typeof data.summaryTag === 'string' && data.summaryTag.trim().length > 0) {
        newLogData.summaryTag = data.summaryTag;
    }
    if (typeof data.sprocketCoachingLine === 'string' && data.sprocketCoachingLine.trim().length > 0) {
        newLogData.sprocketCoachingLine = data.sprocketCoachingLine;
    }
    if (typeof data.difficulty === 'number' && Number.isFinite(data.difficulty)) {
        newLogData.difficulty = Math.max(1, Math.round(data.difficulty));
    }
    if (data.sourceType === 'procedural' || data.sourceType === 'signature') {
        newLogData.sourceType = data.sourceType;
    }
    if (typeof data.personalityType === 'string' && data.personalityType.trim().length > 0) {
        newLogData.personalityType = data.personalityType;
    }
    if (typeof data.buyingStage === 'string' && data.buyingStage.trim().length > 0) {
        newLogData.buyingStage = data.buyingStage;
    }
    if (typeof data.primaryConcern === 'string' && data.primaryConcern.trim().length > 0) {
        newLogData.primaryConcern = data.primaryConcern;
    }
    if (typeof data.secondaryConcern === 'string' && data.secondaryConcern.trim().length > 0) {
        newLogData.secondaryConcern = data.secondaryConcern;
    }
    if (typeof data.communicationStyle === 'string' && data.communicationStyle.trim().length > 0) {
        newLogData.communicationStyle = data.communicationStyle;
    }
    if (typeof data.vehicleInterest === 'string' && data.vehicleInterest.trim().length > 0) {
        newLogData.vehicleInterestLabel = data.vehicleInterest;
    }
    if (typeof data.difficultyLevel === 'string' && data.difficultyLevel.trim().length > 0) {
        newLogData.difficultyLevel = data.difficultyLevel;
    }
    if (typeof data.startingEmotionalState === 'string' && data.startingEmotionalState.trim().length > 0) {
        newLogData.startingEmotionalState = data.startingEmotionalState;
    }
    if (typeof data.endingEmotionalState === 'string' && data.endingEmotionalState.trim().length > 0) {
        newLogData.endingEmotionalState = data.endingEmotionalState;
    }
    if (typeof data.finalCustomerResponse === 'string' && data.finalCustomerResponse.trim().length > 0) {
        newLogData.finalCustomerResponse = data.finalCustomerResponse;
    }
    if (typeof data.endingType === 'string' && data.endingType.trim().length > 0) {
        newLogData.endingType = data.endingType;
    }
    if (typeof data.recommendedNextStep === 'string' && data.recommendedNextStep.trim().length > 0) {
        newLogData.recommendedNextStep = data.recommendedNextStep;
    }
    if (typeof data.trustShift === 'number' && Number.isFinite(data.trustShift)) {
        newLogData.trustShift = Math.round(data.trustShift);
    }
    if (typeof data.roleType === 'string' && data.roleType.trim().length > 0) {
        newLogData.roleType = data.roleType;
    }
    if (typeof data.interactionDisplayLabel === 'string' && data.interactionDisplayLabel.trim().length > 0) {
        newLogData.interactionDisplayLabel = data.interactionDisplayLabel;
    }
    if (typeof data.concernCategoryRoleSpecific === 'string' && data.concernCategoryRoleSpecific.trim().length > 0) {
        newLogData.concernCategoryRoleSpecific = data.concernCategoryRoleSpecific;
    }
    if (typeof data.nextStepType === 'string' && data.nextStepType.trim().length > 0) {
        newLogData.nextStepType = data.nextStepType;
    }
    if (typeof data.roleLanguageVersion === 'string' && data.roleLanguageVersion.trim().length > 0) {
        newLogData.roleLanguageVersion = data.roleLanguageVersion;
    }
    if (typeof data.archetypeId === 'string' && data.archetypeId.trim().length > 0) {
        newLogData.archetypeId = data.archetypeId;
    }
    if (typeof data.archetypeName === 'string' && data.archetypeName.trim().length > 0) {
        newLogData.archetypeName = data.archetypeName;
    }
    if (typeof data.archetypeCategory === 'string' && data.archetypeCategory.trim().length > 0) {
        newLogData.archetypeCategory = data.archetypeCategory;
    }
    if (typeof data.humorLevel === 'number' && Number.isFinite(data.humorLevel)) {
        newLogData.humorLevel = Math.max(0, Math.min(3, Math.round(data.humorLevel)));
    }
    if (Array.isArray(data.guardrailFlags) && data.guardrailFlags.length > 0) {
        newLogData.guardrailFlags = data.guardrailFlags.map((flag) => String(flag));
    }
    if (typeof data.contentValidationPassed === 'boolean') {
        newLogData.contentValidationPassed = data.contentValidationPassed;
    }
    if (Array.isArray(data.validationFailureReasons) && data.validationFailureReasons.length > 0) {
        newLogData.validationFailureReasons = data.validationFailureReasons.map((reason) => String(reason));
    }
    if (typeof data.freshUpVersionId === 'string' && data.freshUpVersionId.trim().length > 0) {
        newLogData.freshUpVersionId = data.freshUpVersionId;
    }
    if (typeof data.freshUpVersionName === 'string' && data.freshUpVersionName.trim().length > 0) {
        newLogData.freshUpVersionName = data.freshUpVersionName;
    }
    if (typeof data.isExperimental === 'boolean') {
        newLogData.isExperimental = data.isExperimental;
    }
    if (data.environment === 'sandbox' || data.environment === 'production') {
        newLogData.environment = data.environment;
    }
    if (typeof data.trainedTrait === 'string' && data.trainedTrait.trim().length > 0) {
        newLogData.trainedTrait = data.trainedTrait;
    }
    if (typeof data.coachSummary === 'string' && data.coachSummary.trim().length > 0) {
        newLogData.coachSummary = data.coachSummary;
    }
    if (typeof data.recommendedNextFocus === 'string' && data.recommendedNextFocus.trim().length > 0) {
        newLogData.recommendedNextFocus = data.recommendedNextFocus;
    }

    const userLogs = priorLogs;
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

    const nextFreshUpState = buildNextFreshUpState({
        user,
        now: new Date(),
        priorLogs,
        ratings: normalizedRatings,
        activitySource,
        lessonId: data.lessonId,
    });

    batch.set(logRef, newLogData);
    batch.set(doc(db, 'users', data.userId), { xp: newXp, ...nextFreshUpState }, { merge: true });

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
    let freshUpSessionStored = false;
    let freshUpSessionId: string | undefined;

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
            const rollingResult = await updateRollingStats(data.userId, normalizedRatings, { weightMultiplier: skillWeightMultiplier });
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
                empathyDelta: statChanges.empathy.delta,
                listeningDelta: statChanges.listening.delta,
                trustDelta: statChanges.trust.delta,
                followUpDelta: statChanges.followUp.delta,
                closingDelta: statChanges.closing.delta,
                relationshipDelta: statChanges.relationshipBuilding.delta,
            });
        }

        if (isFreshUpLessonInput(data) && (data.completionStatus ?? 'completed') === 'completed') {
            const writeToSandboxCollection = data.sandboxMode === true;
            const writeToLiveCollection = !writeToSandboxCollection || data.saveSessionToLiveAnalytics === true;
            const sandboxSessionRef = writeToSandboxCollection ? doc(collection(db, 'freshUpSandboxSessions')) : null;
            const liveSessionRef = writeToLiveCollection ? doc(collection(db, 'freshUpSessions')) : null;
            const upMeterStart = Math.max(0, Math.min(100, Math.round(Number(data.upMeterStart ?? 35))));
            const upMeterEnd = Math.max(0, Math.min(100, Math.round(Number(data.upMeterEnd ?? upMeterStart))));
            const upMeterPeak = Math.max(
                upMeterStart,
                upMeterEnd,
                Math.max(0, Math.min(100, Math.round(Number(data.upMeterPeak ?? upMeterEnd))))
            );
            const nowDate = new Date();
            const basePayload = {
                userId: data.userId,
                dealerId,
                scenarioId: data.freshUpId ?? data.lessonId,
                scenarioName: data.characterName ?? 'Fresh Up',
                sourceType: data.sourceType ?? 'signature',
                timestamp: Timestamp.fromDate(nowDate),
                conversationLength: Math.max(0, Math.round(Number(data.conversationLength ?? 0))),
                messagesSent: Math.max(0, Math.round(Number(data.messagesSent ?? 0))),
                aiResponses: Math.max(0, Math.round(Number(data.aiResponseCount ?? 0))),
                personalityType: data.personalityType ?? '',
                buyingStage: data.buyingStage ?? '',
                primaryConcern: data.primaryConcern ?? '',
                secondaryConcern: data.secondaryConcern ?? '',
                communicationStyle: data.communicationStyle ?? '',
                vehicleInterest: data.vehicleInterest ?? '',
                difficultyLevel: data.difficultyLevel ?? '',
                startingEmotionalState: data.startingEmotionalState ?? '',
                endingEmotionalState: data.endingEmotionalState ?? '',
                finalCustomerResponse: data.finalCustomerResponse ?? '',
                endingType: data.endingType ?? '',
                recommendedNextStep: data.recommendedNextStep ?? '',
                trustShift: Number.isFinite(Number(data.trustShift)) ? Math.round(Number(data.trustShift)) : 0,
                roleType: data.roleType ?? '',
                interactionDisplayLabel: data.interactionDisplayLabel ?? '',
                concernCategoryRoleSpecific: data.concernCategoryRoleSpecific ?? data.primaryConcern ?? '',
                nextStepType: data.nextStepType ?? data.recommendedNextStep ?? '',
                roleLanguageVersion: data.roleLanguageVersion ?? '',
                archetypeId: data.archetypeId ?? '',
                archetypeName: data.archetypeName ?? '',
                archetypeCategory: data.archetypeCategory ?? '',
                humorLevel: Number.isFinite(Number(data.humorLevel)) ? Math.max(0, Math.min(3, Math.round(Number(data.humorLevel)))) : 0,
                guardrailFlags: Array.isArray(data.guardrailFlags) ? data.guardrailFlags.map((flag) => String(flag)) : [],
                contentValidationPassed: typeof data.contentValidationPassed === 'boolean' ? data.contentValidationPassed : true,
                validationFailureReasons: Array.isArray(data.validationFailureReasons) ? data.validationFailureReasons.map((reason) => String(reason)) : [],
                freshUpVersionId: data.freshUpVersionId ?? '',
                freshUpVersionName: data.freshUpVersionName ?? '',
                isExperimental: typeof data.isExperimental === 'boolean' ? data.isExperimental : false,
                environment: data.environment === 'sandbox' || data.environment === 'production'
                    ? data.environment
                    : (writeToSandboxCollection ? 'sandbox' : 'production'),
                scores: {
                    empathy: normalizedRatings.empathy,
                    listening: normalizedRatings.listening,
                    trust: normalizedRatings.trust,
                    relationship: normalizedRatings.relationship,
                    closing: normalizedRatings.closing,
                },
                xpAwarded: xpDelta,
                upMeter: {
                    start: upMeterStart,
                    end: upMeterEnd,
                    peak: upMeterPeak,
                },
                outcomeTag: freshUpOutcomeTag ?? 'Lost Momentum',
                statBonuses: {
                    empathyBonus: statChanges.empathy.delta,
                    listeningBonus: statChanges.listening.delta,
                    trustBonus: statChanges.trust.delta,
                    relationshipBonus: statChanges.relationshipBuilding.delta,
                    closingBonus: statChanges.closing.delta,
                },
                ...(writeToSandboxCollection ? { isSandbox: true } : {}),
                ...(data.memoryDebugState ? { memoryDebugState: data.memoryDebugState } : {}),
                ...(data.scoringDebugState ? { scoringDebugState: data.scoringDebugState } : {}),
                ...(data.scenarioGenerationDetails ? { scenarioGenerationDetails: data.scenarioGenerationDetails } : {}),
            };

            if (sandboxSessionRef) {
                await setDoc(sandboxSessionRef, {
                    sessionId: sandboxSessionRef.id,
                    ...basePayload,
                });
            }
            if (liveSessionRef) {
                await setDoc(liveSessionRef, {
                    sessionId: liveSessionRef.id,
                    ...basePayload,
                });
            }

            freshUpSessionStored = true;
            freshUpSessionId = sandboxSessionRef?.id ?? liveSessionRef?.id;
        }

        // Adaptive Coaching Engine updates after each completed lesson:
        // - marks recommended lesson completion
        // - tracks next 3 Fresh Ups for post-training improvement
        // - refreshes recommendation when a sub-60 skill gap persists.
        await updateAdaptiveCoachingAfterLesson({
            db,
            userId: data.userId,
            dealerId,
            activitySource,
            completionStatus: data.completionStatus ?? 'completed',
            trainedTrait: data.trainedTrait,
            ratings: normalizedRatings,
            now: new Date(),
        });
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
        freshUpSessionStored,
        freshUpSessionId,
        severity,
        ratingsUsed: normalizedRatings,
        statChanges,
    };
}

export const getTeamMemberRoles = (managerRole: UserRole): UserRole[] => {
    switch (managerRole) {
        case 'manager': return ['Sales Consultant', 'BDC'];
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
    lastRecommendedInteraction: Date | null;
    tookRecommendedToday: boolean;
};

type ManagerStats = {
    totalLessons: number;
    avgScores: Record<CxTrait, number> | null;
};

type DealershipActivityRow = {
    userId: string;
    memberName: string;
    memberRole: UserRole;
    lessonId: string;
    timestamp: Date;
    xpGained: number;
    isRecommended: boolean;
    trainedTrait?: string;
    severity?: InteractionSeverity;
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
    const profileXp = typeof consultantSnapshot.xp === 'number' ? consultantSnapshot.xp : 0;
    consultantSnapshot.xp = profileXp;

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
                totalXp: profileXp,
                avgScore,
                topStrength,
                weakestSkill,
                lastInteraction: null,
                lastRecommendedInteraction: null,
                tookRecommendedToday: false,
            };
        }

        return {
            consultant: consultantSnapshot,
            lessonsCompleted: 0,
            totalXp: profileXp,
            avgScore: 0,
            topStrength: null,
            weakestSkill: null,
            lastInteraction: null,
            lastRecommendedInteraction: null,
            tookRecommendedToday: false,
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
    const recommendedLogs = logs.filter((log) => log.isRecommended === true);
    const lastRecommendedInteraction = recommendedLogs.reduce<Date | null>((latest, log) => {
        if (!latest || log.timestamp > latest) return log.timestamp;
        return latest;
    }, null);
    const tookRecommendedToday = recommendedLogs.some((log) => isToday(log.timestamp));
    const logsXp = logs.reduce((sum, log) => sum + (Number.isFinite(log.xpGained) ? log.xpGained : 0), 0);
    const resolvedXp = Math.max(profileXp, logsXp);
    consultantSnapshot.xp = resolvedXp;

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
        totalXp: resolvedXp,
        avgScore: Math.round((Object.values(avgByTrait).reduce((sum, value) => sum + value, 0) / traits.length)),
        topStrength,
        weakestSkill,
        lastInteraction,
        lastRecommendedInteraction,
        tookRecommendedToday,
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

function buildDealershipActivityRows(members: User[], logsByUserId: Map<string, LessonLog[]>): DealershipActivityRow[] {
    const rows: DealershipActivityRow[] = [];

    members.forEach((member) => {
        const memberLogs = logsByUserId.get(member.userId) || [];
        const memberName = (member.name || '').trim() || (member.email || '').split('@')[0] || 'Member';

        memberLogs.forEach((log) => {
            rows.push({
                userId: member.userId,
                memberName,
                memberRole: member.role,
                lessonId: String(log.lessonId || ''),
                timestamp: log.timestamp,
                xpGained: Number.isFinite(log.xpGained) ? log.xpGained : 0,
                isRecommended: log.isRecommended === true,
                trainedTrait: typeof log.trainedTrait === 'string' ? log.trainedTrait : undefined,
                severity: log.severity,
            });
        });
    });

    return rows
        .filter((row) => row.lessonId.length > 0 && row.timestamp instanceof Date && !Number.isNaN(row.timestamp.getTime()))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function getDealerships(user?: User): Promise<Dealership[]> {
    const { firestore: db } = getFirebase();
    if (isTouringUser(user?.userId)) return (await getTourData()).dealerships;
    if (user && !hasDealershipAssignments(user)) return [];
    const snap = await getDocs(collection(db, 'dealerships'));
    const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Dealership));
    if (user && !['Admin', 'Developer'].includes(user.role)) {
        const assignedDealershipIds = Array.isArray(user.dealershipIds) ? user.dealershipIds : [];
        return all.filter(d => assignedDealershipIds.includes(d.id) && d.status !== 'deactivated');
    }
    return all.filter(d => d.id !== 'autoknerd-hq').sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCombinedTeamData(dealershipId: string, user: User): Promise<any> {
    const { firestore: db } = getFirebase();
    const isPrivilegedViewer = ['Admin', 'Developer'].includes(user.role);
    const scopedDealershipIds = Array.isArray(user.dealershipIds) ? user.dealershipIds : [];
    if (!scopedDealershipIds.length) {
        return {
            teamActivity: [],
            managerStats: { totalLessons: 0, avgScores: null },
            dealershipActivity: [],
        };
    }

    if (isTouringUser(user.userId)) {
        const tour = await getTourData();
        const roles = getTeamMemberRoles(user.role);
        if (!roles.length) {
            return {
                teamActivity: [],
                managerStats: { totalLessons: 0, avgScores: null },
                dealershipActivity: [],
            };
        }
        const members = tour.users.filter((member) => (
            member.userId !== user.userId &&
            roles.includes(member.role)
        ));
        const filtered = dealershipId === 'all'
            ? (isPrivilegedViewer
                ? members
                : members.filter((member) => {
                    const memberDealershipIds = Array.isArray(member.dealershipIds) ? member.dealershipIds : [];
                    return memberDealershipIds.some((id) => scopedDealershipIds.includes(id));
                }))
            : members.filter((member) => {
                const memberDealershipIds = Array.isArray(member.dealershipIds) ? member.dealershipIds : [];
                return memberDealershipIds.includes(dealershipId);
            });

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
        const dealershipActivity = buildDealershipActivityRows(filtered, logsByUserId);

        return {
            teamActivity,
            managerStats: buildManagerStatsFromRows(teamActivity, logsByUserId),
            dealershipActivity,
        };
    }

    const roles = getTeamMemberRoles(user.role);
    if (!roles.length) {
        return {
            teamActivity: [],
            managerStats: { totalLessons: 0, avgScores: null },
            dealershipActivity: [],
        };
    }

    const usersSnap = await getDocs(query(collection(db, 'users'), where("role", "in", roles)));
    const members = usersSnap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
    const filtered = dealershipId === 'all'
        ? (isPrivilegedViewer
            ? members
            : members.filter((member) => {
                const memberDealershipIds = Array.isArray(member.dealershipIds) ? member.dealershipIds : [];
                return memberDealershipIds.some((id) => scopedDealershipIds.includes(id));
            }))
        : members.filter((member) => {
            const memberDealershipIds = Array.isArray(member.dealershipIds) ? member.dealershipIds : [];
            return memberDealershipIds.includes(dealershipId);
        });

    const logsByUserId = new Map<string, LessonLog[]>();
    await Promise.all(filtered.map(async (member) => {
        try {
            const logsSnapshot = await getDocs(collection(db, `users/${member.userId}/lessonLogs`));
            const memberLogs = logsSnapshot.docs
                .map((logDoc) => {
                    const data = logDoc.data() as Partial<LessonLog> & { timestamp?: unknown };
                    return {
                        ...data,
                        logId: typeof data.logId === 'string' ? data.logId : logDoc.id,
                        userId: member.userId,
                        timestamp: toSafeDate(data.timestamp, new Date(0)),
                    } as LessonLog;
                })
                .filter((log) => log.timestamp.getTime() > 0);

            logsByUserId.set(member.userId, memberLogs);
        } catch {
            logsByUserId.set(member.userId, []);
        }
    }));

    const teamActivity = filtered.map((member) => (
        buildTeamActivityRow(member, logsByUserId.get(member.userId) || [])
    ));
    const dealershipActivity = buildDealershipActivityRows(filtered, logsByUserId);

    return {
        teamActivity,
        managerStats: buildManagerStatsFromRows(teamActivity, logsByUserId),
        dealershipActivity,
    };
}

export async function getManageableUsers(managerId: string): Promise<User[]> {
    const { firestore: db } = getFirebase();
    const manager = await getUserById(managerId);
    if (!manager) return [];
    const isAdmin = ['Admin', 'Developer'].includes(manager.role);
    if (!isAdmin && !hasDealershipAssignments(manager)) return [];

    if (isTouringUser(managerId)) {
        const tour = await getTourData();

        if (isAdmin) {
            return tour.users
                .filter(user => user.userId !== managerId)
                .map(cloneTourUser)
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        const roles = getTeamMemberRoles(manager.role);
        const managerDealershipIds = Array.isArray(manager.dealershipIds) ? manager.dealershipIds : [];
        return tour.users
            .filter((user) => (
                user.userId !== managerId &&
                roles.includes(user.role) &&
                (Array.isArray(user.dealershipIds) ? user.dealershipIds : []).some((id) => managerDealershipIds.includes(id))
            ))
            .map(cloneTourUser)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    const snap = await getDocs(collection(db, 'users'));
    const all = snap.docs.map(d => ({ ...d.data(), userId: d.id } as User));
    
    if (isAdmin) {
        return all.filter(u => u.userId !== managerId).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const roles = getTeamMemberRoles(manager.role);
    const managerDealershipIds = Array.isArray(manager.dealershipIds) ? manager.dealershipIds : [];
    return all.filter(u => 
        u.userId !== managerId && 
        roles.includes(u.role) && 
        (Array.isArray(u.dealershipIds) ? u.dealershipIds : []).some(id => managerDealershipIds.includes(id))
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

export async function updateDealershipManagementPrivateDataViewingAccess(
    dealershipId: string,
    disabled: boolean
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    if (dealershipId.startsWith('tour-')) {
        const dealership = (await getTourData()).dealerships.find(d => d.id === dealershipId);
        if (dealership) {
            dealership.disableManagementPrivateDataViewing = disabled;
            return dealership;
        }
        throw new Error('Tour dealership not found');
    }

    const dealershipsCollection = collection(db, 'dealerships');
    const dealershipRef = doc(dealershipsCollection, dealershipId);

    try {
        await updateDoc(dealershipRef, { disableManagementPrivateDataViewing: disabled });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: dealershipRef.path,
            operation: 'update',
            requestResourceData: { disableManagementPrivateDataViewing: disabled },
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

export async function updateDealershipGroupMembers(
    dealershipId: string,
    groupDealershipIds: string[]
): Promise<Dealership> {
    const { firestore: db } = getFirebase();
    const ref = doc(db, 'dealerships', dealershipId);
    const deduped = Array.from(new Set(groupDealershipIds.filter(Boolean)));
    await updateDoc(ref, { groupDealershipIds: deduped });
    const snap = await getDoc(ref);
    return { ...snap.data(), id: snap.id } as Dealership;
}

type PppSystemConfig = {
  enabled: boolean;
  updatedUsers?: number;
};

type CxSystemConfig = {
  aggressiveness: number;
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

export async function getCxSystemConfig(): Promise<CxSystemConfig> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Authentication required.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/cxConfig', {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Failed to load CX settings.');
    }

    return {
        aggressiveness: typeof payload?.aggressiveness === 'number' ? payload.aggressiveness : DEFAULT_CX_AGGRESSIVENESS,
    };
}

export async function updateCxSystemConfig(aggressiveness: number): Promise<CxSystemConfig> {
    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('Authentication required.');
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/admin/cxConfig', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ aggressiveness }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'Failed to update CX settings.');
    }

    return {
        aggressiveness: typeof payload?.aggressiveness === 'number' ? payload.aggressiveness : DEFAULT_CX_AGGRESSIVENESS,
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
        const scoreSeed = getTraitScoresFromUserStats(user) || {
            empathy: BASELINE,
            listening: BASELINE,
            trust: BASELINE,
            followUp: BASELINE,
            closing: BASELINE,
            relationshipBuilding: BASELINE,
        };
        const now = new Date();
        tour.lessonLogs.push({
            logId: `tour-ppp-${userId}-${now.getTime()}`,
            timestamp: now,
            userId,
            lessonId,
            stepResults: { pass: 'pass' },
            xpGained: xpAwarded,
            empathy: scoreSeed.empathy,
            listening: scoreSeed.listening,
            trust: scoreSeed.trust,
            followUp: scoreSeed.followUp,
            closing: scoreSeed.closing,
            relationshipBuilding: scoreSeed.relationshipBuilding,
            isRecommended: false,
            trainedTrait: 'ppp',
            coachSummary: 'PPP lesson pass recorded.',
            activitySource: 'ppp',
        });

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
        const scoreSeed = getTraitScoresFromUserStats(user) || {
            empathy: BASELINE,
            listening: BASELINE,
            trust: BASELINE,
            followUp: BASELINE,
            closing: BASELINE,
            relationshipBuilding: BASELINE,
        };
        const pppLogRef = doc(collection(db, `users/${userId}/lessonLogs`));
        transaction.set(pppLogRef, {
            logId: pppLogRef.id,
            timestamp: Timestamp.fromDate(new Date()),
            userId,
            lessonId,
            stepResults: { pass: 'pass' },
            xpGained: xpAwarded,
            empathy: scoreSeed.empathy,
            listening: scoreSeed.listening,
            trust: scoreSeed.trust,
            followUp: scoreSeed.followUp,
            closing: scoreSeed.closing,
            relationshipBuilding: scoreSeed.relationshipBuilding,
            isRecommended: false,
            trainedTrait: 'ppp',
            coachSummary: 'PPP lesson pass recorded.',
            activitySource: 'ppp',
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
        if (!result.alreadyPassed) {
            const scoreSeed = getTraitScoresFromUserStats(user) || {
                empathy: BASELINE,
                listening: BASELINE,
                trust: BASELINE,
                followUp: BASELINE,
                closing: BASELINE,
                relationshipBuilding: BASELINE,
            };
            const now = new Date();
            tour.lessonLogs.push({
                logId: `tour-saas-ppp-${userId}-${now.getTime()}`,
                timestamp: now,
                userId,
                lessonId,
                stepResults: { pass: 'pass' },
                xpGained: result.xpAwarded,
                empathy: scoreSeed.empathy,
                listening: scoreSeed.listening,
                trust: scoreSeed.trust,
                followUp: scoreSeed.followUp,
                closing: scoreSeed.closing,
                relationshipBuilding: scoreSeed.relationshipBuilding,
                isRecommended: false,
                trainedTrait: 'saas-ppp',
                coachSummary: 'SaaS PPP lesson pass recorded.',
                activitySource: 'saas-ppp',
            });
        }

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
        if (!result.alreadyPassed) {
            const scoreSeed = getTraitScoresFromUserStats(user) || {
                empathy: BASELINE,
                listening: BASELINE,
                trust: BASELINE,
                followUp: BASELINE,
                closing: BASELINE,
                relationshipBuilding: BASELINE,
            };
            const saasPppLogRef = doc(collection(db, `users/${userId}/lessonLogs`));
            transaction.set(saasPppLogRef, {
                logId: saasPppLogRef.id,
                timestamp: Timestamp.fromDate(new Date()),
                userId,
                lessonId,
                stepResults: { pass: 'pass' },
                xpGained: result.xpAwarded,
                empathy: scoreSeed.empathy,
                listening: scoreSeed.listening,
                trust: scoreSeed.trust,
                followUp: scoreSeed.followUp,
                closing: scoreSeed.closing,
                relationshipBuilding: scoreSeed.relationshipBuilding,
                isRecommended: false,
                trainedTrait: 'saas-ppp',
                coachSummary: 'SaaS PPP lesson pass recorded.',
                activitySource: 'saas-ppp',
            });
        }

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

export async function getCreatedLessonStatuses(creatorId: string, dealershipId?: string | null): Promise<CreatedLessonStatus[]> {
  const { firestore: db } = getFirebase();
  const isTour = isTouringUser(creatorId);
  const lessonsRef = collection(db, 'lessons');
  const isDealershipScoped = !!dealershipId && dealershipId !== 'all';
  const q = isDealershipScoped
    ? query(lessonsRef, where('dealershipIds', 'array-contains', dealershipId))
    : query(lessonsRef, where('createdByUserId', '==', creatorId));
  const snap = isTour
    ? {
        docs: (await getTourData()).lessons.filter((l) => {
          if (isDealershipScoped) {
            return Array.isArray(l.dealershipIds) && l.dealershipIds.includes(dealershipId as string);
          }
          return l.createdByUserId === creatorId;
        }),
      }
    : await getDocs(q);
  
  const results: CreatedLessonStatus[] = [];
  const assignmentsRef = collection(db, 'lessonAssignments');
  const creatorCache = new Map<string, User | null>();

  for (const docSnap of (snap.docs as any[])) {
    const lesson = isTour ? docSnap : { ...docSnap.data(), lessonId: docSnap.id } as Lesson;
    if (dealershipId && dealershipId !== 'all') {
      const lessonDealershipIds = Array.isArray(lesson.dealershipIds) ? lesson.dealershipIds : [];
      if (lessonDealershipIds.length === 0) {
        const creatorUserId = lesson.createdByUserId;
        if (!creatorUserId) continue;
        let creatorProfile = creatorCache.get(creatorUserId);
        if (creatorProfile === undefined) {
          creatorProfile = await getUserById(creatorUserId);
          creatorCache.set(creatorUserId, creatorProfile);
        }
        const creatorDealershipIds = Array.isArray(creatorProfile?.dealershipIds) ? creatorProfile.dealershipIds : [];
        if (!creatorDealershipIds.includes(dealershipId)) continue;
      } else if (!lessonDealershipIds.includes(dealershipId)) {
        continue;
      }
    }
    
    const aSnap = await getDocs(query(assignmentsRef, where('lessonId', '==', lesson.lessonId)));
    const assignments = aSnap.docs.map(d => d.data() as LessonAssignment);
    
    const assignees: CreatedLessonStatus['assignees'] = [];
    let takenCount = 0;
    let lastAssigned: Date | null = null;

    for (const a of assignments) {
      const assignmentTimestamp = toSafeDate((a as any).timestamp, new Date(0));
      if (!lastAssigned || assignmentTimestamp > lastAssigned) lastAssigned = assignmentTimestamp;
      
      const user = await getUserById(a.userId);
      if (!user) continue;

      const logSnap = await getDocs(query(collection(db, `users/${user.userId}/lessonLogs`), where('lessonId', '==', lesson.lessonId), limit(1)));
      const isTaken = !logSnap.empty;
      if (isTaken) takenCount++;
      const completedAt = isTaken
        ? toSafeDate((logSnap.docs[0].data() as any).timestamp, new Date(0))
        : undefined;

      assignees.push({
        userId: user.userId,
        name: user.name,
        role: user.role,
        taken: isTaken,
        completedAt
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

  return results.sort((a, b) => a.lesson.title.localeCompare(b.lesson.title));
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
