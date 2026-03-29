import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const UPSELL_REPAIR_CATEGORIES = [
  'maintenance',
  'safety',
  'wear item',
  'unexpected repair',
] as const;

export const UPSELL_CUSTOMER_MINDSETS = [
  'trusting',
  'skeptical',
  'rushed',
  'price-sensitive',
  'uncertain',
] as const;

export type UpsellRepairCategory = typeof UPSELL_REPAIR_CATEGORIES[number];
export type UpsellCustomerMindset = typeof UPSELL_CUSTOMER_MINDSETS[number];

export type UpsellTimingInput = {
  timingWindow: number;
  trustReadiness: number;
  needVsBudget: number;
  repairCategory?: UpsellRepairCategory | null;
  customerMindset?: UpsellCustomerMindset | null;
};

export type UpsellTimingPlan = {
  isThisTheRightTime: string;
  bestFramingAngle: string;
  sayThis: string;
  askThis: string;
  doNotDoThis: string;
  approvalProbability: 'Low' | 'Moderate' | 'High';
  readinessScore: number;
};

export type UpsellTimingSprocketEnhancement = {
  deeperReadinessDiagnosis: string;
  sharperTimingRecommendation: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type UpsellTimingCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Objection Control' | 'Pacing';
};

export type UpsellTimingSavedScenario = {
  id: string;
  createdAt: string;
  timingWindow: number;
  trustReadiness: number;
  needVsBudget: number;
  repairCategory?: UpsellRepairCategory | null;
  customerMindset?: UpsellCustomerMindset | null;
  isThisTheRightTime: string;
  bestFramingAngle: string;
  sayThis: string;
  askThis: string;
  doNotDoThis: string;
  approvalProbability: 'Low' | 'Moderate' | 'High';
  readinessScore: number;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function timingScore(windowValue: number): number {
  const centeredDistance = Math.abs(windowValue - 50);
  return clamp(100 - centeredDistance * 2);
}

function categoryWeight(category?: UpsellRepairCategory | null): number {
  if (!category) return 0;
  if (category === 'safety') return 10;
  if (category === 'unexpected repair') return 6;
  if (category === 'wear item') return 2;
  return 0;
}

function mindsetWeight(mindset?: UpsellCustomerMindset | null): number {
  if (!mindset) return 0;
  if (mindset === 'trusting') return 8;
  if (mindset === 'uncertain') return -2;
  if (mindset === 'rushed') return -8;
  if (mindset === 'skeptical') return -10;
  return -12;
}

function probabilityFromScore(score: number): 'Low' | 'Moderate' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 48) return 'Moderate';
  return 'Low';
}

function timingStatus(input: UpsellTimingInput, probability: 'Low' | 'Moderate' | 'High'): string {
  if (input.timingWindow < 32) return 'Too early. Build trust and context before introducing additional work.';
  if (input.timingWindow > 78) return 'Likely too late. Keep recommendation concise and urgency-focused if still relevant.';
  if (probability === 'High') return 'Yes, this is a strong timing window to present additional work now.';
  if (probability === 'Moderate') return 'Proceed now with careful framing and one clear approval path.';
  return 'Borderline timing. Stabilize readiness first, then re-offer.';
}

function framing(input: UpsellTimingInput): string {
  if (input.repairCategory === 'safety') return 'Safety-first framing with transparent urgency and customer control.';
  if (input.needVsBudget < 40) return 'Budget-sensitive framing: prioritize need clarity and phased options.';
  if (input.customerMindset === 'skeptical') return 'Evidence-first framing: simple proof, clear need, no pressure language.';
  if (input.customerMindset === 'rushed') return 'Fast framing: one-sentence need, one consequence, one next step.';
  return 'Value-and-prevention framing tied to convenience and long-term ownership confidence.';
}

function sayThis(input: UpsellTimingInput): string {
  if (input.repairCategory === 'safety') {
    return 'I want to flag one safety item now so you can decide with full clarity while your vehicle is already here.';
  }
  if (input.needVsBudget < 40) {
    return 'I can keep this simple and prioritize what matters most now, then sequence the rest if needed.';
  }
  return 'While we have the vehicle in process, this is the cleanest time to handle one additional item that prevents a return visit.';
}

