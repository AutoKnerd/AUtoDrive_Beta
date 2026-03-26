import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const BE_BACK_REASONS = [
  'wants to think',
  'wants to shop',
  'payment concern',
  'spouse / third party',
  'no urgency',
  'unclear',
] as const;

export const BE_BACK_TIMING_OPTIONS = [
  'within 2 hours',
  'same day evening',
  'next morning',
  '24 hours',
  '48 hours',
] as const;

export const BE_BACK_ENGAGEMENT_LEVELS = [
  'high',
  'medium',
  'low',
] as const;

export type BeBackReason = typeof BE_BACK_REASONS[number];
export type BeBackTiming = typeof BE_BACK_TIMING_OPTIONS[number];
export type BeBackEngagementLevel = typeof BE_BACK_ENGAGEMENT_LEVELS[number];

export type BeBackInput = {
  returnProbability: number;
  sortedReasons: BeBackReason[];
  preferredTiming: BeBackTiming;
  messageTone: number;
  engagementLevel?: BeBackEngagementLevel | null;
};

export type BeBackPlan = {
  likelihoodTheyReturn: string;
  bestRecoveryAngle: string;
  contactTimingPlan: string;
  sayThis: string;
  doNotDoThis: string;
};

export type BeBackSprocketEnhancement = {
  deeperDiagnosis: string;
  likelyHiddenReason: string;
  strongerRecoveryMessage: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type BeBackCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Follow-Up' | 'Trust' | 'Tone' | 'Persistence';
};

