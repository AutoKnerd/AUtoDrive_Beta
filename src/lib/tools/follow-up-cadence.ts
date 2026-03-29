import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const FOLLOW_UP_DEAL_STATUSES = [
  'No decision after visit',
  'Showed numbers, no commitment',
  'Needs to think about it',
  'Shopping other stores',
  'Sent numbers remotely',
  'Missed appointment',
  'Be-back customer',
  'Sold elsewhere (win-back attempt)',
] as const;

export const FOLLOW_UP_DURATIONS = [3, 5, 7, 10] as const;

export const FOLLOW_UP_CUSTOMER_TYPES = [
  'Highly engaged',
  'Neutral',
  'Low engagement',
  'Price-focused',
  'Payment-focused',
] as const;

export const FOLLOW_UP_ACTION_TYPES = ['Call', 'Text', 'Email', 'Video'] as const;

export type FollowUpDealStatus = typeof FOLLOW_UP_DEAL_STATUSES[number];
export type FollowUpDuration = typeof FOLLOW_UP_DURATIONS[number];
export type FollowUpCustomerType = typeof FOLLOW_UP_CUSTOMER_TYPES[number];
export type FollowUpActionType = typeof FOLLOW_UP_ACTION_TYPES[number];

export type FollowUpInput = {
  dealStatus: FollowUpDealStatus;
  days: FollowUpDuration;
  customerType?: FollowUpCustomerType;
  notes?: string;
};

export type FollowUpCadenceDay = {
  day: number;
  action: FollowUpActionType;
  do: string;
  say: string;
};

export type FollowUpCadence = {
  title: string;
  summary: string;
  goal: string;
  days: FollowUpCadenceDay[];
};

export type FollowUpSprocketEnhancement = {
  likelyStallReason: string;
  smarterCadenceShift: string;
  messageRewriteTip: string;
  deliveryCoaching: string;
};

export type FollowUpCxEnhancement = {
  tailoredReason: string;
  cadenceAdjustment: string;
  focusSkillTag: 'Follow-Up' | 'Tone' | 'Consistency';
};

export type FollowUpSavedScenario = {
  id: string;
  createdAt: string;
  dealStatus: FollowUpDealStatus;
  days: FollowUpDuration;
  customerType: FollowUpCustomerType;
  goal: string;
  summary: string;
  favorite?: boolean;
};

type CadenceTemplate = {
  goal: string;
  summary: string;
  startAction: FollowUpActionType;
  doPrompts: string[];
  sayPrompts: string[];
};

const ACTION_SEQUENCE: FollowUpActionType[] = ['Text', 'Call', 'Email', 'Text', 'Call', 'Video', 'Text', 'Email', 'Call', 'Text'];

