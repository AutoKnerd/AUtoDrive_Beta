import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const SPECIAL_ORDER_CUSTOMER_STYLES = [
  'decisive',
  'hesitant',
  'skeptical',
  'price-sensitive',
] as const;

export const SPECIAL_ORDER_CHECKPOINTS = [
  'order placed',
  'supplier confirmed',
  'in transit',
  'arrival QA',
  'ready for pickup',
] as const;

export type SpecialOrderCustomerStyle = typeof SPECIAL_ORDER_CUSTOMER_STYLES[number];
export type SpecialOrderCheckpoint = typeof SPECIAL_ORDER_CHECKPOINTS[number];

export type SpecialOrderInput = {
  commitmentStrength: number;
  waitTolerance: number;
  depositConfidence: boolean;
  expectedFulfillmentDays: number;
  customerStyle?: SpecialOrderCustomerStyle | null;
};

export type SpecialOrderPlan = {
  bestOrderExplanation: string;
  sayThisAboutTiming: string;
  reinforceCommitmentThisWay: string;
  reduceGhostingRisk: string;
  doNotDoThis: string;
};

export type SpecialOrderSprocketEnhancement = {
  likelyHesitationDiagnosis: string;
  strongerReassuranceLanguage: string;
  naturalRewrite: string;
  uncertaintyReductionCoaching: string;
};

export type SpecialOrderCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Tone' | 'Trust' | 'Clarity' | 'Consistency';
};

export type SpecialOrderSavedScenario = {
  id: string;
  createdAt: string;
  commitmentStrength: number;
  waitTolerance: number;
  depositConfidence: boolean;
  expectedFulfillmentDays: number;
  customerStyle?: SpecialOrderCustomerStyle | null;
  bestOrderExplanation: string;
  sayThisAboutTiming: string;
  reinforceCommitmentThisWay: string;
  reduceGhostingRisk: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function dayBand(days: number): 'short' | 'medium' | 'long' {
  if (days <= 7) return 'short';
  if (days <= 14) return 'medium';
  return 'long';
}

function explanation(input: SpecialOrderInput): string {
  const band = dayBand(input.expectedFulfillmentDays);
  if (band === 'short') {
    return 'Use a confidence-first explanation: simple process, clear checkpoints, and quick fulfillment path.';
  }
  if (band === 'long' && input.waitTolerance < 45) {
    return 'Use expectation-stability explanation: transparent timeline plus proactive update commitments.';
  }
  if (!input.depositConfidence) {
    return 'Use trust-based explanation: clarify why deposit secures allocation and protects order certainty.';
  }
  return 'Use process-clarity explanation: what happens next, when updates come, and how pickup is confirmed.';
}

function timingLine(input: SpecialOrderInput): string {
  const days = Math.max(1, Math.round(input.expectedFulfillmentDays));
  if (days <= 7) {
    return `Estimated fulfillment is about ${days} days, and I will confirm each checkpoint as it clears.`;
  }
  if (days <= 14) {
    return `Estimated fulfillment is about ${days} days. I will send update checkpoints so you are never guessing.`;
  }
  return `Estimated fulfillment is about ${days} days, and I will proactively update you at each milestone to keep this predictable.`;
}

function commitmentLine(input: SpecialOrderInput): string {
  if (!input.depositConfidence) {
    return 'Reinforce with allocation language: explain how commitment secures the part and avoids reorder delays.';
  }
  if (input.commitmentStrength < 45) {
    return 'Reinforce with low-pressure confirmation: summarize the plan and ask for one clear go-ahead step.';
  }
  return 'Reinforce with checkpoint accountability: confirm who updates, when, and pickup expectations.';
}

function ghostingLine(input: SpecialOrderInput): string {
  if (input.waitTolerance < 40) {
    return 'Set short update intervals and confirm preferred contact channel before they leave.';
  }
  if (input.customerStyle === 'skeptical') {
    return 'Use documented timeline checkpoints and send first status confirmation quickly.';
  }
  return 'Lock a next-update time and pickup reminder so momentum does not fade.';
}

function doNotLine(input: SpecialOrderInput): string {
  if (!input.depositConfidence) {
    return 'Do not present deposit as a pressure tactic without explaining the protection benefit.';
  }
  if (input.waitTolerance < 40) {
    return 'Do not promise exact arrival dates you cannot control.';
  }
  return 'Do not close with vague “we will call you” language without a specific timeline.';
}

export function getSpecialOrderPlan(input: SpecialOrderInput): SpecialOrderPlan {
  const normalized: SpecialOrderInput = {
    ...input,
    commitmentStrength: clamp(input.commitmentStrength),
    waitTolerance: clamp(input.waitTolerance),
    expectedFulfillmentDays: clamp(input.expectedFulfillmentDays, 1, 30),
  };

  return {
    bestOrderExplanation: explanation(normalized),
    sayThisAboutTiming: timingLine(normalized),
    reinforceCommitmentThisWay: commitmentLine(normalized),
    reduceGhostingRisk: ghostingLine(normalized),
    doNotDoThis: doNotLine(normalized),
  };
}

export function getSprocketSpecialOrderEnhancement(
  input: SpecialOrderInput,
  base: SpecialOrderPlan
): SpecialOrderSprocketEnhancement {
  const likelyHesitationDiagnosis =
    !input.depositConfidence
      ? 'Likely hesitation is commitment anxiety tied to deposit uncertainty.'
      : input.waitTolerance < 45
        ? 'Likely hesitation is timeline uncertainty and fear of follow-through gaps.'
        : 'Likely hesitation is confidence drift between order and pickup.';

  return {
    likelyHesitationDiagnosis,
    strongerReassuranceLanguage: `${base.bestOrderExplanation} Add one concrete checkpoint promise and owner.`,
    naturalRewrite: `Try this line: ${base.sayThisAboutTiming}`,
    uncertaintyReductionCoaching: 'Set one next contact time before ending the conversation and confirm preferred channel.',
  };
}

type SkillSignals = {
  toneLow: boolean;
  trustLow: boolean;
  clarityLow: boolean;
  consistencyLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const tone = readCxStatScore(stats?.listening, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const clarity = readCxStatScore(stats?.closing, 60);
  const consistency = readCxStatScore(stats?.followUp, 60);

  return {
    toneLow: tone > 0 && tone < 55,
    trustLow: trust > 0 && trust < 55,
    clarityLow: clarity > 0 && clarity < 55,
    consistencyLow: consistency > 0 && consistency < 55,
  };
}

export function getAutoDriveCxSpecialOrderEnhancement(
  _input: SpecialOrderInput,
  _base: SpecialOrderPlan,
  user?: User | null
): SpecialOrderCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: calmer reassurance language improves special-order confidence.',
      adjustedApproach: 'Use plain, confident language and avoid defensive wording around deposits.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: explicit checkpoint ownership reduces uncertainty.',
      adjustedApproach: 'State exactly who updates the customer and when each checkpoint is sent.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.clarityLow) {
    return {
      tailoredReason: 'Tailored to clarity trend: tighter process explanation lowers hesitation.',
      adjustedApproach: 'Summarize process in 3 steps: secure, track, pickup-ready.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.consistencyLow) {
    return {
      tailoredReason: 'Tailored to consistency trend: scheduled updates reduce ghosting.',
      adjustedApproach: 'Set a recurring update cadence tied to timeline checkpoints.',
      focusSkillTag: 'Consistency',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: process clarity plus checkpoint follow-through increases commitment.',
    adjustedApproach: 'Lead with certainty, set update timing, and confirm next contact before close.',
    focusSkillTag: 'Consistency',
  };
}