export type BeBackSavedScenario = {
  id: string;
  createdAt: string;
  returnProbability: number;
  sortedReasons: BeBackReason[];
  preferredTiming: BeBackTiming;
  messageTone: number;
  engagementLevel?: BeBackEngagementLevel | null;
  likelihoodTheyReturn: string;
  bestRecoveryAngle: string;
  contactTimingPlan: string;
  sayThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function topReason(input: BeBackInput): BeBackReason {
  return input.sortedReasons[0] || 'unclear';
}

function probabilityBucket(probability: number): string {
  if (probability >= 70) return 'High if follow-up is timely and specific';
  if (probability >= 45) return 'Moderate but fragile without structured re-entry';
  return 'Low unless re-entry lowers pressure and creates a new reason to respond';
}

function recoveryAngle(input: BeBackInput): string {
  const primary = topReason(input);
  if (primary === 'payment concern') {
    return 'Re-open around comfort and clarity, not discount-first pressure.';
  }
  if (primary === 'wants to shop') {
    return 'Differentiate with decision clarity and confidence, not urgency pressure.';
  }
  if (primary === 'spouse / third party') {
    return 'Make the next step easy to share and validate with the other decision-maker.';
  }
  if (primary === 'no urgency') {
    return 'Use low-friction timing plus relevance to rebuild momentum without chasing.';
  }
  if (primary === 'wants to think') {
    return 'Treat this as uncertainty, then isolate one missing piece before re-presenting.';
  }
  return 'Use a curiosity-first re-entry to identify the real blocker before offering solutions.';
}

function timingPlan(input: BeBackInput): string {
  const toneLabel = input.messageTone < 34 ? 'casual' : input.messageTone > 66 ? 'direct' : 'balanced';
  if (input.preferredTiming === 'within 2 hours') {
    return `Send one short ${toneLabel} check-in now, then place a focused call within 24 hours if no reply.`;
  }
  if (input.preferredTiming === 'same day evening') {
    return `Send same-evening recap with one specific question, then follow with next-morning touch.`;
  }
  if (input.preferredTiming === 'next morning') {
    return 'Open with a concise next-morning message, then set a time-bound second touch later that day.';
  }
  if (input.preferredTiming === '24 hours') {
    return 'Use a 24-hour re-entry message, then a value-focused second touch at 48 hours.';
  }
  return 'Use a calm 48-hour re-entry and include one concrete reason to reconnect now.';
}

function sayThis(input: BeBackInput): string {
  const primary = topReason(input);
  const direct = input.messageTone > 66;
  if (primary === 'payment concern') {
    return direct
      ? 'Quick one: if we can land this in your comfort range, would it make sense to pick this back up today?'
      : 'Wanted to check in. If we can make the numbers feel more comfortable, would reopening this be helpful?';
  }
  if (primary === 'wants to shop') {
    return direct
      ? 'If you are comparing, I can make this easier by showing the clearest side-by-side in 2 minutes.'
      : 'Totally fair to compare. Want me to send a simple side-by-side so your decision is easier?';
  }
  if (primary === 'spouse / third party') {
    return 'Happy to help make this easy to review together. Want a short summary you can share right now?';
  }
  if (primary === 'no urgency') {
    return 'No rush at all. If it helps, I can send one quick update so you have the clearest next step whenever ready.';
  }
  return 'Wanted to reconnect briefly. What is the one thing that would help you feel better about moving forward?';
}

function doNot(input: BeBackInput): string {
  if (input.engagementLevel === 'low') {
    return 'Do not send multiple generic “just checking in” messages.';
  }
  if (input.messageTone > 70) {
    return 'Do not use hard-close language before re-establishing trust and relevance.';
  }
  return 'Do not assume they are coming back without a specific re-entry plan.';
}

export function getBeBackPlan(input: BeBackInput): BeBackPlan {
  const normalized = {
    ...input,
    returnProbability: clamp(input.returnProbability),
    messageTone: clamp(input.messageTone),
  };

  return {
    likelihoodTheyReturn: probabilityBucket(normalized.returnProbability),
    bestRecoveryAngle: recoveryAngle(normalized),
    contactTimingPlan: timingPlan(normalized),
    sayThis: sayThis(normalized),
    doNotDoThis: doNot(normalized),
  };
}

export function getSprocketBeBackEnhancement(
  input: BeBackInput,
  base: BeBackPlan
): BeBackSprocketEnhancement {
  const primary = topReason(input);
  const likelyHiddenReason =
    primary === 'wants to think'
      ? 'Likely hidden reason is uncertainty, not a final no.'
      : primary === 'wants to shop'
        ? 'Likely hidden reason is confidence gap, not only price comparison.'
        : primary === 'payment concern'
          ? 'Likely hidden reason is fear of committing to the wrong structure.'
          : 'Likely hidden reason is low urgency combined with low emotional momentum.';

  return {
    deeperDiagnosis: `Primary be-back signal: ${base.likelihoodTheyReturn.toLowerCase()}. Risk sits in reason clarity and timing discipline.`,
    likelyHiddenReason,
    strongerRecoveryMessage: `${base.sayThis} Keep one direct question that earns a response.`,
    naturalRewrite: `Try this version: ${base.sayThis}`,
    deliveryCoaching: 'Keep outreach short, specific, and calm. One message, one ask, one next step.',
  };
}

type SkillSignals = {
  followUpLow: boolean;
  trustLow: boolean;
  toneLow: boolean;
  persistenceLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const followUp = readCxStatScore(stats?.followUp, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const persistence = readCxStatScore(stats?.closing, 60);

  return {
    followUpLow: followUp > 0 && followUp < 55,
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    persistenceLow: persistence > 0 && persistence < 55,
  };
}

export function getAutoDriveCxBeBackEnhancement(
  _input: BeBackInput,
  _base: BeBackPlan,
  user?: User | null
): BeBackCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.followUpLow) {
    return {
      tailoredReason: 'Tailored to follow-up consistency trend: tighter cadence improves be-back reactivation.',
      adjustedApproach: 'Use a fixed 2-touch sequence with clear timing and one CTA per touch.',
      focusSkillTag: 'Follow-Up',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: lower-pressure language improves reply rates.',
      adjustedApproach: 'Lead with help-first framing before any close-oriented ask.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: concise, neutral language reduces resistance.',
      adjustedApproach: 'Avoid hype words and keep messages factual and customer-centered.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.persistenceLow) {
    return {
      tailoredReason: 'Tailored to persistence trend: structured re-entry avoids stopping too early.',
      adjustedApproach: 'Set an explicit follow-up checkpoint if first outreach is unanswered.',
      focusSkillTag: 'Persistence',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: timing precision and one-clear-ask messaging keep be-backs active.',
    adjustedApproach: 'Use a specific timing touchpoint and one direct question tied to their leaving reason.',
    focusSkillTag: 'Follow-Up',
  };
}
