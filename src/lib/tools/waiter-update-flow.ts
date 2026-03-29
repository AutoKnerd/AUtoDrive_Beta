import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const WAITER_RESET_LEVELS = [
  'light',
  'moderate',
  'strong',
] as const;

export const WAITER_LANE_STAGES = [
  'checked in',
  'waiting on technician',
  'inspection in progress',
  'waiting on parts',
  'repair underway',
  'final check',
] as const;

export const WAITER_CUSTOMER_MOODS = [
  'calm',
  'impatient',
  'upset',
  'anxious',
] as const;

export type WaiterResetLevel = typeof WAITER_RESET_LEVELS[number];
export type WaiterLaneStage = typeof WAITER_LANE_STAGES[number];
export type WaiterCustomerMood = typeof WAITER_CUSTOMER_MOODS[number];

export type WaiterUpdateInput = {
  delayTension: number;
  expectationResetLevel: WaiterResetLevel;
  patienceLevel: number;
  laneStage: WaiterLaneStage;
  customerMood?: WaiterCustomerMood | null;
};

export type WaiterUpdatePlan = {
  bestUpdateApproach: string;
  sayThisNow: string;
  whenToUpdateAgain: string;
  howToResetExpectations: string;
  doNotSayThis: string;
};

export type WaiterUpdateSprocketEnhancement = {
  betterTone: string;
  strongerExpectationReset: string;
  naturalRewrite: string;
  likelyReactionPrep: string;
};

export type WaiterUpdateCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Tone' | 'Trust' | 'Pacing' | 'Consistency';
};

export type WaiterUpdateSavedScenario = {
  id: string;
  createdAt: string;
  delayTension: number;
  expectationResetLevel: WaiterResetLevel;
  patienceLevel: number;
  laneStage: WaiterLaneStage;
  customerMood?: WaiterCustomerMood | null;
  bestUpdateApproach: string;
  sayThisNow: string;
  whenToUpdateAgain: string;
  howToResetExpectations: string;
  doNotSayThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function stageBaseApproach(stage: WaiterLaneStage): string {
  if (stage === 'checked in') return 'Set clear process expectations early and lock first update checkpoint.';
  if (stage === 'waiting on technician') return 'Acknowledge queue delay and provide realistic timing bounds.';
  if (stage === 'inspection in progress') return 'Translate status into what happens next and when they will hear from you.';
  if (stage === 'waiting on parts') return 'Lead with transparency on parts timing and alternative options if available.';
  if (stage === 'repair underway') return 'Reinforce progress and next milestone to reduce uncertainty.';
  return 'Confirm completion path and pickup readiness timing clearly.';
}

function deriveUpdateCadence(input: WaiterUpdateInput): string {
  const tension = clamp(input.delayTension);
  const patience = clamp(input.patienceLevel);
  if (tension >= 75 || patience <= 30) return 'Update every 10-15 minutes until uncertainty drops.';
  if (tension >= 55 || patience <= 45) return 'Update every 20 minutes with concrete status progress.';
  return 'Update every 30 minutes or at the next stage change, whichever comes first.';
}

function deriveReset(input: WaiterUpdateInput): string {
  if (input.expectationResetLevel === 'light') {
    return 'Use a brief reset: what is happening now, what is next, and your next update time.';
  }
  if (input.expectationResetLevel === 'moderate') {
    return 'Use a full reset: current delay reason, revised timeline range, and exact next checkpoint.';
  }
  return 'Use a strong reset: direct apology, transparent root cause, revised expectation, and guaranteed follow-up time.';
}

function deriveSayNow(input: WaiterUpdateInput): string {
  const stagePhrase = input.laneStage === 'waiting on parts'
    ? 'we are waiting on the part confirmation'
    : input.laneStage === 'waiting on technician'
      ? 'we are waiting for your vehicle to move to the next technician slot'
      : `your vehicle is currently at ${input.laneStage}`;

  if (input.customerMood === 'upset') {
    return `I understand this delay is frustrating. Right now ${stagePhrase}, and I will update you again by [time].`;
  }
  if (input.customerMood === 'anxious') {
    return `Quick update: ${stagePhrase}. The next milestone is [next step], and I will check back by [time].`;
  }
  return `Quick update: ${stagePhrase}. I will keep you posted again by [time] with the next step.`;
}

function deriveDoNot(input: WaiterUpdateInput): string {
  if (input.customerMood === 'upset' || input.delayTension > 70) {
    return 'Do not say “just a few more minutes” unless you can guarantee it.';
  }
  if (input.laneStage === 'waiting on parts') {
    return 'Do not blame parts logistics without giving a new expectation window.';
  }
  return 'Do not give vague technical updates without a clear next-time commitment.';
}

export function getWaiterUpdatePlan(input: WaiterUpdateInput): WaiterUpdatePlan {
  const normalized: WaiterUpdateInput = {
    ...input,
    delayTension: clamp(input.delayTension),
    patienceLevel: clamp(input.patienceLevel),
  };

  return {
    bestUpdateApproach: stageBaseApproach(normalized.laneStage),
    sayThisNow: deriveSayNow(normalized),
    whenToUpdateAgain: deriveUpdateCadence(normalized),
    howToResetExpectations: deriveReset(normalized),
    doNotSayThis: deriveDoNot(normalized),
  };
}

export function getSprocketWaiterUpdateEnhancement(
  input: WaiterUpdateInput,
  base: WaiterUpdatePlan
): WaiterUpdateSprocketEnhancement {
  const betterTone =
    input.customerMood === 'upset'
      ? 'Use calm ownership language first, then process detail second.'
      : input.customerMood === 'impatient'
        ? 'Keep updates short, specific, and time-bound to reduce escalation.'
        : 'Use confident, plain-language updates with concrete next checkpoints.';

  return {
    betterTone,
    strongerExpectationReset: `${base.howToResetExpectations} Include one explicit commitment time.`,
    naturalRewrite: `Try this line: ${base.sayThisNow}`,
    likelyReactionPrep: 'If reaction intensifies, acknowledge emotion first, then restate the next concrete update time.',
  };
}

type SkillSignals = {
  toneLow: boolean;
  trustLow: boolean;
  pacingLow: boolean;
  consistencyLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const tone = readCxStatScore(stats?.listening, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const pacing = readCxStatScore(stats?.closing, 60);
  const consistency = readCxStatScore(stats?.followUp, 60);

  return {
    toneLow: tone > 0 && tone < 55,
    trustLow: trust > 0 && trust < 55,
    pacingLow: pacing > 0 && pacing < 55,
    consistencyLow: consistency > 0 && consistency < 55,
  };
}

export function getAutoDriveCxWaiterUpdateEnhancement(
  _input: WaiterUpdateInput,
  _base: WaiterUpdatePlan,
  user?: User | null
): WaiterUpdateCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: clearer empathy wording reduces service-lane friction.',
      adjustedApproach: 'Lead each update with acknowledgement before giving timeline details.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: transparent timing commitments improve confidence.',
      adjustedApproach: 'Give exact next update times and avoid soft promises.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored to pacing trend: shorter update cadence prevents uncertainty spikes.',
      adjustedApproach: 'Use tighter, predictable update intervals during delays.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.consistencyLow) {
    return {
      tailoredReason: 'Tailored to consistency trend: repeatable update structure improves customer calm.',
      adjustedApproach: 'Follow the same three-part update pattern each time: status, next step, timestamp.',
      focusSkillTag: 'Consistency',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: precise status + timing keeps waiting customers engaged and calm.',
    adjustedApproach: 'Use concise updates with explicit next-checkpoint times.',
    focusSkillTag: 'Consistency',
  };
}
