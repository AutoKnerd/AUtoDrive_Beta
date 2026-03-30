import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AutoForgeLeadBody = {
  name?: string;
  email?: string;
  dealershipName?: string;
  role?: string;
};

function normalizeField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidRole(value: string): boolean {
  return ['Sales', 'Manager', 'Fixed Ops', 'Owner', 'Other'].includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AutoForgeLeadBody;

    const name = normalizeField(body.name);
    const email = normalizeField(body.email).toLowerCase();
    const dealershipName = normalizeField(body.dealershipName);
    const role = normalizeField(body.role);

    if (!name || !email || !dealershipName || !role) {
      return NextResponse.json({ error: 'All lead fields are required.' }, { status: 400 });
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const now = Timestamp.now();
    const ref = await db.collection('autoforge_leads').add({
      name,
      email,
      dealership_name: dealershipName,
      role,
      source: 'autoforge_modal',
      status: 'captured',
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ ok: true, leadId: ref.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to capture AutoForge lead.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
