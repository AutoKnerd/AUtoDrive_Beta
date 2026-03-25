import type { User } from '@/lib/definitions';

export const LOYALTY_GOALS = [
  'referral generation',
  'repeat purchase setup',
  'review / reputation',
  'service retention',
  'reactivation',
  'long-term nurture',
] as const;

export const LOYALTY_CUSTOMER_TYPES = [
  'just bought',
  'recent buyer',
  'happy customer',
  'quiet / disconnected customer',
  'high-trust customer',
  'transactional customer',
  'prior unsold customer worth reactivating',
  'service customer with upgrade potential',
] as const;

export const LOYALTY_INTENSITY = [
  'light touch',
  'steady',
  'proactive',
  'high-touch',
] as const;

export const LOYALTY_TONE = [
  'practical',
  'balanced',
  'personal',
] as const;

export const LOYALTY_TOUCHPOINTS = [
  'text',
  'phone call',
  'email',
  'video',
  'handwritten note',
  'service reminder',
  'review ask',
  'referral ask',
  'check-in',
  'upgrade / equity touch',
] as const;

export type LoyaltyGoal = typeof LOYALTY_GOALS[number];
export type LoyaltyCustomerType = typeof LOYALTY_CUSTOMER_TYPES[number];
export type LoyaltyIntensity = typeof LOYALTY_INTENSITY[number];
export type LoyaltyTone = typeof LOYALTY_TONE[number];
export type LoyaltyTouchpoint = typeof LOYALTY_TOUCHPOINTS[number];

export type LoyaltyLoopInput = {
  goal: LoyaltyGoal;
  customerType: LoyaltyCustomerType;
  intensity: LoyaltyIntensity;
  tone: LoyaltyTone;
  toneBlend: number; // 0 practical/direct -> 100 personal/warm
  preferredTouchpoints: LoyaltyTouchpoint[];
  context?: string;
};

export type LoyaltyStep = {
  weekLabel: string;
  touchpoint: LoyaltyTouchpoint;
  action: string;
  sayDirection: string;
};

export type LoyaltyLoopPlan = {
  loopSummary: string;
  bestLoyaltyAngle: string;
  sequence: LoyaltyStep[];
  whatToSendOrSay: string[];
  doNotDoThis: string;
  whyThisWorks: string;
};

export type LoyaltyLoopSprocketEnhancement = {
  likelyFailurePoint: string;
  betterLoyaltyAngle: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  strongerNextTouch: string;
};

export type LoyaltyLoopCxEnhancement = {
  tailoredReason: string;
  skillAwareAdjustment: string;
  focusSkillTag: 'Trust' | 'Follow-Up' | 'Tone' | 'Retention' | 'Referral Confidence';
};

