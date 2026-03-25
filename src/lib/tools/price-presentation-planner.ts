import type { User } from '@/lib/definitions';

export const PRICE_PRESENTATION_SCENARIOS = [
  'First pencil',
  'Payment-focused customer',
  'Price-focused customer',
  'Trade-heavy deal',
  'Negative equity / payment stretch',
  'Lease presentation',
  'Finance presentation',
  'Cash buyer',
  'Online lead / remote numbers',
  'Reworked numbers',
  'Manager TO / second presentation',
  'Closing after objection',
] as const;

export const PRICE_PRESENTATION_REACTIONS = [
  'Neutral',
  'Shocked by payment',
  'Shocked by total price',
  'Wants lowest payment only',
  'Focused on trade value',
  'Says another store is cheaper',
  'Confused by the breakdown',
  'Not reacting / unreadable',
  'Distrustful / skeptical',
  'Wants to leave and think',
  'Says send me the numbers',
  'Spouse / third-party decision pending',
  'Just wants best price',
  'Concerned about down payment',
  'Concerned about term length',
] as const;

export const PRICE_PRESENTATION_GOALS = [
  'Build trust',
  'Simplify the deal',
  'Defend value',
  'Hold gross without sounding rigid',
  'Move to commitment',
  'Clarify confusion',
  'Slow the customer down',
  'Keep momentum',
] as const;

export const PRICE_PRESENTATION_INVENTORY_TYPES = ['New', 'Used'] as const;
export const PRICE_PRESENTATION_CHANNELS = ['In-store', 'Phone/Text/Email'] as const;
export const PRICE_PRESENTATION_PAYMENT_ORDERS = ['Payment Before Trade', 'Trade Before Payment'] as const;
export const PRICE_PRESENTATION_ROUNDS = ['First Presentation', 'Rehash'] as const;

export type PricePresentationScenario = typeof PRICE_PRESENTATION_SCENARIOS[number];
export type PricePresentationReaction = typeof PRICE_PRESENTATION_REACTIONS[number];
export type PricePresentationGoal = typeof PRICE_PRESENTATION_GOALS[number];
export type PricePresentationInventoryType = typeof PRICE_PRESENTATION_INVENTORY_TYPES[number];
export type PricePresentationChannel = typeof PRICE_PRESENTATION_CHANNELS[number];
export type PricePresentationPaymentOrder = typeof PRICE_PRESENTATION_PAYMENT_ORDERS[number];
export type PricePresentationRound = typeof PRICE_PRESENTATION_ROUNDS[number];

export type PricePresentationModifiers = {
  inventoryType?: PricePresentationInventoryType;
  channel?: PricePresentationChannel;
  paymentOrder?: PricePresentationPaymentOrder;
  presentationRound?: PricePresentationRound;
  managerInvolved?: boolean;
};

export type PricePresentationInput = {
  scenario: PricePresentationScenario;
  reaction?: PricePresentationReaction;
  goal?: PricePresentationGoal;
  modifiers?: PricePresentationModifiers;
};

export type PricePresentationBaseRecommendation = {
  approachLabel: string;
  approachExplanation: string;
  orderToPresent: string[];
  sayThis: string;
  emphasize: string[];
  doNotDoThis: string;
  whyThisWorks: string;
};

export type PricePresentationSprocketRecommendation = {
  likelyBreakdown: string;
  betterFramingChoice: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  likelyReactionAndResponse: string;
};

export type PricePresentationCxRecommendation = {
  tailoredReason: string;
  adaptedAdjustment: string;
  focusSkillTag: 'Trust' | 'Listening' | 'Tone' | 'Objection Control' | 'Presentation Discipline';
};

