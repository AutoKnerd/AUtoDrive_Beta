import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PptxImportMode = 'background' | 'html';

type TextBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ExtractedSlide = {
  index: number;
  title: string;
  textBoxes: TextBox[];
};

const execFileAsync = promisify(execFile);
const PRESENTATIONS_ROOT = path.join(process.cwd(), 'Presentations');
const EMU_PER_INCH = 914400;

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function readXmlAttribute(source: string, name: string) {
  const match = source.match(new RegExp(`${name}="([^"]+)"`));
  return match ? Number.parseInt(match[1], 10) : 0;
}

function toPercent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function readPresentationSize(presentationXml: string) {
  const sizeMatch = presentationXml.match(/<p:sldSz\b[^>]*>/);
  if (!sizeMatch) {
    return { width: 13.333 * EMU_PER_INCH, height: 7.5 * EMU_PER_INCH };
  }

  return {
    width: readXmlAttribute(sizeMatch[0], 'cx') || 13.333 * EMU_PER_INCH,
    height: readXmlAttribute(sizeMatch[0], 'cy') || 7.5 * EMU_PER_INCH,
  };
}

function extractTextBoxes(slideXml: string, deckSize: { width: number; height: number }) {
  const shapes = Array.from(slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g), (match) => match[0]);

  return shapes.map((shape) => {
    const text = Array.from(shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), (match) => decodeXml(match[1]))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return null;

    const offMatch = shape.match(/<a:off\b[^>]*>/);
    const extMatch = shape.match(/<a:ext\b[^>]*>/);
    const x = offMatch ? readXmlAttribute(offMatch[0], 'x') : 0;
    const y = offMatch ? readXmlAttribute(offMatch[0], 'y') : 0;
    const width = extMatch ? readXmlAttribute(extMatch[0], 'cx') : deckSize.width;
    const height = extMatch ? readXmlAttribute(extMatch[0], 'cy') : deckSize.height;

    return {
      text,
      x: toPercent(x, deckSize.width),
      y: toPercent(y, deckSize.height),
      width: Math.max(8, toPercent(width, deckSize.width)),
      height: Math.max(6, toPercent(height, deckSize.height)),
    };
  }).filter((box): box is TextBox => box !== null);
}

function toSlideTitle(slide: ExtractedSlide) {
  return slide.textBoxes[0]?.text.slice(0, 72) || `Slide ${slide.index}`;
}

async function extractPptxSlides(extractRoot: string) {
  const presentationXml = await readFile(path.join(extractRoot, 'ppt', 'presentation.xml'), 'utf8');
  const deckSize = readPresentationSize(presentationXml);
  const slidesDir = path.join(extractRoot, 'ppt', 'slides');
  const slideFiles = (await readdir(slidesDir))
    .filter((file) => /^slide\d+\.xml$/i.test(file))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/\d+/)?.[0] || 0);
      const rightNumber = Number(right.match(/\d+/)?.[0] || 0);
      return leftNumber - rightNumber;
    });

  const slides: ExtractedSlide[] = [];

  for (const file of slideFiles) {
    const index = Number(file.match(/\d+/)?.[0] || slides.length + 1);
    const slideXml = await readFile(path.join(slidesDir, file), 'utf8');
    const slide = {
      index,
      title: `Slide ${index}`,
      textBoxes: extractTextBoxes(slideXml, deckSize),
    };
    slide.title = toSlideTitle(slide);
    slides.push(slide);
  }

  return slides;
}

