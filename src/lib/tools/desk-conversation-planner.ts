import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const DESK_INVOLVEMENT_REASONS = [
  'price objection',
  'payment objection',
  'trade issue',
  'low urgency',
  'customer wants to leave',
  'manager introduction',
  'approval request',
  'final close support',
] as const;

export const DESK_CUSTOMER_POSTURES = [
  'open',
  'skeptical',
  'resistant',
  'confused',
  'emotionally detached',
] as const;

export const DESK_SALESPERSON_PROGRESS = [
  'strong',
  'decent',
  'unclear',
  'weak',
  'already lost momentum',
] as const;

export const DESK_URGENCY_LEVELS = [
  'low',
  'medium',
  'high',
] as const;

export type DeskInvolvementReason = typeof DESK_INVOLVEMENT_REASONS[number];
export type DeskCustomerPosture = typeof DESK_CUSTOMER_POSTURES[number];
export type DeskSalespersonProgress = typeof DESK_SALESPERSON_PROGRESS[number];
export type DeskUrgencyLevel = typeof DESK_URGENCY_LEVELS[number];

export type DeskConversationInput = {
  reason: DeskInvolvementReason;
  customerPosture: DeskCustomerPosture;
  salespersonProgress: DeskSalespersonProgress;
  urgency: DeskUrgencyLevel;
};

export type DeskConversationPlan = {
  bestEntryAngle: string;
  sayThisFirst: string;
  askThis: string;
  reinforceThis: string;
  doNotDoThis: string;
};

export type DeskConversationSprocketEnhancement = {
  likelyHiddenIssue: string;
  sharperManagerEntry: string;
  naturalRewrite: string;
  coaching: string;
};

export type DeskConversationCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Leadership' | 'Trust' | 'Tone' | 'Coaching Continuity';
};

