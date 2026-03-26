import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const TRADE_OBJECTION_TYPES = [
  'trade too low',
  'expected more',
  'compared to online quote',
  'compared to another store',
  'wants more without explanation',
  'offended by appraisal',
  'wants separate negotiation',
] as const;

export const TRADE_EMOTION_LEVELS = ['low', 'medium', 'high'] as const;
export const TRADE_TRUST_LEVELS = ['low', 'medium', 'high'] as const;
export const TRADE_DEAL_STAGES = ['early', 'after test drive', 'after numbers', 'late stage'] as const;

export type TradeObjectionType = typeof TRADE_OBJECTION_TYPES[number];
export type TradeEmotionLevel = typeof TRADE_EMOTION_LEVELS[number];
export type TradeTrustLevel = typeof TRADE_TRUST_LEVELS[number];
export type TradeDealStage = typeof TRADE_DEAL_STAGES[number];

export type TradeValueBridgeInput = {
  objectionType: TradeObjectionType;
  emotionLevel: TradeEmotionLevel;
  trustLevel: TradeTrustLevel;
  dealStage?: TradeDealStage;
};

export type TradeValueBridgePlan = {
  likelyRealConcern: string;
  bestBridge: string;
  sayThis: string;
  askThis: string;
  doNotDoThis: string;
};

export type TradeValueBridgeSprocketEnhancement = {
  deeperDiagnosis: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  strongerBridge: string;
};

export type TradeValueBridgeCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Trust' | 'Objection Control' | 'Tone' | 'Pacing';
};

