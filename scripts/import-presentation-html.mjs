#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function titleCaseDeckId(deckId) {
  return deckId
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function extractSlideDocuments(source) {
  const pattern = /(?:<!--[\s\S]*?-->\s*)?<!DOCTYPE html>[\s\S]*?<\/html>/gi;
  return Array.from(source.matchAll(pattern), (match) => match[0].trim()).filter(Boolean);
}

function readCommentLabel(chunk) {
  const match = chunk.match(/^<!--\s*([^>]+?)\s*-->/);
  return match ? match[1].trim() : '';
}

function readHtmlTitle(chunk) {
  const match = chunk.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function buildSlideName(index, chunk) {
  const commentLabel = readCommentLabel(chunk);
  const htmlTitle = readHtmlTitle(chunk);
  const rawLabel = commentLabel.includes('|')
    ? commentLabel.split('|').slice(1).join('|').trim()
    : (commentLabel || htmlTitle || `Slide ${index}`);
  const slug = slugify(rawLabel) || `slide-${index}`;
  return `${String(index).padStart(2, '0')}-${slug}.html`;
}

function ensureSharedControls(chunk) {
  let html = chunk
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

  return html;
}

function createDeckIndex({ deckId, deckTitle, description, slides }) {
  const slideLinks = slides
    .map((slide, index) => {
      const label = slide
        .replace(/^\d+-/, '')
        .replace(/\.html$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

      return `
        <a class="slide-link" href="/Presentations/${deckId}/${slide}">
          <span class="slide-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="slide-title">${label}</span>
        </a>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${deckTitle}</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top right, rgba(142,255,113,0.08), transparent 28%),
        #050505;
      color: #ffffff;
      font-family: Inter, Arial, sans-serif;
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 72px 24px 96px;
    }
    .eyebrow {
      color: #8eff71;
      text-transform: uppercase;
      letter-spacing: 0.28em;
      font-size: 11px;
      font-weight: 700;
    }
    h1 {
      margin: 18px 0 0;
      font-size: clamp(3rem, 7vw, 5.5rem);
      line-height: 0.95;
      letter-spacing: -0.06em;
    }
    .description {
      max-width: 720px;
      margin-top: 20px;
      color: rgba(255,255,255,0.66);
      font-size: 18px;
      line-height: 1.75;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-top: 48px;
    }
    .slide-link {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 22px 20px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      text-decoration: none;
      color: inherit;
      transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
    }
    .slide-link:hover {
      transform: translateY(-2px);
      border-color: rgba(142,255,113,0.3);
      background: rgba(255,255,255,0.05);
    }
    .slide-index {
      color: rgba(142,255,113,0.86);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    .slide-title {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Presentation Engine</div>
    <h1>${deckTitle}</h1>
    <p class="description">${description}</p>
    <section class="grid">
      ${slideLinks}
    </section>
  </main>
</body>
</html>`;
}

function createAudienceContent(slides) {
  return slides.reduce((accumulator, slide, index) => {
    const step = `slide${index + 1}`;
    const title = slide
      .replace(/^\d+-/, '')
      .replace(/\.html$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    accumulator[step] = {
      eyebrow: 'Live Session',
      title,
      body: `You are viewing synced audience content for ${title}.`,
      prompt: 'Keep this page open. It updates as the presentation advances.',
    };

    return accumulator;
  }, {});
}

function createCompanionContent({ step, title }) {
  return {
    eyebrow: 'Companion App',
    title,
    body: `Companion content for ${title}.`,
    prompt: 'This companion page can now be wired to the main presentation.',
    speakerNotes: [`Binds to ${step}`],
  };
}

async function readExistingManifest(deckDir) {
  try {
    const payload = await readFile(path.join(deckDir, 'manifest.json'), 'utf8');
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function buildManifest({
  deckId,
  title,
  description,
  slides,
  existingManifest,
  companion,
}) {
  const existingAudience = existingManifest?.audience && typeof existingManifest.audience === 'object'
    ? existingManifest.audience
    : undefined;
  const existingCompanion = existingManifest?.companion && typeof existingManifest.companion === 'object'
    ? existingManifest.companion
    : undefined;

  return {
    deckId,
    title,
    description,
    entry: 'index.html',
    slideCount: slides.length,
    slides,
    audience: {
      enabled: existingAudience?.enabled !== false,
      liveSessionId: typeof existingAudience?.liveSessionId === 'string' && existingAudience.liveSessionId.trim().length > 0
        ? existingAudience.liveSessionId.trim()
        : `${deckId}-main`,
      qrOverlayEnabled: existingAudience?.qrOverlayEnabled !== false,
      contentByStep: {
        ...(slides.length > 0 ? createAudienceContent(slides) : {}),
        ...(existingAudience?.contentByStep ?? {}),
      },
    },
    companion: {
      enabled: companion ? true : existingCompanion?.enabled === true,
      entry: companion?.entry || existingCompanion?.entry || 'companion/index.html',
      files: companion?.files || existingCompanion?.files || [],
      contentByStep: {
        ...(existingCompanion?.contentByStep ?? {}),
        ...(companion?.contentByStep ?? {}),
      },
      bindingsByStep: {
        ...(existingCompanion?.bindingsByStep ?? {}),
        ...(companion?.bindingsByStep ?? {}),
      },
    },
    createdAt: existingManifest?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function writeManifestFile(deckDir, manifest) {
  return writeFile(path.join(deckDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function buildCompanionFileName(step, chunk) {
  const commentLabel = readCommentLabel(chunk);
  const htmlTitle = readHtmlTitle(chunk);
  const rawLabel = commentLabel.includes('|')
    ? commentLabel.split('|').slice(1).join('|').trim()
    : (commentLabel || htmlTitle || step);
  const slug = slugify(rawLabel) || step;
  return `${step}-${slug}.html`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ? path.resolve(process.cwd(), args.input) : '';
  const deckId = slugify(args['deck-id'] || args.deck || '');
  const overwrite = args.overwrite === 'true';
  const mode = (args.mode || 'slides').toLowerCase();
  const targetStep = String(args['target-step'] || args.step || '').trim();
  const responseKey = String(args['response-key'] || args.responseKey || '').trim();

  if (!inputPath || !deckId) {
    console.error('Usage: npm run import:presentation -- --input path/to/presentation.html --deck-id your-deck-id [--mode slides|companion] [--step slide1] [--response-key key] [--title "Deck Title"] [--description "Deck description"] [--overwrite]');
    process.exit(1);
  }

  const source = await readFile(inputPath, 'utf8');
  const documents = extractSlideDocuments(source);

  if (documents.length === 0) {
    console.error('No HTML documents found. Expected one or more full <!DOCTYPE html> ... </html> blocks.');
    process.exit(1);
  }

  const deckTitle = args.title || titleCaseDeckId(deckId);
  const description = args.description || 'Imported from raw HTML into the AutoKnerd presentation engine.';
  const deckDir = path.join(process.cwd(), 'Presentations', deckId);
  const existingManifestBeforeOverwrite = await readExistingManifest(deckDir);
  let preservedCompanionDir = '';

  if (overwrite && mode !== 'companion' && existingManifestBeforeOverwrite?.companion?.enabled === true) {
    const sourceCompanionDir = path.join(deckDir, 'companion');
    try {
      preservedCompanionDir = await mkdtemp(path.join(os.tmpdir(), `${deckId}-companion-`));
      await cp(sourceCompanionDir, path.join(preservedCompanionDir, 'companion'), { recursive: true });
    } catch {
      preservedCompanionDir = '';
    }
  }

  if (overwrite && mode !== 'companion') {
    await rm(deckDir, { recursive: true, force: true });
  }

  await mkdir(deckDir, { recursive: true });

  const existingManifest = overwrite && mode !== 'companion'
    ? existingManifestBeforeOverwrite
    : await readExistingManifest(deckDir);

  if (mode === 'companion') {
    if (!existingManifest || !Array.isArray(existingManifest.slides) || existingManifest.slides.length === 0) {
      console.error('Companion import requires an existing deck with slides. Import slide HTML first.');
      process.exit(1);
    }

    if (!targetStep) {
      console.error('Companion import requires --step slide1 (or another slide step) so the companion page can be bound.');
      process.exit(1);
    }

    const companionDir = path.join(deckDir, 'companion');
    await mkdir(companionDir, { recursive: true });
    const companionDocs = documents.slice(0, 1);
    const companionFileName = buildCompanionFileName(targetStep, companionDocs[0]);
    const companionPath = path.join('companion', companionFileName);
    const existingCompanionFiles = Array.isArray(existingManifest.companion?.files)
      ? existingManifest.companion.files.filter((file) => typeof file === 'string' && file.trim().length > 0)
      : [];
    const mergedCompanionFiles = Array.from(new Set([...existingCompanionFiles, companionPath]));

    await writeFile(
      path.join(companionDir, companionFileName),
      companionDocs[0],
      'utf8',
    );

    const manifest = buildManifest({
      deckId,
      title: typeof existingManifest.title === 'string' && existingManifest.title.trim().length > 0 ? existingManifest.title.trim() : deckTitle,
      description: typeof existingManifest.description === 'string' && existingManifest.description.trim().length > 0 ? existingManifest.description.trim() : description,
      slides: existingManifest.slides.filter((slide) => typeof slide === 'string' && slide.trim().length > 0),
      existingManifest,
      companion: {
        enabled: true,
        entry: companionPath,
        files: mergedCompanionFiles,
        contentByStep: {
          [targetStep]: createCompanionContent({
            step: targetStep,
            title: readHtmlTitle(companionDocs[0]) || titleCaseDeckId(deckId),
          }),
        },
        bindingsByStep: {
          [targetStep]: {
            slideStep: targetStep,
            responseKey: responseKey || `${deckId}-${targetStep}`,
            interactionMode: 'question',
            mainSlideEffect: 'counter',
          },
        },
      },
    });

    await writeManifestFile(deckDir, manifest);
    console.log(`Imported companion HTML for ${targetStep} into Presentations/${deckId}`);
    return;
  }

  const usedNames = new Set();
  const slides = [];

  for (let index = 0; index < documents.length; index += 1) {
    const baseFileName = buildSlideName(index + 1, documents[index]);
    let fileName = baseFileName;
    let duplicateCounter = 2;

    while (usedNames.has(fileName)) {
      fileName = baseFileName.replace(/\.html$/, `-${duplicateCounter}.html`);
      duplicateCounter += 1;
    }

    usedNames.add(fileName);
    slides.push(fileName);

    await writeFile(
      path.join(deckDir, fileName),
      ensureSharedControls(documents[index]),
      'utf8',
    );
  }

  const manifest = buildManifest({
    deckId,
    title: deckTitle,
    description,
    slides,
    existingManifest,
  });

  if (preservedCompanionDir) {
    try {
      await cp(path.join(preservedCompanionDir, 'companion'), path.join(deckDir, 'companion'), { recursive: true });
    } catch {
      // Ignore restoration failures; the manifest still preserves metadata for later repair.
    } finally {
      await rm(preservedCompanionDir, { recursive: true, force: true });
    }
  }

  await writeManifestFile(deckDir, manifest);
  await writeFile(path.join(deckDir, 'index.html'), createDeckIndex({ deckId, deckTitle, description, slides }), 'utf8');

  console.log(`Imported ${slides.length} slides into Presentations/${deckId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
