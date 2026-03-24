import type { User } from '@/lib/definitions';

export const PARTS_URGENCY_LEVELS = [
  'low',
  'medium',
  'high',
  'immediate',
] as const;

export const PARTS_KNOWLEDGE_LEVELS = [
  'informed',
  'uninformed',
] as const;

export const PARTS_OBJECTION_TYPES = [
  'too expensive',
  'not in stock',
  'why OEM',
  'found cheaper elsewhere',
  'wants quick answer',
] as const;

export type PartsUrgencyLevel = typeof PARTS_URGENCY_LEVELS[number];
export type PartsKnowledgeLevel = typeof PARTS_KNOWLEDGE_LEVELS[number];
export type PartsObjectionType = typeof PARTS_OBJECTION_TYPES[number];

export type PartsObjectionInput = {
  oemPreference: number;
  priceSensitivity: number;
  urgency: PartsUrgencyLevel;
  knowledgeLevel: PartsKnowledgeLevel;
  objectionType?: PartsObjectionType | null;
};

export type PartsObjectionPlan = {
  likelyRealConcern: string;
  bestResponseAngle: string;
  sayThis: string;
  clarifyThis: string;
  doNotDoThis: string;
};

export type PartsObjectionSprocketEnhancement = {
  deeperDiagnosis: string;
  sharperResponseFraming: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type PartsObjectionCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Tone' | 'Clarity' | 'Objection Control';
};

