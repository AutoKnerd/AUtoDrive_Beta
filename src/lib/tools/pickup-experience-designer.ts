import type { User } from '@/lib/definitions';

export const PICKUP_IMPRESSIONS = [
  'efficient',
  'reassuring',
  'detailed',
  'warm',
] as const;

export const PICKUP_CHECKPOINTS = [
  'work completed',
  'invoice clarity',
  'vehicle ready',
  'next maintenance',
  'questions answered',
] as const;

export const PICKUP_TYPES = [
  'waiting',
  'same-day',
  'overnight',
  'surprise additional work',
] as const;

export type PickupImpression = typeof PICKUP_IMPRESSIONS[number];
export type PickupCheckpoint = typeof PICKUP_CHECKPOINTS[number];
export type PickupType = typeof PICKUP_TYPES[number];

export type PickupExperienceInput = {
  completionConfidence: number;
  explanationDepth: number;
  satisfactionCheckpoints: PickupCheckpoint[];
  desiredFinalImpression: PickupImpression;
  pickupType?: PickupType | null;
};

export type PickupExperiencePlan = {
  bestPickupFlow: string;
  sayThisRecap: string;
  explainThisClearly: string;
  ownershipNextStep: string;
  doNotDoThis: string;
};

export type PickupExperienceSprocketEnhancement = {
  likelyPickupFrictionPoint: string;
  betterRecapSequence: string;
  naturalRewrite: string;
  finalImpressionCoaching: string;
};

export type PickupExperienceCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Clarity' | 'Tone' | 'Trust' | 'Follow-Through';
};

