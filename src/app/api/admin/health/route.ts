import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, isAdminInitialized, adminInitErrorMessage } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check our exported flag first
    if (!isAdminInitialized) {
        return NextResponse.json({ ok: false, message: adminInitErrorMessage || 'Admin SDK not available' }, { status: 503 });
    }

    // Now try to actually use the SDKs to be certain
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // A lightweight check - no data is actually fetched
    adminDb.collection('__health-check');
    
    // An impossible token will fail, but if verifyIdToken exists, the service is up.
    await adminAuth.verifyIdToken('__health-check', true).catch(err => {
        // We expect "invalid-argument" or "id-token-expired", which means the auth service is running.
        if (err.code !== 'auth/invalid-argument' && err.code !== 'auth/id-token-expired') {
            throw err; // Re-throw unexpected errors
        }
    });

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Admin health check failed' }, { status: 503 });
  }
}
