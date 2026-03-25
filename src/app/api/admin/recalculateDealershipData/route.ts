import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User, UserRole } from '@/lib/definitions';
import { BASELINE } from '@/lib/stats/updateRollingStats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GLOBAL_ROLES = new Set<UserRole>(['Admin', 'Developer']);
const ALLOWED_ROLES = new Set<UserRole>([
  'Admin',
  'Developer',
  'Owner',
  'Trainer',
  'General Manager',
  'manager',
  'Service Manager',
  'Parts Manager',
  'Finance Manager',
]);

type LessonLogDoc = {
  empathy?: number;
  listening?: number;
  trust?: number;
  followUp?: number;
  closing?: number;
  relationshipBuilding?: number;
  timestamp?: { toDate?: () => Date } | Date;
};

type LogAccumulator = {
  empathy: number;
  listening: number;
  trust: number;
  followUp: number;
  closing: number;
  relationshipBuilding: number;
  latestTimestamp: Date;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return BASELINE;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildStatsFromLogs(logs: LessonLogDoc[]) {
  const now = new Date();
  if (!logs.length) {
    return {
      empathy: { score: BASELINE, lastUpdated: now },
      listening: { score: BASELINE, lastUpdated: now },
      trust: { score: BASELINE, lastUpdated: now },
      followUp: { score: BASELINE, lastUpdated: now },
      closing: { score: BASELINE, lastUpdated: now },
      relationship: { score: BASELINE, lastUpdated: now },
    };
  }

  const totals = logs.reduce<LogAccumulator>(
    (acc, log) => {
      acc.empathy += Number(log.empathy || 0);
      acc.listening += Number(log.listening || 0);
      acc.trust += Number(log.trust || 0);
      acc.followUp += Number(log.followUp || 0);
      acc.closing += Number(log.closing || 0);
      acc.relationshipBuilding += Number(log.relationshipBuilding || 0);
      const raw = log.timestamp;
      const date = raw instanceof Date ? raw : raw?.toDate?.();
      if (date instanceof Date && !Number.isNaN(date.getTime()) && date > acc.latestTimestamp) {
        acc.latestTimestamp = date;
      }
      return acc;
    },
    {
      empathy: 0,
      listening: 0,
      trust: 0,
      followUp: 0,
      closing: 0,
      relationshipBuilding: 0,
      latestTimestamp: new Date(0),
    } satisfies LogAccumulator
  );

  const count = logs.length;
  const updatedAt = totals.latestTimestamp.getTime() > 0 ? totals.latestTimestamp : now;
  return {
    empathy: { score: clampScore(totals.empathy / count), lastUpdated: updatedAt },
    listening: { score: clampScore(totals.listening / count), lastUpdated: updatedAt },
    trust: { score: clampScore(totals.trust / count), lastUpdated: updatedAt },
    followUp: { score: clampScore(totals.followUp / count), lastUpdated: updatedAt },
    closing: { score: clampScore(totals.closing / count), lastUpdated: updatedAt },
    relationship: { score: clampScore(totals.relationshipBuilding / count), lastUpdated: updatedAt },
  };
}

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());

    const actorSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!actorSnap.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const actor = actorSnap.data() as User;
    if (!ALLOWED_ROLES.has(actor.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const dealershipId = body?.dealershipId;
    if (!dealershipId || typeof dealershipId !== 'string' || dealershipId === 'all') {
      return NextResponse.json({ message: 'Bad Request: dealershipId is required.' }, { status: 400 });
    }

    if (!GLOBAL_ROLES.has(actor.role)) {
      const actorDealershipIds = Array.isArray(actor.dealershipIds) ? actor.dealershipIds : [];
      if (!actorDealershipIds.includes(dealershipId)) {
        return NextResponse.json({ message: 'Forbidden: No access to this dealership.' }, { status: 403 });
      }
    }

    const usersSnap = await adminDb
      .collection('users')
      .where('dealershipIds', 'array-contains', dealershipId)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ ok: true, updatedUsers: 0 }, { status: 200 });
    }

    let updatedUsers = 0;
    for (let i = 0; i < usersSnap.docs.length; i += 200) {
      const chunk = usersSnap.docs.slice(i, i + 200);
      const statsRows = await Promise.all(
        chunk.map(async (userDoc) => {
          const logsSnap = await adminDb.collection('users').doc(userDoc.id).collection('lessonLogs').get();
          const stats = buildStatsFromLogs(logsSnap.docs.map((logDoc) => logDoc.data() as LessonLogDoc));
          return { userRef: userDoc.ref, stats };
        })
      );

      const batch = adminDb.batch();
      statsRows.forEach(({ userRef, stats }) => {
        batch.set(userRef, { stats }, { merge: true });
      });
      await batch.commit();
      updatedUsers += statsRows.length;
    }

    return NextResponse.json({ ok: true, updatedUsers }, { status: 200 });
  } catch (e: any) {
    console.error('[API recalculateDealershipData] Error:', { message: e?.message, code: e?.code });
    if (e?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }
    return NextResponse.json({ message: e?.message || 'Failed to recalculate dealership data.' }, { status: 500 });
  }
}