export type TradeValueBridgeSavedScenario = {
  id: string;
  createdAt: string;
  objectionType: TradeObjectionType;
  emotionLevel: TradeEmotionLevel;
  trustLevel: TradeTrustLevel;
  dealStage: TradeDealStage;
  likelyRealConcern: string;
  bestBridge: string;
  sayThis: string;
  askThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_OBJECTION: Record<TradeObjectionType, TradeValueBridgePlan> = {
  'trade too low': {
    likelyRealConcern: 'Customer feels the trade number undervalues what they own, not just the deal math.',
    bestBridge: 'Acknowledge value perception, then connect trade to full structure clarity.',
    sayThis: 'I understand why that feels low. Let us make sure the full deal picture is clear before any final call.',
    askThis: 'Would you like to review how trade, payment, and total ownership fit together line by line?',
    doNotDoThis: 'Do not argue the number emotionally.',
  },
  'expected more': {
    likelyRealConcern: 'Expectation gap is driving tension more than hard refusal.',
    bestBridge: 'Reset expectations with transparency and move back to total deal outcome.',
    sayThis: 'Makes sense. Let us align what you expected versus how this value was built.',
    askThis: 'What value range were you expecting so we can close that gap with clarity?',
    doNotDoThis: 'Do not dismiss expectation as unrealistic.',
  },
  'compared to online quote': {
    likelyRealConcern: 'Customer sees inconsistency and is questioning trust in valuation method.',
    bestBridge: 'Clarify quote assumptions, then bridge to verified in-person appraisal logic.',
    sayThis: 'Online quotes are a useful start. Let us compare those assumptions with your actual appraisal details.',
    askThis: 'Can we line up what the online quote assumed versus what was verified here?',
    doNotDoThis: 'Do not say online quotes are useless.',
  },
  'compared to another store': {
    likelyRealConcern: 'Customer wants confidence they are not leaving value on the table.',
    bestBridge: 'Use apples-to-apples comparison and reconnect to full deal convenience/fit.',
    sayThis: 'Fair comparison. Let us make sure we are comparing the same structure, not just one line.',
    askThis: 'Do you want to compare total out-the-door structure side by side?',
    doNotDoThis: 'Do not attack the other store.',
  },
  'wants more without explanation': {
    likelyRealConcern: 'Customer is anchoring high and testing flexibility before revealing true concern.',
    bestBridge: 'Ask diagnostic questions before any movement and tie trade to next commitment step.',
    sayThis: 'I hear you. Before we move anything, let us identify what feels most off in the overall deal.',
    askThis: 'If we improve one thing first, would you prefer we focus on trade, payment, or total?',
    doNotDoThis: 'Do not throw out random increases to trade.',
  },
  'offended by appraisal': {
    likelyRealConcern: 'Emotional reaction and trust drop are now bigger than the number itself.',
    bestBridge: 'Lower temperature first, then restore transparency and control.',
    sayThis: 'I can see that landed wrong. My goal is to keep this respectful and fully transparent for you.',
    askThis: 'Would it help if we slow down and walk through exactly how appraisal was reached?',
    doNotDoThis: 'Do not keep pushing numbers while emotion is high.',
  },
  'wants separate negotiation': {
    likelyRealConcern: 'Customer feels more in control when trade is isolated from the rest of the deal.',
    bestBridge: 'Validate request, then reconnect trade impact to overall structure for decision clarity.',
    sayThis: 'We can isolate trade for clarity, and then reconnect it so your final decision is accurate.',
    askThis: 'Are you open to reviewing trade separately first, then seeing how it changes total structure?',
    doNotDoThis: 'Do not refuse separation without explanation.',
  },
};

const EMOTION_ADJUSTMENTS: Record<TradeEmotionLevel, Partial<TradeValueBridgePlan>> = {
  low: {},
  medium: {
    sayThis: 'I understand the concern. Let us keep this clear and focus on one step at a time.',
  },
  high: {
    bestBridge: 'De-escalate first, then rebuild trust with transparent structure review.',
    sayThis: 'I hear you. Let us pause and walk this through clearly so you stay in control of the decision.',
    doNotDoThis: 'Do not defend the appraisal while emotion is high.',
  },
};

const TRUST_ADJUSTMENTS: Record<TradeTrustLevel, Partial<TradeValueBridgePlan>> = {
  low: {
    bestBridge: 'Use transparency-first language and validation before any trade discussion.',
    askThis: 'Would it help to verify each piece together so nothing feels hidden?',
  },
  medium: {},
  high: {
    askThis: 'Can we quickly align trade and total structure so you can decide with confidence?',
  },
};

const STAGE_ADJUSTMENTS: Partial<Record<TradeDealStage, Partial<TradeValueBridgePlan>>> = {
  early: {
    bestBridge: 'Keep trade discussion light and avoid full negotiation too early.',
  },
  'after test drive': {
    bestBridge: 'Reconnect trade value to vehicle fit before discussing final structure.',
  },
  'after numbers': {
    bestBridge: 'Use full-structure clarity to prevent trade line from stalling the whole deal.',
  },
  'late stage': {
    askThis: 'If we align this final trade point, are you ready to wrap this up today?',
  },
};

export function getTradeValueBridgePlan(input: TradeValueBridgeInput): TradeValueBridgePlan {
  const base = BASE_BY_OBJECTION[input.objectionType];
  const emotion = EMOTION_ADJUSTMENTS[input.emotionLevel];
  const trust = TRUST_ADJUSTMENTS[input.trustLevel];
  const stage = input.dealStage ? STAGE_ADJUSTMENTS[input.dealStage] : undefined;

  return {
    likelyRealConcern: stage?.likelyRealConcern || trust.likelyRealConcern || emotion.likelyRealConcern || base.likelyRealConcern,
    bestBridge: stage?.bestBridge || trust.bestBridge || emotion.bestBridge || base.bestBridge,
    sayThis: stage?.sayThis || trust.sayThis || emotion.sayThis || base.sayThis,
    askThis: stage?.askThis || trust.askThis || emotion.askThis || base.askThis,
    doNotDoThis: stage?.doNotDoThis || trust.doNotDoThis || emotion.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketTradeValueBridgeEnhancement(
  input: TradeValueBridgeInput,
  base: TradeValueBridgePlan
): TradeValueBridgeSprocketEnhancement {
  const deeperDiagnosis =
    input.trustLevel === 'low'
      ? 'This is likely trust friction disguised as trade-value objection.'
      : input.emotionLevel === 'high'
        ? 'Emotion is the primary blocker right now, not number logic.'
        : 'The objection likely reflects uncertainty in total deal value, not just trade amount.';

  return {
    deeperDiagnosis,
    naturalRewrite: `Try this line: ${base.sayThis}`,
    deliveryCoaching: 'Keep pace slower than normal. Validate first, ask one question, then pause.',
    strongerBridge: `${base.bestBridge} Explicitly connect trade review to the customer's final decision confidence.`,
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

export function getAutoDriveCxTradeValueBridgeEnhancement(
  input: TradeValueBridgeInput,
  base: TradeValueBridgePlan,
  user?: User | null
): TradeValueBridgeCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: transparency and validation should lead every trade response.',
      adjustedApproach: `${base.sayThis} Add explicit reassurance that they stay in control of the process.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.objectionLow) {
    return {
      tailoredReason: 'Tailored for your objection-control trend: tighter structure keeps trade friction from derailing the deal.',
      adjustedApproach: 'Use one validation statement, one diagnostic question, then one bridge step.',
      focusSkillTag: 'Objection Control',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: calmer wording reduces defensiveness during appraisal tension.',
      adjustedApproach: 'Shorten language and remove defensive phrasing before asking the next question.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored for your pacing trend: slower sequencing improves trade conversation control.',
      adjustedApproach: 'Pause after each response and avoid stacking multiple points in one turn.',
      focusSkillTag: 'Pacing',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced trust and structure are recommended.',
    adjustedApproach: base.bestBridge,
    focusSkillTag: 'Objection Control',
  };
}
