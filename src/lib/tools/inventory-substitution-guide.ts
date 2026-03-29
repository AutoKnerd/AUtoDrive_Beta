import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const SUBSTITUTION_TRADEOFFS = [
  'price',
  'speed',
  'quality',
  'availability',
] as const;

export const SUBSTITUTION_CUSTOMER_TYPES = [
  'budget-first',
  'speed-first',
  'quality-first',
  'uncertain',
] as const;

export type SubstitutionTradeoff = typeof SUBSTITUTION_TRADEOFFS[number];
export type SubstitutionCustomerType = typeof SUBSTITUTION_CUSTOMER_TYPES[number];

export type InventorySubstitutionInput = {
  compatibilityConfidence: number;
  tradeoffPriorities: SubstitutionTradeoff[];
  customerPriorityRanking: SubstitutionTradeoff[];
  substitutionRisk: number;
  customerType?: SubstitutionCustomerType | null;
};

export type InventorySubstitutionPlan = {
  bestSubstitutionStrategy: string;
  explainThisFirst: string;
  frameTheTradeoffsThisWay: string;
  askThisBeforeRecommending: string;
  doNotDoThis: string;
};

export type InventorySubstitutionSprocketEnhancement = {
  deeperTradeoffDiagnosis: string;
  sharperRecommendation: string;
  naturalRewrite: string;
  confidenceBuildingCoaching: string;
};

export type InventorySubstitutionCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Clarity' | 'Trust' | 'Tone' | 'Objection Control';
};

export type InventorySubstitutionSavedScenario = {
  id: string;
  createdAt: string;
  compatibilityConfidence: number;
  tradeoffPriorities: SubstitutionTradeoff[];
  customerPriorityRanking: SubstitutionTradeoff[];
  substitutionRisk: number;
  customerType?: SubstitutionCustomerType | null;
  bestSubstitutionStrategy: string;
  explainThisFirst: string;
  frameTheTradeoffsThisWay: string;
  askThisBeforeRecommending: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function topPriority(input: InventorySubstitutionInput): SubstitutionTradeoff {
  return input.customerPriorityRanking[0] || 'quality';
}

function strategy(input: InventorySubstitutionInput): string {
  if (input.compatibilityConfidence < 45 || input.substitutionRisk > 70) {
    return 'Use risk-first strategy: validate fit confidence before discussing any price/speed tradeoff.';
  }
  if (input.customerType === 'budget-first') {
    return 'Use value-protection strategy: show lowest-risk cost path with clear fit safeguards.';
  }
  if (input.customerType === 'speed-first') {
    return 'Use continuity strategy: prioritize fastest viable substitute with explicit quality boundaries.';
  }
  if (input.customerType === 'quality-first') {
    return 'Use quality-assurance strategy: lead with durability/fit confidence, then discuss timing impact.';
  }
  return 'Use decision-clarity strategy: anchor on top customer priority, then compare one backup option.';
}

function explainFirst(input: InventorySubstitutionInput): string {
  if (input.compatibilityConfidence < 45) {
    return 'Explain compatibility confidence and verification steps first.';
  }
  if (input.substitutionRisk > 70) {
    return 'Explain risk boundaries first: where substitute is acceptable and where it is not.';
  }
  return `Explain how this substitute best matches their top priority (${topPriority(input)}).`;
}

function tradeoffFrame(input: InventorySubstitutionInput): string {
  const ranking = input.customerPriorityRanking.slice(0, 3).join(' -> ');
  if (input.tradeoffPriorities.length === 0) {
    return 'Frame tradeoffs as fit certainty first, then speed, then total cost.';
  }
  return `Frame using ranked priorities: ${ranking}. Keep comparison to two options max.`;
}

function askLine(input: InventorySubstitutionInput): string {
  if (input.customerType === 'uncertain') {
    return 'Would it help if I narrow this to one best-fit option and one fallback so the decision is simple?';
  }
  if (input.customerType === 'speed-first') {
    return 'If this gets you back on the road sooner with verified fit, does that match your goal today?';
  }
  if (input.customerType === 'budget-first') {
    return 'Would you like the lowest-cost option that still meets safe fit standards?';
  }
  return 'Which matters most here: fastest turnaround, lowest total cost, or longest-term quality?';
}

function doNotLine(input: InventorySubstitutionInput): string {
  if (input.compatibilityConfidence < 45) {
    return 'Do not recommend substitute as final before confirming compatibility.';
  }
  if (input.substitutionRisk > 70) {
    return 'Do not oversell certainty when substitution risk is still high.';
  }
  return 'Do not present multiple substitutes without a clear recommendation path.';
}

export function getInventorySubstitutionPlan(input: InventorySubstitutionInput): InventorySubstitutionPlan {
  const normalized: InventorySubstitutionInput = {
    ...input,
    compatibilityConfidence: clamp(input.compatibilityConfidence),
    substitutionRisk: clamp(input.substitutionRisk),
  };

  return {
    bestSubstitutionStrategy: strategy(normalized),
    explainThisFirst: explainFirst(normalized),
    frameTheTradeoffsThisWay: tradeoffFrame(normalized),
    askThisBeforeRecommending: askLine(normalized),
    doNotDoThis: doNotLine(normalized),
  };
}

export function getSprocketInventorySubstitutionEnhancement(
  input: InventorySubstitutionInput,
  base: InventorySubstitutionPlan
): InventorySubstitutionSprocketEnhancement {
  const deeperTradeoffDiagnosis =
    input.compatibilityConfidence < 45
      ? 'Primary friction is fit uncertainty, not price preference.'
      : input.customerType === 'budget-first'
        ? 'Primary friction is value confidence under cost pressure.'
        : 'Primary friction is decision overload across tradeoff dimensions.';

  return {
    deeperTradeoffDiagnosis,
    sharperRecommendation: `${base.bestSubstitutionStrategy} Finish with one explicit recommended option.`,
    naturalRewrite: `Try this line: ${base.askThisBeforeRecommending}`,
    confidenceBuildingCoaching: 'Use one recommendation, one backup, and one reason each. Avoid over-comparing.',
  };
}

type SkillSignals = {
  clarityLow: boolean;
  trustLow: boolean;
  toneLow: boolean;
  objectionLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const clarity = readCxStatScore(stats?.followUp, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const objection = readCxStatScore(stats?.closing, 60);

  return {
    clarityLow: clarity > 0 && clarity < 55,
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    objectionLow: objection > 0 && objection < 55,
  };
}

export function getAutoDriveCxInventorySubstitutionEnhancement(
  _input: InventorySubstitutionInput,
  _base: InventorySubstitutionPlan,
  user?: User | null
): InventorySubstitutionCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.clarityLow) {
    return {
      tailoredReason: 'Tailored to clarity trend: fewer options with explicit recommendation improves decisions.',
      adjustedApproach: 'Present one primary substitute and one fallback only.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: transparent tradeoff language increases confidence.',
      adjustedApproach: 'State what you know, what is verified, and what remains uncertain.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: neutral language lowers substitution resistance.',
      adjustedApproach: 'Avoid hard-sell wording and use practical recommendation phrasing.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.objectionLow) {
    return {
      tailoredReason: 'Tailored to objection-control trend: concern-first responses prevent stalls.',
      adjustedApproach: 'Ask one concern question before presenting final substitute recommendation.',
      focusSkillTag: 'Objection Control',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: clear tradeoff ranking and direct recommendation reduce hesitation.',
    adjustedApproach: 'Lead with compatibility confidence, then connect to top customer priority.',
    focusSkillTag: 'Clarity',
  };
}