export type PartsObjectionSavedScenario = {
  id: string;
  createdAt: string;
  oemPreference: number;
  priceSensitivity: number;
  urgency: PartsUrgencyLevel;
  knowledgeLevel: PartsKnowledgeLevel;
  objectionType?: PartsObjectionType | null;
  likelyRealConcern: string;
  bestResponseAngle: string;
  sayThis: string;
  clarifyThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function realConcern(input: PartsObjectionInput): string {
  if (input.objectionType === 'not in stock') {
    return 'Primary concern is downtime risk and confidence in timing, not just inventory status.';
  }
  if (input.objectionType === 'why OEM') {
    return 'Primary concern is value justification versus perceived lower-cost alternatives.';
  }
  if (input.objectionType === 'found cheaper elsewhere') {
    return 'Primary concern is trust in price fairness and equivalency of the compared part.';
  }
  if (input.priceSensitivity > 70) {
    return 'Primary concern is budget pressure and fear of overpaying for unclear value.';
  }
  if (input.urgency === 'immediate') {
    return 'Primary concern is speed and certainty more than part-spec detail.';
  }
  return 'Primary concern is balancing confidence, cost, and fit without making a bad choice.';
}

function responseAngle(input: PartsObjectionInput): string {
  if (input.urgency === 'immediate') {
    return 'Use certainty-first framing: timeline, fit confirmation, and fastest viable path.';
  }
  if (input.oemPreference >= 65) {
    return 'Use OEM confidence framing focused on fit reliability, warranty alignment, and long-term value.';
  }
  if (input.oemPreference <= 35) {
    return 'Use option-clarity framing: compare OEM vs aftermarket tradeoffs transparently.';
  }
  if (input.knowledgeLevel === 'uninformed') {
    return 'Use education-light framing with simple tradeoff language and one recommendation.';
  }
  return 'Use practical comparison framing tied to customer priority: cost, confidence, and timing.';
}

function sayThis(input: PartsObjectionInput): string {
  if (input.objectionType === 'too expensive') {
    return 'Fair question. Let me show what you are getting for that price and the most practical option.';
  }
  if (input.objectionType === 'not in stock') {
    return 'I want to give you the fastest clean path, so let me map exact timing and the best alternative.';
  }
  if (input.objectionType === 'found cheaper elsewhere') {
    return 'Let us compare apples to apples so you can choose based on real value, not just sticker difference.';
  }
  if (input.objectionType === 'wants quick answer') {
    return 'Quick answer: here is the best fit for your need, with timing and cost in one clear summary.';
  }
  return 'Here is the clearest recommendation based on fit, timing, and total value for your situation.';
}

function clarifyThis(input: PartsObjectionInput): string {
  if (input.knowledgeLevel === 'uninformed') {
    return 'Clarify fit, warranty impact, and expected lifespan in plain language.';
  }
  if (input.priceSensitivity > 70) {
    return 'Clarify total cost of choice, including replacement risk and downtime impact.';
  }
  if (input.oemPreference <= 35) {
    return 'Clarify where aftermarket performs well and where OEM meaningfully reduces risk.';
  }
  return 'Clarify why this recommendation matches both timeline and performance expectations.';
}

function doNot(input: PartsObjectionInput): string {
  if (input.objectionType === 'found cheaper elsewhere') {
    return 'Do not dismiss outside pricing without validating part equivalency first.';
  }
  if (input.knowledgeLevel === 'uninformed') {
    return 'Do not overwhelm with technical jargon before confirming what the customer cares about.';
  }
  return 'Do not turn the conversation into a rigid price defense before diagnosing the real concern.';
}

export function getPartsObjectionPlan(input: PartsObjectionInput): PartsObjectionPlan {
  const normalized: PartsObjectionInput = {
    ...input,
    oemPreference: clamp(input.oemPreference),
    priceSensitivity: clamp(input.priceSensitivity),
  };

  return {
    likelyRealConcern: realConcern(normalized),
    bestResponseAngle: responseAngle(normalized),
    sayThis: sayThis(normalized),
    clarifyThis: clarifyThis(normalized),
    doNotDoThis: doNot(normalized),
  };
}

export function getSprocketPartsObjectionEnhancement(
  input: PartsObjectionInput,
  base: PartsObjectionPlan
): PartsObjectionSprocketEnhancement {
  const deeperDiagnosis =
    input.objectionType === 'why OEM'
      ? 'Likely gap is perceived premium without a clear risk comparison.'
      : input.objectionType === 'not in stock'
        ? 'Likely gap is uncertainty around timeline reliability.'
        : `Likely gap is confidence mismatch between price and expected outcome.`;

  return {
    deeperDiagnosis,
    sharperResponseFraming: `${base.bestResponseAngle} Keep the explanation practical and tradeoff-aware.`,
    naturalRewrite: `Try this line: ${base.sayThis}`,
    deliveryCoaching: 'Use concise, neutral tone. Confirm concern first, then give one clear recommendation.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  toneLow: boolean;
  clarityLow: boolean;
  objectionLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = Number(stats?.trust ?? 60);
  const tone = Number(stats?.listening ?? 60);
  const clarity = Number(stats?.followUp ?? 60);
  const objection = Number(stats?.closing ?? 60);

  return {
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    clarityLow: clarity > 0 && clarity < 55,
    objectionLow: objection > 0 && objection < 55,
  };
}

export function getAutoDriveCxPartsObjectionEnhancement(
  _input: PartsObjectionInput,
  _base: PartsObjectionPlan,
  user?: User | null
): PartsObjectionCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: transparent tradeoff framing improves confidence.',
      adjustedApproach: 'State pros/cons clearly before recommending one option.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: calmer language reduces objection escalation.',
      adjustedApproach: 'Keep responses short and non-defensive when price objections surface.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.clarityLow) {
    return {
      tailoredReason: 'Tailored to clarity trend: simpler explanations increase acceptance speed.',
      adjustedApproach: 'Use one-sentence explanation plus one concrete recommendation.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.objectionLow) {
    return {
      tailoredReason: 'Tailored to objection-control trend: early concern diagnosis improves outcomes.',
      adjustedApproach: 'Ask one concern question before discussing part price details.',
      focusSkillTag: 'Objection Control',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: practical tradeoff language supports faster objection resolution.',
    adjustedApproach: 'Compare options clearly, confirm concern, then recommend one best path.',
    focusSkillTag: 'Clarity',
  };
}
