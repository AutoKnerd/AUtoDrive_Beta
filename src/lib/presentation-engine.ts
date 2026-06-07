import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LiveSessionAudienceContent } from '@/lib/live-session';

export type PresentationAudienceContentMap = Record<string, LiveSessionAudienceContent>;

export type PresentationCompanionBinding = {
  slideStep: string;
  responseKey?: string;
  interactionMode?: 'counter' | 'stage' | 'toggle' | 'advance' | 'question';
  mainSlideEffect?: 'counter' | 'visual' | 'advance' | 'none';
};

export type PresentationCompanionConfig = {
  enabled?: boolean;
  entry?: string;
  files?: string[];
  contentByStep?: PresentationAudienceContentMap;
  bindingsByStep?: Record<string, PresentationCompanionBinding>;
};

export type PresentationAudienceConfig = {
  enabled?: boolean;
  liveSessionId?: string;
  qrOverlayEnabled?: boolean;
  contentByStep?: PresentationAudienceContentMap;
};

export type PresentationDeckManifest = {
  deckId: string;
  title: string;
  slides: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  audience?: PresentationAudienceConfig;
  companion?: PresentationCompanionConfig;
  // Number of navigable steps inside a single-file deck (e.g. a self-contained
  // carousel whose slides live in an in-page array rather than as separate
  // files). When set and greater than slides.length, the deck is treated as
  // having steps slide1..slideN for companion binding and live-step sync.
  inPageSteps?: number;
};

export type PresentationDeckSummary = PresentationDeckManifest & {
  href: string;
  slideCount: number;
};

const PRESENTATIONS_ROOT = path.join(process.cwd(), 'Presentations');

function normalizeCompanionFileList(files?: string[]) {
  if (!Array.isArray(files)) return [];

  return Array.from(
    new Set(
      files
        .filter((file): file is string => typeof file === 'string' && file.trim().length > 0)
        .map((file) => file.trim()),
    ),
  );
}

