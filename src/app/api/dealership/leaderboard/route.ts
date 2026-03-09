import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User, UserRole } from '@/lib/definitions';
import type { Firestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Readiness = 'green' | 'yellow' | 'red';

type LeaderboardEntry = {
  userId: string;
  name: string;
  totalXp: number;
  level: number;
  readiness: Readiness;
  readinessLabel: string;
};

const GLOBAL_ROLES = new Set<UserRole>(['Admin', 'Developer']);

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    const maybe = (value as { toDate?: () => Date }).toDate?.();
    if (maybe instanceof Date && !Number.isNaN(maybe.getTime())) return maybe;
  }
  return null;
}

function getReadiness(lastRecommendedAt: Date | null): { readiness: Readiness; readinessLabel: string } {
  if (!lastRecommendedAt) return { readiness: 'red', readinessLabel: 'Overdue' };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const lastStart = new Date(lastRecommendedAt);
  lastStart.setHours(0, 0, 0, 0);

  const daysSince = Math.max(0, Math.floor((todayStart.getTime() - lastStart.getTime()) / (24 * 60 * 60 * 1000)));
  if (daysSince === 0) return { readiness: 'green', readinessLabel: 'Today' };
  if (daysSince > 3) return { readiness: 'red', readinessLabel: 'Overdue' };
  return { readiness: 'yellow', readinessLabel: 'Due Soon' };
}

async function getLastRecommendedAt(adminDb: Firestore, userId: string): Promise<Date | null> {
  const logsRef = adminDb.collection('users').doc(userId).collection('lessonLogs');

  try {
    const recommendedSnap = await logsRef
      .where('isRecommended', '==', true)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    return recommendedSnap.docs[0] ? toDate(recommendedSnap.docs[0].data().timestamp) : null;
  } catch {
    // Fallback if the composite index is unavailable: scan a recent timestamp-ordered window.
    const recentSnap = await logsRef
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .catch(() => null);

    if (!recentSnap) return null;

    for (const doc of recentSnap.docs) {
      const data = doc.data();
      if (data?.isRecommended === true) {
        return toDate(data.timestamp);
      }
    }
    return null;
  }
}

function calculateLevel(xp: number): number {
  const safeXp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  const BASE_XP = 100;
  const EXPONENT = 1.5;
  let level = 1;
  let requiredXp = 0;
  while (level < 100) {
    const xpForNextLevel = requiredXp + Math.floor(BASE_XP * Math.pow(level, EXPONENT));
    if (safeXp < xpForNextLevel) break;
    requiredXp = xpForNextLevel;
    level += 1;
  }
  return level;
}

export async function GET(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });

  try {
    const url = new URL(req.url);
    const dealershipId = url.searchParams.get('dealershipId');
    if (!dealershipId || dealershipId === 'all') {
      return NextResponse.json({ message: 'Bad Request: dealershipId is required.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());

    const actorSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!actorSnap.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const actor = actorSnap.data() as User;
    const actorDealershipIds = Array.isArray(actor.dealershipIds) ? actor.dealershipIds : [];
    const hasAccess = GLOBAL_ROLES.has(actor.role) || actorDealershipIds.includes(dealershipId) || actor.selfDeclaredDealershipId === dealershipId;
    if (!hasAccess) {
      return NextResponse.json({ message: 'Forbidden: No access to this dealership.' }, { status: 403 });
    }

    const usersSnap = await adminDb
      .collection('users')
      .where('dealershipIds', 'array-contains', dealershipId)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ leaderboard: [] as LeaderboardEntry[] }, { status: 200 });
    }

    const rows = await Promise.all(
      usersSnap.docs.map(async (doc) => {
        const member = { ...(doc.data() as User), userId: doc.id } as User;

        if (!GLOBAL_ROLES.has(actor.role)) {
          if (actor.role === 'Owner' && member.isPrivateFromOwner === true) return null;
          if (actor.role !== 'Owner' && member.isPrivate === true) return null;
        }

        const lastRecommendedAt = await getLastRecommendedAt(adminDb, member.userId);
        const readiness = getReadiness(lastRecommendedAt);

        const displayName = (member.name || '').trim() || (member.email || '').split('@')[0] || 'Member';
        const totalXp = Number.isFinite(member.xp) ? Number(member.xp) : 0;

        return {
          userId: member.userId,
          name: displayName,
          totalXp,
          level: calculateLevel(totalXp),
          readiness: readiness.readiness,
          readinessLabel: readiness.readinessLabel,
        } satisfies LeaderboardEntry;
      })
    );

    const leaderboard = rows
      .filter((entry): entry is LeaderboardEntry => entry !== null)
      .sort((a, b) => b.totalXp - a.totalXp);

    return NextResponse.json({ leaderboard }, { status: 200 });
  } catch (e: any) {
    console.error('[API dealership leaderboard] Error:', { message: e?.message, code: e?.code });
    if (e?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }
    return NextResponse.json({ message: e?.message || 'Failed to load leaderboard.' }, { status: 500 });
  }
}
