import type { User } from '@/lib/definitions';

export const BUYER_TEMPERATURE_STAGES = [
  'early',
  'middle',
  'late',
  'after numbers',
  'after objection',
] as const;

export type BuyerTemperatureStage = typeof BUYER_TEMPERATURE_STAGES[number];

export type BuyerTemperatureInput = {
  buyingEnergy: number;
  consultantConfidence: number;
  trustLevel: number;
  urgencyLevel: number;
  dealStage?: BuyerTemperatureStage | null;
};

export type BuyerTemperaturePlan = {
  currentDealTemperature: string;
  hiddenRisk: string;
  bestNextMove: string;
  sayThisNext: string;
  doNotDoThis: string;
  momentumScore: number;
};

export type BuyerTemperatureSprocketEnhancement = {
  deeperDiagnosis: string;
  warmingOrCoolingReason: string;
  sharperNextMove: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type BuyerTemperatureCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Listening' | 'Trust' | 'Pacing' | 'Follow-Up';
};

export type BuyerTemperatureSavedScenario = {
  id: string;
  createdAt: string;
  buyingEnergy: number;
  consultantConfidence: number;
  trustLevel: number;
  urgencyLevel: number;
  dealStage?: BuyerTemperatureStage | null;
  currentDealTemperature: string;
  hiddenRisk: string;
  bestNextMove: string;
  sayThisNext: string;
  doNotDoThis: string;
  momentumScore: number;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function stageModifier(stage?: BuyerTemperatureStage | null): number {
  if (!stage) return 0;
  if (stage === 'early') return -4;
  if (stage === 'middle') return 0;
  if (stage === 'late') return 3;
  if (stage === 'after numbers') return -2;
  return -6;
}

function deriveTemperatureLabel(score: number): string {
  if (score >= 72) return 'Hot';
  if (score >= 54) return 'Warm';
  if (score >= 38) return 'Cooling';
  return 'Cold';
}

function deriveHiddenRisk(input: BuyerTemperatureInput, label: string): string {
  if (input.trustLevel < 45 && input.buyingEnergy > 55) {
    return 'Interest is present, but trust is weak. Momentum can collapse at commitment.';
  }
  if (input.urgencyLevel < 40 && input.buyingEnergy > 55) {
    return 'Customer likes the deal but has no timing pressure. Drift risk is high.';
  }
  if (input.consultantConfidence < 45 && input.trustLevel < 50) {
    return 'Low confidence and low trust together can make the deal feel uncertain.';
  }
  if (label === 'Cooling' || label === 'Cold') {
    return 'The deal is losing clarity. Without a specific next step, follow-up will weaken.';
  }
  return 'Momentum is good, but over-talking or rushing can still cool the deal.';
}

function deriveNextMove(input: BuyerTemperatureInput, label: string): string {
  if (label === 'Hot') {
    return 'Run a clean commitment step now and confirm the exact next action before momentum softens.';
  }
  if (label === 'Warm') {
    return 'Tighten clarity with one diagnostic question, then bridge directly to a commitment checkpoint.';
  }
  if (label === 'Cooling') {
    return 'Lower pressure and re-open with a precise question to isolate the real blocker before presenting again.';
  }
  if (input.dealStage === 'after objection' || input.dealStage === 'after numbers') {
    return 'Reset the frame: diagnose reaction first, then propose one smaller next step instead of a full close.';
  }
  return 'Use a low-friction re-entry move focused on trust and specificity, then set a concrete next touchpoint.';
}

function deriveSayThis(input: BuyerTemperatureInput, label: string): string {
  if (label === 'Hot') {
    return 'It sounds like we are close. If we solve this one piece, are you ready to move forward?';
  }
  if (label === 'Warm') {
    return 'Before we go further, what feels like the one thing we should tighten up together?';
  }
  if (label === 'Cooling') {
    return 'No pressure. Help me understand what feels off so we can make this simple.';
  }
  if (input.dealStage === 'after objection') {
    return 'I hear you. Let us reset this quickly and focus on what matters most to you right now.';
  }
  return 'If we simplify this to one clear next step, what would you want that step to be?';
}

function deriveDoNotDo(input: BuyerTemperatureInput, label: string): string {
  if (label === 'Hot') return 'Do not over-explain and accidentally create new objections.';
  if (label === 'Warm') return 'Do not jump to discounting before confirming what is actually blocking movement.';
  if (label === 'Cooling') return 'Do not send generic follow-up without a specific question or next step.';
  if (input.consultantConfidence < 45) return 'Do not apologize for the process or sound uncertain about next steps.';
  return 'Do not push hard-close language when trust and urgency are still low.';
}

export function getBuyerTemperaturePlan(input: BuyerTemperatureInput): BuyerTemperaturePlan {
  const energy = clamp(input.buyingEnergy);
  const confidence = clamp(input.consultantConfidence);
  const trust = clamp(input.trustLevel);
  const urgency = clamp(input.urgencyLevel);

  const weighted =
    (energy * 0.34) +
    (trust * 0.3) +
    (urgency * 0.2) +
    (confidence * 0.16) +
    stageModifier(input.dealStage);

  const momentumScore = clamp(Math.round(weighted));
  const currentDealTemperature = deriveTemperatureLabel(momentumScore);

  return {
    currentDealTemperature,
    hiddenRisk: deriveHiddenRisk(input, currentDealTemperature),
    bestNextMove: deriveNextMove(input, currentDealTemperature),
    sayThisNext: deriveSayThis(input, currentDealTemperature),
    doNotDoThis: deriveDoNotDo(input, currentDealTemperature),
    momentumScore,
  };
}

export function getSprocketBuyerTemperatureEnhancement(
  input: BuyerTemperatureInput,
  base: BuyerTemperaturePlan
): BuyerTemperatureSprocketEnhancement {
  const warmingOrCoolingReason =
    input.trustLevel < 50
      ? 'Temperature is cooling mostly from trust instability, even if interest appears high.'
      : input.urgencyLevel < 45
        ? 'Temperature is flattening due to low urgency and weak decision timing.'
        : input.consultantConfidence < 50
          ? 'Temperature is unstable because consultant delivery confidence is leaking certainty.'
          : 'Temperature is improving, but momentum needs a cleaner commitment sequence.';

  return {
    deeperDiagnosis: `Primary momentum read: ${base.currentDealTemperature} at ${base.momentumScore}/100 with risk concentrated in sequencing and clarity.`,
    warmingOrCoolingReason,
    sharperNextMove: `${base.bestNextMove} Tie it to one explicit yes-condition.`,
    naturalRewrite: `Try this line: ${base.sayThisNext}`,
    deliveryCoaching: 'Keep pace controlled, ask one question, pause fully, then respond. Do not stack explanations.',
  };
}

type SkillSignals = {
  listeningLow: boolean;
  trustLow: boolean;
  pacingLow: boolean;
  followUpLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const listening = Number(stats?.listening ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const pacing = Number(stats?.closing ?? 60);
  const followUp = Number(stats?.followUp ?? 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    trustLow: trust > 0 && trust < 55,
    pacingLow: pacing > 0 && pacing < 55,
    followUpLow: followUp > 0 && followUp < 55,
  };
}

export function getAutoDriveCxBuyerTemperatureEnhancement(
  _input: BuyerTemperatureInput,
  _base: BuyerTemperaturePlan,
  user?: User | null
): BuyerTemperatureCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored to listening trend: better diagnosis questions improve momentum accuracy.',
      adjustedApproach: 'Ask one short clarifying question before any recommendation or defense.',
      focusSkillTag: 'Listening',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust-building trend: transparency-first framing stabilizes warm deals.',
      adjustedApproach: 'Use calmer, lower-pressure wording before any commitment ask.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored to pacing trend: slowing delivery reduces avoidable cooling moments.',
      adjustedApproach: 'Shorten your statement, pause, then ask the next question.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.followUpLow) {
    return {
      tailoredReason: 'Tailored to follow-up trend: momentum holds better with explicit next-touch commitments.',
      adjustedApproach: 'Always lock a time-bound next step while the deal is still warm.',
      focusSkillTag: 'Follow-Up',
    };
  }

  return {
    tailoredReason: 'Tailored from your skill profile: momentum improves with cleaner question-to-next-step flow.',
    adjustedApproach: 'Diagnose quickly, keep language simple, and move to one concrete next action.',
    focusSkillTag: 'Listening',
  };
}
