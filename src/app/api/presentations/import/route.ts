import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export async function POST(request: Request) {
  let tempDir = '';

  try {
    const body = await request.json() as {
      title?: string;
      deckId?: string;
      description?: string;
      html?: string;
      overwrite?: boolean;
      mode?: 'slides' | 'companion';
      step?: string;
      responseKey?: string;
    };

    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const deckId = slugify(body.deckId || body.title || '');
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const overwrite = body.overwrite === true;
    const mode = body.mode === 'companion' ? 'companion' : 'slides';
    const step = typeof body.step === 'string' ? body.step.trim() : '';
    const responseKey = typeof body.responseKey === 'string' ? body.responseKey.trim() : '';

    if (!html) {
      return NextResponse.json({ error: 'Presentation HTML is required.' }, { status: 400 });
    }

    if (!deckId) {
      return NextResponse.json({ error: 'Deck id or title is required.' }, { status: 400 });
    }

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'presentation-import-'));
    const inputPath = path.join(tempDir, 'source.html');
    await writeFile(inputPath, html, 'utf8');

    const scriptPath = path.join(process.cwd(), 'scripts', 'import-presentation-html.mjs');
    const args = [
      scriptPath,
      '--input',
      inputPath,
      '--deck-id',
      deckId,
      '--mode',
      mode,
    ];

    if (title) {
      args.push('--title', title);
    }

    if (description) {
      args.push('--description', description);
    }

    if (overwrite && mode !== 'companion') {
      args.push('--overwrite');
    }

    if (step) {
      args.push('--step', step);
    }

    if (responseKey) {
      args.push('--response-key', responseKey);
    }

    await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
    });

    const manifest = await readPresentationDeckManifest(deckId);

    return NextResponse.json({
      ok: true,
      deckId,
      href: `/Presentations/${deckId}`,
      manifest,
    });
  } catch (error) {
    console.error('Unable to import presentation deck.', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to import presentation deck.',
      },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
