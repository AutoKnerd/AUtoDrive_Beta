import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTION = 'signalMapperUnlocks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      return NextResponse.json({ ok: false, message: 'Valid email is required.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const adminDb = getAdminDb();
    await adminDb.collection(COLLECTION).add({
      email,
      emailDomain: email.split('@')[1] || '',
      source: 'signal-mapper',
      createdAt: nowIso,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Failed to capture unlock email.' }, { status: 500 });
  }
}