export type LoyaltyLoopSavedScenario = {
  id: string;
  createdAt: string;
  goal: LoyaltyGoal;
  customerType: LoyaltyCustomerType;
  intensity: LoyaltyIntensity;
  tone: LoyaltyTone;
  toneBlend: number;
  preferredTouchpoints: LoyaltyTouchpoint[];
  loopSummary: string;
  bestLoyaltyAngle: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const GOAL_ANGLE: Record<LoyaltyGoal, string> = {
  'referral generation': 'Earn advocacy by stacking value touches before any ask.',
  'repeat purchase setup': 'Plant future-upgrade context early with low-pressure check-ins.',
  'review / reputation': 'Create positive recall moments, then ask for feedback at the right time.',
  'service retention': 'Anchor ongoing ownership support and convenience.',
  reactivation: 'Re-enter calmly with relevance before any sales-forward message.',
  'long-term nurture': 'Build relationship rhythm with consistency and low friction.',
};

const CUSTOMER_ADJUSTMENT: Partial<Record<LoyaltyCustomerType, { cadenceShift: string; warning: string }>> = {
  'quiet / disconnected customer': {
    cadenceShift: 'Start with softer reactivation touches and slower pacing.',
    warning: 'Do not jump to referral or upgrade asks too early.',
  },
  'transactional customer': {
    cadenceShift: 'Lead with practical value and convenience over personal language.',
    warning: 'Do not over-personalize before trust is built.',
  },
  'high-trust customer': {
    cadenceShift: 'Use warm check-ins and introduce review/referral naturally after value touch.',
    warning: 'Do not assume loyalty means frequent asks are always welcome.',
  },
  'prior unsold customer worth reactivating': {
    cadenceShift: 'Treat first touch as re-entry and reset, not continuation.',
    warning: 'Do not message as if prior objections were already solved.',
  },
};

const INTENSITY_SEQUENCE_COUNT: Record<LoyaltyIntensity, number> = {
  'light touch': 3,
  steady: 4,
  proactive: 5,
  'high-touch': 6,
};

const WEEK_LABELS = ['Week 1', 'Week 3', 'Week 5', 'Week 8', 'Week 10', 'Week 12'];

function fallbackTouchpoints(goal: LoyaltyGoal): LoyaltyTouchpoint[] {
  if (goal === 'service retention') {
    return ['check-in', 'service reminder', 'text', 'phone call'];
  }
  if (goal === 'review / reputation') {
    return ['check-in', 'review ask', 'text', 'email'];
  }
  if (goal === 'referral generation') {
    return ['check-in', 'service reminder', 'referral ask', 'text'];
  }
  if (goal === 'reactivation') {
    return ['text', 'phone call', 'check-in', 'email'];
  }
  return ['check-in', 'text', 'phone call', 'upgrade / equity touch'];
}

function normalizeTouchpoints(goal: LoyaltyGoal, preferred: LoyaltyTouchpoint[]): LoyaltyTouchpoint[] {
  const cleaned = preferred.filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  return fallbackTouchpoints(goal);
}

function directionForTouchpoint(touch: LoyaltyTouchpoint, tone: LoyaltyTone, toneBlend: number): string {
  const warmth = tone === 'personal' || toneBlend >= 65;
  const concise = tone === 'practical' || toneBlend <= 35;

  if (touch === 'review ask') {
    return warmth
      ? 'Thank them first, then ask for a short review based on their ownership experience.'
      : 'Ask for a brief review tied to one clear ownership benefit.';
  }
  if (touch === 'referral ask') {
    return warmth
      ? 'Ask for referral only after reinforcing how much you appreciate their trust.'
      : 'Request one referral in a direct, low-pressure way after value recap.';
  }
  if (touch === 'service reminder') {
    return concise
      ? 'Keep it practical: date, benefit, and easy next step.'
      : 'Frame service as convenience and long-term support.';
  }
  if (touch === 'handwritten note') {
    return 'Keep it short and appreciative. Mention one specific detail from their experience.';
  }
  if (touch === 'video') {
    return concise
      ? 'Send a 20-second update with one clear action.'
      : 'Send a warm, short video that feels human and not scripted.';
  }
  if (touch === 'upgrade / equity touch') {
    return 'Present as optional value check, not immediate sales push.';
  }
  return concise
    ? 'Use one clear point and one simple next step.'
    : 'Use a warm check-in and keep the message helpful, not sales-forward.';
}

function actionForTouchpoint(touch: LoyaltyTouchpoint): string {
  if (touch === 'text') return 'Send a short relationship check-in.';
  if (touch === 'phone call') return 'Make a brief value-first call.';
  if (touch === 'email') return 'Send one helpful ownership update.';
  if (touch === 'video') return 'Record a quick personal touch video.';
  if (touch === 'handwritten note') return 'Send appreciation note to reinforce memory.';
  if (touch === 'service reminder') return 'Connect service convenience to ownership value.';
  if (touch === 'review ask') return 'Ask for feedback/review at a positive moment.';
  if (touch === 'referral ask') return 'Invite a referral after trust touchpoint.';
  if (touch === 'check-in') return 'Run a no-pressure relationship pulse check.';
  return 'Share optional equity/upgrade value check.';
}

export function getLoyaltyLoopPlan(input: LoyaltyLoopInput): LoyaltyLoopPlan {
  const baseTouchpoints = normalizeTouchpoints(input.goal, input.preferredTouchpoints);
  const count = INTENSITY_SEQUENCE_COUNT[input.intensity];
  const sequence: LoyaltyStep[] = [];

  for (let index = 0; index < count; index += 1) {
    const touchpoint = baseTouchpoints[index % baseTouchpoints.length];
    sequence.push({
      weekLabel: WEEK_LABELS[index] || `Step ${index + 1}`,
      touchpoint,
      action: actionForTouchpoint(touchpoint),
      sayDirection: directionForTouchpoint(touchpoint, input.tone, input.toneBlend),
    });
  }

  const customerAdjustment = CUSTOMER_ADJUSTMENT[input.customerType];
  const angle = GOAL_ANGLE[input.goal];
  const tonePhrase =
    input.toneBlend <= 33 ? 'practical and direct' : input.toneBlend >= 67 ? 'warm and personal' : 'balanced and helpful';

  const whatToSendOrSay = sequence.slice(0, 4).map(
    (step) => `${step.weekLabel}: ${step.sayDirection}`
  );

  const summary = `${input.intensity} ${tonePhrase} loyalty loop focused on ${input.goal}, tailored for ${input.customerType}.`;

  let doNotDoThis = 'Do not make every touch feel like a sales ask.';
  if (customerAdjustment?.warning) doNotDoThis = customerAdjustment.warning;
  if (input.intensity === 'high-touch' && input.customerType === 'transactional customer') {
    doNotDoThis = 'Do not over-contact transactional customers with personal-heavy outreach.';
  }

  const why = customerAdjustment?.cadenceShift
    ? `${customerAdjustment.cadenceShift} This keeps the loop maintainable and relationship-centered.`
    : 'The sequence balances consistency, value, and timing so loyalty grows without pressure fatigue.';

  const plan: LoyaltyLoopPlan = {
    loopSummary: summary,
    bestLoyaltyAngle: angle,
    sequence,
    whatToSendOrSay,
    doNotDoThis,
    whyThisWorks: why,
  };

  if (input.context?.trim()) {
    plan.whyThisWorks = `${plan.whyThisWorks} Context note applied for extra relevance.`;
  }

  return plan;
}

export function getSprocketLoyaltyLoopEnhancement(
  input: LoyaltyLoopInput,
  base: LoyaltyLoopPlan
): LoyaltyLoopSprocketEnhancement {
  const likelyFailurePoint =
    input.intensity === 'high-touch'
      ? 'This loop may fatigue the customer if each touch lacks fresh value.'
      : input.goal === 'referral generation'
        ? 'Referral ask can fail if appreciation and support touches are too light beforehand.'
        : 'The loop may fade if message variety is low and next steps are unclear.';

  return {
    likelyFailurePoint,
    betterLoyaltyAngle: `${base.bestLoyaltyAngle} Add one ownership-support touch before any ask-heavy step.`,
    naturalRewrite: `Try this opening line for your next touch: ${base.sequence[0]?.sayDirection || 'Keep it short and helpful.'}`,
    deliveryCoaching: 'Keep each touch brief, specific, and genuinely useful. One message, one value point, one pause.',
    strongerNextTouch: 'If response is low, switch the next touchpoint format (text to call, call to video) before increasing frequency.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  followUpLow: boolean;
  toneLow: boolean;
  referralLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = Number(stats?.trust ?? 60);
  const followUp = Number(stats?.followUp ?? 60);
  const tone = Number(stats?.listening ?? 60);
  const referralConfidence = Number(stats?.closing ?? 60);

  return {
    trustLow: trust > 0 && trust < 55,
    followUpLow: followUp > 0 && followUp < 55,
    toneLow: tone > 0 && tone < 55,
    referralLow: referralConfidence > 0 && referralConfidence < 55,
  };
}

export function getAutoDriveCxLoyaltyLoopEnhancement(
  input: LoyaltyLoopInput,
  base: LoyaltyLoopPlan,
  user?: User | null
): LoyaltyLoopCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.followUpLow) {
    return {
      tailoredReason: 'Tailored for your follow-up consistency trend: a simpler loop improves execution.',
      skillAwareAdjustment: 'Reduce to 3-4 high-value touches and keep a fixed rhythm before adding extras.',
      focusSkillTag: 'Follow-Up',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: value and appreciation should lead before asks.',
      skillAwareAdjustment: `${base.bestLoyaltyAngle} Add one additional support touch before review/referral asks.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: shorter, warmer language improves relationship quality.',
      skillAwareAdjustment: 'Use concise, human phrasing and avoid stacked requests in one message.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.referralLow) {
    return {
      tailoredReason: 'Tailored for your referral confidence trend: delay referral ask until clear value touches land.',
      skillAwareAdjustment: 'Place referral ask after at least two appreciation/support touches.',
      focusSkillTag: 'Referral Confidence',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced retention rhythm with consistent value touches.',
    skillAwareAdjustment: base.bestLoyaltyAngle,
    focusSkillTag: 'Retention',
  };
}
