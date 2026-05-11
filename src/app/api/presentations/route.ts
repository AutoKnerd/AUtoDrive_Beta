import { NextResponse } from 'next/server';
import { listPresentationDecks } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const decks = await listPresentationDecks();
    return NextResponse.json({ ok: true, decks });
  } catch (error) {
    console.error('Unable to list presentation decks.', error);
    return NextResponse.json(
      { error: 'Unable to list presentation decks.' },
      { status: 500 },
    );
  }
}