export type PickupExperienceSavedScenario = {
  id: string;
  createdAt: string;
  completionConfidence: number;
  explanationDepth: number;
  satisfactionCheckpoints: PickupCheckpoint[];
  desiredFinalImpression: PickupImpression;
  pickupType?: PickupType | null;
  bestPickupFlow: string;
  sayThisRecap: string;
  explainThisClearly: string;
  ownershipNextStep: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function hasCheckpoint(input: PickupExperienceInput, checkpoint: PickupCheckpoint): boolean {
  return input.satisfactionCheckpoints.includes(checkpoint);
}

function pickupFlow(input: PickupExperienceInput): string {
  if (input.completionConfidence < 40) {
    return 'Lead with transparency: confirm completed work first, then walk open items before invoicing.';
  }
  if (input.pickupType === 'surprise additional work') {
    return 'Use a reassurance-first flow: recap approved work, explain additional item context, then confirm next step.';
  }
  if (input.desiredFinalImpression === 'efficient') {
    return 'Use a concise 3-step pickup: work summary, invoice clarity, next action.';
  }
  if (input.desiredFinalImpression === 'detailed') {
    return 'Use a structured full recap: completed items, evidence/why, invoice breakdown, next maintenance.';
  }
  if (input.desiredFinalImpression === 'warm') {
    return 'Use a relationship-first pickup flow with clear recap, reassurance, and helpful next-step guidance.';
  }
  return 'Use a confidence-building flow: recap, clarify cost and completion quality, then set ownership next step.';
}

function recapLine(input: PickupExperienceInput): string {
  if (input.pickupType === 'waiting') {
    return 'Thanks for waiting today. Let me quickly walk you through what was completed and what to keep in mind next.';
  }
  if (input.pickupType === 'overnight') {
    return 'Welcome back. I will give you a clear recap of what was done and what to watch going forward.';
  }
  if (input.desiredFinalImpression === 'warm') {
    return 'I want to make pickup easy and clear, so I will recap the work and your next best maintenance step.';
  }
  return 'Here is a clean recap of what we completed today and what matters next.';
}

function explainClearly(input: PickupExperienceInput): string {
  if (input.explanationDepth <= 30) {
    return 'Keep explanation tight: what was done, why it mattered, and one next maintenance checkpoint.';
  }
  if (input.explanationDepth >= 75) {
    return 'Use detailed recap with clear order: work completed, invoice logic, vehicle condition, and future service timing.';
  }
  if (!hasCheckpoint(input, 'invoice clarity')) {
    return 'Prioritize invoice clarity in plain language before moving to maintenance recommendations.';
  }
  return 'Explain with simple sequence and short checkpoints so nothing feels rushed at pickup.';
}

function ownershipNext(input: PickupExperienceInput): string {
  if (!hasCheckpoint(input, 'next maintenance')) {
    return 'Set one concrete next-maintenance checkpoint with timing and customer confirmation.';
  }
  if (!hasCheckpoint(input, 'questions answered')) {
    return 'End with a final question check so customer leaves with no unresolved uncertainty.';
  }
  return 'Confirm the next service touchpoint and offer a quick follow-up check-in if needed.';
}

function avoidLine(input: PickupExperienceInput): string {
  if (input.explanationDepth < 30) {
    return 'Do not rush through pickup so fast that invoice or next-step clarity gets skipped.';
  }
  if (input.pickupType === 'surprise additional work') {
    return 'Do not gloss over additional work context or it will erode trust at the finish line.';
  }
  return 'Do not end pickup without confirming understanding of what was done and what happens next.';
}

export function getPickupExperiencePlan(input: PickupExperienceInput): PickupExperiencePlan {
  const normalized: PickupExperienceInput = {
    ...input,
    completionConfidence: clamp(input.completionConfidence),
    explanationDepth: clamp(input.explanationDepth),
  };

  return {
    bestPickupFlow: pickupFlow(normalized),
    sayThisRecap: recapLine(normalized),
    explainThisClearly: explainClearly(normalized),
    ownershipNextStep: ownershipNext(normalized),
    doNotDoThis: avoidLine(normalized),
  };
}

export function getSprocketPickupExperienceEnhancement(
  input: PickupExperienceInput,
  base: PickupExperiencePlan
): PickupExperienceSprocketEnhancement {
  const likelyPickupFrictionPoint =
    !hasCheckpoint(input, 'invoice clarity')
      ? 'Likely friction point is invoice uncertainty at handoff.'
      : !hasCheckpoint(input, 'questions answered')
        ? 'Likely friction point is unresolved customer questions at final handoff.'
        : input.pickupType === 'surprise additional work'
          ? 'Likely friction point is trust tension from unexpected work context.'
          : 'Likely friction point is recap pacing feeling rushed at pickup.';

  const proofOrder = [
    hasCheckpoint(input, 'work completed') ? 'work completed' : null,
    hasCheckpoint(input, 'vehicle ready') ? 'vehicle ready' : null,
    hasCheckpoint(input, 'invoice clarity') ? 'invoice clarity' : null,
    hasCheckpoint(input, 'next maintenance') ? 'next maintenance' : null,
    hasCheckpoint(input, 'questions answered') ? 'questions answered' : null,
  ].filter(Boolean).join(' -> ') || 'work completed -> invoice clarity -> next maintenance';

  return {
    likelyPickupFrictionPoint,
    betterRecapSequence: `Use this recap sequence: ${proofOrder}. Pause briefly between each section.`,
    naturalRewrite: `Try this wording: ${base.sayThisRecap}`,
    finalImpressionCoaching: 'Close with confident clarity and one final customer-confirmation question before handoff.',
  };
}

type SkillSignals = {
  clarityLow: boolean;
  toneLow: boolean;
  trustLow: boolean;
  followThroughLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const clarity = Number(stats?.listening ?? 60);
  const tone = Number(stats?.closing ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const followThrough = Number(stats?.followUp ?? 60);

  return {
    clarityLow: clarity > 0 && clarity < 55,
    toneLow: tone > 0 && tone < 55,
    trustLow: trust > 0 && trust < 55,
    followThroughLow: followThrough > 0 && followThrough < 55,
  };
}

export function getAutoDriveCxPickupExperienceEnhancement(
  _input: PickupExperienceInput,
  _base: PickupExperiencePlan,
  user?: User | null
): PickupExperienceCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.clarityLow) {
    return {
      tailoredReason: 'Clarity trend suggests pickup recap needs tighter sequencing and clearer invoice translation.',
      adjustedApproach: 'Use short checkpoint-by-checkpoint recap and confirm understanding after each section.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tone trend indicates warmer closeout language will improve pickup satisfaction.',
      adjustedApproach: 'Use calm, customer-centered phrasing and avoid abrupt transactional closeout lines.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Trust trend suggests stronger transparency around work and invoice details is needed.',
      adjustedApproach: 'Lead with what was done, show why it mattered, and clarify invoice before next maintenance.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.followThroughLow) {
    return {
      tailoredReason: 'Follow-through trend suggests final ownership next-step confirmations should be explicit.',
      adjustedApproach: 'Set one clear next maintenance checkpoint and confirm customer understanding before departure.',
      focusSkillTag: 'Follow-Through',
    };
  }

  return {
    tailoredReason: 'Skill profile suggests best gains come from structured recap flow and explicit next-step ownership.',
    adjustedApproach: 'Use clear recap sequence, confirm questions, and end with one concrete next maintenance step.',
    focusSkillTag: 'Clarity',
  };
}
