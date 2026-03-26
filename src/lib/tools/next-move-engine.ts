import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const NEXT_MOVE_STAGES = [
  'Greeting',
  'Needs Assessment',
  'Vehicle Selection',
  'Walkaround',
  'Test Drive',
  'Post Test Drive',
  'Presenting Numbers',
  'Trade Discussion',
  'Objection / Hesitation',
  'Follow-Up / No Decision',
  'Closing / Ask for Commitment',
] as const;

export const NEXT_MOVE_BEHAVIORS = [
  'Neutral / no special behavior',
  'Hesitating',
  'Price-focused',
  'Payment-focused',
  'Confused',
  'Distracted',
  'Rushing',
  'Skeptical',
  'Not opening up',
  'Comparing other stores',
  'Wants to leave',
  'Needs spouse / third-party approval',
  'Says “I need to think about it”',
  'Says “just looking”',
  'Says “send me numbers”',
] as const;

export const NEXT_MOVE_CHANNELS = ['In-store', 'Phone/Text'] as const;
export const NEXT_MOVE_VISIT_TYPES = ['First Visit', 'Repeat Visit'] as const;

export type NextMoveStage = typeof NEXT_MOVE_STAGES[number];
export type NextMoveBehavior = typeof NEXT_MOVE_BEHAVIORS[number];
export type NextMoveChannel = typeof NEXT_MOVE_CHANNELS[number];
export type NextMoveVisitType = typeof NEXT_MOVE_VISIT_TYPES[number];

export type NextMoveModifiers = {
  visitType?: NextMoveVisitType;
  channel?: NextMoveChannel;
  tradeInvolved?: boolean;
  managerEngaged?: boolean;
};

export type NextMoveInput = {
  stage: NextMoveStage;
  behavior?: NextMoveBehavior;
  modifiers?: NextMoveModifiers;
};

export type NextMoveBaseRecommendation = {
  sayThisNext: string;
  askThisQuestion: string;
  doNotDoThis: string;
  whyThisWorks: string;
};

