import type { User } from '@/lib/definitions';
import { readCxStatScore } from '@/lib/tools/cx-stats';

export const OBJECTION_TYPES = [
  'Payment too high',
  'Price too high',
  'Need to think about it',
  'Need to talk to spouse / other decision-maker',
  'Shopping other stores',
  'Want best price',
  'Not ready yet',
  'Just looking',
  'Send me numbers',
  'Trade offer too low',
  'Monthly payment concern',
  'Down payment concern',
  'Lease concern',
  'Not sure on vehicle',
  'Other',
] as const;

export type ObjectionType = typeof OBJECTION_TYPES[number];

export type ObjectionInput = {
  objectionType: ObjectionType;
  objectionText?: string;
  trustLevel: number;
  urgencyLevel: number;
  confusionLevel: number;
  resistanceLevel: number;
  contextNotes?: string;
};

export type ObjectionBaseRecommendation = {
  likelyRealConcern: string;
  bestReframe: string;
  sayThisNext: string;
  askThisQuestion: string;
  doNotDoThis: string;
  whyThisWorks: string;
};

export type ObjectionSprocketRecommendation = {
  probableReality: string;
  betterReframe: string;
  naturalRewrite: string;
  deliveryCoaching: string;
  strongerFollowUpQuestion: string;
};

export type ObjectionCxRecommendation = {
  tailoredReason: string;
  adaptedCoaching: string;
  focusSkillTag: 'Listening' | 'Trust' | 'Tone' | 'Objection Control' | 'Pace';
};

