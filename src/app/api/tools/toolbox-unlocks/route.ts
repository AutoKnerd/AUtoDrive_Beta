import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import { isValidEmail, normalizeEmail, TOOLBOX_UNLOCK_COLLECTION } from '@/lib/tools/toolbox-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, message: 'Valid email is required.' }, { status: 400 });
    }

    await getAdminDb().collection(TOOLBOX_UNLOCK_COLLECTION).add({
      email,
      source: 'toolbox',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Failed to capture email.' }, { status: 500 });
  }
}
