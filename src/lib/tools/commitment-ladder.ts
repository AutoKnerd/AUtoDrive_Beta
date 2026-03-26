import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const COMMITMENT_DEAL_MOMENTS = [
  'after greeting',
  'after needs assessment',
  'after walkaround',
  'after test drive',
  'after numbers',
  'after objection',
  'before manager TO',
  'before close',
] as const;

export const COMMITMENT_OPENNESS = [
  'very open',
  'somewhat open',
  'neutral',
  'guarded',
  'resistant',
] as const;

export const COMMITMENT_RESISTANCE = [
  'low',
  'moderate',
  'high',
] as const;

export const COMMITMENT_CONCERNS = [
  'price',
  'payment',
  'trade',
  'timing',
  'trust',
  'spouse / third party',
  'unclear',
] as const;

export type CommitmentDealMoment = typeof COMMITMENT_DEAL_MOMENTS[number];
export type CommitmentOpenness = typeof COMMITMENT_OPENNESS[number];
export type CommitmentResistance = typeof COMMITMENT_RESISTANCE[number];
export type CommitmentConcern = typeof COMMITMENT_CONCERNS[number];

export type CommitmentLadderInput = {
  dealMoment: CommitmentDealMoment;
  customerOpenness: CommitmentOpenness;
  resistanceLevel: CommitmentResistance;
  concernType?: CommitmentConcern;
};

export type CommitmentLadderPlan = {
  bestNextCommitment: string;
  sayThis: string;
  askThis: string;
  whatThisUnlocks: string;
  doNotDoThis: string;
};

