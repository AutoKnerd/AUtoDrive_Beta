#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input ? path.resolve(process.cwd(), args.input) : '';
  const deckId = slugify(args['deck-id'] || args.deck || '');
  const overwrite = args.overwrite === 'true';

  if (!inputPath || !deckId) {
    console.error('Usage: npm run import:presentation -- --input path/to/presentation.html --deck-id your-deck-id [--title "Deck Title"] [--description "Deck description"] [--overwrite]');
    process.exit(1);
  }

  const source = await readFile(inputPath, 'utf8');
  const documents = extractSlideDocuments(source);

  if (documents.length === 0) {
    console.error('No HTML slide documents found. Expected one or more full <!DOCTYPE html> ... </html> blocks.');
    process.exit(1);
  }

  const deckTitle = args.title || titleCaseDeckId(deckId);
  const description = args.description || 'Imported from raw HTML into the AutoKnerd presentation engine.';
  const deckDir = path.join(process.cwd(), 'Presentations', deckId);

  if (overwrite) {
    await rm(deckDir, { recursive: true, force: true });
  }

  await mkdir(deckDir, { recursive: true });

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

  const manifest = {
    deckId,
    title: deckTitle,
    description,
    entry: 'index.html',
    slideCount: slides.length,
    slides,
    audience: {
      enabled: true,
      liveSessionId: `${deckId}-main`,
      qrOverlayEnabled: true,
      contentByStep: createAudienceContent(slides),
    },
    createdAt: new Date().toISOString(),
  };

  await writeFile(path.join(deckDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(path.join(deckDir, 'index.html'), createDeckIndex({ deckId, deckTitle, description, slides }), 'utf8');

  console.log(`Imported ${slides.length} slides into Presentations/${deckId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