const TEMPLATE_BY_STATUS: Record<FollowUpDealStatus, CadenceTemplate> = {
  'No decision after visit': {
    goal: 'Re-engage and identify the unresolved blocker',
    summary: 'Light re-engagement first, then focused clarification and clear next-step ask.',
    startAction: 'Text',
    doPrompts: [
      'Reference visit and lower pressure',
      'Ask what is still unclear',
      'Reinforce fit and value briefly',
      'Offer one clear next option',
    ],
    sayPrompts: [
      'Quick check-in from your visit yesterday. Anything new come up after thinking it over?',
      'I can keep this simple, what is the one piece still holding you back?',
      'Based on what you liked, this still looks like a strong fit for your goals.',
      'If helpful, we can lock a quick next step and keep this easy.',
    ],
  },
  'Showed numbers, no commitment': {
    goal: 'Clarify number friction and regain momentum',
    summary: 'Diagnose what part of structure missed, then offer a clean path forward.',
    startAction: 'Call',
    doPrompts: [
      'Ask reaction to numbers first',
      'Isolate payment/price/trade concern',
      'Reframe value before defense',
      'Ask for commitment checkpoint',
    ],
    sayPrompts: [
      'Wanted to follow up on the numbers. Which part felt most off to you?',
      'If we fix that specific piece, would moving forward feel easier?',
      'I can keep this transparent and focused so you have a clear decision.',
      'Would a quick revisit today help you finalize this?',
    ],
  },
  'Needs to think about it': {
    goal: 'Turn vague pause into specific decision criteria',
    summary: 'Respect space while extracting the exact issue they need to resolve.',
    startAction: 'Text',
    doPrompts: [
      'Acknowledge decision process',
      'Ask what they are weighing',
      'Provide one concise comparison',
      'Set a follow-up checkpoint',
    ],
    sayPrompts: [
      'Totally fair to think it through. What part are you evaluating first?',
      'If I send one quick side-by-side, would that help your decision?',
      'I can keep this simple so your review time is focused.',
      'Would tomorrow afternoon be a good time to reconnect for 5 minutes?',
    ],
  },
  'Shopping other stores': {
    goal: 'Help customer compare accurately and preserve trust',
    summary: 'Comparison support first, then sharpen differences and ask for next step.',
    startAction: 'Email',
    doPrompts: [
      'Offer apples-to-apples comparison',
      'Clarify what they value most',
      'Differentiate with relevance not pressure',
      'Ask for final comparison call',
    ],
    sayPrompts: [
      'I can make your comparison easier with a clean apples-to-apples summary.',
      'What are your top two criteria so I line this up the right way?',
      'I want this to be clear, not salesy, so you can decide confidently.',
      'Once you compare, can we do a quick final review together?',
    ],
  },
  'Sent numbers remotely': {
    goal: 'Convert passive review into active conversation',
    summary: 'Concise follow-up to confirm receipt, then move toward live clarification.',
    startAction: 'Text',
    doPrompts: [
      'Confirm they received numbers',
      'Ask if any line is unclear',
      'Offer short call to simplify',
      'Set clear next action',
    ],
    sayPrompts: [
      'Checking in to make sure you got the numbers clearly.',
      'Was there any line you want me to simplify first?',
      'Happy to do a 5-minute call so this is easy to evaluate.',
      'If helpful, I can send one best-path summary now.',
    ],
  },
  'Missed appointment': {
    goal: 'Recover momentum and reschedule quickly',
    summary: 'No-guilt tone, quick rebook options, and low-friction re-entry.',
    startAction: 'Text',
    doPrompts: [
      'Acknowledge without blame',
      'Offer two rebook windows',
      'Reconfirm value of next step',
      'Lock commitment to new time',
    ],
    sayPrompts: [
      'No worries at all, want to find a better time that works for you?',
      'I have two quick windows open tomorrow if that helps.',
      'We can keep it short and focused on your main question.',
      'Which time should I reserve for you?',
    ],
  },
  'Be-back customer': {
    goal: 'Convert warm intent into commitment',
    summary: 'Confidence-based reminders and direct, clear asks.',
    startAction: 'Call',
    doPrompts: [
      'Reference prior positive signals',
      'Confirm what changed since last visit',
      'Reinforce best-fit rationale',
      'Ask directly for next commitment step',
    ],
    sayPrompts: [
      'You had great feedback last time, wanted to see what you are thinking now.',
      'What is the one thing you still want settled before moving forward?',
      'From what you shared, this still aligns really well with your priorities.',
      'Are you ready to lock in a next step today?',
    ],
  },
  'Sold elsewhere (win-back attempt)': {
    goal: 'Re-open conversation without pressure and preserve future opportunity',
    summary: 'Respect their decision, offer support, and keep relationship active.',
    startAction: 'Email',
    doPrompts: [
      'Congratulate and stay professional',
      'Offer help post-purchase',
      'Ask for feedback respectfully',
      'Keep relationship open for future',
    ],
    sayPrompts: [
      'Congrats on your purchase, and thank you for the chance to help.',
      'If any questions come up, I am happy to be a resource.',
      'If you are open to it, any feedback helps me improve.',
      'I would love to stay in touch for future needs.',
    ],
  },
};

const CUSTOMER_TYPE_TUNING: Record<FollowUpCustomerType, { spacingTone: string; messagingBias: string }> = {
  'Highly engaged': {
    spacingTone: 'Slightly more direct asks with tighter spacing.',
    messagingBias: 'Use confidence and clear commitment steps.',
  },
  Neutral: {
    spacingTone: 'Balanced cadence and neutral tone.',
    messagingBias: 'Keep message concise and practical.',
  },
  'Low engagement': {
    spacingTone: 'Lower pressure and stronger value per touch.',
    messagingBias: 'Short messages, fewer assumptions, clear opt-in asks.',
  },
  'Price-focused': {
    spacingTone: 'Frame value before numbers each time.',
    messagingBias: 'Emphasize comparison clarity and cost context.',
  },
  'Payment-focused': {
    spacingTone: 'Center affordability and structure options.',
    messagingBias: 'Lead with payment-fit language and simple trade-offs.',
  },
};

