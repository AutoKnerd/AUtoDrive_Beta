import type { User } from '@/lib/definitions';

export const HANDOFF_TYPES = [
  'TO manager (desk)',
  'TO closer / senior salesperson',
  'TO finance',
  'TO manager for approval',
  'TO manager for better numbers',
  'TO specialist (EV, truck, etc.)',
] as const;

export const HANDOFF_SITUATIONS = [
  'customer hesitant after numbers',
  'customer asking for better deal',
  'customer unsure / needs reassurance',
  'customer losing momentum',
  'customer wants to leave',
  'customer confused',
  'normal progression (no tension)',
  'after objection',
  'before commitment',
  'after commitment (handoff to finance)',
] as const;

export const HANDOFF_MINDSETS = [
  'resistant',
  'neutral',
  'engaged',
  'skeptical',
  'in a hurry',
  'price-focused',
] as const;

export type HandoffType = typeof HANDOFF_TYPES[number];
export type HandoffSituation = typeof HANDOFF_SITUATIONS[number];
export type HandoffMindset = typeof HANDOFF_MINDSETS[number];

export type HandoffInput = {
  handoffType: HandoffType;
  situation: HandoffSituation;
  customerMindset?: HandoffMindset;
  context?: string;
};

export type HandoffPlan = {
  setupBeforeHandoff: string;
  frameTheHandoff: string;
  sayThis: string;
  reinforceAfterIntroduction: string;
  doNotDoThis: string;
  whyThisWorks: string;
};

export type HandoffSprocketEnhancement = {
  likelyFailureRisk: string;
  betterPositioning: string;
  naturalRewrite: string;
  deliveryCoaching: string;
};

export type HandoffCxEnhancement = {
  tailoredReason: string;
  adjustedFraming: string;
  focusSkillTag: 'Trust' | 'Control' | 'Tone' | 'Transition';
};

export type HandoffSavedScenario = {
  id: string;
  createdAt: string;
  handoffType: HandoffType;
  situation: HandoffSituation;
  customerMindset: HandoffMindset;
  setupBeforeHandoff: string;
  frameTheHandoff: string;
  sayThis: string;
  reinforceAfterIntroduction: string;
  doNotDoThis: string;
  favorite?: boolean;
};

const BASE_BY_TYPE: Record<HandoffType, HandoffPlan> = {
  'TO manager (desk)': {
    setupBeforeHandoff: 'Confirm what they already like, restate one unresolved point, and set expectation that this adds support not pressure.',
    frameTheHandoff: 'Position the manager as a resource to simplify the decision and keep things efficient.',
    sayThis: 'You have done the hard part already. I want to bring my manager in for two minutes to help us tighten this up around what matters most to you.',
    reinforceAfterIntroduction: 'This is exactly what we were reviewing. We are aligned on fit, and now we are finalizing the cleanest path forward.',
    doNotDoThis: 'Do not say, "I need to get my manager," with no context.',
    whyThisWorks: 'It keeps authority high while making the handoff feel intentional and customer-focused.',
  },
  'TO closer / senior salesperson': {
    setupBeforeHandoff: 'Summarize progress and confirm they are open to a second perspective focused on speed and clarity.',
    frameTheHandoff: 'Position the senior teammate as a deal-finishing specialist, not a pressure escalation.',
    sayThis: 'You are close. I want to bring in a senior teammate who is excellent at making the final step simple and clean.',
    reinforceAfterIntroduction: 'We have already narrowed this well. We just want to make this last part easy for you.',
    doNotDoThis: 'Do not present the handoff as you being unable to help.',
    whyThisWorks: 'It preserves your control while adding credibility at the exact moment momentum matters.',
  },
  'TO finance': {
    setupBeforeHandoff: 'Confirm commitment, recap agreed numbers at a high level, and set expectation for a smooth paperwork phase.',
    frameTheHandoff: 'Position finance as the step that finalizes structure and protects their ownership experience.',
    sayThis: 'Great choice. Next step is a quick finance handoff so we can finalize your structure and keep this smooth.',
    reinforceAfterIntroduction: 'We are aligned on vehicle and direction. We are here to finalize details and get you wrapped up efficiently.',
    doNotDoThis: 'Do not imply finance is only about add-ons or extra pressure.',
    whyThisWorks: 'It makes finance feel like progress, not friction, and protects deal confidence.',
  },
  'TO manager for approval': {
    setupBeforeHandoff: 'Identify exactly what needs approval, confirm seriousness, and anchor the customer on one clear request.',
    frameTheHandoff: 'Position this as a fast decision checkpoint so they get a definitive answer quickly.',
    sayThis: 'Let me bring my manager in now so we can get a direct answer on that request and keep momentum.',
    reinforceAfterIntroduction: 'We are aligned on the vehicle and intent. We are confirming this one approval item now.',
    doNotDoThis: 'Do not promise approval before involving the manager.',
    whyThisWorks: 'Specific framing lowers uncertainty and avoids false expectations.',
  },
  'TO manager for better numbers': {
    setupBeforeHandoff: 'Clarify whether concern is payment, total, or trade and capture one target outcome before handoff.',
    frameTheHandoff: 'Position manager involvement as optimization around their priority, not a defensive response.',
    sayThis: 'I want to have my manager join us so we can structure this around your top priority and see the cleanest possible path.',
    reinforceAfterIntroduction: 'Their key focus is getting this into a comfortable structure without losing fit.',
    doNotDoThis: 'Do not debate numbers before confirming what number they are reacting to.',
    whyThisWorks: 'It keeps the handoff problem-focused and protects trust during pricing tension.',
  },
  'TO specialist (EV, truck, etc.)': {
    setupBeforeHandoff: 'Confirm the exact technical or use-case question and tee up why a specialist adds value.',
    frameTheHandoff: 'Position specialist support as precision and confidence, not a sales tactic.',
    sayThis: 'I want to bring in our specialist for two minutes so you get the most accurate answer for your use case.',
    reinforceAfterIntroduction: 'We are in good shape overall. We just want to make sure this detail is handled perfectly for you.',
    doNotDoThis: 'Do not flood them with technical detail before the specialist joins.',
    whyThisWorks: 'Customers trust the process when expertise is introduced with purpose and timing.',
  },
};