export type NextMoveSprocketRecommendation = {
  likelyIssue: string;
  sharperNextMove: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type NextMoveCxRecommendation = {
  tailoredReason: string;
  adaptedLine: string;
  focusSkillTag: 'Listening' | 'Trust' | 'Tone' | 'Follow-Up';
};

const BASE_BY_STAGE: Record<NextMoveStage, NextMoveBaseRecommendation> = {
  Greeting: {
    sayThisNext: 'Welcome in. I can keep this quick and useful, then you decide the pace.',
    askThisQuestion: 'What matters most for your next vehicle today?',
    doNotDoThis: 'Do not start with a long dealership pitch.',
    whyThisWorks: 'It lowers pressure and gets to customer intent quickly.',
  },
  'Needs Assessment': {
    sayThisNext: 'Let me make sure we solve the right problem first.',
    askThisQuestion: 'What would make this a win for you by the time you leave?',
    doNotDoThis: 'Do not jump into inventory before clarity.',
    whyThisWorks: 'Clear priorities prevent random vehicle bouncing.',
  },
  'Vehicle Selection': {
    sayThisNext: 'Based on what you shared, these are your top two fits.',
    askThisQuestion: 'Which one feels closer to what you actually need daily?',
    doNotDoThis: 'Do not show too many options at once.',
    whyThisWorks: 'Narrowing choices reduces indecision and fatigue.',
  },
  Walkaround: {
    sayThisNext: 'I will show only what connects to your priorities.',
    askThisQuestion: 'Which feature would you use most in your normal week?',
    doNotDoThis: 'Do not feature dump every spec.',
    whyThisWorks: 'Relevance keeps attention and builds perceived value.',
  },
  'Test Drive': {
    sayThisNext: 'As you drive, call out anything that feels off or right.',
    askThisQuestion: 'What do you notice first about comfort, visibility, and confidence?',
    doNotDoThis: 'Do not fill every silence with talking.',
    whyThisWorks: 'Customer-led observations create ownership and trust.',
  },
  'Post Test Drive': {
    sayThisNext: 'Great. Let us lock in what felt strongest before we move forward.',
    askThisQuestion: 'What felt best, and what still feels uncertain?',
    doNotDoThis: 'Do not rush straight to price without a recap.',
    whyThisWorks: 'Recap bridges emotion to decision logic.',
  },
  'Presenting Numbers': {
    sayThisNext: 'I will keep this simple and tie each number to your priority.',
    askThisQuestion: 'Which part do you want to tackle first: vehicle value, trade, or monthly?',
    doNotDoThis: 'Do not defend price before understanding concern.',
    whyThisWorks: 'It frames numbers as a joint problem-solving step.',
  },
  'Trade Discussion': {
    sayThisNext: 'I want this trade discussion transparent and easy to verify.',
    askThisQuestion: 'Would you like to review how this value was built line by line?',
    doNotDoThis: 'Do not argue trade value emotionally.',
    whyThisWorks: 'Transparency reduces trust erosion around trade values.',
  },
  'Objection / Hesitation': {
    sayThisNext: 'Fair concern. Let us isolate the real blocker before we solve it.',
    askThisQuestion: 'If we fixed one thing right now, what would move this forward?',
    doNotDoThis: 'Do not stack multiple rebuttals at once.',
    whyThisWorks: 'Isolation creates clarity and avoids defensive spirals.',
  },
  'Follow-Up / No Decision': {
    sayThisNext: 'I can send exactly what helps your decision without noise.',
    askThisQuestion: 'What is the one detail you need next to make a clear call?',
    doNotDoThis: 'Do not send generic check-in messages.',
    whyThisWorks: 'Specific follow-up increases response and momentum.',
  },
  'Closing / Ask for Commitment': {
    sayThisNext: 'If this solves your priority and the plan fits, we can wrap this up cleanly now.',
    askThisQuestion: 'Are you ready to move forward, or is there one item left to clear?',
    doNotDoThis: 'Do not ask weak yes/no closes without context.',
    whyThisWorks: 'Clear conditional close keeps confidence without pressure.',
  },
};

const BEHAVIOR_OVERRIDES: Partial<Record<`${NextMoveStage}|${NextMoveBehavior}`, Partial<NextMoveBaseRecommendation>>> = {
  'Greeting|Says “just looking”': {
    sayThisNext: 'Perfect. I can stay light and still save you time while you look.',
    askThisQuestion: 'What are you comparing first so I can point you to the right place?',
    doNotDoThis: 'Do not challenge or corner the customer.',
  },
  'Needs Assessment|Not opening up': {
    sayThisNext: 'I will make this easy with two quick options so you can react.',
    askThisQuestion: 'Would you rather optimize monthly comfort or total value first?',
  },
  'Post Test Drive|Neutral / no special behavior': {
    sayThisNext: 'You have driven it. Let us decide whether this is your best fit or if we adjust.',
  },
  'Presenting Numbers|Payment-focused': {
    sayThisNext: 'Let us solve payment first, then confirm value and terms stay strong.',
    askThisQuestion: 'What monthly range feels comfortable and sustainable for you?',
    doNotDoThis: 'Do not throw multiple payment options before anchoring target.',
  },
  'Presenting Numbers|Price-focused': {
    sayThisNext: 'Let us walk value and total cost together before deciding next step.',
    askThisQuestion: 'Compared to your expectation, where does this feel off today?',
    doNotDoThis: 'Do not discount before diagnosing the gap.',
  },
  'Objection / Hesitation|Confused': {
    sayThisNext: 'Let me simplify this to one clear path and one backup option.',
    askThisQuestion: 'Which part feels unclear right now so we can clean it up first?',
  },
  'Objection / Hesitation|Wants to leave': {
    sayThisNext: 'Before you go, give me 60 seconds to make sure you have the clearest next option.',
    askThisQuestion: 'What would need to be true for staying today to make sense?',
    doNotDoThis: 'Do not chase with pressure language.',
  },
  'Objection / Hesitation|Needs spouse / third-party approval': {
    sayThisNext: 'Great. Let us prepare a clear summary you can review together tonight.',
    askThisQuestion: 'What concern will they ask first so we can answer it now?',
  },
  'Follow-Up / No Decision|Says “send me numbers”': {
    sayThisNext: 'I will send concise numbers plus one recommendation so it is easy to compare.',
    askThisQuestion: 'Should I send one best-fit option or two side-by-side options?',
  },
  'Follow-Up / No Decision|Says “I need to think about it”': {
    sayThisNext: 'Makes sense. I will send a short recap so your thinking time is focused.',
    askThisQuestion: 'What exactly do you want to think through first?',
    doNotDoThis: 'Do not ask “any updates?” with no value.',
  },
};

function applyModifierAdjustments(base: NextMoveBaseRecommendation, modifiers?: NextMoveModifiers): NextMoveBaseRecommendation {
  if (!modifiers) return base;
  let sayThisNext = base.sayThisNext;
  let askThisQuestion = base.askThisQuestion;
  let doNotDoThis = base.doNotDoThis;
  let whyThisWorks = base.whyThisWorks;

  if (modifiers.channel === 'Phone/Text') {
    sayThisNext = `${sayThisNext} I will keep this short so it is easy to review by phone.`;
  }
  if (modifiers.tradeInvolved) {
    askThisQuestion = `${askThisQuestion} Also, do you want trade clarity first or payment clarity first?`;
  }
  if (modifiers.managerEngaged) {
    doNotDoThis = 'Do not repeat the full story from the top; keep one aligned message with the manager.';
  }
  if (modifiers.visitType === 'Repeat Visit') {
    whyThisWorks = `${whyThisWorks} It also acknowledges prior progress and avoids restart friction.`;
  }

  return { sayThisNext, askThisQuestion, doNotDoThis, whyThisWorks };
}

export function getNextMoveBaseRecommendation(input: NextMoveInput): NextMoveBaseRecommendation {
  const behavior = input.behavior || 'Neutral / no special behavior';
  const base = BASE_BY_STAGE[input.stage];
  const override = BEHAVIOR_OVERRIDES[`${input.stage}|${behavior}`];
  const merged: NextMoveBaseRecommendation = {
    sayThisNext: override?.sayThisNext || base.sayThisNext,
    askThisQuestion: override?.askThisQuestion || base.askThisQuestion,
    doNotDoThis: override?.doNotDoThis || base.doNotDoThis,
    whyThisWorks: override?.whyThisWorks || base.whyThisWorks,
  };

  return applyModifierAdjustments(merged, input.modifiers);
}

export function getSprocketNextMoveRecommendation(input: NextMoveInput, base: NextMoveBaseRecommendation): NextMoveSprocketRecommendation {
  const behavior = input.behavior || 'Neutral / no special behavior';
  const likelyIssue = behavior === 'Price-focused' || behavior === 'Payment-focused'
    ? 'The customer is signaling decision-risk, not just price resistance. Value confidence is incomplete.'
    : behavior === 'Wants to leave' || behavior === 'Says “I need to think about it”'
      ? 'Momentum is dropping because next-step ownership is unclear.'
      : 'The deal is stalling from ambiguity, not lack of interest.';

  return {
    likelyIssue,
    sharperNextMove: `${base.sayThisNext} Then isolate one blocker and solve only that blocker.`,
    naturalRewrite: `Here is what I recommend next: ${base.sayThisNext}`,
    deliveryCoaching: 'Keep it calm and brief. One statement, one question, then stop talking and let them answer.',
  };
}

type SkillSignal = {
  listeningLow: boolean;
  trustLow: boolean;
  followUpLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignal {
  const stats = user?.stats;
  const listening = readCxStatScore(stats?.listening, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const followUp = readCxStatScore(stats?.followUp, 60);
  return {
    listeningLow: listening > 0 && listening < 55,
    trustLow: trust > 0 && trust < 55,
    followUpLow: followUp > 0 && followUp < 55,
  };
}

export function getAutoDriveCxNextMoveRecommendation(input: NextMoveInput, base: NextMoveBaseRecommendation, user?: User | null): NextMoveCxRecommendation {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored for your listening trend: shorter, question-led prompts increase engagement.',
      adaptedLine: `${base.sayThisNext} I want to hear your priority in your words before we go further.`,
      focusSkillTag: 'Listening',
    };
  }

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust-building trend: transparency language lowers customer resistance.',
      adaptedLine: `${base.sayThisNext} I will show exactly how we got here so you can verify each step.`,
      focusSkillTag: 'Trust',
    };
  }

  if (signal.followUpLow || input.stage === 'Follow-Up / No Decision') {
    return {
      tailoredReason: 'Tailored for your follow-up consistency trend: commitment timing is the highest leverage move.',
      adaptedLine: `${base.sayThisNext} Let us lock one exact follow-up time now so this stays easy.`,
      focusSkillTag: 'Follow-Up',
    };
  }

  return {
    tailoredReason: 'Tailored for your pacing profile: concise language keeps confidence high and pressure low.',
    adaptedLine: `${base.sayThisNext} I will keep this to one clear step at a time.`,
    focusSkillTag: 'Tone',
  };
}

export type NextMoveSavedScenario = {
  id: string;
  createdAt: string;
  stage: NextMoveStage;
  behavior: NextMoveBehavior;
  sayThisNext: string;
  askThisQuestion: string;
  doNotDoThis: string;
  favorite?: boolean;
};