function createHtmlSlide(deckTitle: string, slide: ExtractedSlide) {
  const boxes = slide.textBoxes.map((box) => `
      <div class="pptx-text" style="left:${box.x.toFixed(3)}%;top:${box.y.toFixed(3)}%;width:${box.width.toFixed(3)}%;min-height:${box.height.toFixed(3)}%;">
        ${escapeHtml(box.text)}
      </div>
    `).join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(deckTitle)} - Slide ${slide.index}</title>
  <link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; width: 100%; height: 100%; background: #05070c; color: #fff; font-family: Inter, Arial, sans-serif; }
    body { display: grid; place-items: center; overflow: hidden; }
    .slide { position: relative; width: 100vw; height: 56.25vw; max-height: 100vh; max-width: 177.78vh; background: #f8fafc; color: #111827; overflow: hidden; }
    .pptx-text { position: absolute; box-sizing: border-box; padding: 0.45rem 0.6rem; color: inherit; font-size: clamp(14px, 2vw, 32px); line-height: 1.18; white-space: pre-wrap; }
    .overlay-layer { position: absolute; inset: 0; pointer-events: none; }
  </style>
</head>
<body>
  <main class="slide" data-slide-step="slide${slide.index}">
    ${boxes || '<div class="pptx-text" style="left:8%;top:12%;width:84%;">No editable text was found on this slide.</div>'}
    <section class="overlay-layer" data-overlay-layer></section>
  </main>
  <script src="/Presentations/_shared/deck-controls.js"></script>
</body>
</html>`;
}

function createBackgroundSlide(deckTitle: string, slideIndex: number, imagePath: string) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(deckTitle)} - Slide ${slideIndex}</title>
  <link href="/Presentations/_shared/deck-controls.css" rel="stylesheet"/>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; width: 100%; height: 100%; background: #05070c; }
    body { display: grid; place-items: center; overflow: hidden; }
    .slide { position: relative; width: 100vw; height: 56.25vw; max-height: 100vh; max-width: 177.78vh; overflow: hidden; background: #000; }
    .slide-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .overlay-layer { position: absolute; inset: 0; pointer-events: none; }
  </style>
</head>
<body>
  <main class="slide" data-slide-step="slide${slideIndex}">
    <img class="slide-bg" src="/Presentations/${imagePath}" alt="Slide ${slideIndex}"/>
    <section class="overlay-layer" data-overlay-layer></section>
  </main>
  <script src="/Presentations/_shared/deck-controls.js"></script>
</body>
</html>`;
}

