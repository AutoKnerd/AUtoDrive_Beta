import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const FIRST_IMPRESSION_COMFORT_READS = [
  'relaxed',
  'guarded',
  'skeptical',
  'rushed',
] as const;

export const FIRST_IMPRESSION_PACE = [
  'slow',
  'balanced',
  'brisk',
] as const;

export const FIRST_IMPRESSION_SETTINGS = [
  'showroom walk-in',
  'lot up',
  'appointment',
  'phone-to-store arrival',
] as const;

export type FirstImpressionComfortRead = typeof FIRST_IMPRESSION_COMFORT_READS[number];
export type FirstImpressionPace = typeof FIRST_IMPRESSION_PACE[number];
export type FirstImpressionSetting = typeof FIRST_IMPRESSION_SETTINGS[number];

export type FirstImpressionInput = {
  customerEnergy: number;
  comfortRead: FirstImpressionComfortRead;
  warmthLevel: number;
  pace: FirstImpressionPace;
  setting?: FirstImpressionSetting | null;
};

export type FirstImpressionPlan = {
  bestOpeningStyle: string;
  sayThisFirst: string;
  askThisFirst: string;
  toneGuidance: string;
  doNotDoThis: string;
};

export type FirstImpressionSprocketEnhancement = {
  likelyReason: string;
  sharperOpeningLine: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type FirstImpressionCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Pacing' | 'Listening';
};

export type FirstImpressionSavedScenario = {
  id: string;
  createdAt: string;
  customerEnergy: number;
  comfortRead: FirstImpressionComfortRead;
  warmthLevel: number;
  pace: FirstImpressionPace;
  setting?: FirstImpressionSetting | null;
  bestOpeningStyle: string;
  sayThisFirst: string;
  askThisFirst: string;
  toneGuidance: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function openingStyle(input: FirstImpressionInput): string {
  if (input.comfortRead === 'guarded') {
    return 'Low-pressure warm entry with permission-based pacing';
  }
  if (input.comfortRead === 'skeptical') {
    return 'Credibility-first opening with calm transparency';
  }
  if (input.comfortRead === 'rushed') {
    return 'Fast clarity opening with concise direction';
  }
  if (input.customerEnergy >= 70 && input.warmthLevel >= 60) {
    return 'High-energy rapport opening with controlled focus';
  }
  return 'Balanced welcome with comfort-first discovery';
}

function sayFirst(input: FirstImpressionInput): string {
  if (input.comfortRead === 'guarded') {
    return 'Welcome in. We can keep this easy and go at your pace today.';
  }
  if (input.comfortRead === 'skeptical') {
    return 'Glad you stopped in. I will keep this straightforward so you can compare clearly.';
  }
  if (input.comfortRead === 'rushed') {
    return 'Great to meet you. We can move quickly and focus only on what matters most right now.';
  }
  if (input.setting === 'appointment') {
    return 'Great to finally meet in person. Let us pick up exactly where we left off.';
  }
  return 'Welcome in. Happy to help however you prefer to shop today.';
}

function askFirst(input: FirstImpressionInput): string {
  if (input.comfortRead === 'guarded') {
    return 'What would make this visit feel useful for you today?';
  }
  if (input.comfortRead === 'skeptical') {
    return 'As you compare options, what matters most for you to feel confident?';
  }
  if (input.comfortRead === 'rushed') {
    return 'If we only solve one thing right now, what should that be first?';
  }
  if (input.customerEnergy < 40) {
    return 'Would you like a quick overview first, or jump straight to a specific vehicle?';
  }
  return 'What are you hoping to narrow down first today?';
}

function tone(input: FirstImpressionInput): string {
  if (input.pace === 'slow') {
    return 'Use a calm tone, shorter statements, and leave space after each question.';
  }
  if (input.pace === 'brisk') {
    return 'Keep a friendly but efficient rhythm and confirm direction every 30-60 seconds.';
  }
  if (input.warmthLevel < 35) {
    return 'Increase vocal warmth slightly so the interaction feels helpful, not procedural.';
  }
  if (input.warmthLevel > 75 && input.customerEnergy < 45) {
    return 'Dial warmth down slightly and focus on clarity so the customer does not feel pressured.';
  }
  return 'Stay warm, grounded, and concise. Match their pace before trying to lead it.';
}

function avoidPattern(input: FirstImpressionInput): string {
  if (input.comfortRead === 'guarded') {
    return 'Do not jump into inventory details before establishing comfort and permission.';
  }
  if (input.comfortRead === 'skeptical') {
    return 'Do not over-sell or stack claims before asking one trust-building question.';
  }
  if (input.comfortRead === 'rushed') {
    return 'Do not slow-walk the opening with long intros when they signal time pressure.';
  }
  return 'Do not open with a script dump that ignores their current energy and comfort.';
}

export function getFirstImpressionPlan(input: FirstImpressionInput): FirstImpressionPlan {
  const normalized: FirstImpressionInput = {
    ...input,
    customerEnergy: clamp(input.customerEnergy),
    warmthLevel: clamp(input.warmthLevel),
  };

  return {
    bestOpeningStyle: openingStyle(normalized),
    sayThisFirst: sayFirst(normalized),
    askThisFirst: askFirst(normalized),
    toneGuidance: tone(normalized),
    doNotDoThis: avoidPattern(normalized),
  };
}

export function getSprocketFirstImpressionEnhancement(
  input: FirstImpressionInput,
  base: FirstImpressionPlan
): FirstImpressionSprocketEnhancement {
  const likelyReason =
    input.comfortRead === 'guarded'
      ? 'Customer likely needs safety and control before sharing details.'
      : input.comfortRead === 'skeptical'
        ? 'Customer likely expects pressure and is testing credibility early.'
        : input.comfortRead === 'rushed'
          ? 'Customer likely values speed and is protecting time more than resisting help.'
          : 'Customer appears open but still needs a clear, confident conversational frame.';

  return {
    likelyReason,
    sharperOpeningLine: `${base.sayThisFirst} Then confirm one clear next step immediately.`,
    naturalRewrite: `Try this wording: ${base.askThisFirst}`,
    deliveryCoaching: 'Keep first line under 8 seconds, ask one question, then pause fully before adding detail.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  pacingLow: boolean;
  listeningLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.closing, 60);
  const pacing = readCxStatScore(stats?.followUp, 60);
  const listening = readCxStatScore(stats?.listening, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    pacingLow: pacing > 0 && pacing < 55,
    listeningLow: listening > 0 && listening < 55,
  };
}

export function getAutoDriveCxFirstImpressionEnhancement(
  _input: FirstImpressionInput,
  _base: FirstImpressionPlan,
  user?: User | null
): FirstImpressionCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Trust trend shows first-minute transparency should be emphasized earlier.',
      adjustedApproach: 'Open with lower-pressure clarity and ask permission before guiding the next step.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tone trend indicates softer vocal framing will improve first-minute comfort.',
      adjustedApproach: 'Shorten your opener and use calmer pacing before asking your first question.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Pacing trend suggests sequencing the first minute more deliberately will improve engagement.',
      adjustedApproach: 'Use one warm statement, one question, then pause before adding detail.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.listeningLow) {
    return {
      tailoredReason: 'Listening trend indicates early comfort improves when the first question does more work.',
      adjustedApproach: 'Ask one open comfort question first and reflect back before proposing direction.',
      focusSkillTag: 'Listening',
    };
  }

  return {
    tailoredReason: 'Skill profile suggests balancing warmth with concise structure will improve first impressions.',
    adjustedApproach: 'Match their energy quickly, then lead with one clear opening question.',
    focusSkillTag: 'Trust',
  };
}