export type CommitmentLadderSprocketEnhancement = {
  stallDiagnosis: string;
  sharperAsk: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type CommitmentLadderCxEnhancement = {
  tailoredReason: string;
  adaptedStep: string;
  focusSkillTag: 'Trust' | 'Listening' | 'Tone' | 'Pacing' | 'Talk Control';
};

export type CommitmentLadderSavedScenario = {
  id: string;
  createdAt: string;
  dealMoment: CommitmentDealMoment;
  customerOpenness: CommitmentOpenness;
  resistanceLevel: CommitmentResistance;
  concernType: CommitmentConcern;
  bestNextCommitment: string;
  sayThis: string;
  askThis: string;
  whatThisUnlocks: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_MOMENT: Record<CommitmentDealMoment, CommitmentLadderPlan> = {
  'after greeting': {
    bestNextCommitment: 'Confirm fit direction',
    sayThis: 'If we find the right fit quickly, are you open to narrowing to your top two options?',
    askThis: 'What must-have should we lock in first so we stay focused?',
    whatThisUnlocks: 'A low-pressure micro-yes to continue with purpose.',
    doNotDoThis: 'Do not ask for numbers or closing commitment yet.',
  },
  'after needs assessment': {
    bestNextCommitment: 'Confirm must-haves',
    sayThis: 'Let us lock your top priorities so every next step stays aligned.',
    askThis: 'Can we agree these are your non-negotiables before we compare options?',
    whatThisUnlocks: 'Clear decision criteria and less random backtracking.',
    doNotDoThis: 'Do not jump to a hard close before priorities are confirmed.',
  },
  'after walkaround': {
    bestNextCommitment: 'Agree on next comparison point',
    sayThis: 'Based on what you saw, let us compare this against your second-best option.',
    askThis: 'Would it help to line up the two options side by side now?',
    whatThisUnlocks: 'Decision clarity without pressure.',
    doNotDoThis: 'Do not overload with more features before confirming reaction.',
  },
  'after test drive': {
    bestNextCommitment: 'Agree to move to numbers',
    sayThis: 'You have driven it, so next best step is seeing how this looks in real numbers.',
    askThis: 'Are you comfortable moving to numbers so we can confirm fit and affordability?',
    whatThisUnlocks: 'Transition from interest to practical decision.',
    doNotDoThis: 'Do not skip recap and ask for purchase immediately.',
  },
  'after numbers': {
    bestNextCommitment: 'Isolate one blocker',
    sayThis: 'Let us solve one thing at a time so this stays clean and simple.',
    askThis: 'If we fix one item right now, which one moves this forward first?',
    whatThisUnlocks: 'Focused problem-solving instead of broad resistance.',
    doNotDoThis: 'Do not defend every number at once.',
  },
  'after objection': {
    bestNextCommitment: 'Agree to a clarification step',
    sayThis: 'Fair concern. Let us clarify that piece first before deciding anything else.',
    askThis: 'Can we agree to isolate that concern for two minutes so you get a clear answer?',
    whatThisUnlocks: 'Lower pressure and improved trust after friction.',
    doNotDoThis: 'Do not stack rebuttals without confirming the real issue.',
  },
  'before manager TO': {
    bestNextCommitment: 'Agree to manager introduction',
    sayThis: 'I want to bring my manager in briefly to help us tighten this around your priority.',
    askThis: 'Are you open to a two-minute manager touch so we can keep momentum?',
    whatThisUnlocks: 'A cleaner handoff and stronger continuity.',
    doNotDoThis: 'Do not present manager TO as escalation or pressure.',
  },
  'before close': {
    bestNextCommitment: 'Agree to test paperwork',
    sayThis: 'If this fits your key priorities, next step is quick paperwork so we can finalize cleanly.',
    askThis: 'Are you ready to test paperwork while we confirm the final details?',
    whatThisUnlocks: 'Practical final-step commitment with less emotional pressure.',
    doNotDoThis: 'Do not use vague close language with no clear next step.',
  },
};

const OPENNESS_ADJUSTMENTS: Partial<Record<CommitmentOpenness, Partial<CommitmentLadderPlan>>> = {
  'very open': {
    whatThisUnlocks: 'Fast forward momentum with confidence.',
  },
  'somewhat open': {
    whatThisUnlocks: 'Steady progress while preserving comfort.',
  },
  neutral: {
    sayThis: 'Let us keep this simple and move one step at a time.',
  },
  guarded: {
    sayThis: 'No pressure here. Let us just confirm the next smallest step.',
    doNotDoThis: 'Do not use aggressive close phrasing.',
  },
  resistant: {
    bestNextCommitment: 'Agree to a low-pressure next appointment',
    sayThis: 'If now is not the time to decide, let us at least set a short next check-in so this stays easy.',
    askThis: 'Would a quick follow-up slot tomorrow work better than forcing this right now?',
    whatThisUnlocks: 'Continued dialogue without forcing commitment.',
    doNotDoThis: 'Do not push a hard close into active resistance.',
  },
};

const RESISTANCE_ADJUSTMENTS: Partial<Record<CommitmentResistance, Partial<CommitmentLadderPlan>>> = {
  low: {
    askThis: 'Are you comfortable taking this next step now so we keep momentum?',
  },
  moderate: {
    sayThis: 'Let us keep this to one clear step so it stays manageable.',
  },
  high: {
    bestNextCommitment: 'Agree to clarity checkpoint',
    askThis: 'Can we pause for 60 seconds and identify the one thing that feels off before deciding anything else?',
    doNotDoThis: 'Do not ask for full commitment while high resistance is unresolved.',
  },
};

const CONCERN_ADJUSTMENTS: Partial<Record<CommitmentConcern, Partial<CommitmentLadderPlan>>> = {
  price: {
    askThis: 'Can we agree to confirm where value feels off before discussing any changes?',
  },
  payment: {
    askThis: 'Can we agree on a comfortable payment range first so we solve this cleanly?',
  },
  trade: {
    askThis: 'Can we agree to review trade value line by line so it is fully clear?',
  },
  timing: {
    bestNextCommitment: 'Agree to next appointment',
    askThis: 'Would setting a specific next time help you decide without pressure?',
  },
  trust: {
    sayThis: 'I want this transparent so you feel fully in control of each step.',
  },
  'spouse / third party': {
    bestNextCommitment: 'Agree to decision summary for third party',
    askThis: 'Can we build a clear summary now so your other decision-maker has what they need?',
  },
};

export function getCommitmentLadderPlan(input: CommitmentLadderInput): CommitmentLadderPlan {
  const base = BASE_BY_MOMENT[input.dealMoment];
  const openness = OPENNESS_ADJUSTMENTS[input.customerOpenness];
  const resistance = RESISTANCE_ADJUSTMENTS[input.resistanceLevel];
  const concern = input.concernType ? CONCERN_ADJUSTMENTS[input.concernType] : undefined;

  return {
    bestNextCommitment: concern?.bestNextCommitment || resistance?.bestNextCommitment || openness?.bestNextCommitment || base.bestNextCommitment,
    sayThis: concern?.sayThis || resistance?.sayThis || openness?.sayThis || base.sayThis,
    askThis: concern?.askThis || resistance?.askThis || openness?.askThis || base.askThis,
    whatThisUnlocks: concern?.whatThisUnlocks || resistance?.whatThisUnlocks || openness?.whatThisUnlocks || base.whatThisUnlocks,
    doNotDoThis: concern?.doNotDoThis || resistance?.doNotDoThis || openness?.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketCommitmentLadderEnhancement(
  input: CommitmentLadderInput,
  base: CommitmentLadderPlan
): CommitmentLadderSprocketEnhancement {
  const stallDiagnosis =
    input.resistanceLevel === 'high'
      ? 'Commitment is stalling because the ask is too big for current trust and clarity.'
      : input.customerOpenness === 'guarded' || input.customerOpenness === 'resistant'
        ? 'Momentum dropped because the customer needs lower-pressure progression.'
        : 'The next ask likely needs tighter framing to feel natural.';

  return {
    stallDiagnosis,
    sharperAsk: `${base.askThis} Keep it to one step and one outcome.`,
    naturalRewrite: `Try this line: ${base.sayThis}`,
    deliveryCoaching: 'State one clear step, ask one question, then pause. Avoid filling silence with extra persuasion.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  listeningLow: boolean;
  toneLow: boolean;
  pacingLow: boolean;
  overTalkingRisk: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const listening = readCxStatScore(stats?.listening, 60);
  const pacing = readCxStatScore(stats?.followUp, 60);
  const talkControl = readCxStatScore(stats?.closing, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    listeningLow: listening > 0 && listening < 55,
    toneLow: listening > 0 && listening < 50,
    pacingLow: pacing > 0 && pacing < 55,
    overTalkingRisk: talkControl > 0 && talkControl < 55,
  };
}

export function getAutoDriveCxCommitmentLadderEnhancement(
  input: CommitmentLadderInput,
  base: CommitmentLadderPlan,
  user?: User | null
): CommitmentLadderCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: softer micro-commitments improve acceptance.',
      adaptedStep: `${base.sayThis} Add transparency language before asking for commitment.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored for your listening trend: clarifying questions should come before persuasion.',
      adaptedStep: 'Use one diagnostic question first, then propose the next commitment step.',
      focusSkillTag: 'Listening',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: shorter, calmer phrasing lowers resistance.',
      adaptedStep: 'Keep ask language concise and remove any stacked urgency phrases.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.pacingLow) {
    return {
      tailoredReason: 'Tailored for your pacing trend: slower progression improves commitment quality.',
      adaptedStep: 'Use one smaller step before moving to larger commitment requests.',
      focusSkillTag: 'Pacing',
    };
  }
  if (signal.overTalkingRisk) {
    return {
      tailoredReason: 'Tailored for your talk-control trend: fewer words improve decision movement.',
      adaptedStep: 'Limit to one statement and one question, then pause.',
      focusSkillTag: 'Talk Control',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced progression and tone are recommended.',
    adaptedStep: base.bestNextCommitment,
    focusSkillTag: 'Pacing',
  };
}
