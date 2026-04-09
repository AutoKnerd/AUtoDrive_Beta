import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AutoForgeLeadUpdateBody = {
  name?: string;
  email?: string;
  dealershipName?: string;
  role?: string;
  status?: string;
};

function normalizeField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidRole(value: string): boolean {
  return ['Sales', 'Manager', 'Fixed Ops', 'Owner', 'Other'].includes(value);
}

async function requireAdminOrDeveloper(request: NextRequest): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  const role = String(userDoc.data()?.role || '').trim();
  if (role !== 'Admin' && role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  try {
    const authCheck = await requireAdminOrDeveloper(request);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const { leadId } = await context.params;
    const body = (await request.json()) as AutoForgeLeadUpdateBody;

    const name = normalizeField(body.name);
    const email = normalizeField(body.email).toLowerCase();
    const dealershipName = normalizeField(body.dealershipName);
    const role = normalizeField(body.role);
    const status = normalizeField(body.status);

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required.' }, { status: 400 });
    }

    if (!name || !email || !dealershipName || !role || !status) {
      return NextResponse.json({ error: 'All lead fields are required.' }, { status: 400 });
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('autoforge_leads').doc(leadId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    const now = Timestamp.now();
    await ref.set(
      {
        name,
        email,
        dealership_name: dealershipName,
        role,
        status,
        updated_at: now,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, leadId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update AutoForge lead.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  try {
    const authCheck = await requireAdminOrDeveloper(request);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const { leadId } = await context.params;
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('autoforge_leads').doc(leadId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true, leadId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete AutoForge lead.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
