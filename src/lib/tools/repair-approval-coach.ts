import type { User } from '@/lib/definitions';

export const REPAIR_CATEGORIES = [
  'maintenance',
  'safety',
  'wear-and-tear',
  'diagnostic',
  'unexpected repair',
  'declined prior service',
] as const;

export const REPAIR_URGENCY = [
  'low',
  'medium',
  'high',
  'safety-critical',
] as const;

export const REPAIR_CUSTOMER_MINDSETS = [
  'trusting',
  'skeptical',
  'price-sensitive',
  'rushed',
  'confused',
  'declined before',
] as const;

export const REPAIR_PRICE_SENSITIVITY = [
  'low',
  'medium',
  'high',
] as const;

export type RepairCategory = typeof REPAIR_CATEGORIES[number];
export type RepairUrgency = typeof REPAIR_URGENCY[number];
export type RepairCustomerMindset = typeof REPAIR_CUSTOMER_MINDSETS[number];
export type RepairPriceSensitivity = typeof REPAIR_PRICE_SENSITIVITY[number];

export type RepairApprovalInput = {
  repairCategory: RepairCategory;
  urgency: RepairUrgency;
  customerMindset: RepairCustomerMindset;
  priceSensitivity?: RepairPriceSensitivity;
};

export type RepairApprovalPlan = {
  bestApprovalAngle: string;
  sayThis: string;
  askThis: string;
  whyItMatters: string;
  doNotDoThis: string;
};

export type RepairApprovalSprocketEnhancement = {
  likelyObjectionRisk: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  sharperApprovalLanguage: string;
};

export type RepairApprovalCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Clarity' | 'Listening';
};

