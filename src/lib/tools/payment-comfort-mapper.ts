import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const PAYMENT_COMFORT_STYLES = [
  'price-focused',
  'payment-focused',
  'cautious',
  'skeptical',
  'confused',
] as const;

export const PAYMENT_FLEX_KEYS = [
  'term',
  'down payment',
  'vehicle',
  'payment',
] as const;

export type PaymentComfortStyle = typeof PAYMENT_COMFORT_STYLES[number];
export type PaymentFlexKey = typeof PAYMENT_FLEX_KEYS[number];

export type PaymentComfortInput = {
  comfortRange: number;
  painPointThreshold: number;
  reactionIntensity: number;
  flexTerm: boolean;
  flexDownPayment: boolean;
  flexVehicle: boolean;
  flexPayment: boolean;
  customerStyle?: PaymentComfortStyle | null;
};

export type PaymentComfortPlan = {
  likelyPaymentTolerancePattern: string;
  bestFramingApproach: string;
  whatToEmphasize: string;
  askThis: string;
  doNotDoThis: string;
};

export type PaymentComfortSprocketEnhancement = {
  deeperInterpretation: string;
  likelyHiddenIssue: string;
  sharperFraming: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type PaymentComfortCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Objection Control' | 'Tone' | 'Pacing';
};

