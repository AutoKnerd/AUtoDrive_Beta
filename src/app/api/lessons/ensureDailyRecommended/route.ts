import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { CxTrait, LessonRole } from '@/lib/definitions';
import { buildAutoRecommendedLesson } from '@/lib/lessons/auto-recommended';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TRAITS = new Set<CxTrait>([
  'empathy',
  'listening',
  'trust',
  'followUp',
  'closing',
  'relationshipBuilding',
]);

const VALID_ROLES = new Set<LessonRole>([
  'Sales Consultant',
  'manager',
  'Service Writer',
  'Service Manager',
  'Finance Manager',
  'Parts Consultant',
  'Parts Manager',
  'General Manager',
  'Trainer',
  'Developer',
  'global',
]);

type Decoded = {
  uid: string;
};

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }

  let decoded: Decoded;
  try {
    const adminAuth = getAdminAuth();
    const verified = await adminAuth.verifyIdToken(match[1].trim());
    decoded = { uid: verified.uid };
  } catch (error: any) {
    return NextResponse.json({ message: `Unauthorized: ${error?.message || 'Invalid token.'}` }, { status: 401 });
  }

  try {
    const { role, trait } = await req.json();
    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ message: 'Bad Request: Invalid role.' }, { status: 400 });
    }
    if (!VALID_TRAITS.has(trait)) {
      return NextResponse.json({ message: 'Bad Request: Invalid trait.' }, { status: 400 });
    }
    if (role === 'global') {
      return NextResponse.json({ message: 'Bad Request: global role is not supported for daily recommended.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const requesterRole = userDoc.data()?.role;
    if (requesterRole !== role) {
      return NextResponse.json({ message: 'Forbidden: Role mismatch.' }, { status: 403 });
    }

    const lesson = buildAutoRecommendedLesson(role, trait);
    const lessonRef = adminDb.collection('lessons').doc(lesson.lessonId);
    const existing = await lessonRef.get();
    if (!existing.exists) {
      await lessonRef.set(lesson);
      return NextResponse.json(lesson, { status: 201 });
    }

    return NextResponse.json(existing.data(), { status: 200 });
  } catch (error: any) {
    console.error('[API ensureDailyRecommended] Error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    if (error?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json(
      {
        message: error?.message || 'Internal Server Error',
        code: error?.code || 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