export type PricePresentationSavedScenario = {
  id: string;
  createdAt: string;
  scenario: PricePresentationScenario;
  reaction: PricePresentationReaction;
  goal?: PricePresentationGoal;
  approachLabel: string;
  sayThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_SCENARIO: Record<PricePresentationScenario, PricePresentationBaseRecommendation> = {
  'First pencil': {
    approachLabel: 'Value-first then payment',
    approachExplanation: 'Anchor the fit and value before the monthly so numbers feel earned, not random.',
    orderToPresent: [
      'Confirm top priority and fit',
      'Restate why this vehicle solves it',
      'Show structure: price, trade/down, payment',
      'Pause and ask reaction',
    ],
    sayThis: 'I will keep this simple and tie each number back to what matters most to you.',
    emphasize: ['Reason they chose this vehicle', 'How structure creates payment', 'Transparency of each line'],
    doNotDoThis: 'Do not lead with a naked payment number.',
    whyThisWorks: 'It reduces sticker shock and keeps the presentation grounded in value.',
  },
  'Payment-focused customer': {
    approachLabel: 'Payment-first with value framing',
    approachExplanation: 'Meet them on payment priority, then protect value context before negotiation.',
    orderToPresent: [
      'Confirm target payment comfort zone',
      'Show the path that gets closest',
      'Connect payment to term/down/trade choices',
      'Ask what part needs adjustment first',
    ],
    sayThis: 'Let us solve payment first and keep value strong while we do it.',
    emphasize: ['Payment comfort and sustainability', 'How trade/down changes payment', 'One clear path first'],
    doNotDoThis: 'Do not flood them with multiple payment grids immediately.',
    whyThisWorks: 'It honors their concern while keeping control of structure.',
  },
  'Price-focused customer': {
    approachLabel: 'Transparent breakdown approach',
    approachExplanation: 'Show where value lives before defending total price.',
    orderToPresent: [
      'Acknowledge total-price concern',
      'Break down vehicle, market, and included value',
      'Show final structure cleanly',
      'Ask what feels off specifically',
    ],
    sayThis: 'Before we change anything, let me show exactly how this number is built.',
    emphasize: ['Market positioning', 'Vehicle fit and ownership value', 'Line-by-line transparency'],
    doNotDoThis: 'Do not discount before isolating what they are reacting to.',
    whyThisWorks: 'Specificity lowers emotion and reveals the real objection.',
  },
  'Trade-heavy deal': {
    approachLabel: 'Trade-isolation approach',
    approachExplanation: 'Separate trade value discussion from the full deal so trust stays intact.',
    orderToPresent: [
      'Confirm trade condition and expectation',
      'Show how trade value was determined',
      'Recombine with purchase structure',
      'Ask for reaction to the full picture',
    ],
    sayThis: 'Let us isolate trade first so the rest of the numbers are easy to trust.',
    emphasize: ['Trade valuation method', 'Market comps / condition impact', 'Net effect on total deal'],
    doNotDoThis: 'Do not debate trade value emotionally.',
    whyThisWorks: 'Isolation prevents trade friction from contaminating the whole deal.',
  },
  'Negative equity / payment stretch': {
    approachLabel: 'Simple one-path presentation',
    approachExplanation: 'Keep complexity low and show one realistic path with clear trade-offs.',
    orderToPresent: [
      'Acknowledge equity reality without blame',
      'Show one clean path that works now',
      'Explain trade-offs (term/down/payment)',
      'Ask which lever they want to adjust',
    ],
    sayThis: 'I want to keep this realistic and simple so we can pick the best path forward.',
    emphasize: ['Feasibility over guesswork', 'Trade-off clarity', 'Next-step control'],
    doNotDoThis: 'Do not pretend negative equity is minor or easy to hide.',
    whyThisWorks: 'Honest structure protects trust and keeps momentum possible.',
  },
  'Lease presentation': {
    approachLabel: 'Comparison-based presentation',
    approachExplanation: 'Use lease-specific value points to frame payment and ownership cycle.',
    orderToPresent: [
      'Confirm expected miles and ownership cycle',
      'Present lease payment and terms clearly',
      'Contrast with finance path briefly',
      'Ask which path better fits usage',
    ],
    sayThis: 'Based on how you drive, here is why this lease structure may fit better than buying.',
    emphasize: ['Usage fit', 'Payment efficiency', 'End-of-term flexibility'],
    doNotDoThis: 'Do not present lease and finance with no context.',
    whyThisWorks: 'It helps the customer choose strategy, not just a payment.',
  },
  'Finance presentation': {
    approachLabel: 'Ownership-value presentation',
    approachExplanation: 'Frame long-term ownership value before the monthly reaction takes over.',
    orderToPresent: [
      'Confirm ownership intent',
      'Show purchase value and total structure',
      'Present payment with term context',
      'Ask for reaction before rebuttal',
    ],
    sayThis: 'If ownership is your goal, this structure gives you the strongest long-term position.',
    emphasize: ['Ownership benefits', 'Total value over time', 'Payment with purpose'],
    doNotDoThis: 'Do not treat finance like a lease payment pitch.',
    whyThisWorks: 'It aligns numbers with ownership intent.',
  },
  'Cash buyer': {
    approachLabel: 'One-path transparent presentation',
    approachExplanation: 'Keep it short and transparent, focused on total value and certainty.',
    orderToPresent: [
      'Confirm no-payment path',
      'Present total out-the-door clearly',
      'Highlight value and ownership certainty',
      'Ask for commitment',
    ],
    sayThis: 'Since you are buying cash, I will keep this focused on total value and clean execution.',
    emphasize: ['Out-the-door clarity', 'Speed and simplicity', 'Vehicle fit certainty'],
    doNotDoThis: 'Do not push financing logic in a cash-first conversation.',
    whyThisWorks: 'It respects buyer intent and reduces friction.',
  },
  'Online lead / remote numbers': {
    approachLabel: 'Simple remote summary approach',
    approachExplanation: 'Remote customers need clarity and confidence quickly, not a full desk dump.',
    orderToPresent: [
      'Confirm what they are comparing',
      'Send one concise recommended structure',
      'Add one alternate only if needed',
      'Set next call or visit time',
    ],
    sayThis: 'I will send this in a clean format so you can compare quickly and accurately.',
    emphasize: ['Comparability', 'Concise structure', 'Clear next step'],
    doNotDoThis: 'Do not send raw numbers without framing.',
    whyThisWorks: 'It prevents confusion and keeps the conversation moving.',
  },
  'Reworked numbers': {
    approachLabel: 'Reset-and-reframe approach',
    approachExplanation: 'Reworked deals need a clean reset so the customer sees progress.',
    orderToPresent: [
      'Recap what changed from prior version',
      'Present one revised structure',
      'Explain why this is the best path',
      'Ask if this resolves their blocker',
    ],
    sayThis: 'Here is what we changed and why this version is stronger for your goal.',
    emphasize: ['What changed', 'Why it changed', 'Clear blocker resolution'],
    doNotDoThis: 'Do not re-present every old number from scratch.',
    whyThisWorks: 'A focused reset reduces fatigue and rebuilds confidence.',
  },
  'Manager TO / second presentation': {
    approachLabel: 'Unified trust-forward presentation',
    approachExplanation: 'Second presentation works best when message is aligned and concise.',
    orderToPresent: [
      'Acknowledge prior conversation',
      'Align with one shared recommendation',
      'Present with concise rationale',
      'Ask for the final blocker',
    ],
    sayThis: 'We are aligned on one path so this is clear and easy to decide.',
    emphasize: ['Team alignment', 'One clear path', 'Final blocker isolation'],
    doNotDoThis: 'Do not contradict or restart the whole deal story.',
    whyThisWorks: 'Consistency from both consultants increases trust and closure rate.',
  },
  'Closing after objection': {
    approachLabel: 'Commitment-focused recap',
    approachExplanation: 'After an objection, recap the resolved points and ask clearly for next action.',
    orderToPresent: [
      'Confirm what was resolved',
      'Restate current structure briefly',
      'Ask for commitment or final concern',
      'Lock next step immediately',
    ],
    sayThis: 'Now that we solved that concern, are you comfortable moving forward on this plan?',
    emphasize: ['Resolution recap', 'Decision clarity', 'Clear commitment ask'],
    doNotDoThis: 'Do not drift into new details after objection resolution.',
    whyThisWorks: 'It converts resolved friction into forward motion.',
  },
};

const REACTION_OVERRIDES: Partial<Record<`${PricePresentationScenario}|${PricePresentationReaction}`, Partial<PricePresentationBaseRecommendation>>> = {
  'First pencil|Shocked by payment': {
    approachLabel: 'Payment shock stabilization',
    sayThis: 'I hear that. Let us slow this down and isolate what part of payment feels off first.',
    doNotDoThis: 'Do not immediately defend payment with speed.',
  },
  'First pencil|Shocked by total price': {
    approachLabel: 'Value reset before price defense',
    sayThis: 'That reaction makes sense. Let me isolate what is driving that number first.',
  },
  'Price-focused customer|Just wants best price': {
    sayThis: 'I can get aggressive, but first let us make sure we are comparing the same deal structure.',
    doNotDoThis: 'Do not race to “best price” without structure alignment.',
  },
  'Trade-heavy deal|Focused on trade value': {
    sayThis: 'Let us lock trade clarity first, then finalize the rest with confidence.',
    emphasize: ['Trade valuation transparency', 'Condition and market comps', 'Net deal impact'],
  },
  'Lease presentation|Concerned about term length': {
    sayThis: 'Let us compare two lease terms side by side so you can choose the right cycle.',
  },
  'Finance presentation|Shocked by total price': {
    sayThis: 'Before we talk payment again, I want to walk where total value is showing up for you.',
  },
  'Reworked numbers|Distrustful / skeptical': {
    approachLabel: 'Transparency-first reset',
    sayThis: 'I want to earn this with full transparency, so I will show every change line-by-line.',
    doNotDoThis: 'Do not ask for commitment before rebuilding trust.',
  },
  'Online lead / remote numbers|Says send me the numbers': {
    sayThis: 'I will send concise numbers plus one recommendation so this is easy to compare.',
    doNotDoThis: 'Do not send a raw screenshot with no explanation.',
  },
  'Manager TO / second presentation|Just wants best price': {
    sayThis: 'Let us identify what “best” means for you: lowest payment, lowest total, or shortest term.',
  },
  'Closing after objection|Wants to leave and think': {
    sayThis: 'That is fair. Before you go, let us confirm one exact next step so this stays easy.',
    doNotDoThis: 'Do not apply pressure without a clear next-step option.',
  },
  'Negative equity / payment stretch|Concerned about down payment': {
    sayThis: 'Let us map two down-payment paths so you can see what changes and what does not.',
  },
};

const GOAL_EMPHASIS: Record<PricePresentationGoal, string> = {
  'Build trust': 'Use transparent language and verify each step.',
  'Simplify the deal': 'Keep one path visible and remove unnecessary options.',
  'Defend value': 'Connect price to fit and ownership benefit before negotiation.',
  'Hold gross without sounding rigid': 'Stay firm on structure while remaining collaborative.',
  'Move to commitment': 'Ask for one clear decision after recap.',
  'Clarify confusion': 'Use plain language and pause for confirmation.',
  'Slow the customer down': 'Control pace and isolate one concern at a time.',
  'Keep momentum': 'Set the next step before discussing edge-case details.',
};

function applyGoalAndModifierAdjustments(
  base: PricePresentationBaseRecommendation,
  goal?: PricePresentationGoal,
  modifiers?: PricePresentationModifiers
): PricePresentationBaseRecommendation {
  let sayThis = base.sayThis;
  let approachExplanation = base.approachExplanation;
  let orderToPresent = [...base.orderToPresent];
  let emphasize = [...base.emphasize];
  let doNotDoThis = base.doNotDoThis;
  let whyThisWorks = base.whyThisWorks;

  if (goal) {
    emphasize = [GOAL_EMPHASIS[goal], ...emphasize].slice(0, 4);
    if (goal === 'Move to commitment') {
      sayThis = `${sayThis} Then I will ask for a clear yes or the final blocker.`;
    }
    if (goal === 'Clarify confusion') {
      orderToPresent = [...orderToPresent, 'Recap in plain language and confirm understanding'];
    }
  }

  if (modifiers?.inventoryType === 'Used') {
    emphasize = ['Condition and value proof points', ...emphasize].slice(0, 4);
  }
  if (modifiers?.channel === 'Phone/Text/Email') {
    sayThis = `${sayThis} I will keep this concise and easy to compare remotely.`;
  }
  if (modifiers?.paymentOrder === 'Payment Before Trade') {
    orderToPresent = orderToPresent.map((step) => (step.toLowerCase().includes('trade') ? 'Revisit trade after payment anchor' : step));
  }
  if (modifiers?.presentationRound === 'Rehash') {
    approachExplanation = `${approachExplanation} Keep the rehash tight and clearly different from the first pass.`;
  }
  if (modifiers?.managerInvolved) {
    doNotDoThis = 'Do not split messaging between consultant and manager.';
    whyThisWorks = `${whyThisWorks} A single aligned message improves confidence.`;
  }

  return {
    ...base,
    sayThis,
    approachExplanation,
    orderToPresent: orderToPresent.slice(0, 5),
    emphasize: emphasize.slice(0, 4),
    doNotDoThis,
    whyThisWorks,
  };
}

export function getPricePresentationBaseRecommendation(input: PricePresentationInput): PricePresentationBaseRecommendation {
  const reaction = input.reaction || 'Neutral';
  const base = BASE_BY_SCENARIO[input.scenario];
  const override = REACTION_OVERRIDES[`${input.scenario}|${reaction}`];
  const merged: PricePresentationBaseRecommendation = {
    approachLabel: override?.approachLabel || base.approachLabel,
    approachExplanation: override?.approachExplanation || base.approachExplanation,
    orderToPresent: override?.orderToPresent || base.orderToPresent,
    sayThis: override?.sayThis || base.sayThis,
    emphasize: override?.emphasize || base.emphasize,
    doNotDoThis: override?.doNotDoThis || base.doNotDoThis,
    whyThisWorks: override?.whyThisWorks || base.whyThisWorks,
  };
  return applyGoalAndModifierAdjustments(merged, input.goal, input.modifiers);
}

export function getSprocketPricePresentationRecommendation(
  input: PricePresentationInput,
  base: PricePresentationBaseRecommendation
): PricePresentationSprocketRecommendation {
  const reaction = input.reaction || 'Neutral';
  const likelyBreakdown =
    reaction === 'Shocked by payment' || reaction === 'Wants lowest payment only'
      ? 'The customer is reacting to payment uncertainty and pacing, not only affordability.'
      : reaction === 'Distrustful / skeptical' || reaction === 'Says another store is cheaper'
        ? 'Trust is the primary friction. Without transparency, numbers feel defensive.'
        : 'The sequence is likely too dense. Customer needs a cleaner path and earlier pause.';

  return {
    likelyBreakdown,
    betterFramingChoice: `${base.approachLabel}: present one path, pause earlier, then isolate one concern.`,
    naturalRewrite: `Let me keep this simple: ${base.sayThis}`,
    deliveryCoaching: 'Keep voice steady, slow down 15 percent, and avoid stacking explanations before they react.',
    likelyReactionAndResponse: 'If they push back again, ask: “Is this mainly payment, value, or trust?” then solve only that.',
  };
}

type SkillSignal = {
  listeningLow: boolean;
  trustLow: boolean;
  followUpLow: boolean;
  closingLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignal {
  const stats = user?.stats;
  const listening = Number(stats?.listening ?? 60);
  const trust = Number(stats?.trust ?? 60);
  const followUp = Number(stats?.followUp ?? 60);
  const closing = Number(stats?.closing ?? 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    trustLow: trust > 0 && trust < 55,
    followUpLow: followUp > 0 && followUp < 55,
    closingLow: closing > 0 && closing < 55,
  };
}

export function getAutoDriveCxPricePresentationRecommendation(
  input: PricePresentationInput,
  base: PricePresentationBaseRecommendation,
  user?: User | null
): PricePresentationCxRecommendation {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to your trust trend: customers respond better when you verify numbers transparently.',
      adaptedAdjustment: `${base.sayThis} I will walk each line so you can see exactly how we got here.`,
      focusSkillTag: 'Trust',
    };
  }

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored to your listening trend: shorter explanation plus reaction question improves control.',
      adaptedAdjustment: `${base.sayThis} Before I continue, what part feels off to you right now?`,
      focusSkillTag: 'Listening',
    };
  }

  if (signal.closingLow || input.scenario === 'Closing after objection') {
    return {
      tailoredReason: 'Tailored to your objection-control trend: convert resolution into one clear commitment ask.',
      adaptedAdjustment: 'After recap, ask for one decision now or one exact next step time.',
      focusSkillTag: 'Objection Control',
    };
  }

  if (signal.followUpLow || input.reaction === 'Says send me the numbers') {
    return {
      tailoredReason: 'Tailored to your follow-up trend: lock a concrete follow-up commitment while numbers are fresh.',
      adaptedAdjustment: 'Send concise numbers and set one exact callback time before ending the interaction.',
      focusSkillTag: 'Presentation Discipline',
    };
  }

  return {
    tailoredReason: 'Tailored to your pacing profile: controlled tempo improves understanding and confidence.',
    adaptedAdjustment: 'Present one section, pause, ask reaction, then move forward.',
    focusSkillTag: 'Tone',
  };
}
