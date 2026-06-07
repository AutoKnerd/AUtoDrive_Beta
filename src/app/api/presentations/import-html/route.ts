import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRESENTATIONS_ROOT = path.join(process.cwd(), 'Presentations');

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function titleCaseDeckId(deckId: string) {
  return deckId
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isHiddenPath(relativePath: string) {
  return relativePath.split(path.sep).some((segment) => segment.startsWith('.') || segment === '__MACOSX');
}

function toPosixPath(value: string) {
  return value.split(path.sep).join('/');
}

function toSafeRelativePath(value: string) {
  const normalized = path.normalize(value).replace(/^(\.\.(\/|\\|$))+/, '');
  if (path.isAbsolute(normalized) || normalized.includes(`..${path.sep}`) || normalized === '..') return '';
  return normalized;
}

function readHtmlTitle(source: string) {
  const match = source.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function toTitleFromSlideFile(slide: string) {
  return slide
    .split('/')
    .pop()
    ?.replace(/^\d+-/, '')
    .replace(/\.html?$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Slide';
}

function inferStepFromSlide(slide: string, fallbackIndex: number) {
  const fileName = slide.split('/').pop() || '';
  const numberedMatch = fileName.match(/^(\d+)/);
  const number = numberedMatch ? Number.parseInt(numberedMatch[1], 10) : fallbackIndex + 1;
  return `slide${number}`;
}

function ensureSharedControls(source: string) {
  let html = source
    .replace(/href="\/Presentations\/[^"]+\/deck-controls\.css"/g, 'href="/Presentations/_shared/deck-controls.css"')
    .replace(/src="\/Presentations\/[^"]+\/deck-controls\.js"/g, 'src="/Presentations/_shared/deck-controls.js"');

  if (!html.includes('/Presentations/_shared/deck-controls.css')) {
    html = html.replace(
      /<\/head>/i,
      '<link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>\n</head>',
    );
  }

  if (!html.includes('/Presentations/_shared/deck-controls.js')) {
    html = html.replace(
      /<\/body>/i,
      '<script src="/Presentations/_shared/deck-controls.js"></script>\n</body>',
    );
  }

  if (!html.includes('/Presentations/_shared/in-page-deck.css')) {
    html = html.replace(
      /<\/head>/i,
      '<link href="/Presentations/_shared/in-page-deck.css" rel="stylesheet"/>\n</head>',
    );
  }

  if (!html.includes('/Presentations/_shared/in-page-deck.js')) {
    html = html.replace(
      /<\/body>/i,
      '<script src="/Presentations/_shared/in-page-deck.js"></script>\n</body>',
    );
  }

  return html;
}

// Single-file decks can hold many slides internally (a thumbnail carousel whose
// slides live in an in-page array). Count those so the manifest can declare
// inPageSteps and the builder/companion system can target slide1..slideN.
function countInPageSlides(source: string) {
  const byThumb = source.match(/data-i\s*=\s*["']\d+["']/g);
  if (byThumb && byThumb.length > 1) return byThumb.length;
  const byFigure = source.match(/class\s*=\s*["'][^"']*\bslide\b[^"']*["']/g);
  if (byFigure && byFigure.length > 1) return byFigure.length;
  const byAlt = source.match(/alt\s*=\s*["']\s*slide\s*\d+\s*["']/gi);
  if (byAlt && byAlt.length > 1) return byAlt.length;
  return 0;
}

// Apple Keynote HTML exports keep a master header.json listing every slide, so
// the slide count isn't in the index.html itself. Read it when present.
async function detectKeynoteSlideCount(packageRoot: string, files: string[]) {
  const headerRel = files.find((file) => path.basename(file).toLowerCase() === 'header.json');
  if (!headerRel) return 0;
  try {
    const data = JSON.parse(await readFile(path.join(packageRoot, headerRel), 'utf8'));
    if (Array.isArray(data?.slideList) && data.slideList.length > 1) return data.slideList.length;
    if (typeof data?.slideCount === 'number' && data.slideCount > 1) return Math.floor(data.slideCount);
  } catch {
    // Ignore malformed header files.
  }
  return 0;
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath);
    if (isHiddenPath(relativePath)) return [];
    if (entry.isDirectory()) return listFiles(root, absolutePath);
    if (!entry.isFile()) return [];
    return [relativePath];
  }));

  return nested.flat();
}

async function resolvePackageRoot(extractRoot: string) {
  const entries = await readdir(extractRoot, { withFileTypes: true });
  const visible = entries.filter((entry) => !entry.name.startsWith('.') && entry.name !== '__MACOSX');
  if (visible.length === 1 && visible[0].isDirectory()) {
    return path.join(extractRoot, visible[0].name);
  }

  return extractRoot;
}

async function copyPackageFiles(sourceRoot: string, deckRoot: string, files: string[]) {
  await Promise.all(files.map(async (relativePath) => {
    const safeRelativePath = toSafeRelativePath(relativePath);
    if (!safeRelativePath) return;
    const sourcePath = path.join(sourceRoot, safeRelativePath);
    const destinationPath = path.join(deckRoot, safeRelativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }));
}

function sortSlideFiles(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function createAudienceContent(slides: string[]) {
  return slides.reduce<Record<string, { eyebrow: string; title: string; body: string; prompt: string }>>((accumulator, slide, index) => {
    const step = inferStepFromSlide(slide, index);
    const title = toTitleFromSlideFile(slide);
    accumulator[step] = {
      eyebrow: 'Live Session',
      title,
      body: `You are viewing synced audience content for ${title}.`,
      prompt: 'Keep this page open. It updates as the presentation moves.',
    };
    return accumulator;
  }, {});
}

function createCompanionBindings(deckId: string, slides: string[]) {
  return slides.reduce<Record<string, { slideStep: string; responseKey: string; interactionMode: string; mainSlideEffect: string }>>((accumulator, slide, index) => {
    const step = inferStepFromSlide(slide, index);
    accumulator[step] = {
      slideStep: step,
      responseKey: `${deckId}-${step}`,
      interactionMode: 'question',
      mainSlideEffect: 'counter',
    };
    return accumulator;
  }, {});
}

function createDeckIndex(deckId: string, deckTitle: string, description: string, slides: string[]) {
  const slideLinks = slides.map((slide, index) => {
    const encodedSlide = slide.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `
      <a class="slide-link" href="/Presentations/${deckId}/${encodedSlide}">
        <span class="slide-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="slide-title">${toTitleFromSlideFile(slide)}</span>
      </a>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${deckTitle}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; background: #050505; color: #fff; font-family: Inter, Arial, sans-serif; }
    main { max-width: 1100px; margin: 0 auto; padding: 72px 24px 96px; }
    .eyebrow { color: #8eff71; text-transform: uppercase; letter-spacing: 0.28em; font-size: 11px; font-weight: 700; }
    h1 { margin: 18px 0 0; font-size: clamp(3rem, 7vw, 5.5rem); line-height: 0.95; }
    .description { max-width: 720px; margin-top: 20px; color: rgba(255,255,255,0.66); font-size: 18px; line-height: 1.75; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 48px; }
    .slide-link { display: flex; flex-direction: column; gap: 14px; padding: 22px 20px; border-radius: 22px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); text-decoration: none; color: inherit; }
    .slide-index { color: rgba(142,255,113,0.86); font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; }
    .slide-title { font-size: 22px; font-weight: 800; line-height: 1.2; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Presentation Engine</div>
    <h1>${deckTitle}</h1>
    <p class="description">${description}</p>
    <section class="grid">${slideLinks}</section>
  </main>
</body>
</html>`;
}

function buildRelativePath(file: File) {
  const uploadedFile = file as File & { webkitRelativePath?: string };
  const relativePath = (uploadedFile.webkitRelativePath || file.name || '').trim();
  return toSafeRelativePath(relativePath || file.name || '');
}

async function writeUploadedFolderFiles(files: File[], relativePaths: string[], extractRoot: string) {
  await Promise.all(files.map(async (file, index) => {
    const providedRelativePath = relativePaths[index] || '';
    const relativePath = toSafeRelativePath(providedRelativePath) || buildRelativePath(file);
    if (!relativePath) return;
    const destinationPath = path.join(extractRoot, relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, Buffer.from(await file.arrayBuffer()));
  }));
}

export async function POST(request: Request) {
  let tempDir = '';

  try {
    const formData = await request.formData();
    const folderFiles = formData.getAll('files').filter((file): file is File => file instanceof File);
    const relativePaths = formData.getAll('relativePaths').map((value) => String(value || ''));
    const title = typeof formData.get('title') === 'string' ? String(formData.get('title')).trim() : '';
    const deckId = slugify(String(formData.get('deckId') || title || ''));
    const description = typeof formData.get('description') === 'string' && String(formData.get('description')).trim().length > 0
      ? String(formData.get('description')).trim()
      : 'Imported from an HTML presentation folder.';
    const overwrite = formData.get('overwrite') === 'true';

    if (folderFiles.length === 0) {
      return NextResponse.json({ error: 'Select an HTML folder to import.' }, { status: 400 });
    }

    if (!deckId) {
      return NextResponse.json({ error: 'Deck id or title is required.' }, { status: 400 });
    }

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'presentation-html-import-'));
    const extractRoot = path.join(tempDir, 'extracted');
    await mkdir(extractRoot, { recursive: true });
    await writeUploadedFolderFiles(folderFiles, relativePaths, extractRoot);

    const packageRoot = await resolvePackageRoot(extractRoot);
    const files = await listFiles(packageRoot);
    const htmlFiles = files
      .filter((file) => /\.html?$/i.test(file))
      .map(toSafeRelativePath)
      .filter(Boolean)
      .sort(sortSlideFiles);

    if (htmlFiles.length === 0) {
      return NextResponse.json({ error: 'No HTML files were found in the selected folder.' }, { status: 400 });
    }

    const manifestPath = files.find((file) => path.basename(file).toLowerCase() === 'manifest.json');
    const existingHtmlManifest = manifestPath
      ? JSON.parse(await readFile(path.join(packageRoot, manifestPath), 'utf8')) as { slides?: string[]; title?: string; description?: string }
      : null;
    const manifestSlides = Array.isArray(existingHtmlManifest?.slides)
      ? existingHtmlManifest.slides.map(toSafeRelativePath).filter((slide) => htmlFiles.includes(slide))
      : [];
    const discoveredSlides = manifestSlides.length > 0
      ? manifestSlides
      : htmlFiles.filter((file) => htmlFiles.length === 1 || path.basename(file).toLowerCase() !== 'index.html');
    const slides = discoveredSlides.length > 0
      ? discoveredSlides
      : htmlFiles;

    const deckRoot = path.join(PRESENTATIONS_ROOT, deckId);
    const deckStats = await stat(deckRoot).catch(() => null);
    const existingDeckManifest = deckStats ? await readPresentationDeckManifest(deckId) : null;

    if (deckStats && !overwrite) {
      return NextResponse.json({ error: 'A deck with this id already exists. Enable overwrite to replace it.' }, { status: 409 });
    }

    if (overwrite) {
      await rm(deckRoot, { recursive: true, force: true });
    }

    await mkdir(deckRoot, { recursive: true });
    await copyPackageFiles(packageRoot, deckRoot, files);

    const finalSlides: string[] = [];
    let detectedInPageSteps = 0;
    for (const [index, slide] of slides.entries()) {
      const source = await readFile(path.join(packageRoot, slide), 'utf8');
      if (slides.length === 1) {
        detectedInPageSteps = countInPageSlides(source);
      }
      const outputSlide = slide.toLowerCase() === 'index.html'
        ? '01-index.html'
        : slide;
      const outputPath = path.join(deckRoot, outputSlide);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, ensureSharedControls(source), 'utf8');
      finalSlides.push(toPosixPath(outputSlide || `slide-${index + 1}.html`));
    }

    // Single-file deck with no in-page markers? It may be a Keynote export — read
    // its header.json for the real slide count.
    if (slides.length === 1 && detectedInPageSteps < 2) {
      detectedInPageSteps = await detectKeynoteSlideCount(packageRoot, files);
    }

    const deckTitle = title || existingHtmlManifest?.title || readHtmlTitle(await readFile(path.join(packageRoot, slides[0]), 'utf8')) || titleCaseDeckId(deckId);
    const deckDescription = description || existingHtmlManifest?.description || 'Imported from an HTML presentation folder.';
    const manifest = {
      deckId,
      title: deckTitle,
      description: deckDescription,
      entry: 'index.html',
      slideCount: finalSlides.length,
      ...(detectedInPageSteps > 1 ? { inPageSteps: detectedInPageSteps } : {}),
      slides: finalSlides,
      importSource: {
        type: 'html-folder',
      },
      audience: {
        enabled: existingDeckManifest?.audience?.enabled !== false,
        liveSessionId: existingDeckManifest?.audience?.liveSessionId || `${deckId}-main`,
        qrOverlayEnabled: existingDeckManifest?.audience?.qrOverlayEnabled !== false,
        contentByStep: {
          ...createAudienceContent(finalSlides),
          ...(existingDeckManifest?.audience?.contentByStep ?? {}),
        },
      },
      companion: {
        enabled: existingDeckManifest?.companion?.enabled === true,
        entry: existingDeckManifest?.companion?.entry || 'companion/index.html',
        files: existingDeckManifest?.companion?.files || [],
        contentByStep: existingDeckManifest?.companion?.contentByStep || {},
        bindingsByStep: {
          ...createCompanionBindings(deckId, finalSlides),
          ...(existingDeckManifest?.companion?.bindingsByStep ?? {}),
        },
      },
      createdAt: existingDeckManifest?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeFile(path.join(deckRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(path.join(deckRoot, 'index.html'), createDeckIndex(deckId, deckTitle, deckDescription, finalSlides), 'utf8');

    const normalizedManifest = await readPresentationDeckManifest(deckId);

    return NextResponse.json({
      ok: true,
      deckId,
      href: `/Presentations/${deckId}`,
      manifest: normalizedManifest,
    });
  } catch (error) {
    console.error('Unable to import presentation HTML folder.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import presentation HTML folder.' },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