const SITUATION_OVERRIDES: Partial<Record<`${HandoffType}|${HandoffSituation}`, Partial<HandoffPlan>>> = {
  'TO manager (desk)|customer wants to leave': {
    sayThis: 'Before you head out, give me 90 seconds to bring my manager in so we can make sure you leave with a clear best option.',
    doNotDoThis: 'Do not block the exit or pressure the customer to stay.',
  },
  'TO manager for better numbers|customer asking for better deal': {
    setupBeforeHandoff: 'Get one concrete target from the customer so the manager can respond precisely.',
    frameTheHandoff: 'Position this as a focused effort to tighten one priority, not reopen everything.',
  },
  'TO finance|after commitment (handoff to finance)': {
    sayThis: 'Perfect, we are all set on your decision. Finance is the final step to complete your paperwork smoothly.',
  },
  'TO specialist (EV, truck, etc.)|customer confused': {
    frameTheHandoff: 'Position specialist support as clarity-first guidance so they can decide confidently.',
    reinforceAfterIntroduction: 'We are slowing this down to make sure every detail is clear before your next step.',
  },
  'TO closer / senior salesperson|after objection': {
    setupBeforeHandoff: 'Acknowledge concern, isolate the objection, then tee up senior support for fast clarity.',
  },
  'TO manager for approval|before commitment': {
    frameTheHandoff: 'Position this as the final checkpoint before commitment, not a negotiation reset.',
  },
};

function applyMindsetAdjustments(plan: HandoffPlan, mindset: HandoffMindset): HandoffPlan {
  if (mindset === 'resistant') {
    return {
      ...plan,
      frameTheHandoff: `${plan.frameTheHandoff} Keep tone calm and permission-based so it does not feel forced.`,
      sayThis: `${plan.sayThis} Fair to say no if it does not help, but this usually makes decisions easier.`,
    };
  }

  if (mindset === 'skeptical') {
    return {
      ...plan,
      frameTheHandoff: `${plan.frameTheHandoff} Use transparency language and explain exactly what this person will help with.`,
      doNotDoThis: 'Do not use vague "policy" statements that increase skepticism.',
    };
  }

  if (mindset === 'in a hurry') {
    return {
      ...plan,
      setupBeforeHandoff: `${plan.setupBeforeHandoff} Promise a clear time box before introducing anyone.`,
      sayThis: `${plan.sayThis} This will take about two minutes, then you decide next steps.`,
    };
  }

  if (mindset === 'price-focused') {
    return {
      ...plan,
      frameTheHandoff: `${plan.frameTheHandoff} Tie the handoff to payment/price clarity, not negotiation pressure.`,
      reinforceAfterIntroduction: `${plan.reinforceAfterIntroduction} We are focused on making the numbers make sense for you.`,
    };
  }

  if (mindset === 'engaged') {
    return {
      ...plan,
      sayThis: `${plan.sayThis} You are in a great position, and this keeps us moving cleanly.`,
    };
  }

  return plan;
}

