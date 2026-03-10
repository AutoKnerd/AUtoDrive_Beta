import { NextResponse } from 'next/server';
import { getConsultantLeaderboard } from '@/lib/consultant-sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leaderboard = await getConsultantLeaderboard();
    return NextResponse.json(leaderboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load leaderboard.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
