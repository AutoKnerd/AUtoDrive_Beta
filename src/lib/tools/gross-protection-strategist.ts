import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const GROSS_DEAL_PRESSURE_LEVELS = [
  'low',
  'moderate',
  'high',
  'near-loss',
] as const;

export const GROSS_OBJECTION_TYPES = [
  'price',
  'payment',
  'trade',
  'competitor comparison',
  'urgency / timing',
  'bundle value',
] as const;

export const GROSS_CUSTOMER_LEVERAGE_LEVELS = [
  'weak',
  'moderate',
  'strong',
] as const;

export const GROSS_MANAGER_GOALS = [
  'hold gross',
  'protect front-end while moving deal',
  'maintain value perception',
  'keep customer engaged without discounting',
  'choose best concession path',
] as const;

export type GrossDealPressureLevel = typeof GROSS_DEAL_PRESSURE_LEVELS[number];
export type GrossObjectionType = typeof GROSS_OBJECTION_TYPES[number];
export type GrossCustomerLeverageLevel = typeof GROSS_CUSTOMER_LEVERAGE_LEVELS[number];
export type GrossManagerGoal = typeof GROSS_MANAGER_GOALS[number];

export type GrossProtectionInput = {
  dealPressure: GrossDealPressureLevel;
  objectionType: GrossObjectionType;
  customerLeverage: GrossCustomerLeverageLevel;
  managerGoal: GrossManagerGoal;
};

export type GrossProtectionPlan = {
  bestGrossProtectionAngle: string;
  sayThis: string;
  bestConcessionStrategy: string;
  lineNotToCross: string;
  doNotDoThis: string;
};

export type GrossProtectionSprocketEnhancement = {
  likelyValueBreakdown: string;
  betterHoldStrategy: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type GrossProtectionCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Negotiation' | 'Value Control';
};