function rotateAction(dayIndex: number, preferred: FollowUpActionType): FollowUpActionType {
  if (dayIndex === 0) return preferred;
  return ACTION_SEQUENCE[dayIndex % ACTION_SEQUENCE.length];
}

function selectPrompt(prompts: string[], dayIndex: number): string {
  return prompts[dayIndex % prompts.length];
}

function refineForCustomerType(
  day: FollowUpCadenceDay,
  customerType: FollowUpCustomerType,
  dayIndex: number
): FollowUpCadenceDay {
  if (customerType === 'Low engagement') {
    return {
      ...day,
      do: `${day.do}. Keep this touch short and low-pressure.`,
      say: dayIndex === 0 ? `${day.say} No pressure at all, just keeping this easy for you.` : day.say,
    };
  }

  if (customerType === 'Price-focused') {
    return {
      ...day,
      do: `${day.do}. Reinforce value context before discussing price shifts.`,
    };
  }

  if (customerType === 'Payment-focused') {
    return {
      ...day,
      do: `${day.do}. Prioritize payment-fit language and sustainability.`,
    };
  }

  return day;
}

export function buildFollowUpCadence(input: FollowUpInput): FollowUpCadence {
  const template = TEMPLATE_BY_STATUS[input.dealStatus];
  const customerType = input.customerType || 'Neutral';
  const tuning = CUSTOMER_TYPE_TUNING[customerType];

  const days: FollowUpCadenceDay[] = Array.from({ length: input.days }, (_, idx) => {
    const baseDay: FollowUpCadenceDay = {
      day: idx + 1,
      action: rotateAction(idx, template.startAction),
      do: selectPrompt(template.doPrompts, idx),
      say: selectPrompt(template.sayPrompts, idx),
    };
    return refineForCustomerType(baseDay, customerType, idx);
  });

  return {
    title: 'Follow-Up Cadence',
    summary: `${template.summary} ${tuning.spacingTone}`,
    goal: template.goal,
    days,
  };
}

export function getSprocketFollowUpEnhancement(
  input: FollowUpInput,
  cadence: FollowUpCadence
): FollowUpSprocketEnhancement {
  const likelyStallReason = input.dealStatus === 'Showed numbers, no commitment'
    ? 'The customer likely stalled because the objection was not isolated before follow-up.'
    : input.customerType === 'Low engagement'
      ? 'Engagement is low because previous follow-ups likely felt generic or high-pressure.'
      : 'Momentum faded because the cadence lacked a clear progression and commitment ask.';

  return {
    likelyStallReason,
    smarterCadenceShift: 'Use shorter messages early, then one direct ask once clarity is restored.',
    messageRewriteTip: 'Reference the last interaction explicitly, then ask one specific question.',
    deliveryCoaching: 'Stay calm, concise, and never stack multiple asks in one touchpoint.',
  };
}

type SkillSignal = {
  followUpLow: boolean;
  trustLow: boolean;
  listeningLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignal {
  const stats = user?.stats;
  const followUp = readCxStatScore(stats?.followUp, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const listening = readCxStatScore(stats?.listening, 60);

  return {
    followUpLow: followUp > 0 && followUp < 55,
    trustLow: trust > 0 && trust < 55,
    listeningLow: listening > 0 && listening < 55,
  };
}

export function getAutoDriveCxFollowUpEnhancement(
  _input: FollowUpInput,
  _cadence: FollowUpCadence,
  user?: User | null
): FollowUpCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.followUpLow) {
    return {
      tailoredReason: 'Tailored to your consistency trend: simpler day-by-day structure improves execution.',
      cadenceAdjustment: 'Use one mandatory touch each day and set next-day prep reminder immediately after each outreach.',
      focusSkillTag: 'Consistency',
    };
  }

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored to your trust trend: lower-pressure language helps maintain response rates.',
      cadenceAdjustment: 'Replace hard asks with transparent check-ins until engagement improves.',
      focusSkillTag: 'Tone',
    };
  }

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored to your listening trend: question-first follow-up increases customer reply quality.',
      cadenceAdjustment: 'Each touch should include one clear question before any pitch language.',
      focusSkillTag: 'Follow-Up',
    };
  }

  return {
    tailoredReason: 'Tailored to your current pattern: keep cadence disciplined and concise to sustain momentum.',
    cadenceAdjustment: 'Maintain varied channels and end each touch with a single next-step prompt.',
    focusSkillTag: 'Follow-Up',
  };
}