function toTitleFromSlideFile(slide: string) {
  return slide
    .replace(/^\d+-/, '')
    .replace(/\.html$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferStepFromSlide(slide: string, index: number) {
  const numberedMatch = slide.match(/^(\d+)/);
  const number = numberedMatch ? Number.parseInt(numberedMatch[1], 10) : index + 1;
  return `slide${number}`;
}

function normalizeAudienceConfig(
  deckId: string,
  slides: string[],
  input?: PresentationAudienceConfig,
): PresentationAudienceConfig {
  const generatedContentByStep = slides.reduce<PresentationAudienceContentMap>((accumulator, slide, index) => {
    const step = inferStepFromSlide(slide, index);
    const title = toTitleFromSlideFile(slide);
    accumulator[step] = {
      eyebrow: 'Live Session',
      title,
      body: `You are viewing synced audience content for ${title}.`,
      prompt: 'Keep this page open. It updates as the presentation moves.',
      speakerNotes: [],
    };
    return accumulator;
  }, {});

  return {
    enabled: input?.enabled !== false,
    liveSessionId: typeof input?.liveSessionId === 'string' && input.liveSessionId.trim().length > 0
      ? input.liveSessionId.trim()
      : `${deckId}-main`,
    qrOverlayEnabled: input?.qrOverlayEnabled !== false,
    contentByStep: {
      ...generatedContentByStep,
      ...(input?.contentByStep ?? {}),
    },
  };
}

function normalizeCompanionConfig(
  deckId: string,
  slides: string[],
  input?: PresentationCompanionConfig,
): PresentationCompanionConfig {
  const generatedBindingsByStep = slides.reduce<Record<string, PresentationCompanionBinding>>((accumulator, slide, index) => {
    const step = inferStepFromSlide(slide, index);
    accumulator[step] = {
      slideStep: step,
      responseKey: `${deckId}-${step}`,
      interactionMode: 'question',
      mainSlideEffect: 'counter',
    };
    return accumulator;
  }, {});

  return {
    enabled: input?.enabled === true,
    entry: typeof input?.entry === 'string' && input.entry.trim().length > 0
      ? input.entry.trim()
      : 'companion/index.html',
    files: normalizeCompanionFileList(input?.files),
    contentByStep: {
      ...(input?.contentByStep ?? {}),
    },
    bindingsByStep: {
      ...generatedBindingsByStep,
      ...(input?.bindingsByStep ?? {}),
    },
  };
}

function isValidDeckId(value: string) {
  return value.length > 0 && !value.includes('..') && !value.startsWith('.');
}

export async function readPresentationDeckManifest(deckId: string): Promise<PresentationDeckManifest | null> {
  if (!isValidDeckId(deckId)) return null;

  const manifestPath = path.join(PRESENTATIONS_ROOT, deckId, 'manifest.json');

  try {
    const payload = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(payload) as Partial<PresentationDeckManifest>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.slides)) return null;

    return {
      deckId,
      title: typeof parsed.title === 'string' && parsed.title.trim().length > 0 ? parsed.title.trim() : deckId,
      slides: parsed.slides.filter((slide): slide is string => typeof slide === 'string' && slide.trim().length > 0),
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      audience: normalizeAudienceConfig(
        deckId,
        parsed.slides.filter((slide): slide is string => typeof slide === 'string' && slide.trim().length > 0),
        parsed.audience && typeof parsed.audience === 'object' ? parsed.audience : undefined,
      ),
      companion: normalizeCompanionConfig(
        deckId,
        parsed.slides.filter((slide): slide is string => typeof slide === 'string' && slide.trim().length > 0),
        parsed.companion && typeof parsed.companion === 'object' ? parsed.companion : undefined,
      ),
      inPageSteps: typeof parsed.inPageSteps === 'number' && Number.isFinite(parsed.inPageSteps) && parsed.inPageSteps > 0
        ? Math.floor(parsed.inPageSteps)
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function listPresentationDecks(): Promise<PresentationDeckSummary[]> {
  const entries = await readdir(PRESENTATIONS_ROOT, { withFileTypes: true });
  const candidateDecks = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((deckId) => isValidDeckId(deckId) && deckId !== '_shared');

  const manifests = await Promise.all(candidateDecks.map((deckId) => readPresentationDeckManifest(deckId)));

  const results = manifests
    .filter((manifest): manifest is PresentationDeckManifest => manifest !== null)
    .map((manifest) => ({
      ...manifest,
      href: `/Presentations/${manifest.deckId}`,
      slideCount: manifest.slides.length,
    }));

  results.sort((left, right) => left.title.localeCompare(right.title));
  return results;
}

export async function getPresentationDeckTimestamp(deckId: string): Promise<string | null> {
  if (!isValidDeckId(deckId)) return null;

  try {
    const manifestStats = await stat(path.join(PRESENTATIONS_ROOT, deckId, 'manifest.json'));
    return manifestStats.mtime.toISOString();
  } catch {
    return null;
  }
}

export function getAudienceContentForDeck(
  manifest: PresentationDeckManifest,
  currentStep: string,
): LiveSessionAudienceContent {
  return manifest.audience?.contentByStep?.[currentStep] ?? {
    eyebrow: 'Live Session',
    title: manifest.title,
    body: 'This presentation is live.',
    prompt: 'Keep this page open. It updates as the presentation advances.',
  };
}

function findCompanionEntryInFileList(files: string[], currentStep: string) {
  const normalizedStep = currentStep.trim().toLowerCase();

  return files.find((file) => {
    const baseName = path.basename(file).toLowerCase();
    return baseName.startsWith(`${normalizedStep}-`);
  }) ?? null;
}

export async function resolveCompanionEntryForStep(
  deckId: string,
  manifest: PresentationDeckManifest,
  currentStep: string,
): Promise<string | null> {
  if (manifest.companion?.enabled !== true) {
    return null;
  }

  const manifestFiles = normalizeCompanionFileList(manifest.companion.files);
  const manifestMatch = findCompanionEntryInFileList(manifestFiles, currentStep);
  if (manifestMatch) {
    return manifestMatch;
  }

  const companionDir = path.join(PRESENTATIONS_ROOT, deckId, 'companion');
  let diskCandidateFiles: string[] = [];

  try {
    const diskFiles = await readdir(companionDir, { withFileTypes: true });
    diskCandidateFiles = diskFiles
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
      .map((entry) => path.posix.join('companion', entry.name));

    const diskMatch = findCompanionEntryInFileList(diskCandidateFiles, currentStep);
    if (diskMatch) {
      return diskMatch;
    }
  } catch {
    // Ignore missing companion directories; fall back handling is below.
  }

  // Per-step model: if the deck has companion files keyed by slide step, then a
  // step with no matching file simply has no companion — do NOT fall back to a
  // deck-wide entry (which would leak the previous slide's companion onto every
  // unbound slide). Only legacy decks with no per-step files use the single entry.
  const hasPerStepFiles = manifestFiles.length > 0 || diskCandidateFiles.length > 0;
  if (hasPerStepFiles) {
    return null;
  }

  if (typeof manifest.companion.entry === 'string' && manifest.companion.entry.trim().length > 0) {
    return manifest.companion.entry.trim();
  }

  return null;
}