export function getHandoffPlan(input: HandoffInput): HandoffPlan {
  const base = BASE_BY_TYPE[input.handoffType];
  const override = SITUATION_OVERRIDES[`${input.handoffType}|${input.situation}`];
  const merged: HandoffPlan = {
    setupBeforeHandoff: override?.setupBeforeHandoff || base.setupBeforeHandoff,
    frameTheHandoff: override?.frameTheHandoff || base.frameTheHandoff,
    sayThis: override?.sayThis || base.sayThis,
    reinforceAfterIntroduction: override?.reinforceAfterIntroduction || base.reinforceAfterIntroduction,
    doNotDoThis: override?.doNotDoThis || base.doNotDoThis,
    whyThisWorks: override?.whyThisWorks || base.whyThisWorks,
  };

  const withMindset = applyMindsetAdjustments(merged, input.customerMindset || 'neutral');

  if (input.context?.trim()) {
    return {
      ...withMindset,
      whyThisWorks: `${withMindset.whyThisWorks} Context-aware note applied from your deal details.`,
    };
  }

  return withMindset;
}

export function getSprocketHandoffEnhancement(input: HandoffInput, base: HandoffPlan): HandoffSprocketEnhancement {
  const likelyFailureRisk = input.customerMindset === 'resistant' || input.situation === 'customer wants to leave'
    ? 'The handoff can feel like pressure escalation, which triggers immediate resistance.'
    : input.customerMindset === 'skeptical' || input.situation === 'customer confused'
      ? 'The handoff may fail if the customer does not understand why a new person is joining.'
      : 'The main risk is losing continuity between your progress and the next person. Keep one aligned story.';

  return {
    likelyFailureRisk,
    betterPositioning: `${base.frameTheHandoff} Keep ownership language: "we are continuing your process," not "starting over."`,
    naturalRewrite: `Here is a cleaner handoff line: ${base.sayThis}`,
    deliveryCoaching: 'Slow down before introduction. One setup sentence, one value statement, then bring them in without over-talking.',
  };
}

type SkillSignals = {
  trustLow: boolean;
  controlLow: boolean;
  toneLow: boolean;
  transitionLow: boolean;
};

function readSkillSignals(user: User | null | undefined): SkillSignals {
  const stats = user?.stats;
  const trust = Number(stats?.trust ?? 60);
  const control = Number(stats?.closing ?? 60);
  const tone = Number(stats?.listening ?? 60);
  const transition = Number(stats?.followUp ?? 60);

  return {
    trustLow: trust > 0 && trust < 55,
    controlLow: control > 0 && control < 55,
    toneLow: tone > 0 && tone < 55,
    transitionLow: transition > 0 && transition < 55,
  };
}

export function getAutoDriveCxHandoffEnhancement(input: HandoffInput, base: HandoffPlan, user?: User | null): HandoffCxEnhancement {
  const signal = readSkillSignals(user);

  if (signal.trustLow) {
    return {
      tailoredReason: 'Tailored for your trust trend: transparent setup reduces defensive reactions during handoff.',
      adjustedFraming: `${base.frameTheHandoff} Add: "This is to make things clearer for you, not to pressure you."`,
      focusSkillTag: 'Trust',
    };
  }

  if (signal.controlLow) {
    return {
      tailoredReason: 'Tailored for your control trend: clearer authority language helps maintain deal direction.',
      adjustedFraming: `${base.frameTheHandoff} Add a confident bridge: "I will stay with you through this step."`,
      focusSkillTag: 'Control',
    };
  }

  if (signal.toneLow) {
    return {
      tailoredReason: 'Tailored for your tone trend: shorter phrasing lowers pressure and improves acceptance.',
      adjustedFraming: 'Keep framing to one sentence and avoid layered explanations before the handoff.',
      focusSkillTag: 'Tone',
    };
  }

  if (signal.transitionLow) {
    return {
      tailoredReason: 'Tailored for your transition trend: cleaner sequencing improves continuity between teammates.',
      adjustedFraming: `${base.reinforceAfterIntroduction} Then pause and let the next person lead immediately.`,
      focusSkillTag: 'Transition',
    };
  }

  return {
    tailoredReason: 'Tailored to your current profile: balanced trust and control language keeps handoffs natural.',
    adjustedFraming: base.frameTheHandoff,
    focusSkillTag: 'Transition',
  };
}
