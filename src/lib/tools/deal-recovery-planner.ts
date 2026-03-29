import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const RECOVERY_SITUATIONS = [
  'customer went cold',
  'no decision after visit',
  'no reply after numbers',
  'payment objection stalled deal',
  'price objection stalled deal',
  'trade objection stalled deal',
  'lost momentum after test drive',
  'customer wants to shop around',
  'customer said need to think about it',
  'customer says spouse / other decision-maker',
  'customer stopped responding after follow-up',
  'customer seems interested but not moving',
  'manager TO did not land',
  'customer is about to leave',
  'deal feels stuck without a clear objection',
] as const;

export const CUSTOMER_STATUSES = [
  'in store now',
  'left the store today',
  '1 day later',
  '2 to 3 days later',
  '4 to 7 days later',
  'over a week later',
] as const;

export const CUSTOMER_MINDSETS = [
  'hesitant',
  'confused',
  'price-focused',
  'payment-focused',
  'skeptical',
  'low urgency',
  'emotionally detached',
  'still engaged',
  'resistant',
  'hard to read',
] as const;

export const RECOVERY_GOALS = [
  'reopen the conversation',
  'clarify the real issue',
  'rebuild trust',
  'regain momentum',
  'get commitment',
  'set next appointment',
  'recover from pricing reaction',
  'recover from silence',
] as const;

export type RecoverySituation = typeof RECOVERY_SITUATIONS[number];
export type CustomerStatus = typeof CUSTOMER_STATUSES[number];
export type CustomerMindset = typeof CUSTOMER_MINDSETS[number];
export type RecoveryGoal = typeof RECOVERY_GOALS[number];

export type DealRecoveryInput = {
  situation: RecoverySituation;
  customerStatus: CustomerStatus;
  customerMindset?: CustomerMindset;
  recoveryGoal?: RecoveryGoal;
  context?: string;
};

export type DealRecoveryPlan = {
  likelyBreakdown: string;
  bestRecoveryPath: string;
  nextMove: string;
  sayThis: string;
  doNotDoThis: string;
  whyThisWorks: string;
};

export type DealRecoverySprocketEnhancement = {
  probablyReallyHappening: string;
  betterRecoveryAngle: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  fallbackNextStep: string;
};

export type DealRecoveryCxEnhancement = {
  tailoredReason: string;
  skillAwareAdjustment: string;
  focusSkillTag: 'Trust' | 'Listening' | 'Follow-Up' | 'Recovery Control' | 'Tone';
};

