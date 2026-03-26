import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const MPI_ITEM_LEVELS = [
  'red',
  'yellow',
  'green',
] as const;

export const MPI_URGENCY_LEVELS = [
  'low',
  'moderate',
  'high',
  'critical',
] as const;

export const MPI_CUSTOMER_ATTITUDES = [
  'practical',
  'anxious',
  'skeptical',
  'overwhelmed',
  'neutral',
] as const;

export type MpiItemLevel = typeof MPI_ITEM_LEVELS[number];
export type MpiUrgencyLevel = typeof MPI_URGENCY_LEVELS[number];
export type MpiCustomerAttitude = typeof MPI_CUSTOMER_ATTITUDES[number];

export type MpiConversationInput = {
  priorityStack: MpiItemLevel[];
  urgencyLevel: MpiUrgencyLevel;
  budgetSensitivity: number;
  customerAttitude?: MpiCustomerAttitude | null;
};

export type MpiConversationPlan = {
  bestOrderToPresent: string;
  leadWithThis: string;
  howToFrameUrgency: string;
  askThis: string;
  doNotDoThis: string;
};

export type MpiConversationSprocketEnhancement = {
  sharperSequencing: string;
  clearerWording: string;
  naturalRewrite: string;
  simplificationCoaching: string;
};

export type MpiConversationCxEnhancement = {
  tailoredReason: string;
  adjustedApproach: string;
  focusSkillTag: 'Clarity' | 'Trust' | 'Tone' | 'Listening';
};

export type MpiConversationSavedScenario = {
  id: string;
  createdAt: string;
  priorityStack: MpiItemLevel[];
  urgencyLevel: MpiUrgencyLevel;
  budgetSensitivity: number;
  customerAttitude?: MpiCustomerAttitude | null;
  bestOrderToPresent: string;
  leadWithThis: string;
  howToFrameUrgency: string;
  askThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function defaultStack(stack: MpiItemLevel[]): MpiItemLevel[] {
  return stack.length > 0 ? stack : ['red', 'yellow', 'green'];
}

function readableStack(stack: MpiItemLevel[]): string {
  return stack.map((item, index) => `${index + 1}. ${item.toUpperCase()} items`).join(' -> ');
}

function leadLine(stack: MpiItemLevel[], urgency: MpiUrgencyLevel): string {
  const top = stack[0];
  if (top === 'red') {
    return urgency === 'critical'
      ? 'Lead with one critical red item and immediate safety relevance.'
      : 'Lead with the highest-impact red item in plain language.';
  }
  if (top === 'yellow') {
    return 'Lead with the most time-sensitive yellow item and explain what waiting changes.';
  }
  return 'Lead with value and maintenance planning before moving through lower-risk items.';
}

function urgencyFraming(input: MpiConversationInput): string {
  if (input.urgencyLevel === 'critical') {
    return 'Use direct urgency framing: safety risk, consequence of delay, and clear immediate recommendation.';
  }
  if (input.urgencyLevel === 'high') {
    return 'Use near-term urgency framing with practical risk, not fear language.';
  }
  if (input.budgetSensitivity > 65) {
    return 'Use staged urgency framing: now vs soon vs monitor, with clear prioritization.';
  }
  return 'Use balanced urgency framing tied to reliability and prevention.';
}

function askLine(input: MpiConversationInput): string {
  if (input.customerAttitude === 'overwhelmed') {
    return 'Would it help if we simplify this into must-do now, should-do soon, and watch items?';
  }
  if (input.customerAttitude === 'skeptical') {
    return 'Which item would you like me to walk through first so the recommendation feels fully clear?';
  }
  if (input.budgetSensitivity > 65) {
    return 'Would you like a priority-first plan that handles the most urgent item today and phases the rest?';
  }
  return 'Do you want to handle the highest-priority items now while your vehicle is already here?';
}

function doNotLine(input: MpiConversationInput): string {
  if (input.customerAttitude === 'anxious' || input.customerAttitude === 'overwhelmed') {
    return 'Do not read the full MPI list without grouping and priority context.';
  }
  if (input.customerAttitude === 'skeptical') {
    return 'Do not push approval before explaining why each priority level matters.';
  }
  return 'Do not present MPI items in random order without urgency grouping.';
}

export function getMpiConversationPlan(input: MpiConversationInput): MpiConversationPlan {
  const normalizedStack = defaultStack(input.priorityStack);
  const normalizedBudget = clamp(input.budgetSensitivity);
  const normalizedInput: MpiConversationInput = {
    ...input,
    priorityStack: normalizedStack,
    budgetSensitivity: normalizedBudget,
  };

  return {
    bestOrderToPresent: readableStack(normalizedStack),
    leadWithThis: leadLine(normalizedStack, normalizedInput.urgencyLevel),
    howToFrameUrgency: urgencyFraming(normalizedInput),
    askThis: askLine(normalizedInput),
    doNotDoThis: doNotLine(normalizedInput),
  };
}

export function getSprocketMpiConversationEnhancement(
  input: MpiConversationInput,
  base: MpiConversationPlan
): MpiConversationSprocketEnhancement {
  const sharperSequencing =
    input.customerAttitude === 'overwhelmed'
      ? 'Use 3-bucket sequence: immediate safety, near-term reliability, future maintenance.'
      : `Use priority sequence with one key example per level: ${base.bestOrderToPresent}`;

  return {
    sharperSequencing,
    clearerWording: `${base.howToFrameUrgency} Keep wording practical and customer-centered.`,
    naturalRewrite: `Try this opener: ${base.leadWithThis}`,
    simplificationCoaching: 'Use fewer items per segment, confirm understanding, then move to the next bucket.',
  };
}

type SkillSignals = {
  clarityLow: boolean;
  trustLow: boolean;
  toneLow: boolean;
  listeningLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const clarity = readCxStatScore(stats?.closing, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const tone = readCxStatScore(stats?.listening, 60);
  const listening = readCxStatScore(stats?.followUp, 60);

  return {
    clarityLow: clarity > 0 && clarity < 55,
    trustLow: trust > 0 && trust < 55,
    toneLow: tone > 0 && tone < 55,
    listeningLow: listening > 0 && listening < 55,
  };
}

export function getAutoDriveCxMpiConversationEnhancement(
  _input: MpiConversationInput,
  _base: MpiConversationPlan,
  user?: User | null
): MpiConversationCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.clarityLow) {
    return {
      tailoredReason: 'Tailored to clarity trend: tighter grouping improves customer understanding.',
      adjustedApproach: 'Present MPI in 3 buckets only, then confirm understanding before asking for approval.',
      focusSkillTag: 'Clarity',
    };
  }
  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to trust trend: transparent priority logic increases acceptance.',
      adjustedApproach: 'Explain why each item is prioritized before discussing total cost.',
      focusSkillTag: 'Trust',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored to tone trend: calmer language lowers resistance during MPI discussions.',
      adjustedApproach: 'Use plain-language, non-urgent tone for non-critical items.',
      focusSkillTag: 'Tone',
    };
  }
  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored to listening trend: response checks improve buy-in.',
      adjustedApproach: 'After each priority bucket, ask one short understanding question.',
      focusSkillTag: 'Listening',
    };
  }

  return {
    tailoredReason: 'Tailored from your profile: structured MPI flow improves clarity and approvals.',
    adjustedApproach: 'Lead with top priority, group logically, then ask for a clear next-step decision.',
    focusSkillTag: 'Clarity',
  };
}