export type PaymentComfortSavedScenario = {
  id: string;
  createdAt: string;
  comfortRange: number;
  painPointThreshold: number;
  reactionIntensity: number;
  flexTerm: boolean;
  flexDownPayment: boolean;
  flexVehicle: boolean;
  flexPayment: boolean;
  customerStyle?: PaymentComfortStyle | null;
  likelyPaymentTolerancePattern: string;
  bestFramingApproach: string;
  whatToEmphasize: string;
  askThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function flexibilityCount(input: PaymentComfortInput): number {
  return [input.flexTerm, input.flexDownPayment, input.flexVehicle, input.flexPayment].filter(Boolean).length;
}

function deriveTolerancePattern(input: PaymentComfortInput): string {
  const gap = input.painPointThreshold - input.comfortRange;
  if (input.reactionIntensity >= 75 && gap <= 5) {
    return 'Sharp payment edge: customer tolerance is narrow and reacts fast near threshold.';
  }
  if (gap > 15 && input.reactionIntensity <= 45) {
    return 'Elastic payment zone: customer can tolerate structure changes with clear logic.';
  }
  if (input.customerStyle === 'payment-focused') {
    return 'Payment-first orientation: monthly comfort is primary decision driver.';
  }
  if (input.customerStyle === 'price-focused') {
    return 'Price-anchored pattern: payment reaction likely reflects value certainty, not payment alone.';
  }
  return 'Moderate tolerance pattern: comfort exists, but clarity and sequencing determine momentum.';
}

function deriveFraming(input: PaymentComfortInput): string {
  const flex = flexibilityCount(input);
  if (input.reactionIntensity >= 75) {
    return 'Slow the pace, validate reaction, then reframe with one controlled structure path.';
  }
  if (flex >= 3) {
    return 'Use structured options: clarify comfort target, then map the cleanest path across flexible variables.';
  }
  if (flex <= 1) {
    return 'Use transparency-first framing and protect the one flexible lane without overcomplicating.';
  }
  if (input.customerStyle === 'confused') {
    return 'Simplify to one payment story with plain-language tradeoffs before asking for decision.';
  }
  return 'Use value-to-payment framing: connect fit and ownership value before discussing adjustments.';
}

function deriveEmphasis(input: PaymentComfortInput): string {
  if (input.customerStyle === 'skeptical') {
    return 'Emphasize transparency, exact math, and why this structure avoids future pressure.';
  }
  if (input.flexVehicle && !input.flexDownPayment) {
    return 'Emphasize vehicle-fit alternatives before forcing more cash down.';
  }
  if (input.flexTerm && input.flexPayment) {
    return 'Emphasize payment comfort band and term impact with one side-by-side comparison.';
  }
  return 'Emphasize comfort target, affordability stability, and one clear next decision point.';
}

function deriveAsk(input: PaymentComfortInput): string {
  if (input.reactionIntensity >= 75) {
    return 'Which part feels most uncomfortable right now: amount, timeline, or confidence in value?';
  }
  if (input.customerStyle === 'payment-focused') {
    return 'What monthly range feels realistic without stretching?';
  }
  if (input.customerStyle === 'price-focused') {
    return 'If payment fits your comfort band, what would still need to be true to move forward?';
  }
  return 'If we keep this inside your comfort zone, does the path make sense to you?';
}

function deriveDoNot(input: PaymentComfortInput): string {
  if (input.reactionIntensity >= 75) {
    return 'Do not rapid-fire options while the customer is still in payment shock.';
  }
  if (input.customerStyle === 'confused') {
    return 'Do not stack technical terms without confirming understanding.';
  }
  return 'Do not defend numbers before diagnosing what part of payment feels off.';
}

export function getPaymentComfortPlan(input: PaymentComfortInput): PaymentComfortPlan {
  const normalized: PaymentComfortInput = {
    ...input,
    comfortRange: clamp(input.comfortRange),
    painPointThreshold: clamp(input.painPointThreshold),
    reactionIntensity: clamp(input.reactionIntensity),
  };

  return {
    likelyPaymentTolerancePattern: deriveTolerancePattern(normalized),
    bestFramingApproach: deriveFraming(normalized),
    whatToEmphasize: deriveEmphasis(normalized),
    askThis: deriveAsk(normalized),
    doNotDoThis: deriveDoNot(normalized),
  };
}

export function getSprocketPaymentComfortEnhancement(
  input: PaymentComfortInput,
  base: PaymentComfortPlan
): PaymentComfortSprocketEnhancement {
  const likelyHiddenIssue =
    input.customerStyle === 'price-focused'
      ? 'Likely hidden issue is value confidence, not strictly monthly discomfort.'
      : input.reactionIntensity >= 75
        ? 'Likely hidden issue is emotional payment shock and loss of control.'
        : 'Likely hidden issue is uncertainty around tradeoffs, not outright rejection.';

  return {
    deeperInterpretation: `Tolerance map indicates ${base.likelyPaymentTolerancePattern.toLowerCase()}`,
    likelyHiddenIssue,
    sharperFraming: `${base.bestFramingApproach} Keep to one sequence and one decision checkpoint.`,
    naturalRewrite: `Try this line: ${base.askThis}`,
    deliveryCoaching: 'Lower tone, shorten explanation, then pause. Let customer answer before offering a new path.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  objectionLow: boolean;
  toneLow: boolean;
  pacingLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const objection = readCxStatScore(stats?.closing, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const pacing = readCxStatScore(stats?.followUp, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    objectionLow: objection > 0 && objection < 55,
    toneLow: tone > 0 && tone < 55,
    pacingLow: pacing > 0 && pacing < 55,
  };
}

export function getAutoDriveCxPaymentComfortEnhancement(
  _input: PaymentComfortInput,
  _base: PaymentComfortPlan,
  user?: User | null
): PaymentComfortCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: payment talks improve when transparency leads before persuasion.',
      adjustedApproach: 'Start with acknowledgement and clear math, then ask one comfort-zone question.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.objectionLow) {
    return {
      tailoredReason: 'Tailored to objection-control trend: better diagnosis prevents unnecessary concessions.',
      adjustedApproach: 'Clarify reaction source first, then move one variable at a time.',
      focusSkillTag: 'Objection Control',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: calmer language reduces defensiveness around payment.',
      adjustedApproach: 'Use shorter phrasing and neutral tone when discussing discomfort points.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored to pacing trend: deliberate pauses improve customer clarity and response quality.',
      adjustedApproach: 'Explain one element, pause, then ask for reaction before continuing.',
      focusSkillTag: 'Pacing',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: structured sequencing keeps payment talks controlled and clear.',
    adjustedApproach: 'Frame value, map comfort range, then move to one focused next step.',
    focusSkillTag: 'Objection Control',
  };
}
