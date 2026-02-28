import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Try a minimal Admin SDK call to verify initialization
    // We avoid fetching data; use verifyIdToken with an impossible token to check availability
    const adminAuth = getAdminAuth();
    if (!adminAuth || typeof adminAuth.verifyIdToken !== 'function') {
      return NextResponse.json({ ok: false, message: 'Admin SDK not available' }, { status: 503 });
    }

    // If adminDb.collection exists, assume Firestore is available.
    const adminDb = getAdminDb();
    if (!adminDb || typeof adminDb.collection !== 'function') {
      return NextResponse.json({ ok: false, message: 'Admin Firestore not available' }, { status: 503 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Admin health check failed' }, { status: 503 });
  }
}