function askThis(input: UpsellTimingInput): string {
  if (input.customerMindset === 'price-sensitive') {
    return 'Would it help if we prioritized the highest-impact item first and mapped options for the rest?';
  }
  if (input.customerMindset === 'rushed') {
    return 'If this adds just a short amount of time now, would you want to avoid another visit later?';
  }
  return 'Would you prefer to handle this now while the vehicle is here, or review a phased plan together?';
}

function doNot(input: UpsellTimingInput): string {
  if (input.timingWindow < 32) return 'Do not push additional work before establishing trust and current-status clarity.';
  if (input.customerMindset === 'skeptical' || input.customerMindset === 'price-sensitive') {
    return 'Do not sound defensive on price before confirming what concern matters most.';
  }
  return 'Do not stack multiple recommendations at once without prioritization.';
}

export function getUpsellTimingPlan(input: UpsellTimingInput): UpsellTimingPlan {
  const normalized: UpsellTimingInput = {
    ...input,
    timingWindow: clamp(input.timingWindow),
    trustReadiness: clamp(input.trustReadiness),
    needVsBudget: clamp(input.needVsBudget),
  };

  const score = clamp(Math.round(
    timingScore(normalized.timingWindow) * 0.36 +
    normalized.trustReadiness * 0.32 +
    normalized.needVsBudget * 0.24 +
    categoryWeight(normalized.repairCategory) +
    mindsetWeight(normalized.customerMindset)
  ));

  const approvalProbability = probabilityFromScore(score);

  return {
    isThisTheRightTime: timingStatus(normalized, approvalProbability),
    bestFramingAngle: framing(normalized),
    sayThis: sayThis(normalized),
    askThis: askThis(normalized),
    doNotDoThis: doNot(normalized),
    approvalProbability,
    readinessScore: score,
  };
}

export function getSprocketUpsellTimingEnhancement(
  input: UpsellTimingInput,
  base: UpsellTimingPlan
): UpsellTimingSprocketEnhancement {
  const deeperReadinessDiagnosis =
    input.timingWindow < 32
      ? 'Primary risk is premature recommendation timing before trust readiness.'
      : input.timingWindow > 78
        ? 'Primary risk is late recommendation timing with reduced customer bandwidth.'
        : `Primary readiness signal is ${base.approvalProbability.toLowerCase()} based on timing-trust-budget balance.`;

  return {
    deeperReadinessDiagnosis,
    sharperTimingRecommendation: `${base.isThisTheRightTime} Anchor to one clear recommendation path.`,
    naturalRewrite: `Try this line: ${base.sayThis}`,
    deliveryCoaching: 'State need in plain language, pause, then ask one approval question. Avoid over-explaining.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  objectionLow: boolean;
  pacingLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const objection = readCxStatScore(stats?.closing, 60);
  const pacing = readCxStatScore(stats?.followUp, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    objectionLow: objection > 0 && objection < 55,
    pacingLow: pacing > 0 && pacing < 55,
  };
}

export function getAutoDriveCxUpsellTimingEnhancement(
  _input: UpsellTimingInput,
  _base: UpsellTimingPlan,
  user?: User | null
): UpsellTimingCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: recommendation acceptance improves with clearer transparency first.',
      adjustedApproach: 'Acknowledge customer priorities, then present one prioritized recommendation.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: neutral language lowers resistance to added work recommendations.',
      adjustedApproach: 'Use calm, non-salesy wording with a single concise ask.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.objectionLow) {
    return {
      tailoredReason: 'Tailored to objection-control trend: pre-emptive clarification reduces decline risk.',
      adjustedApproach: 'Clarify likely concern before presenting price or timing details.',
      focusSkillTag: 'Objection Control',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored to pacing trend: timing discipline increases approval probability.',
      adjustedApproach: 'Present at the identified window and avoid delayed add-on stacking.',
      focusSkillTag: 'Pacing',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: one-timing-window and one-priority framing keeps approvals cleaner.',
    adjustedApproach: 'Present one recommendation at the readiness peak and confirm next step directly.',
    focusSkillTag: 'Pacing',
  };
}