export type DealRecoverySavedScenario = {
  id: string;
  createdAt: string;
  situation: RecoverySituation;
  customerStatus: CustomerStatus;
  customerMindset: CustomerMindset;
  recoveryGoal: RecoveryGoal;
  likelyBreakdown: string;
  bestRecoveryPath: string;
  nextMove: string;
  sayThis: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_SITUATION: Record<RecoverySituation, DealRecoveryPlan> = {
  'customer went cold': {
    likelyBreakdown: 'Momentum likely dropped because the follow-up had low specificity and no clear next step.',
    bestRecoveryPath: 'Re-enter with precision and one low-pressure question.',
    nextMove: 'Send a short, specific text tied to their original priority.',
    sayThis: 'Quick follow-up: is your main hold-up still payment fit, or did something else come up?',
    doNotDoThis: 'Do not send another generic "just checking in" message.',
    whyThisWorks: 'Specific outreach feels relevant and makes reply easier.',
  },
  'no decision after visit': {
    likelyBreakdown: 'They left with unresolved uncertainty, not necessarily a hard no.',
    bestRecoveryPath: 'Clarify the unresolved point before re-presenting anything.',
    nextMove: 'Call with one diagnostic question and one simple next-step option.',
    sayThis: 'After your visit, what felt most unsettled so I can help you decide clearly?',
    doNotDoThis: 'Do not jump straight into revised numbers.',
    whyThisWorks: 'Diagnosis-first follow-up reduces resistance and reopens conversation.',
  },
  'no reply after numbers': {
    likelyBreakdown: 'The structure likely created friction but the customer never voiced which part.',
    bestRecoveryPath: 'Re-open with clarity over pressure and isolate the real blocker.',
    nextMove: 'Send a clean message asking which line item feels most off.',
    sayThis: 'I can tighten this up quickly. Which part felt most off: payment, total, or trade?',
    doNotDoThis: 'Do not defend the numbers before they identify concern.',
    whyThisWorks: 'Isolating the friction point speeds meaningful re-engagement.',
  },
  'payment objection stalled deal': {
    likelyBreakdown: 'Payment concern may be affordability confidence, not pure price objection.',
    bestRecoveryPath: 'Reframe around comfort and structure options.',
    nextMove: 'Ask for target range, then narrow to one realistic path.',
    sayThis: 'What monthly range feels comfortable long-term so we solve this cleanly?',
    doNotDoThis: 'Do not stack multiple payment options at once.',
    whyThisWorks: 'A single focused path lowers overwhelm and improves trust.',
  },
  'price objection stalled deal': {
    likelyBreakdown: 'They may still be unconvinced on fit/value, not only reacting to amount.',
    bestRecoveryPath: 'Reset value context, then ask for the exact gap.',
    nextMove: 'Re-engage with value recap and one pinpoint question.',
    sayThis: 'Before we move numbers around, what part of value feels least clear right now?',
    doNotDoThis: 'Do not discount before understanding the concern.',
    whyThisWorks: 'Value clarity often resolves price tension more effectively than fast concessions.',
  },
  'trade objection stalled deal': {
    likelyBreakdown: 'Trust around trade valuation likely dropped.',
    bestRecoveryPath: 'Move to transparent explanation and verifiable logic.',
    nextMove: 'Walk through trade basis line by line and ask for reaction.',
    sayThis: 'I want this fully transparent. Want a quick line-by-line on how trade value was built?',
    doNotDoThis: 'Do not argue trade value emotionally.',
    whyThisWorks: 'Transparency rebuilds trust and turns conflict into review.',
  },
  'lost momentum after test drive': {
    likelyBreakdown: 'Positive emotion from drive did not convert into decision clarity.',
    bestRecoveryPath: 'Recap what they liked and identify the missing commitment piece.',
    nextMove: 'Use a short recap call and ask for the one unresolved item.',
    sayThis: 'You had strong feedback on the drive. What is the one item still keeping this open?',
    doNotDoThis: 'Do not skip straight to closing pressure.',
    whyThisWorks: 'Linking their own positives to one blocker restores direction.',
  },
  'customer wants to shop around': {
    likelyBreakdown: 'They want confidence and comparison safety before committing.',
    bestRecoveryPath: 'Support comparison with clear criteria and low pressure.',
    nextMove: 'Offer an apples-to-apples comparison summary.',
    sayThis: 'Happy to make comparison easier. What two criteria matter most so I align this cleanly?',
    doNotDoThis: 'Do not criticize other stores.',
    whyThisWorks: 'Confidence grows when you guide comparison instead of resisting it.',
  },
  'customer said need to think about it': {
    likelyBreakdown: 'This often signals unresolved risk, not just desire for time.',
    bestRecoveryPath: 'Turn vague delay into specific decision criteria.',
    nextMove: 'Ask what they need to think through first and simplify that item.',
    sayThis: 'Totally fair. What are you weighing first so I can make that part easy?',
    doNotDoThis: 'Do not ask for updates with no value.',
    whyThisWorks: 'Specificity converts stalls into actionable next steps.',
  },
  'customer says spouse / other decision-maker': {
    likelyBreakdown: 'Decision confidence is externalized because concerns are still unresolved.',
    bestRecoveryPath: 'Equip them with a clear review summary and one next checkpoint.',
    nextMove: 'Provide concise summary and schedule short follow-up time.',
    sayThis: 'Let us make this easy to review together. What question will they ask first?',
    doNotDoThis: 'Do not pressure them to decide without the other person.',
    whyThisWorks: 'Prepared review reduces delay and keeps momentum alive.',
  },
  'customer stopped responding after follow-up': {
    likelyBreakdown: 'Message fatigue likely set in from low-precision outreach.',
    bestRecoveryPath: 'Reduce frequency and increase relevance per touch.',
    nextMove: 'Pause briefly, then send one high-value re-entry message.',
    sayThis: 'One quick reset: do you want a clear best-path option, or should I close this out for now?',
    doNotDoThis: 'Do not continue daily check-ins with no new value.',
    whyThisWorks: 'A respectful reset lowers pressure and prompts cleaner responses.',
  },
  'customer seems interested but not moving': {
    likelyBreakdown: 'Interest exists, but urgency and decision clarity are weak.',
    bestRecoveryPath: 'Create a smaller commitment step to restart motion.',
    nextMove: 'Offer a low-friction next step with a clear time anchor.',
    sayThis: 'Would a quick 10-minute revisit tomorrow help you finalize this with less back-and-forth?',
    doNotDoThis: 'Do not keep repeating the full pitch.',
    whyThisWorks: 'Micro-commitments rebuild movement without heavy pressure.',
  },
  'manager TO did not land': {
    likelyBreakdown: 'The transition likely felt like escalation instead of support.',
    bestRecoveryPath: 'Re-establish trust and ownership with a calmer re-entry.',
    nextMove: 'Reset with transparent language and a single clarifying question.',
    sayThis: 'I want to reset this in a cleaner way. What felt off in that last step?',
    doNotDoThis: 'Do not ignore the failed handoff moment.',
    whyThisWorks: 'Acknowledging friction directly rebuilds control and trust.',
  },
  'customer is about to leave': {
    likelyBreakdown: 'Pressure and uncertainty are peaking at the same time.',
    bestRecoveryPath: 'Use a brief, low-pressure stop-and-clarify move.',
    nextMove: 'Ask for 60 seconds to isolate one solvable blocker.',
    sayThis: 'Before you go, give me 60 seconds to make sure you leave with your clearest option.',
    doNotDoThis: 'Do not chase with urgency language or guilt.',
    whyThisWorks: 'A short, respectful pause can recover clarity before they exit.',
  },
  'deal feels stuck without a clear objection': {
    likelyBreakdown: 'The real concern is hidden, and conversation is circling.',
    bestRecoveryPath: 'Run a direct diagnosis pass before any persuasion.',
    nextMove: 'Ask one binary diagnostic question to uncover true blocker type.',
    sayThis: 'If we fixed one thing right now, would it be confidence in fit, numbers, or timing?',
    doNotDoThis: 'Do not keep pushing without a diagnosed issue.',
    whyThisWorks: 'Clear diagnosis unlocks a targeted recovery path.',
  },
};

const STATUS_ADJUSTMENTS: Record<CustomerStatus, Partial<DealRecoveryPlan>> = {
  'in store now': {
    bestRecoveryPath: 'Use live, low-pressure clarification and secure a small commitment before they disengage.',
  },
  'left the store today': {
    nextMove: 'Send a same-day follow-up while details are still fresh.',
  },
  '1 day later': {
    nextMove: 'Use a direct call or concise text that asks for one reaction point.',
  },
  '2 to 3 days later': {
    bestRecoveryPath: 'Re-open with value and relevance before asking for decision movement.',
  },
  '4 to 7 days later': {
    nextMove: 'Use a reset message with one clear option to re-engage.',
    doNotDoThis: 'Do not resume as if there was no gap in communication.',
  },
  'over a week later': {
    bestRecoveryPath: 'Use respectful re-entry and permission-based follow-up.',
    nextMove: 'Send a close-loop message that offers one final helpful option.',
    doNotDoThis: 'Do not restart with high-pressure closing language.',
  },
};

function applyMindset(plan: DealRecoveryPlan, mindset: CustomerMindset): DealRecoveryPlan {
  if (mindset === 'confused') {
    return {
      ...plan,
      bestRecoveryPath: 'Simplify to one path and one question before adding detail.',
      sayThis: `${plan.sayThis} I can keep this to one clear option so it is easy to evaluate.`,
    };
  }
  if (mindset === 'skeptical') {
    return {
      ...plan,
      bestRecoveryPath: 'Lead with transparency and verification language.',
      doNotDoThis: 'Do not use vague claims or pressure framing.',
    };
  }
  if (mindset === 'low urgency' || mindset === 'emotionally detached') {
    return {
      ...plan,
      nextMove: 'Offer a low-friction next step with a specific time anchor.',
    };
  }
  if (mindset === 'price-focused' || mindset === 'payment-focused') {
    return {
      ...plan,
      bestRecoveryPath: 'Diagnose whether concern is true affordability or confidence gap before adjusting.',
    };
  }
  if (mindset === 'resistant') {
    return {
      ...plan,
      sayThis: `${plan.sayThis} If now is not right, that is okay. I only want to make your next step clearer.`,
    };
  }
  if (mindset === 'still engaged') {
    return {
      ...plan,
      nextMove: 'Move to a direct commitment checkpoint with one clear option.',
    };
  }
  return plan;
}

function applyGoal(plan: DealRecoveryPlan, goal: RecoveryGoal): DealRecoveryPlan {
  if (goal === 'rebuild trust') {
    return {
      ...plan,
      bestRecoveryPath: 'Slow the pace, increase transparency, and confirm customer priorities before any ask.',
    };
  }
  if (goal === 'set next appointment') {
    return {
      ...plan,
      nextMove: 'Offer two short appointment windows and ask them to choose one.',
    };
  }
  if (goal === 'get commitment') {
    return {
      ...plan,
      nextMove: 'Use a conditional close after confirming the last blocker.',
    };
  }
  if (goal === 'recover from silence') {
    return {
      ...plan,
      sayThis: 'I do not want to over-message you. Should I send one best-path option or pause for now?',
    };
  }
  if (goal === 'recover from pricing reaction') {
    return {
      ...plan,
      bestRecoveryPath: 'Re-anchor value and isolate the exact number concern before any adjustment.',
    };
  }
  return plan;
}

export function getDealRecoveryPlan(input: DealRecoveryInput): DealRecoveryPlan {
  const base = BASE_BY_SITUATION[input.situation];
  const status = STATUS_ADJUSTMENTS[input.customerStatus];

  let plan: DealRecoveryPlan = {
    likelyBreakdown: status.likelyBreakdown || base.likelyBreakdown,
    bestRecoveryPath: status.bestRecoveryPath || base.bestRecoveryPath,
    nextMove: status.nextMove || base.nextMove,
    sayThis: status.sayThis || base.sayThis,
    doNotDoThis: status.doNotDoThis || base.doNotDoThis,
    whyThisWorks: status.whyThisWorks || base.whyThisWorks,
  };

  if (input.customerMindset) {
    plan = applyMindset(plan, input.customerMindset);
  }

  if (input.recoveryGoal) {
    plan = applyGoal(plan, input.recoveryGoal);
  }

  if (input.context?.trim()) {
    plan = {
      ...plan,
      whyThisWorks: `${plan.whyThisWorks} This recommendation also accounted for your deal context note.`,
    };
  }

  return plan;
}

export function getSprocketDealRecoveryEnhancement(
  input: DealRecoveryInput,
  base: DealRecoveryPlan
): DealRecoverySprocketEnhancement {
  const probablyReallyHappening =
    input.customerStatus === 'in store now' || input.customerStatus === 'left the store today'
      ? 'The customer is likely overloaded and uncertain, not fully opposed.'
      : input.customerStatus === 'over a week later'
        ? 'The deal likely faded from urgency, and your re-entry needs precision more than persistence.'
        : 'The customer likely has an unresolved concern that was never isolated directly.';

  return {
    probablyReallyHappening,
    betterRecoveryAngle: `${base.bestRecoveryPath} Keep the next move to one clear action and one question.`,
    naturalRewrite: `Try this: ${base.sayThis}`,
    deliveryCoaching: 'Keep your pace calm and concise. Ask one question, then pause instead of filling silence.',
    fallbackNextStep: 'If no response, use one final close-loop message offering either a quick reset call or a respectful pause.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  listeningLow: boolean;
  followUpLow: boolean;
  controlLow: boolean;
  toneLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = readCxStatScore(stats?.trust, 60);
  const listening = readCxStatScore(stats?.listening, 60);
  const followUp = readCxStatScore(stats?.followUp, 60);
  const control = readCxStatScore(stats?.closing, 60);

  return {
    trustLow: trust > 0 && trust < 55,
    listeningLow: listening > 0 && listening < 55,
    followUpLow: followUp > 0 && followUp < 55,
    controlLow: control > 0 && control < 55,
    toneLow: listening > 0 && listening < 50,
  };
}

export function getAutoDriveCxDealRecoveryEnhancement(
  input: DealRecoveryInput,
  base: DealRecoveryPlan,
  user?: User | null
): DealRecoveryCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: transparent language improves recovery acceptance.',
      skillAwareAdjustment: `${base.bestRecoveryPath} Add explicit transparency and permission-based phrasing.`,
      focusSkillTag: 'Trust',
    };
  }
  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored for your listening trend: question-led recovery improves diagnosis quality.',
      skillAwareAdjustment: 'Lead with one clarifying question before proposing any solution.',
      focusSkillTag: 'Listening',
    };
  }
  if (signal.followUpLow) {
    return {
      tailoredReason: 'Tailored for your follow-up trend: simpler cadence improves execution consistency.',
      skillAwareAdjustment: 'Use a strict two-step recovery sequence: diagnostic touch, then appointment ask.',
      focusSkillTag: 'Follow-Up',
    };
  }
  if (signal.controlLow) {
    return {
      tailoredReason: 'Tailored for your recovery control trend: stronger structure prevents random re-entry.',
      skillAwareAdjustment: `${base.nextMove} Keep ownership language and one explicit next checkpoint.`,
      focusSkillTag: 'Recovery Control',
    };
  }
  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: shorter, calmer phrasing lowers resistance.',
      skillAwareAdjustment: 'Trim outreach to one sentence and one question; avoid stacked explanations.',
      focusSkillTag: 'Tone',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced recovery structure and tone are recommended.',
    skillAwareAdjustment: base.bestRecoveryPath,
    focusSkillTag: 'Recovery Control',
  };
}
