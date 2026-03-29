import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type XpEventType = 'tool_first_use' | 'tool_completion' | 'tool_session_completion';
type SkillCategory = 'Empathy' | 'Listening' | 'Trust' | 'Follow-Up' | 'Closing' | 'Relationship Building';
type EntitlementStatus = 'free' | 'paid';

type XpEventPayload = {
  idempotencyKey?: string;
  userId?: string;
  toolId?: string;
  eventType?: XpEventType;
  baseXP?: number;
  bonusXP?: number;
  skillCategory?: SkillCategory;
  entitlementStatus?: EntitlementStatus;
  timestamp?: string;
};

const EVENT_TYPES = new Set<XpEventType>(['tool_first_use', 'tool_completion', 'tool_session_completion']);
const SKILL_CATEGORIES = new Set<SkillCategory>(['Empathy', 'Listening', 'Trust', 'Follow-Up', 'Closing', 'Relationship Building']);
const ENTITLEMENT_STATUSES = new Set<EntitlementStatus>(['free', 'paid']);

function clampXp(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1000, Math.round(numeric)));
}

function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

async function requireAuth(req: NextRequest): Promise<{ uid: string; user: User } | NextResponse> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ ok: false, message: 'User profile not found.' }, { status: 404 });
  }

  return {
    uid: decoded.uid,
    user: userSnap.data() as User,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null) as XpEventPayload | null;
    const idempotencyKey = String(body?.idempotencyKey || '').trim();
    const toolId = String(body?.toolId || '').trim();
    const eventType = body?.eventType;
    const skillCategory = body?.skillCategory;
    const entitlementStatus = body?.entitlementStatus;
    const timestamp = isIsoTimestamp(body?.timestamp) ? String(body?.timestamp) : new Date().toISOString();

    if (!idempotencyKey || idempotencyKey.length < 12) {
      return NextResponse.json({ ok: false, message: 'A valid idempotencyKey is required.' }, { status: 400 });
    }
    if (!toolId) {
      return NextResponse.json({ ok: false, message: 'toolId is required.' }, { status: 400 });
    }
    if (!EVENT_TYPES.has(eventType as XpEventType)) {
      return NextResponse.json({ ok: false, message: 'Invalid eventType.' }, { status: 400 });
    }
    if (!SKILL_CATEGORIES.has(skillCategory as SkillCategory)) {
      return NextResponse.json({ ok: false, message: 'Invalid skillCategory.' }, { status: 400 });
    }
    if (!ENTITLEMENT_STATUSES.has(entitlementStatus as EntitlementStatus)) {
      return NextResponse.json({ ok: false, message: 'Invalid entitlementStatus.' }, { status: 400 });
    }

    const baseXP = clampXp(body?.baseXP);
    const bonusXP = clampXp(body?.bonusXP);
    const xpAdded = baseXP + bonusXP;

    if (xpAdded <= 0) {
      return NextResponse.json({ ok: false, message: 'XP event must award at least 1 XP.' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(auth.uid);
    const eventRef = userRef.collection('toolboxXpEvents').doc(idempotencyKey);

    let response: { xpAdded: number; totalXp: number; duplicate?: boolean } = { xpAdded: 0, totalXp: Number(auth.user.xp || 0) };

    await db.runTransaction(async (tx) => {
      const [eventSnap, userSnap] = await Promise.all([tx.get(eventRef), tx.get(userRef)]);
      const currentXp = Number(userSnap.data()?.xp || 0);

      if (eventSnap.exists) {
        response = {
          xpAdded: Number(eventSnap.data()?.xpAdded || 0),
          totalXp: currentXp,
          duplicate: true,
        };
        return;
      }

      const nextXp = Math.max(0, currentXp + xpAdded);
      tx.set(eventRef, {
        idempotencyKey,
        userId: auth.uid,
        toolId,
        eventType,
        baseXP,
        bonusXP,
        xpAdded,
        skillCategory,
        entitlementStatus,
        timestamp,
        createdAt: new Date().toISOString(),
      });
      tx.set(userRef, { xp: nextXp, updatedAt: new Date().toISOString() }, { merge: true });

      response = {
        xpAdded,
        totalXp: nextXp,
      };
    });

    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Failed to track XP event.' }, { status: 500 });
  }
}