export type ObjectionSavedScenario = {
  id: string;
  createdAt: string;
  objectionType: ObjectionType;
  objectionText: string;
  likelyRealConcern: string;
  sayThisNext: string;
  askThisQuestion: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_OBJECTION: Record<ObjectionType, ObjectionBaseRecommendation> = {
  'Payment too high': {
    likelyRealConcern: 'The customer may be uncertain about value or affordability fit, not rejecting the deal outright.',
    bestReframe: 'Treat this as a clarity request, not a hard no.',
    sayThisNext: 'That makes sense. Let us isolate what part of this payment feels off first.',
    askThisQuestion: 'Is it the monthly amount itself, the term, or how it compares to what you expected?',
    doNotDoThis: 'Do not defend the payment before confirming what they are reacting to.',
    whyThisWorks: 'It lowers pressure and helps you solve the actual issue first.',
  },
  'Price too high': {
    likelyRealConcern: 'They may not see enough value certainty yet to justify the number.',
    bestReframe: 'Treat price pushback as a value-confidence gap.',
    sayThisNext: 'Fair concern. Before we change numbers, let me make sure the value side is fully clear.',
    askThisQuestion: 'Compared to your expectation, what part feels most out of line?',
    doNotDoThis: 'Do not jump straight to discounting.',
    whyThisWorks: 'It turns emotional pushback into a diagnosable gap.',
  },
  'Need to think about it': {
    likelyRealConcern: 'This is often a low-risk pause signal, not a final decision.',
    bestReframe: 'Treat this as unresolved uncertainty, not rejection.',
    sayThisNext: 'Completely fair. Let us narrow what you want to think through so I can help.',
    askThisQuestion: 'What is the main piece you still need confidence on?',
    doNotDoThis: 'Do not push for a close before identifying the unresolved item.',
    whyThisWorks: 'It gives them control while revealing the real blocker.',
  },
  'Need to talk to spouse / other decision-maker': {
    likelyRealConcern: 'They need social safety and confidence before committing.',
    bestReframe: 'Treat this as a joint-decision preparation step.',
    sayThisNext: 'Great. Let us make this easy to review together so nothing feels unclear later.',
    askThisQuestion: 'What question will they ask first so we can answer it now?',
    doNotDoThis: 'Do not challenge the need for another decision-maker.',
    whyThisWorks: 'It supports their process and keeps momentum.',
  },
  'Shopping other stores': {
    likelyRealConcern: 'They are testing confidence and trust, not only price.',
    bestReframe: 'Treat comparison behavior as a trust-validation step.',
    sayThisNext: 'That makes sense. I can help you compare this apples-to-apples so it is clear.',
    askThisQuestion: 'What are the top two things you are comparing so I can line them up directly?',
    doNotDoThis: 'Do not attack competitor pricing.',
    whyThisWorks: 'You stay consultative and reduce defensive tension.',
  },
  'Want best price': {
    likelyRealConcern: 'They want certainty they are not overpaying.',
    bestReframe: 'Treat this as a confidence request, not greed.',
    sayThisNext: 'I can work aggressively, and I also want to make sure we are comparing the same structure first.',
    askThisQuestion: 'When you say best, do you mean lowest monthly, lowest total, or best overall value?',
    doNotDoThis: 'Do not promise “best” before structure alignment.',
    whyThisWorks: 'It defines success criteria before negotiation.',
  },
  'Not ready yet': {
    likelyRealConcern: 'Readiness is low because risk still feels high.',
    bestReframe: 'Treat this as a pacing issue, not disinterest.',
    sayThisNext: 'No problem. Let us keep this low-pressure and identify what would make you ready.',
    askThisQuestion: 'What would need to be true for this to feel like the right time?',
    doNotDoThis: 'Do not force urgency language.',
    whyThisWorks: 'It lowers resistance and surfaces decision criteria.',
  },
  'Just looking': {
    likelyRealConcern: 'They are protecting control and avoiding pressure.',
    bestReframe: 'Treat this as a request for low-pressure guidance.',
    sayThisNext: 'Perfect. I can keep this simple and still help you compare quickly.',
    askThisQuestion: 'What are you most curious to compare first?',
    doNotDoThis: 'Do not challenge the statement or corner them.',
    whyThisWorks: 'It keeps rapport while moving the conversation forward.',
  },
  'Send me numbers': {
    likelyRealConcern: 'They want distance and easy comparison before engagement.',
    bestReframe: 'Treat this as a convenience request plus low commitment signal.',
    sayThisNext: 'Absolutely. I will send concise numbers with one recommended path so it is easy to review.',
    askThisQuestion: 'Should I send one best-fit option or two side-by-side options?',
    doNotDoThis: 'Do not send raw numbers without framing.',
    whyThisWorks: 'It keeps you useful and increases follow-up response odds.',
  },
  'Trade offer too low': {
    likelyRealConcern: 'Trust around fairness is breaking down.',
    bestReframe: 'Treat this as a trust-and-transparency moment.',
    sayThisNext: 'I hear you. Let us walk exactly how we arrived at the trade number.',
    askThisQuestion: 'What number were you expecting and what are you basing that on?',
    doNotDoThis: 'Do not debate trade value emotionally.',
    whyThisWorks: 'Transparency stabilizes emotion and restores credibility.',
  },
  'Monthly payment concern': {
    likelyRealConcern: 'They need control over affordability, not a full deal argument.',
    bestReframe: 'Treat this as a budget-fit adjustment conversation.',
    sayThisNext: 'Understood. Let us tune the structure around your comfort zone.',
    askThisQuestion: 'What monthly range feels comfortable and sustainable for you?',
    doNotDoThis: 'Do not stack multiple options before anchoring target.',
    whyThisWorks: 'It narrows focus and speeds practical alignment.',
  },
  'Down payment concern': {
    likelyRealConcern: 'Cash-out friction is blocking confidence to proceed.',
    bestReframe: 'Treat this as a structure flexibility issue.',
    sayThisNext: 'Got it. Let us map how different down-payment levels change this cleanly.',
    askThisQuestion: 'What down-payment range feels realistic right now?',
    doNotDoThis: 'Do not pressure for a number before showing impact.',
    whyThisWorks: 'It turns anxiety into transparent trade-offs.',
  },
  'Lease concern': {
    likelyRealConcern: 'They may be unclear on lease fit, not rejecting the vehicle.',
    bestReframe: 'Treat this as an education and fit decision.',
    sayThisNext: 'Good question. Let us match lease structure to how you actually drive.',
    askThisQuestion: 'What part concerns you most: mileage, flexibility, or long-term value?',
    doNotDoThis: 'Do not blur lease and finance with vague language.',
    whyThisWorks: 'Clear category fit reduces hesitation.',
  },
  'Not sure on vehicle': {
    likelyRealConcern: 'Decision confidence is not strong enough to justify commitment.',
    bestReframe: 'Treat this as fit uncertainty before pricing resistance.',
    sayThisNext: 'That is important. Let us confirm fit first before we keep talking numbers.',
    askThisQuestion: 'What part of fit still feels uncertain right now?',
    doNotDoThis: 'Do not keep negotiating numbers on an uncertain fit.',
    whyThisWorks: 'Fit clarity prevents false objections from multiplying.',
  },
  Other: {
    likelyRealConcern: 'The customer may be signaling uncertainty without naming it directly.',
    bestReframe: 'Treat this as an interpretation moment before response.',
    sayThisNext: 'I appreciate that. Let me make sure I understand what is most important before we move.',
    askThisQuestion: 'What is the main concern behind that for you?',
    doNotDoThis: 'Do not assume the first interpretation is correct.',
    whyThisWorks: 'Clarification first avoids misfires.',
  },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function contains(text: string, pattern: RegExp): boolean {
  return pattern.test(text.toLowerCase());
}

function applySignals(base: ObjectionBaseRecommendation, input: ObjectionInput): ObjectionBaseRecommendation {
  const trust = clamp(input.trustLevel);
  const urgency = clamp(input.urgencyLevel);
  const confusion = clamp(input.confusionLevel);
  const resistance = clamp(input.resistanceLevel);
  const objectionText = String(input.objectionText || '').trim();
  const context = String(input.contextNotes || '').toLowerCase();

  let likelyRealConcern = base.likelyRealConcern;
  let bestReframe = base.bestReframe;
  let sayThisNext = base.sayThisNext;
  let askThisQuestion = base.askThisQuestion;
  let doNotDoThis = base.doNotDoThis;
  let whyThisWorks = base.whyThisWorks;

  if (trust <= 35) {
    likelyRealConcern = 'Low trust is likely amplifying this objection.';
    bestReframe = 'Treat this as a trust-rebuild step before persuasion.';
    sayThisNext = `${sayThisNext} I want this to feel transparent and easy to verify.`;
  }

  if (confusion >= 65) {
    likelyRealConcern = 'Confusion is likely driving hesitation more than price or commitment.';
    bestReframe = 'Treat this as a clarity gap first.';
    askThisQuestion = 'Which part feels unclear so we can simplify it first?';
    doNotDoThis = 'Do not keep adding details when clarity is low.';
  }

  if (resistance >= 70 && urgency <= 35) {
    likelyRealConcern = 'High resistance plus low urgency suggests a pressure-avoidance response.';
    bestReframe = 'Treat this as a low-pressure diagnosis moment.';
    sayThisNext = 'No pressure. Let us isolate one concern so this stays simple.';
    doNotDoThis = 'Do not push for commitment in a defensive state.';
  }

  if (objectionText) {
    if (contains(objectionText, /(another store|cheaper|better price|quote)/i)) {
      likelyRealConcern = 'They are comparison-checking confidence, not only price-cut shopping.';
    } else if (contains(objectionText, /(spouse|wife|husband|partner)/i)) {
      likelyRealConcern = 'They are seeking decision safety with another stakeholder.';
    } else if (contains(objectionText, /(payment|monthly|month)/i)) {
      likelyRealConcern = 'Affordability framing is likely the main stress point.';
    } else if (contains(objectionText, /(think about it|not sure|later|maybe)/i)) {
      likelyRealConcern = 'This is likely unresolved uncertainty rather than a final no.';
    }
  }

  if (context.includes('remote') || context.includes('phone') || context.includes('text') || context.includes('email')) {
    sayThisNext = `${sayThisNext} I will keep this concise so it is easy to review remotely.`;
  }
  if (context.includes('after numbers')) {
    askThisQuestion = 'After seeing the numbers, what single part feels hardest to accept right now?';
  }
  if (context.includes('manager')) {
    doNotDoThis = 'Do not split messaging after manager involvement.';
  }

  if (urgency >= 70 && resistance <= 45) {
    whyThisWorks = `${whyThisWorks} With readiness already higher, a clear next-step ask can convert momentum.`;
  }

  return {
    likelyRealConcern,
    bestReframe,
    sayThisNext,
    askThisQuestion,
    doNotDoThis,
    whyThisWorks,
  };
}

export function getObjectionBaseRecommendation(input: ObjectionInput): ObjectionBaseRecommendation {
  const base = BASE_BY_OBJECTION[input.objectionType];
  return applySignals(base, input);
}

export function getSprocketObjectionRecommendation(
  input: ObjectionInput,
  base: ObjectionBaseRecommendation
): ObjectionSprocketRecommendation {
  const highFriction = input.trustLevel <= 40 && input.resistanceLevel >= 65;
  const probableReality = highFriction
    ? 'This objection likely protects the customer from feeling pressured or exposed.'
    : input.confusionLevel >= 60
      ? 'This objection is likely a clarity gap, not a rejection gap.'
      : 'The surface objection is masking a confidence gap in value, fit, or safety.';

  return {
    probableReality,
    betterReframe: `${base.bestReframe} Focus on one blocker and solve only that blocker.`,
    naturalRewrite: `That is totally fair. ${base.sayThisNext}`,
    deliveryCoaching: 'Use a calm tone, one short statement, one question, then pause.',
    strongerFollowUpQuestion: `${base.askThisQuestion} If we fix that, would moving forward feel easier?`,
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
  const listening = readCxStatScore(stats?.listening, 60);
  const trust = readCxStatScore(stats?.trust, 60);
  const followUp = readCxStatScore(stats?.followUp, 60);
  const closing = readCxStatScore(stats?.closing, 60);

  return {
    listeningLow: listening > 0 && listening < 55,
    trustLow: trust > 0 && trust < 55,
    followUpLow: followUp > 0 && followUp < 55,
    closingLow: closing > 0 && closing < 55,
  };
}

export function getAutoDriveCxObjectionRecommendation(
  input: ObjectionInput,
  base: ObjectionBaseRecommendation,
  user?: User | null
): ObjectionCxRecommendation {
  const signal = readSkillSignals(user);

  if (signal.listeningLow) {
    return {
      tailoredReason: 'Tailored for your listening trend: clarifying questions should lead before explanation.',
      adaptedCoaching: `${base.askThisQuestion} Then summarize their answer in one sentence before responding.`,
      focusSkillTag: 'Listening',
    };
  }

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: lower-pressure and transparent language reduces defensiveness.',
      adaptedCoaching: `${base.sayThisNext} Keep verification language explicit and avoid urgency pressure.`,
      focusSkillTag: 'Trust',
    };
  }

  if (signal.closingLow || input.resistanceLevel >= 70) {
    return {
      tailoredReason: 'Tailored for your objection-control trend: diagnose first, then ask for one contained next step.',
      adaptedCoaching: 'After clarification, ask for one micro-commitment instead of a full close.',
      focusSkillTag: 'Objection Control',
    };
  }

  if (signal.followUpLow || input.objectionType === 'Send me numbers') {
    return {
      tailoredReason: 'Tailored for your follow-up trend: secure a concrete follow-up time before ending this exchange.',
      adaptedCoaching: 'Confirm channel, send concise recap, and lock one exact follow-up time.',
      focusSkillTag: 'Pace',
    };
  }

  return {
    tailoredReason: 'Tailored for your tone/pacing profile: shorter responses improve control and trust.',
    adaptedCoaching: 'Use one sentence, one question, and a deliberate pause.',
    focusSkillTag: 'Tone',
  };
}
