import type { User } from '@/lib/definitions';

export const PRESSURE_DROP_PATHS = [
  'reassure',
  'clarify',
  'pause',
  'redirect',
  'simplify',
] as const;

export const PRESSURE_DROP_TRIGGERS = [
  'numbers',
  'trade',
  'close attempt',
  'manager involvement',
  'objection',
] as const;

export type PressureDropPath = typeof PRESSURE_DROP_PATHS[number];
export type PressureDropTrigger = typeof PRESSURE_DROP_TRIGGERS[number];

export type PressureDropInput = {
  currentPressureLevel: number;
  customerDefensiveness: number;
  consultantIntensity: number;
  preferredDeEscalationPath: PressureDropPath;
  trigger?: PressureDropTrigger | null;
};

export type PressureDropPlan = {
  bestPressureDropMove: string;
  sayThis: string;
  reassureThisWay: string;
  nextSafeStep: string;
  doNotDoThis: string;
};

export type PressureDropSprocketEnhancement = {
  likelySpikeReason: string;
  betterDeEscalationPath: string;
  naturalRewrite: string;
  toneCoaching: string;
};

export type PressureDropCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Pacing' | 'Over-Pursuit Control';
};

export type PressureDropSavedScenario = {
  id: string;
  createdAt: string;
  currentPressureLevel: number;
  customerDefensiveness: number;
  consultantIntensity: number;
  preferredDeEscalationPath: PressureDropPath;
  trigger?: PressureDropTrigger | null;
  bestPressureDropMove: string;
  sayThis: string;
  reassureThisWay: string;
  nextSafeStep: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function bestMove(input: PressureDropInput): string {
  if (input.customerDefensiveness >= 75 && input.consultantIntensity >= 65) {
    return 'Lower your intensity immediately, acknowledge tension, and move to a single low-pressure checkpoint.';
  }
  if (input.preferredDeEscalationPath === 'pause') {
    return 'Insert a short pause, reset pace, and ask one calm question before continuing.';
  }
  if (input.preferredDeEscalationPath === 'clarify') {
    return 'Clarify what feels off before presenting anything new.';
  }
  if (input.preferredDeEscalationPath === 'redirect') {
    return 'Redirect from pressure point to customer goal and rebuild comfort first.';
  }
  if (input.preferredDeEscalationPath === 'simplify') {
    return 'Simplify to one option and one next step so the customer regains control.';
  }
  return 'Reassure calmly, reduce urgency language, and confirm one safe next step.';
}

function sayThis(input: PressureDropInput): string {
  if (input.customerDefensiveness >= 75) {
    return 'No pressure. Let us slow this down and focus only on what feels right for you right now.';
  }
  if (input.trigger === 'numbers' || input.trigger === 'trade') {
    return 'We can step back for a second and make this cleaner so you can react to one piece at a time.';
  }
  if (input.trigger === 'close attempt') {
    return 'We do not need to force a decision. Let us tighten what matters most first.';
  }
  return 'Let us keep this comfortable and clear, then choose the next step together.';
}

function reassure(input: PressureDropInput): string {
  if (input.preferredDeEscalationPath === 'reassure') {
    return 'Reassure autonomy: remind them they control pace and decision timing.';
  }
  if (input.preferredDeEscalationPath === 'clarify') {
    return 'Reassure clarity: confirm you will answer the exact concern before moving forward.';
  }
  if (input.preferredDeEscalationPath === 'pause') {
    return 'Reassure space: pause and normalize taking a breath before the next step.';
  }
  if (input.preferredDeEscalationPath === 'redirect') {
    return 'Reassure priorities: bring the conversation back to their original goal.';
  }
  return 'Reassure simplicity: remove extra variables and keep only what matters now.';
}

function nextStep(input: PressureDropInput): string {
  if (input.currentPressureLevel >= 75) {
    return 'Run one low-friction question, then confirm whether to continue now or schedule a short follow-up touch.';
  }
  if (input.trigger === 'manager involvement') {
    return 'Set expectation for the manager step in one sentence and confirm comfort before proceeding.';
  }
  return 'Take one smaller commitment step only after the customer confirms comfort and understanding.';
}

function avoid(input: PressureDropInput): string {
  if (input.consultantIntensity >= 70) {
    return 'Do not increase pace or stack more persuasion while tension is rising.';
  }
  if (input.customerDefensiveness >= 70) {
    return 'Do not challenge their objection directly before lowering pressure.';
  }
  return 'Do not push for a close while emotional pressure is still visible.';
}

export function getPressureDropPlan(input: PressureDropInput): PressureDropPlan {
  const normalized: PressureDropInput = {
    ...input,
    currentPressureLevel: clamp(input.currentPressureLevel),
    customerDefensiveness: clamp(input.customerDefensiveness),
    consultantIntensity: clamp(input.consultantIntensity),
  };

  return {
    bestPressureDropMove: bestMove(normalized),
    sayThis: sayThis(normalized),
    reassureThisWay: reassure(normalized),
    nextSafeStep: nextStep(normalized),
    doNotDoThis: avoid(normalized),
  };
}

export function getSprocketPressureDropEnhancement(
  input: PressureDropInput,
  base: PressureDropPlan
): PressureDropSprocketEnhancement {
  const likelySpikeReason =
    input.trigger === 'close attempt'
      ? 'Pressure likely spiked from commitment timing before enough confidence was established.'
      : input.trigger === 'numbers' || input.trigger === 'trade'
        ? 'Pressure likely spiked from complexity and emotional reaction to structure, not refusal alone.'
        : input.trigger === 'manager involvement'
          ? 'Pressure likely spiked from unclear handoff purpose and perceived escalation.'
          : input.trigger === 'objection'
            ? 'Pressure likely spiked because the objection was treated as resistance instead of signal.'
            : 'Pressure likely spiked due to pace mismatch between consultant intensity and customer comfort.';

  return {
    likelySpikeReason,
    betterDeEscalationPath: `${base.bestPressureDropMove} Keep only one decision checkpoint in the next 2 minutes.`,
    naturalRewrite: `Try this line: ${base.sayThis}`,
    toneCoaching: 'Drop volume and speed slightly, use shorter phrases, and pause after each question.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  pacingLow: boolean;
  overPursuitRisk: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = Number(stats?.trust ?? 60);
  const tone = Number(stats?.closing ?? 60);
  const pacing = Number(stats?.followUp ?? 60);
  const overPursuit = Number(stats?.listening ?? 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    pacingLow: pacing > 0 && pacing < 55,
    overPursuitRisk: overPursuit > 0 && overPursuit < 55,
  };
}

export function getAutoDriveCxPressureDropEnhancement(
  _input: PressureDropInput,
  _base: PressureDropPlan,
  user?: User | null
): PressureDropCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Trust trend indicates pressure drops faster when autonomy and transparency are emphasized early.',
      adjustedApproach: 'Open with reassurance of control, then ask one comfort-check question before any proposal.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tone trend suggests softer delivery will reduce defensiveness faster.',
      adjustedApproach: 'Use calmer volume, shorter lines, and remove hard-close phrases in this moment.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Pacing trend suggests conversation speed is likely increasing perceived pressure.',
      adjustedApproach: 'Slow sequencing: statement, question, pause, then one next step only.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.overPursuitRisk) {
    return {
      tailoredReason: 'Pattern suggests over-pursuit risk when tension rises, which can trigger disengagement.',
      adjustedApproach: 'Reduce pursuit intensity and focus on one safe, customer-controlled next action.',
      focusSkillTag: 'Over-Pursuit Control',
    };
  }

  return {
    tailoredReason: 'Skill profile suggests best gains come from calmer pacing and tighter de-escalation sequencing.',
    adjustedApproach: 'Acknowledge pressure, simplify path, and confirm comfort before advancing.',
    focusSkillTag: 'Pacing',
  };
}