export type GrossProtectionSavedScenario = {
  id: string;
  createdAt: string;
  dealPressure: GrossDealPressureLevel;
  objectionType: GrossObjectionType;
  customerLeverage: GrossCustomerLeverageLevel;
  managerGoal: GrossManagerGoal;
  bestGrossProtectionAngle: string;
  sayThis: string;
  bestConcessionStrategy: string;
  lineNotToCross: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_OBJECTION: Record<GrossObjectionType, GrossProtectionPlan> = {
  price: {
    bestGrossProtectionAngle: 'Anchor on fit and ownership value before discussing any movement.',
    sayThis: 'I hear you. Before we change numbers, let us confirm this is the right fit and what part feels off.',
    bestConcessionStrategy: 'Trade small for commitment: narrow one variable only after clear buyer signal.',
    lineNotToCross: 'Do not drop price without isolating the real blocker first.',
    doNotDoThis: 'Do not defend gross emotionally or argue sticker logic.',
  },
  payment: {
    bestGrossProtectionAngle: 'Re-structure first, discount second.',
    sayThis: 'Let us solve payment comfort with structure before we touch vehicle value.',
    bestConcessionStrategy: 'Adjust term/down/payment path in controlled steps tied to a yes-condition.',
    lineNotToCross: 'Do not give front-end away when payment can be solved structurally.',
    doNotDoThis: 'Do not show multiple weak payment concessions at once.',
  },
  trade: {
    bestGrossProtectionAngle: 'Isolate trade discussion, then reconnect to the total deal.',
    sayThis: 'Let us make trade transparent first, then look at the full deal impact together.',
    bestConcessionStrategy: 'Use documented valuation boundaries and trade movement only with reciprocal commitment.',
    lineNotToCross: 'Do not over-allow trade without preserving total gross position.',
    doNotDoThis: 'Do not turn trade into a separate emotional negotiation.',
  },
  'competitor comparison': {
    bestGrossProtectionAngle: 'Differentiate value and certainty before matching.',
    sayThis: 'If we are close, let us compare total value and confidence, not just one headline number.',
    bestConcessionStrategy: 'Offer a precise bridge concession only if it closes now.',
    lineNotToCross: 'Do not chase unknown competitor numbers blindly.',
    doNotDoThis: 'Do not call the competitor offer fake without proof.',
  },
  'urgency / timing': {
    bestGrossProtectionAngle: 'Lower pressure while tightening the next step.',
    sayThis: 'No pressure. Let us make one clear next move so you can decide with confidence.',
    bestConcessionStrategy: 'Use time-bound clarity concessions tied to a concrete follow-up commitment.',
    lineNotToCross: 'Do not trade heavy discounting for low-urgency shoppers.',
    doNotDoThis: 'Do not force urgency language before trust is secured.',
  },
  'bundle value': {
    bestGrossProtectionAngle: 'Reframe around package value and convenience, not item-by-item price fights.',
    sayThis: 'The goal is complete value and fewer surprises, not just one lower line item.',
    bestConcessionStrategy: 'Unbundle selectively or swap value components without collapsing total margin.',
    lineNotToCross: 'Do not strip value blindly if it destroys perceived integrity of the offer.',
    doNotDoThis: 'Do not let the conversation become a checklist discount exercise.',
  },
};

const PRESSURE_ADJUSTMENTS: Partial<Record<GrossDealPressureLevel, Partial<GrossProtectionPlan>>> = {
  low: {},
  moderate: {},
  high: {
    bestConcessionStrategy: 'Use one strategic concession tied to immediate commitment, then stop.',
  },
  'near-loss': {
    bestGrossProtectionAngle: 'Preserve trust and salvageable value with one clean recovery path.',
    sayThis: 'If we solve the one thing blocking this, are you ready to move forward today?',
    bestConcessionStrategy: 'Choose a final, conditional concession with explicit close language.',
    doNotDoThis: 'Do not panic-discount in multiple steps.',
  },
};

const LEVERAGE_ADJUSTMENTS: Partial<Record<GrossCustomerLeverageLevel, Partial<GrossProtectionPlan>>> = {
  weak: {},
  moderate: {},
  strong: {
    bestGrossProtectionAngle: 'Hold value with transparent logic and disciplined concession sequencing.',
    lineNotToCross: 'Do not show your floor early when customer leverage is strong.',
  },
};

const GOAL_ADJUSTMENTS: Partial<Record<GrossManagerGoal, Partial<GrossProtectionPlan>>> = {
  'hold gross': {
    bestConcessionStrategy: 'Delay monetary movement; prioritize reframing and commitment checkpoints.',
  },
  'protect front-end while moving deal': {
    bestConcessionStrategy: 'Shift variables off front-end first, then trade one controlled move for a decision.',
  },
  'maintain value perception': {
    sayThis: 'I want this to feel fair and clear, not rushed or random.',
  },
  'keep customer engaged without discounting': {
    bestGrossProtectionAngle: 'Increase clarity and momentum with questions, not immediate concessions.',
  },
  'choose best concession path': {
    bestConcessionStrategy: 'Pick one concession lane only, anchor it to decision timing, and avoid stacking.',
  },
};

export function getGrossProtectionPlan(input: GrossProtectionInput): GrossProtectionPlan {
  const base = BASE_BY_OBJECTION[input.objectionType];
  const pressure = PRESSURE_ADJUSTMENTS[input.dealPressure];
  const leverage = LEVERAGE_ADJUSTMENTS[input.customerLeverage];
  const goal = GOAL_ADJUSTMENTS[input.managerGoal];

  return {
    bestGrossProtectionAngle: goal?.bestGrossProtectionAngle || leverage?.bestGrossProtectionAngle || pressure?.bestGrossProtectionAngle || base.bestGrossProtectionAngle,
    sayThis: goal?.sayThis || leverage?.sayThis || pressure?.sayThis || base.sayThis,
    bestConcessionStrategy: goal?.bestConcessionStrategy || leverage?.bestConcessionStrategy || pressure?.bestConcessionStrategy || base.bestConcessionStrategy,
    lineNotToCross: goal?.lineNotToCross || leverage?.lineNotToCross || pressure?.lineNotToCross || base.lineNotToCross,
    doNotDoThis: goal?.doNotDoThis || leverage?.doNotDoThis || pressure?.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketGrossProtectionEnhancement(
  input: GrossProtectionInput,
  base: GrossProtectionPlan
): GrossProtectionSprocketEnhancement {
  const likelyValueBreakdown =
    input.objectionType === 'price' || input.objectionType === 'competitor comparison'
      ? 'Customer likely doubts value certainty more than absolute price.'
      : input.objectionType === 'payment'
        ? 'Breakdown is likely payment-fit anxiety, not immediate value rejection.'
        : input.dealPressure === 'near-loss'
          ? 'Breakdown is momentum collapse from unclear final path.'
          : 'Breakdown is likely sequencing: concession talk started before diagnosis.';

  return {
    likelyValueBreakdown,
    betterHoldStrategy: `${base.bestGrossProtectionAngle} Use one conditional concession rule and protect sequence discipline.`,
    naturalRewrite: `Try this line: ${base.sayThis}`,
    deliveryCoaching: 'Stay calm, ask one question, then state one path. Avoid rapid-fire options.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  negotiationLow: boolean;
  valueControlLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const negotiation = readCxStatScore(stats?.closing, 60);
  const valueControl = readCxStatScore(stats?.followUp, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    negotiationLow: negotiation > 0 && negotiation < 55,
    valueControlLow: valueControl > 0 && valueControl < 55,
  };
}

export function getAutoDriveCxGrossProtectionEnhancement(
  _input: GrossProtectionInput,
  _base: GrossProtectionPlan,
  user?: User | null
): GrossProtectionCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: clearer transparency protects margin without pressure spikes.',
      adjustedApproach: 'Lead with fairness framing, then ask for the one blocker before any concession.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: shorter, calmer phrasing improves customer receptivity.',
      adjustedApproach: 'Use fewer words and deliberate pauses before each concession checkpoint.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.negotiationLow) {
    return {
      tailoredReason: 'Tailored for negotiation trend: sequencing discipline prevents unnecessary margin leaks.',
      adjustedApproach: 'Set one concession lane and require a reciprocal commitment before moving.',
      focusSkillTag: 'Negotiation',
    };
  }
  if (signal.valueControlLow) {
    return {
      tailoredReason: 'Tailored for value-control trend: reinforce value logic before discussing numbers.',
      adjustedApproach: 'Restate fit and ownership value before any pricing movement.',
      focusSkillTag: 'Value Control',
    };
  }

  return {
    tailoredReason: 'Tailored from your skill profile: maintain value-first framing and clean concession structure.',
    adjustedApproach: 'Hold one clear path, use one controlled concession, and close on the next step.',
    focusSkillTag: 'Negotiation',
  };
}
