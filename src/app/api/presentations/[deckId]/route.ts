import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';

function isValidDeckId(value: string) {
  return value.length > 0 && !value.includes('..') && !value.startsWith('.') && value !== '_shared';
}

function leadingNumber(file: unknown): number {
  const match = String(file || '').match(/^(\d+)/);
  const n = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

// A truly blank slide that still wires the shared deck engine (so prev/next,
// filmstrip, and live controls keep working). It carries a high, unique leading
// number so the engine infers a step that has no companion binding — the slide
// stays blank no matter where it's inserted, and existing slides are NOT
// renumbered, so per-slide wiring (rosters, leaderboards) is left untouched.
function createBlankSlideDocument(stepNumber: number, deckTitle: string) {
  const title = (deckTitle || 'Presentation').trim() || 'Presentation';
  return `<!-- slide${stepNumber} | Blank slide -->
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — Blank</title>
    <link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>
    <style>
      :root { color-scheme: dark; }
      html, body {
        margin: 0;
        min-height: 100%;
        width: 100%;
        background: linear-gradient(180deg, #050505 0%, #0d1018 100%);
      }
    </style>
  </head>
  <body data-blank-slide="1">
    <script src="/Presentations/_shared/deck-controls.js"></script>
  </body>
</html>`;
}

// Strip markdown code fences that tools (Stitch, chat assistants) wrap HTML in,
// then return either the full <html> document or a bare fragment.
function cleanPastedHtml(raw: string) {
  return String(raw || '')
    .replace(/^[ \t]*(?:```|~~~)[a-zA-Z0-9-]*[ \t]*$/gm, '')
    .replace(/(?:```|~~~)+/g, '')
    .trim();
}

// Wrap a bare HTML fragment in a full slide document (dark deck background) so
// it renders standalone. Full documents pass straight through.
function wrapSlideFragment(cleaned: string, title: string) {
  if (/<html[\s\S]*?>/i.test(cleaned)) return cleaned;
  return `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; }
      html, body { margin: 0; min-height: 100%; width: 100%; background: linear-gradient(180deg, #050505 0%, #0d1018 100%); color: #fff; font-family: Inter, Arial, sans-serif; }
    </style>
  </head>
  <body>
${cleaned}
  </body>
</html>`;
}

// Guarantee the shared deck engine assets are present so navigation, filmstrip,
// and live controls keep working — this is what keeps injected HTML from
// "breaking the presentation". Mirrors the importer's ensureSharedControls.
function ensureSharedControls(input: string) {
  let html = input
    .replace(/href="\/Presentations\/[^"]+\/deck-controls\.css"/g, 'href="/Presentations/_shared/deck-controls.css"')
    .replace(/src="\/Presentations\/[^"]+\/deck-controls\.js"/g, 'src="/Presentations/_shared/deck-controls.js"');

  if (!html.includes('/Presentations/_shared/deck-controls.css')) {
    html = html.replace(/<\/head>/i, '<link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>\n</head>');
  }
  if (!html.includes('/Presentations/_shared/deck-controls.js')) {
    html = html.replace(/<\/body>/i, '<script src="/Presentations/_shared/deck-controls.js"></script>\n</body>');
  }
  // Fallbacks if the document has no <head>/<body> tags at all.
  if (!html.includes('/Presentations/_shared/deck-controls.css')) {
    html = `<link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>\n${html}`;
  }
  if (!html.includes('/Presentations/_shared/deck-controls.js')) {
    html = `${html}\n<script src="/Presentations/_shared/deck-controls.js"></script>`;
  }
  return html;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const { deckId: rawDeckId } = await params;
  const deckId = String(rawDeckId || '').trim();

  if (!isValidDeckId(deckId)) {
    return NextResponse.json({ error: 'Invalid deck id.' }, { status: 400 });
  }

  let body: { action?: unknown; afterIndex?: unknown; slideFile?: unknown; html?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.action !== 'insert-blank' && body.action !== 'set-slide-html') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  const deckRoot = path.join(process.cwd(), 'Presentations', deckId);
  const manifestPath = path.join(deckRoot, 'manifest.json');

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return NextResponse.json({ error: 'Deck not found.' }, { status: 404 });
  }

  const slides = Array.isArray(manifest.slides)
    ? (manifest.slides as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  if (slides.length === 0) {
    return NextResponse.json({ error: 'This deck has no slides.' }, { status: 400 });
  }

  // --- Replace one slide's HTML with injected content (keeps engine + manifest) ---
  if (body.action === 'set-slide-html') {
    const slideFile = String(body.slideFile || '').trim();
    // Only allow writing a file that is actually part of this deck's slide list,
    // and reject any path tricks — the file must be a plain name in the array.
    if (!slideFile || slideFile.includes('/') || slideFile.includes('..') || !slides.includes(slideFile)) {
      return NextResponse.json({ error: 'Unknown slide file for this deck.' }, { status: 400 });
    }

    const cleaned = cleanPastedHtml(String(body.html || ''));
    if (!cleaned) {
      return NextResponse.json({ error: 'No HTML provided.' }, { status: 400 });
    }

    const wrapped = wrapSlideFragment(cleaned, String(manifest.title || deckId));
    const finalHtml = ensureSharedControls(wrapped);

    try {
      await writeFile(path.join(deckRoot, slideFile), `${finalHtml}\n`, 'utf8');
      manifest.updatedAt = new Date().toISOString();
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.error('Unable to save slide HTML.', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unable to save slide HTML.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, deckId, slideFile, bytes: finalHtml.length });
  }

  // afterIndex is 0-based: insert AFTER this slide. -1 inserts at the very start.
  const rawAfter = Number(body.afterIndex);
  const afterIndex = Number.isFinite(rawAfter)
    ? Math.max(-1, Math.min(slides.length - 1, Math.floor(rawAfter)))
    : slides.length - 1;
  const insertAt = afterIndex + 1;

  // Pick a leading number that is unique and clear of every existing slide step.
  const maxNumber = slides.reduce((max, file) => Math.max(max, leadingNumber(file)), 0);
  const stepNumber = maxNumber + 1;
  const fileName = `${stepNumber}-blank.html`;

  try {
    await writeFile(
      path.join(deckRoot, fileName),
      createBlankSlideDocument(stepNumber, String(manifest.title || deckId)),
      'utf8',
    );

    slides.splice(insertAt, 0, fileName);
    manifest.slides = slides;
    manifest.slideCount = slides.length;
    manifest.updatedAt = new Date().toISOString();

    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.error('Unable to insert blank slide.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to insert blank slide.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deckId,
    inserted: fileName,
    position: insertAt,
    slideCount: slides.length,
    slides,
  });
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