export type RepairApprovalSavedScenario = {
  id: string;
  createdAt: string;
  repairCategory: RepairCategory;
  urgency: RepairUrgency;
  customerMindset: RepairCustomerMindset;
  priceSensitivity: RepairPriceSensitivity;
  bestApprovalAngle: string;
  sayThis: string;
  askThis: string;
  whyItMatters: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_CATEGORY: Record<RepairCategory, RepairApprovalPlan> = {
  maintenance: {
    bestApprovalAngle: 'Frame as predictable prevention and long-term ownership savings.',
    sayThis: 'This service helps prevent larger repairs later and keeps your vehicle running as expected.',
    askThis: 'Would you like to handle this now while the vehicle is already here?',
    whyItMatters: 'Routine maintenance protects reliability and lowers risk of avoidable breakdowns.',
    doNotDoThis: 'Do not present maintenance like an upsell with no context.',
  },
  safety: {
    bestApprovalAngle: 'Lead with safety impact in plain language, then explain immediate next step.',
    sayThis: 'This item affects safe operation, so I recommend taking care of it before the vehicle goes back on the road.',
    askThis: 'Are you comfortable approving this now so we remove that safety risk today?',
    whyItMatters: 'Safety-related issues can increase accident risk and liability if delayed.',
    doNotDoThis: 'Do not downplay safety severity to avoid discomfort.',
  },
  'wear-and-tear': {
    bestApprovalAngle: 'Show current condition and expected progression if delayed.',
    sayThis: 'This part is wearing down and will likely cost more if it continues to deteriorate.',
    askThis: 'Would you rather handle it now before it turns into a bigger repair?',
    whyItMatters: 'Normal wear turns into larger failures when ignored too long.',
    doNotDoThis: 'Do not use vague statements without timeline or impact.',
  },
  diagnostic: {
    bestApprovalAngle: 'Position approval as clarity-first decision support.',
    sayThis: 'This diagnostic step helps us identify the exact issue so you avoid guessing and repeated visits.',
    askThis: 'Can we approve diagnostics first so you have a clear answer before deciding on repair?',
    whyItMatters: 'Accurate diagnosis reduces misrepair risk and unnecessary spend.',
    doNotDoThis: 'Do not imply final repair certainty before diagnostics are complete.',
  },
  'unexpected repair': {
    bestApprovalAngle: 'Acknowledge surprise, then focus on consequence and practical options.',
    sayThis: 'I know this was unexpected. I want to show you what happens if we delay versus handle it now.',
    askThis: 'Would you like the safest recommendation first, then options around timing and budget?',
    whyItMatters: 'Unexpected failures can escalate quickly and create downtime.',
    doNotDoThis: 'Do not rush into price defense before explaining impact.',
  },
  'declined prior service': {
    bestApprovalAngle: "Reconnect prior decline to today's condition with no judgment.",
    sayThis: 'This was previously deferred, and today we are seeing signs it is still impacting the vehicle.',
    askThis: 'Are you open to taking care of it now so this does not continue to progress?',
    whyItMatters: 'Deferred items often become more expensive or disruptive over time.',
    doNotDoThis: 'Do not guilt the customer for declining earlier.',
  },
};

const URGENCY_ADJUSTMENTS: Record<RepairUrgency, Partial<RepairApprovalPlan>> = {
  low: {},
  medium: {
    askThis: 'Would you like to handle this now while it is still straightforward?',
  },
  high: {
    bestApprovalAngle: 'Use consequence-first framing with clear near-term risk.',
    sayThis: 'This is moving toward a larger issue, so handling it now is the safer and cleaner option.',
  },
  'safety-critical': {
    bestApprovalAngle: 'Prioritize immediate safety and liability reduction.',
    askThis: 'Can we approve this now so the vehicle leaves in a safe condition?',
    doNotDoThis: 'Do not present safety-critical work as optional convenience.',
  },
};

const MINDSET_ADJUSTMENTS: Partial<Record<RepairCustomerMindset, Partial<RepairApprovalPlan>>> = {
  trusting: {},
  skeptical: {
    bestApprovalAngle: 'Lead with transparency and visible evidence.',
    askThis: 'Would you like to review exactly what we found so you can decide with full clarity?',
  },
  'price-sensitive': {
    sayThis: 'I want to help you avoid the higher-cost outcome by handling the highest-impact piece first.',
    doNotDoThis: 'Do not lead with total price before explaining value and consequence.',
  },
  rushed: {
    bestApprovalAngle: 'Keep explanation concise and outcome-focused.',
    askThis: 'Can I give you the shortest version: risk if delayed versus benefit if done now?',
  },
  confused: {
    sayThis: 'Let me simplify this to what it affects now and what can happen if delayed.',
  },
  'declined before': {
    bestApprovalAngle: 'Use no-judgment update framing tied to current condition.',
  },
};

const PRICE_ADJUSTMENTS: Partial<Record<RepairPriceSensitivity, Partial<RepairApprovalPlan>>> = {
  low: {},
  medium: {
    askThis: 'Would a staged approach help, starting with the highest-priority item?',
  },
  high: {
    bestApprovalAngle: 'Prioritize risk and phased options to protect trust under budget pressure.',
    sayThis: 'If budget is tight, we can prioritize the most important step first and map the rest clearly.',
    doNotDoThis: 'Do not pressure full approval without discussing priority options.',
  },
};

export function getRepairApprovalPlan(input: RepairApprovalInput): RepairApprovalPlan {
  const base = BASE_BY_CATEGORY[input.repairCategory];
  const urgency = URGENCY_ADJUSTMENTS[input.urgency];
  const mindset = MINDSET_ADJUSTMENTS[input.customerMindset];
  const price = input.priceSensitivity ? PRICE_ADJUSTMENTS[input.priceSensitivity] : undefined;

  return {
    bestApprovalAngle: price?.bestApprovalAngle || mindset?.bestApprovalAngle || urgency.bestApprovalAngle || base.bestApprovalAngle,
    sayThis: price?.sayThis || mindset?.sayThis || urgency.sayThis || base.sayThis,
    askThis: price?.askThis || mindset?.askThis || urgency.askThis || base.askThis,
    whyItMatters: price?.whyItMatters || mindset?.whyItMatters || urgency.whyItMatters || base.whyItMatters,
    doNotDoThis: price?.doNotDoThis || mindset?.doNotDoThis || urgency.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketRepairApprovalEnhancement(
  input: RepairApprovalInput,
  base: RepairApprovalPlan
): RepairApprovalSprocketEnhancement {
  const likelyObjectionRisk =
    input.customerMindset === 'skeptical'
      ? 'Approval risk is trust-based; customer may doubt necessity without visible proof.'
      : input.customerMindset === 'price-sensitive' || input.priceSensitivity === 'high'
        ? 'Approval risk is value-to-cost imbalance perception before consequence is understood.'
        : 'Approval risk is usually clarity and urgency mismatch.';

  return {
    likelyObjectionRisk,
    naturalRewrite: `Try this wording: ${base.sayThis}`,
    deliveryCoaching: 'Keep explanation to two short parts: what it affects now, what changes if delayed. Then ask and pause.',
    sharperApprovalLanguage: `${base.bestApprovalAngle} Tie recommendation to customer safety/reliability priority, not shop preference.`,
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  clarityLow: boolean;
  listeningLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = Number(stats?.trust ?? 60);
  const tone = Number(stats?.listening ?? 60);
  const clarity = Number(stats?.closing ?? 60);
  const listening = Number(stats?.listening ?? 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    clarityLow: clarity > 0 && clarity < 55,
    listeningLow: listening > 0 && listening < 55,
  };
}

export function getAutoDriveCxRepairApprovalEnhancement(
  input: RepairApprovalInput,
  base: RepairApprovalPlan,
  user?: User | null
): RepairApprovalCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: evidence-first framing improves approval confidence.',
      adjustedApproach: 'Lead with what was found, then explain risk and recommendation in plain language.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: calmer language lowers pushback during price moments.',
      adjustedApproach: 'Use neutral, customer-centered wording and avoid urgency-heavy phrasing.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.clarityLow) {
    return {
      tailoredReason: 'Tailored for your clarity trend: simple structure increases understanding and approval decisions.',
      adjustedApproach: 'Use a 3-step structure: issue, consequence, recommendation.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored for your listening trend: brief check-back questions improve buy-in.',
      adjustedApproach: `${base.askThis} Then let customer answer fully before continuing.`,
      focusSkillTag: 'Listening',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced explanation-first framing is recommended.',
    adjustedApproach: base.bestApprovalAngle,
    focusSkillTag: 'Clarity',
  };
}
