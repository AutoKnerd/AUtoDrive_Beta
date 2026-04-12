import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LiveSessionAudienceContent } from '@/lib/live-session';

export type PresentationAudienceContentMap = Record<string, LiveSessionAudienceContent>;

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
};

export type PresentationDeckSummary = PresentationDeckManifest & {
  href: string;
  slideCount: number;
};

const PRESENTATIONS_ROOT = path.join(process.cwd(), 'Presentations');

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