export type DeskConversationSavedScenario = {
  id: string;
  createdAt: string;
  reason: DeskInvolvementReason;
  customerPosture: DeskCustomerPosture;
  salespersonProgress: DeskSalespersonProgress;
  urgency: DeskUrgencyLevel;
  bestEntryAngle: string;
  sayThisFirst: string;
  askThis: string;
  reinforceThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_REASON: Record<DeskInvolvementReason, DeskConversationPlan> = {
  'price objection': {
    bestEntryAngle: 'Diagnose value gap before discussing number movement.',
    sayThisFirst: 'I appreciate the clarity. Before we adjust anything, I want to understand exactly what feels off.',
    askThis: 'Compared to your expectation, which part feels most misaligned right now?',
    reinforceThis: 'Salesperson has already narrowed fit; we are now focused on one pricing concern.',
    doNotDoThis: 'Do not start by discounting to gain control.',
  },
  'payment objection': {
    bestEntryAngle: 'Reframe around payment-fit and structure clarity.',
    sayThisFirst: 'Let us keep this simple and focus on what payment feels sustainable for you.',
    askThis: 'What monthly range feels comfortable without stretching?',
    reinforceThis: 'Salesperson did the right work on fit; this is now structure optimization.',
    doNotDoThis: 'Do not overwhelm with multiple payment options too fast.',
  },
  'trade issue': {
    bestEntryAngle: 'Use transparency-first trade framing and reconnect to full deal.',
    sayThisFirst: 'I want this to be clear and fair. Let us review how trade value was built.',
    askThis: 'What trade outcome were you expecting so we can compare clearly?',
    reinforceThis: 'Salesperson kept the deal aligned; this step is valuation clarity.',
    doNotDoThis: 'Do not argue trade value emotionally.',
  },
  'low urgency': {
    bestEntryAngle: 'Create relevance and a low-pressure next commitment.',
    sayThisFirst: 'No pressure from me. I just want to help you decide with the clearest next step.',
    askThis: 'What would need to be true for moving forward to make sense now?',
    reinforceThis: 'Salesperson built good context; we are now aligning timing and priority.',
    doNotDoThis: 'Do not force urgency language before confirming interest drivers.',
  },
  'customer wants to leave': {
    bestEntryAngle: 'Use brief de-escalation and one last clarity checkpoint.',
    sayThisFirst: 'Before you head out, give me 60 seconds to make sure you leave with your clearest option.',
    askThis: 'What one condition would make staying today worth it?',
    reinforceThis: 'Salesperson made progress; we are simply trying to clarify one final blocker.',
    doNotDoThis: 'Do not block exit or pressure physically/socially.',
  },
  'manager introduction': {
    bestEntryAngle: 'Support continuity and trust without overpowering the salesperson.',
    sayThisFirst: 'Great to meet you. You are in good hands, and I am here to help keep this smooth and clear.',
    askThis: 'What is the main thing you want solved before deciding next step?',
    reinforceThis: 'Salesperson has already done strong groundwork and remains your primary guide.',
    doNotDoThis: 'Do not reset conversation from scratch.',
  },
  'approval request': {
    bestEntryAngle: 'Confirm seriousness, define request, deliver clear yes/no path.',
    sayThisFirst: 'Let us make this clean. I want to confirm exactly what needs approval and why.',
    askThis: 'If we solve this one approval point, are you ready to move forward?',
    reinforceThis: 'Salesperson has already aligned the core deal; this is final checkpoint support.',
    doNotDoThis: 'Do not promise approval before validating details.',
  },
  'final close support': {
    bestEntryAngle: 'Protect momentum and simplify commitment language.',
    sayThisFirst: 'Looks like you are close. Let us finalize this in the most straightforward way.',
    askThis: 'Is there one remaining item we should clear before wrapping up?',
    reinforceThis: 'Salesperson guided this well; we are now helping with final clarity.',
    doNotDoThis: 'Do not take credit from salesperson or change tone abruptly.',
  },
};

const POSTURE_ADJUSTMENTS: Partial<Record<DeskCustomerPosture, Partial<DeskConversationPlan>>> = {
  open: {},
  skeptical: {
    bestEntryAngle: 'Lead with transparency and avoid authority-heavy language.',
    askThis: 'What specifically would help you trust this path more?',
  },
  resistant: {
    sayThisFirst: 'I am not here to pressure you. I want to understand what feels off before anything else.',
    doNotDoThis: 'Do not escalate intensity to overpower resistance.',
  },
  confused: {
    bestEntryAngle: 'Simplify deal into one clear path and one backup option.',
    askThis: 'Which part feels unclear so we can clean it up first?',
  },
  'emotionally detached': {
    bestEntryAngle: 'Re-engage gently with relevance and low-pressure options.',
    askThis: 'What would make this feel worth moving forward today?',
  },
};

const PROGRESS_ADJUSTMENTS: Partial<Record<DeskSalespersonProgress, Partial<DeskConversationPlan>>> = {
  strong: {
    reinforceThis: 'Salesperson has done strong work; manager role is alignment and final support.',
  },
  decent: {},
  unclear: {
    reinforceThis: 'Salesperson started key steps; manager will help tighten clarity and direction.',
  },
  weak: {
    bestEntryAngle: 'Stabilize trust and reset structure without undermining the salesperson publicly.',
    doNotDoThis: 'Do not criticize the salesperson in front of the customer.',
  },
  'already lost momentum': {
    bestEntryAngle: 'Run a quick reset with one diagnostic question before any close attempt.',
    sayThisFirst: 'Let us reset this in a simpler way so you can decide clearly.',
  },
};

const URGENCY_ADJUSTMENTS: Partial<Record<DeskUrgencyLevel, Partial<DeskConversationPlan>>> = {
  low: {},
  medium: {},
  high: {
    askThis: 'If we solve this now, are you comfortable taking the next step today?',
    doNotDoThis: 'Do not fake urgency signals; keep urgency factual and relevant.',
  },
};

export function getDeskConversationPlan(input: DeskConversationInput): DeskConversationPlan {
  const base = BASE_BY_REASON[input.reason];
  const posture = POSTURE_ADJUSTMENTS[input.customerPosture];
  const progress = PROGRESS_ADJUSTMENTS[input.salespersonProgress];
  const urgency = URGENCY_ADJUSTMENTS[input.urgency];

  return {
    bestEntryAngle: urgency?.bestEntryAngle || progress?.bestEntryAngle || posture?.bestEntryAngle || base.bestEntryAngle,
    sayThisFirst: urgency?.sayThisFirst || progress?.sayThisFirst || posture?.sayThisFirst || base.sayThisFirst,
    askThis: urgency?.askThis || progress?.askThis || posture?.askThis || base.askThis,
    reinforceThis: urgency?.reinforceThis || progress?.reinforceThis || posture?.reinforceThis || base.reinforceThis,
    doNotDoThis: urgency?.doNotDoThis || progress?.doNotDoThis || posture?.doNotDoThis || base.doNotDoThis,
  };
}

export function getSprocketDeskConversationEnhancement(
  input: DeskConversationInput,
  base: DeskConversationPlan
): DeskConversationSprocketEnhancement {
  const likelyHiddenIssue =
    input.customerPosture === 'resistant' || input.customerPosture === 'skeptical'
      ? 'Hidden issue is likely trust and control, not just pricing.'
      : input.salespersonProgress === 'already lost momentum'
        ? 'Hidden issue is momentum collapse from unclear next step ownership.'
        : 'Hidden issue is often ambiguity around the true blocker.';

  return {
    likelyHiddenIssue,
    sharperManagerEntry: `${base.bestEntryAngle} Keep manager role as clarifier, not closer-first enforcer.`,
    naturalRewrite: `Try this opening: ${base.sayThisFirst}`,
    coaching: 'Confirm salesperson progress first, then ask one question, then bridge. Do not over-talk.',
  };
}

type SkillSignals = {
  leadershipLow: boolean;
  trustLow: boolean;
  toneLow: boolean;
  coachingLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const leadership = readCxStatScore(stats?.closing, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const coaching = readCxStatScore(stats?.followUp, 60);

  return {
    leadershipLow: leadership > 0 && leadership < 55,
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    coachingLow: coaching > 0 && coaching < 55,
  };
}

export function getAutoDriveCxDeskConversationEnhancement(
  input: DeskConversationInput,
  base: DeskConversationPlan,
  user?: User | null
): DeskConversationCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.leadershipLow) {
    return {
      tailoredReason: 'Tailored for your leadership trend: cleaner entry structure improves deal control.',
      adjustedApproach: 'Use a 3-step manager entry: align, diagnose, then direct next step.',
      focusSkillTag: 'Leadership',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: lower-pressure language increases acceptance.',
      adjustedApproach: `${base.sayThisFirst} Add explicit transparency and customer-control wording.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: concise, calm language reduces defensiveness.',
      adjustedApproach: 'Keep opening to one sentence and avoid stacked authority statements.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.coachingLow) {
    return {
      tailoredReason: 'Tailored for your coaching trend: manager-seller continuity should be made explicit.',
      adjustedApproach: `${base.reinforceThis} Then hand control back to salesperson for next step execution.`,
      focusSkillTag: 'Coaching Continuity',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced entry and continuity are recommended.',
    adjustedApproach: base.bestEntryAngle,
    focusSkillTag: 'Coaching Continuity',
  };
}
