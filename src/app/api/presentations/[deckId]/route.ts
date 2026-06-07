import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';

function isValidDeckId(value: string) {
  return value.length > 0 && !value.includes('..') && !value.startsWith('.') && value !== '_shared';
}

// Update deck-level manifest settings (currently just inPageSteps for single-file
// decks that hold multiple slides internally). Reads/writes the raw manifest so
// unrelated fields (importSource, audience, companion, etc.) are preserved.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const { deckId: rawDeckId } = await params;
  const deckId = String(rawDeckId || '').trim();

  if (!isValidDeckId(deckId)) {
    return NextResponse.json({ error: 'Invalid deck id.' }, { status: 400 });
  }

  const manifestPath = path.join(process.cwd(), 'Presentations', deckId, 'manifest.json');

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return NextResponse.json({ error: 'Deck not found.' }, { status: 404 });
  }

  let body: { inPageSteps?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if ('inPageSteps' in body) {
    const numeric = Number(body.inPageSteps);
    if (Number.isFinite(numeric) && numeric > 1) {
      manifest.inPageSteps = Math.floor(numeric);
    } else {
      delete manifest.inPageSteps;
    }
  }

  manifest.updatedAt = new Date().toISOString();

  try {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.error('Unable to update presentation manifest.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update deck.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deckId,
    inPageSteps: typeof manifest.inPageSteps === 'number' ? manifest.inPageSteps : null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const { deckId: rawDeckId } = await params;
  const deckId = String(rawDeckId || '').trim();

  if (!isValidDeckId(deckId)) {
    return NextResponse.json({ error: 'Invalid deck id.' }, { status: 400 });
  }

  const manifest = await readPresentationDeckManifest(deckId);
  if (!manifest) {
    return NextResponse.json({ error: 'Deck not found.' }, { status: 404 });
  }

  try {
    const deckRoot = path.join(process.cwd(), 'Presentations', deckId);
    await rm(deckRoot, { recursive: true, force: true });

    return NextResponse.json({
      ok: true,
      deckId,
      title: manifest.title,
    });
  } catch (error) {
    console.error('Unable to delete presentation deck.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete presentation deck.' },
      { status: 500 },
    );
  }
}