function createAudienceContent(slides: string[]) {
  return slides.reduce<Record<string, { eyebrow: string; title: string; body: string; prompt: string; speakerNotes: string[] }>>((accumulator, slide, index) => {
    const step = `slide${index + 1}`;
    accumulator[step] = {
      eyebrow: 'Live Session',
      title: slide.replace(/^\d+-/, '').replace(/\.html$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      body: 'This slide is ready for live overlay content.',
      prompt: 'Keep this page open. It updates as the presentation moves.',
      speakerNotes: [],
    };
    return accumulator;
  }, {});
}

function createCompanionBindings(deckId: string, slides: string[]) {
  return slides.reduce<Record<string, { slideStep: string; responseKey: string; interactionMode: string; mainSlideEffect: string }>>((accumulator, _slide, index) => {
    const step = `slide${index + 1}`;
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
  const slideLinks = slides.map((slide, index) => `
      <a class="slide-link" href="/Presentations/${deckId}/${slide}">
        <span class="slide-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="slide-title">Slide ${index + 1}</span>
      </a>
    `).join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(deckTitle)}</title>
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
    <h1>${escapeHtml(deckTitle)}</h1>
    <p class="description">${escapeHtml(description)}</p>
    <section class="grid">${slideLinks}</section>
  </main>
</body>
</html>`;
}

async function findCommand(candidates: string[]) {
  for (const command of candidates) {
    try {
      await execFileAsync('which', [command]);
      return command;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

async function importAsBackground({
  pptxPath,
  tempDir,
  deckRoot,
  deckId,
  deckTitle,
}: {
  pptxPath: string;
  tempDir: string;
  deckRoot: string;
  deckId: string;
  deckTitle: string;
}) {
  const officeCommand = await findCommand([
    'soffice',
    'libreoffice',
    // macOS Homebrew cask installs the binary inside the app bundle, not on PATH.
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ]);
  const pdfToPpmCommand = await findCommand(['pdftoppm', '/opt/homebrew/bin/pdftoppm', '/usr/local/bin/pdftoppm']);
  const imageMagickCommand = await findCommand(['magick', 'convert']);

  if (!officeCommand) {
    throw new Error('PowerPoint background import requires LibreOffice or soffice on the server.');
  }

  if (!pdfToPpmCommand && !imageMagickCommand) {
    throw new Error('PowerPoint background import requires pdftoppm or ImageMagick on the server.');
  }

  const pdfDir = path.join(tempDir, 'pdf');
  const imageDir = path.join(deckRoot, 'assets', 'pptx-backgrounds');
  await mkdir(pdfDir, { recursive: true });
  await mkdir(imageDir, { recursive: true });
  await execFileAsync(officeCommand, ['--headless', '--convert-to', 'pdf', '--outdir', pdfDir, pptxPath], { timeout: 120000 });

  const pdfFile = (await readdir(pdfDir)).find((file) => file.toLowerCase().endsWith('.pdf'));
  if (!pdfFile) {
    throw new Error('The PPTX file could not be converted to PDF.');
  }

  const pdfPath = path.join(pdfDir, pdfFile);
  if (pdfToPpmCommand) {
    await execFileAsync(pdfToPpmCommand, ['-png', '-r', '144', pdfPath, path.join(imageDir, 'slide')], { timeout: 120000 });
  } else if (imageMagickCommand) {
    await execFileAsync(imageMagickCommand, ['-density', '144', pdfPath, path.join(imageDir, 'slide-%d.png')], { timeout: 120000 });
  }

  const imageFiles = (await readdir(imageDir))
    .filter((file) => /\.png$/i.test(file))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

  if (imageFiles.length === 0) {
    throw new Error('No slide images were generated from the PPTX file.');
  }

  const slides: string[] = [];
  for (const [index, imageFile] of imageFiles.entries()) {
    const slideNumber = index + 1;
    const slideFile = `${String(slideNumber).padStart(2, '0')}-slide-${slideNumber}.html`;
    const imagePath = `${deckId}/assets/pptx-backgrounds/${imageFile}`;
    await writeFile(path.join(deckRoot, slideFile), createBackgroundSlide(deckTitle, slideNumber, imagePath), 'utf8');
    slides.push(slideFile);
  }

  return slides;
}

async function importAsHtml({
  extractRoot,
  deckRoot,
  deckTitle,
}: {
  extractRoot: string;
  deckRoot: string;
  deckTitle: string;
}) {
  const extractedSlides = await extractPptxSlides(extractRoot);
  if (extractedSlides.length === 0) {
    throw new Error('No slides were found in the PPTX file.');
  }

  const slides: string[] = [];
  for (const slide of extractedSlides) {
    const slideFile = `${String(slide.index).padStart(2, '0')}-${slugify(slide.title) || `slide-${slide.index}`}.html`;
    await writeFile(path.join(deckRoot, slideFile), createHtmlSlide(deckTitle, slide), 'utf8');
    slides.push(slideFile);
  }

  return slides;
}

export async function POST(request: Request) {
  let tempDir = '';

  try {
    const formData = await request.formData();
    const pptxFile = formData.get('pptx');
    const title = typeof formData.get('title') === 'string' ? String(formData.get('title')).trim() : '';
    const deckId = slugify(String(formData.get('deckId') || title || ''));
    const description = typeof formData.get('description') === 'string' && String(formData.get('description')).trim().length > 0
      ? String(formData.get('description')).trim()
      : 'Imported from a PowerPoint presentation.';
    const overwrite = formData.get('overwrite') === 'true';
    const mode: PptxImportMode = formData.get('mode') === 'html' ? 'html' : 'background';

    if (!(pptxFile instanceof File)) {
      return NextResponse.json({ error: 'A .pptx file is required.' }, { status: 400 });
    }

    if (!pptxFile.name.toLowerCase().endsWith('.pptx')) {
      return NextResponse.json({ error: 'Only .pptx files are supported.' }, { status: 400 });
    }

    if (!deckId) {
      return NextResponse.json({ error: 'Deck id or title is required.' }, { status: 400 });
    }

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'presentation-pptx-import-'));
    const pptxPath = path.join(tempDir, 'source.pptx');
    const extractRoot = path.join(tempDir, 'extracted');
    await mkdir(extractRoot, { recursive: true });
    await writeFile(pptxPath, Buffer.from(await pptxFile.arrayBuffer()));
    await execFileAsync('unzip', ['-q', pptxPath, '-d', extractRoot]);

    const deckRoot = path.join(PRESENTATIONS_ROOT, deckId);
    const stagingDeckRoot = path.join(tempDir, 'deck-output');
    const deckStats = await stat(deckRoot).catch(() => null);
    const existingDeckManifest = deckStats ? await readPresentationDeckManifest(deckId) : null;

    if (deckStats && !overwrite) {
      return NextResponse.json({ error: 'A deck with this id already exists. Enable overwrite to replace it.' }, { status: 409 });
    }

    await mkdir(stagingDeckRoot, { recursive: true });

    const deckTitle = title || titleCaseDeckId(deckId);
    let effectiveMode: PptxImportMode = mode;
    let importWarning: string | null = null;

    if (mode === 'background') {
      const officeCommand = await findCommand([
        'soffice',
        'libreoffice',
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      ]);
      if (!officeCommand) {
        effectiveMode = 'html';
        importWarning = 'Background PPTX import requires LibreOffice or soffice on the server, so this deck was imported as editable HTML instead.';
      }
    }

    const slides = effectiveMode === 'html'
      ? await importAsHtml({ extractRoot, deckRoot: stagingDeckRoot, deckTitle })
      : await importAsBackground({ pptxPath, tempDir, deckRoot: stagingDeckRoot, deckId, deckTitle });

    const manifest = {
      deckId,
      title: deckTitle,
      description,
      entry: 'index.html',
      slideCount: slides.length,
      slides,
      importSource: {
        type: 'pptx',
        mode: effectiveMode,
        fileName: pptxFile.name,
      },
      audience: {
        enabled: existingDeckManifest?.audience?.enabled !== false,
        liveSessionId: existingDeckManifest?.audience?.liveSessionId || `${deckId}-main`,
        qrOverlayEnabled: existingDeckManifest?.audience?.qrOverlayEnabled !== false,
        contentByStep: {
          ...createAudienceContent(slides),
          ...(existingDeckManifest?.audience?.contentByStep ?? {}),
        },
      },
      companion: {
        enabled: existingDeckManifest?.companion?.enabled === true,
        entry: existingDeckManifest?.companion?.entry || 'companion/index.html',
        files: existingDeckManifest?.companion?.files || [],
        contentByStep: existingDeckManifest?.companion?.contentByStep || {},
        bindingsByStep: {
          ...createCompanionBindings(deckId, slides),
          ...(existingDeckManifest?.companion?.bindingsByStep ?? {}),
        },
      },
      createdAt: existingDeckManifest?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeFile(path.join(stagingDeckRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(path.join(stagingDeckRoot, 'index.html'), createDeckIndex(deckId, deckTitle, description, slides), 'utf8');

    if (overwrite) {
      await rm(deckRoot, { recursive: true, force: true });
    }

    await cp(stagingDeckRoot, deckRoot, { recursive: true });

    const normalizedManifest = await readPresentationDeckManifest(deckId);

    return NextResponse.json({
      ok: true,
      deckId,
      href: `/Presentations/${deckId}`,
      manifest: normalizedManifest,
      mode: effectiveMode,
      warning: importWarning,
    });
  } catch (error) {
    console.error('Unable to import presentation PPTX.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import presentation PPTX.' },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
