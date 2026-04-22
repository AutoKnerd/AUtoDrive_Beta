import type { User } from '@/lib/definitions';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';

export type WhatHappensNextMode = 'Short' | 'Warmer' | 'Confident' | 'Premium' | 'Service' | 'F&I' | 'Delay recovery';
export type WhatHappensNextTone = 'Calm' | 'Warm' | 'Organized' | 'Premium' | 'Direct';

export type WhatHappensNextInput = {
  currentStage: string;
  nextStep: string;
  estimatedTime: string;
  reasonForStep: string;
  reassuranceTone: WhatHappensNextTone;
  delayOrComplication: string;
  customerConcern: string;
};

export type WhatHappensNextSavedScript = {
  id: string;
  createdAt: string;
  signature: string;
  currentStage: string;
  nextStep: string;
  estimatedTime: string;
  reasonForStep: string;
  reassuranceTone: WhatHappensNextTone;
  delayOrComplication: string;
  customerConcern: string;
  mode: WhatHappensNextMode;
  script: string;
  nextHappensLine: string;
  timingLine: string;
  reassuranceLine: string;
  favorite: boolean;
};

export type WhatHappensNextPreset = {
  id: string;
  label: string;
  currentStage: string;
  nextStep: string;
  estimatedTime: string;
  reasonForStep: string;
  reassuranceTone: WhatHappensNextTone;
  delayOrComplication: string;
  customerConcern: string;
};

export type WhatHappensNextPlan = {
  mode: WhatHappensNextMode;
  script: string;
  nextHappensLine: string;
  timingLine: string;
  reassuranceLine: string;
  whyItWorks: string;
  cleanerStep: string;
  altVersion: string;
  conciseVersion: string;
  modeHint: string;
  clarityFlags: string[];
};

export type WhatHappensNextSprocketInsight = {
  cleanerStep: string;
  whyThisMatters: string;
  sayThisInstead: string;
  clarityFocus: string[];
};

export type WhatHappensNextCxInsight = {
  recommendedTone: WhatHappensNextTone;
  recommendedMode: WhatHappensNextMode;
  rationale: string;
  focus: string[];
};

export const WHAT_HAPPENS_NEXT_MODES: WhatHappensNextMode[] = [
  'Short',
  'Warmer',
  'Confident',
  'Premium',
  'Service',
  'F&I',
  'Delay recovery',
];

export const WHAT_HAPPENS_NEXT_TONES: WhatHappensNextTone[] = ['Calm', 'Warm', 'Organized', 'Premium', 'Direct'];

const REASSURANCE_PATTERNS: Record<WhatHappensNextTone, string[]> = {
  Calm: ["I'll keep you posted the whole time.", "I'll let you know if anything changes.", "You'll always know what is happening."],
  Warm: ["I'll keep this easy to follow.", "I'll stay with you the whole way.", "I want this to feel simple and clear."],
  Organized: ["I'll keep the steps organized and clear.", "I'll make sure you know what is next.", "I'll keep the timing and order easy to follow."],
  Premium: ["I'll keep the handoff smooth and polished.", "I'll make sure this feels seamless.", "I'll keep everything moving in a clean, simple way."],
  Direct: ["I'll be clear if anything slows down.", "I'll tell you right away if timing changes.", "I'll keep you updated without confusion."],
};

const TIME_FALLBACKS: Record<string, string> = {
  appraisal: '10 to 15 minutes',
  numbers: '5 to 10 minutes',
  manager: '3 to 5 minutes',
  finance: '10 to 15 minutes',
  fi: '10 to 15 minutes',
  service: '15 to 25 minutes',
  delivery: '10 to 20 minutes',
  cleanup: '10 to 15 minutes',
  parts: '15 to 30 minutes',
  test: '10 to 15 minutes',
  wait: 'a few minutes',
};

type LiveLineTemplate = {
  lead: string;
  bridge: string;
  timeLead: string;
  reassuranceLead: string;
};

const LIVE_LINE_TEMPLATES: LiveLineTemplate[] = [
  { lead: "Next, I'll", bridge: 'That way,', timeLead: 'That should take about', reassuranceLead: "and I'll keep you updated." },
  { lead: "Here's the plan: I'll", bridge: 'So,', timeLead: 'Plan on about', reassuranceLead: "and I'll stay with you on it." },
  { lead: "From here, I'll", bridge: 'This way,', timeLead: 'That usually takes about', reassuranceLead: "so you'll always know what's happening." },
  { lead: "Right now, I'll", bridge: 'That way,', timeLead: 'Give me about', reassuranceLead: "and I'll let you know if anything changes." },
  { lead: "Let me", bridge: 'That way,', timeLead: 'That will run about', reassuranceLead: "and I'll keep it simple for you." },
  { lead: "I'll go ahead and", bridge: 'So,', timeLead: 'That will probably take about', reassuranceLead: "and I'll keep you posted the whole time." },
  { lead: "To keep this moving, I'll", bridge: 'That way,', timeLead: 'Expect about', reassuranceLead: "and I'll keep the pace easy to follow." },
  { lead: "I'll work through", bridge: 'This way,', timeLead: 'That should be about', reassuranceLead: "and I'll keep you in the loop." },
  { lead: "I'll", bridge: 'That way,', timeLead: 'We’re looking at about', reassuranceLead: "and I'll make sure it stays clear." },
  { lead: "For now, I'll", bridge: 'So,', timeLead: 'That will likely take about', reassuranceLead: "and I'll keep it moving for you." },
  { lead: "Then I'll", bridge: 'That way,', timeLead: 'Plan on roughly', reassuranceLead: "and I'll stay on top of it." },
  { lead: "After that, I'll", bridge: 'This way,', timeLead: 'This should take around', reassuranceLead: "and I'll explain anything that changes." },
  { lead: "I'll start by", bridge: 'That way,', timeLead: 'That will take about', reassuranceLead: "and I'll keep the update straightforward." },
  { lead: "I'll keep it simple and", bridge: 'So,', timeLead: 'This is usually about', reassuranceLead: "and I'll keep things easy for you." },
  { lead: "I'll make sure to", bridge: 'That way,', timeLead: 'That should be roughly', reassuranceLead: "and I'll keep you comfortable with the pace." },
  { lead: "I'll stay with you while I", bridge: 'This way,', timeLead: 'This will probably be about', reassuranceLead: "and I'll keep you informed as we go." },
  { lead: "I'll walk you through", bridge: 'That way,', timeLead: 'It should take about', reassuranceLead: "and I'll make sure you know what's next." },
  { lead: "I'll keep this moving and", bridge: 'That way,', timeLead: 'Expect around', reassuranceLead: "and I'll keep the handoff smooth." },
  { lead: "I'll keep you updated while I", bridge: 'That way,', timeLead: 'This should run about', reassuranceLead: "and I'll keep the timing clear." },
  { lead: "I'll move us forward and", bridge: 'So,', timeLead: 'We should be looking at about', reassuranceLead: "and I'll keep you updated if anything shifts." },
];

export const SCENARIO_STARTER_PRESETS: WhatHappensNextPreset[] = [
  {
    id: 'trade-appraisal-wait',
    label: 'Trade appraisal wait',
    currentStage: 'Trade appraisal',
    nextStep: 'take a quick look at your trade',
    estimatedTime: '10 to 15 minutes',
    reasonForStep: 'So we can confirm the right value before moving forward',
    reassuranceTone: 'Organized',
    delayOrComplication: '',
    customerConcern: 'Worried about waiting too long',
  },
  {
    id: 'waiting-on-numbers',
    label: 'Waiting on numbers',
    currentStage: 'Numbers in progress',
    nextStep: 'finish the numbers and review the next step',
    estimatedTime: '5 to 10 minutes',
    reasonForStep: 'So the customer can see the full picture before deciding',
    reassuranceTone: 'Calm',
    delayOrComplication: '',
    customerConcern: 'Needs a clear update',
  },
  {
    id: 'manager-transition',
    label: 'Manager transition',
    currentStage: 'Manager handoff',
    nextStep: 'bring in the manager and keep the conversation moving',
    estimatedTime: '3 to 5 minutes',
    reasonForStep: 'So the next person can help with the current step',
    reassuranceTone: 'Warm',
    delayOrComplication: '',
    customerConcern: 'Does not want to feel passed around',
  },
  {
    id: 'fi-transition',
    label: 'Finance transition',
    currentStage: 'Finance step',
    nextStep: 'go through the finance step together',
    estimatedTime: '10 to 15 minutes',
    reasonForStep: 'So the paperwork and payment details stay clear',
    reassuranceTone: 'Organized',
    delayOrComplication: '',
    customerConcern: 'Does not want a stressful handoff',
  },
  {
    id: 'service-delay',
    label: 'Service delay',
    currentStage: 'Service update',
    nextStep: 'check the current repair status and give the next update',
    estimatedTime: '15 to 25 minutes',
    reasonForStep: 'So the customer knows what is happening and why',
    reassuranceTone: 'Direct',
    delayOrComplication: 'waiting on parts or technician timing',
    customerConcern: 'Needs honesty about the delay',
  },
  {
    id: 'delivery-delay',
    label: 'Delivery delay',
    currentStage: 'Delivery prep',
    nextStep: 'finish the final prep and get you to delivery',
    estimatedTime: '10 to 20 minutes',
    reasonForStep: 'So the handoff stays smooth and complete',
    reassuranceTone: 'Premium',
    delayOrComplication: 'final cleanup or paperwork detail',
    customerConcern: 'Wants a smooth finish',
  },
  {
    id: 'cleanup-wait',
    label: 'Cleanup wait',
    currentStage: 'Prep and cleanup',
    nextStep: 'finish the cleanup and make it ready for you',
    estimatedTime: '10 to 15 minutes',
    reasonForStep: 'So you get the vehicle in ready-to-go condition',
    reassuranceTone: 'Warm',
    delayOrComplication: 'detail team is still wrapping up',
    customerConcern: 'Just wants to leave soon',
  },
  {
    id: 'parts-delay',
    label: 'Parts delay',
    currentStage: 'Parts update',
    nextStep: 'check the parts status and give you the next clear update',
    estimatedTime: '15 to 30 minutes',
    reasonForStep: 'So you know whether the next step can move now or later',
    reassuranceTone: 'Calm',
    delayOrComplication: 'waiting on a part arrival',
    customerConcern: 'Does not want to be left hanging',
  },
  {
    id: 'test-drive-transition',
    label: 'Test drive transition',
    currentStage: 'Test drive',
    nextStep: 'wrap up the drive and review what you thought',
    estimatedTime: '10 to 15 minutes',
    reasonForStep: 'So the customer can reflect before the next decision',
    reassuranceTone: 'Confident',
    delayOrComplication: '',
    customerConcern: 'Needs a clean next step',
  },
];

export const COMMON_VAGUE_PHRASES: WhatHappensNextPreset[] = [
  {
    id: 'lets-head-inside',
    label: 'let\'s head inside',
    currentStage: 'Outside',
    nextStep: 'head inside and review the next step',
    estimatedTime: '5 to 10 minutes',
    reasonForStep: 'So the customer knows what happens after we walk in',
    reassuranceTone: 'Warm',
    delayOrComplication: '',
    customerConcern: 'May not know what is next',
  },
  {
    id: 'this-wont-take-long',
    label: 'this won\'t take long',
    currentStage: 'Any step',
    nextStep: 'keep the next step short and clear',
    estimatedTime: '5 to 10 minutes',
    reasonForStep: 'So the customer can relax and stay engaged',
    reassuranceTone: 'Calm',
    delayOrComplication: '',
    customerConcern: 'Wants speed',
  },
  {
    id: 'i-m-working-on-it',
    label: 'I\'m working on it',
    currentStage: 'In progress',
    nextStep: 'finish the current step and give the next update',
    estimatedTime: 'a few minutes',
    reasonForStep: 'So the customer knows progress is still happening',
    reassuranceTone: 'Direct',
    delayOrComplication: '',
    customerConcern: 'Needs a real update',
  },
  {
    id: 'waiting-on-manager',
    label: 'waiting on my manager',
    currentStage: 'Manager handoff',
    nextStep: 'bring in the manager for the next step',
    estimatedTime: '3 to 5 minutes',
    reasonForStep: 'So the customer knows the handoff is moving',
    reassuranceTone: 'Organized',
    delayOrComplication: '',
    customerConcern: 'Does not want to wait too long',
  },
  {
    id: 'finance-will-go-over-everything',
    label: 'finance will go over everything',
    currentStage: 'Finance step',
    nextStep: 'go through the finance step and cover the details',
    estimatedTime: '10 to 15 minutes',
    reasonForStep: 'So the paperwork stays organized and clear',
    reassuranceTone: 'Organized',
    delayOrComplication: '',
    customerConcern: 'Needs structure',
  },
  {
    id: 'were-getting-numbers',
    label: 'we\'re getting numbers',
    currentStage: 'Numbers in progress',
    nextStep: 'finish the numbers and show the next step',
    estimatedTime: '5 to 10 minutes',
    reasonForStep: 'So the customer can understand the decision clearly',
    reassuranceTone: 'Calm',
    delayOrComplication: '',
    customerConcern: 'Does not want to feel stalled',
  },
  {
    id: 'theyre-cleaning-it-up',
    label: 'they\'re cleaning it up',
    currentStage: 'Prep and cleanup',
    nextStep: 'finish the prep and have it ready for you',
    estimatedTime: '10 to 15 minutes',
    reasonForStep: 'So the handoff feels complete and polished',
    reassuranceTone: 'Premium',
    delayOrComplication: '',
    customerConcern: 'Wants a polished finish',
  },
];

function simpleHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pick<T>(values: T[], seed: string): T {
  if (!values.length) {
    throw new Error('Cannot pick from an empty array.');
  }
  return values[simpleHash(seed) % values.length];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatStep(input: string, mode: WhatHappensNextMode): string {
  const cleaned = normalizeWhitespace(input)
    .replace(/\bF&I\b/gi, 'finance step')
    .replace(/\bfinance office\b/gi, 'finance step')
    .replace(/\bdesk\b/gi, 'next step')
    .replace(/\bback-end\b/gi, 'next step')
    .replace(/\bback end\b/gi, 'next step');

  if (!cleaned) return 'move to the next step';

  const lower = cleaned.toLowerCase();
  if (lower.startsWith('take a quick look')) return cleaned;
  if (lower.startsWith('go through')) return cleaned;
  if (lower.startsWith('finish')) return cleaned;
  if (lower.startsWith('review')) return cleaned;
  if (mode === 'Service' && !lower.includes('service')) {
    return cleaned.replace(/^we\s+/i, 'we will ');
  }

  return cleaned;
}

function formatTimeEstimate(input: WhatHappensNextInput): string {
  const raw = normalizeWhitespace(input.estimatedTime);
  if (raw) {
    const cleaned = raw
      .replace(/minutes?/gi, 'minutes')
      .replace(/mins?/gi, 'minutes')
      .replace(/\babout\b/gi, '')
      .replace(/\broughly\b/gi, '')
      .replace(/\baround\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (/^\d+\s*(to|-)?\s*\d*\s*minutes?$/i.test(cleaned)) {
      return cleaned.replace(/-/g, ' to ').replace(/\s+/g, ' ').replace(/\s+minutes?$/i, ' minutes');
    }

    if (/^\d+\s*minutes?$/i.test(cleaned)) {
      return cleaned;
    }

    if (/^a few minutes$/i.test(cleaned) || /^a couple of minutes$/i.test(cleaned)) {
      return cleaned;
    }

    return cleaned.toLowerCase().includes('minute') ? cleaned : `${cleaned} minutes`;
  }

  const parts = [input.currentStage, input.nextStep, input.delayOrComplication, input.customerConcern]
    .join(' ')
    .toLowerCase();

  const matchedKey = Object.keys(TIME_FALLBACKS).find((key) => {
    if (key === 'fi') return /\b(fi|f&i)\b/.test(parts);
    return new RegExp(`\\b${key}\\b`, 'i').test(parts);
  });
  if (matchedKey) return TIME_FALLBACKS[matchedKey];

  if ((input.reasonForStep || '').toLowerCase().includes('service')) return '15 to 25 minutes';
  if ((input.reasonForStep || '').toLowerCase().includes('paperwork')) return '10 to 15 minutes';
  return '5 to 10 minutes';
}

function chooseReassurance(input: WhatHappensNextInput, mode: WhatHappensNextMode, seed: string): string {
  const baseTone = input.reassuranceTone || 'Calm';
  const toneSeed = `${seed}:${mode}:${baseTone}:${input.delayOrComplication}:${input.customerConcern}`;
  const base = pick(REASSURANCE_PATTERNS[baseTone], toneSeed);

  if (mode === 'Delay recovery') {
    return input.delayOrComplication
      ? `I'll keep you updated if the timing shifts. ${base}`
      : `I'll keep you updated if anything slows down. ${base}`;
  }

  if (input.delayOrComplication) {
    return `${base} If anything changes, I'll tell you right away.`;
  }

  return base;
}

function buildBenefitLine(input: WhatHappensNextInput, mode: WhatHappensNextMode): string {
  const reason = `${input.reasonForStep} ${input.delayOrComplication} ${input.customerConcern}`.toLowerCase();

  if (mode === 'Delay recovery') {
    return input.delayOrComplication
      ? 'That way, you know what is happening and there is no guesswork.'
      : 'That way, you know what is happening and the next update stays clear.';
  }

  if (/\btrade\b|\bvalue\b|\bappraisal\b/.test(reason)) {
    return 'That way, you know we are checking the value before we move forward.';
  }

  if (/\bnumbers\b|\bpayment\b|\bdeal\b/.test(reason)) {
    return 'That way, the numbers stay clear before you move ahead.';
  }

  if (/\bfinance\b|\bpaperwork\b|\bf&i\b/.test(reason)) {
    return 'That way, the paperwork stays organized and easy for you to follow.';
  }

  if (/\bservice\b|\bparts\b|\brepair\b|\btechnician\b/.test(reason)) {
    return 'That way, you get a clear update while we check the status.';
  }

  if (/\bdelivery\b|\bcleanup\b|\bprep\b/.test(reason)) {
    return 'That way, the handoff stays smooth and ready for you.';
  }

  if (input.customerConcern) {
    return 'That way, it stays simple and comfortable for you.';
  }

  return 'That way, everything stays simple and moves in the right order.';
}

function buildModeHint(mode: WhatHappensNextMode, input: WhatHappensNextInput): string {
  if (mode === 'Short') return 'Keep it direct and easy to say out loud.';
  if (mode === 'Warmer') return 'Lead with empathy, then give the next step.';
  if (mode === 'Confident') return 'Sound certain, organized, and calm.';
  if (mode === 'Premium') return 'Make the handoff feel smooth and polished.';
  if (mode === 'Service') return 'Use clear updates and avoid sounding rushed.';
  if (mode === 'F&I') return 'Stay organized and make the paperwork step feel simple.';
  if (mode === 'Delay recovery') return 'Acknowledge the wait without sounding defensive.';
  return input.delayOrComplication ? 'Acknowledge the delay before moving on.' : 'Keep the next step easy to follow.';
}

function buildWhyItWorks(input: WhatHappensNextInput, mode: WhatHappensNextMode): string {
  if (mode === 'Delay recovery') {
    return 'It names the next step, sets a realistic timing expectation, and lowers pressure by acknowledging the wait plainly.';
  }

  if (input.delayOrComplication) {
    return 'It explains the next step, gives a realistic time frame, and keeps the customer steady even if the timing is not perfect.';
  }

  return 'It gives the customer direction, sets a realistic expectation, and reassures them without using filler or overpromising.';
}

function buildTemplate(mode: WhatHappensNextMode, step: string, time: string, reassurance: string, input: WhatHappensNextInput, seed: string): { script: string; nextHappensLine: string; timingLine: string; reassuranceLine: string } {
  const template = pick(LIVE_LINE_TEMPLATES, seed);
  const nextHappensLine = `${template.lead} ${step}.`;
  const benefitLine = buildBenefitLine(input, mode);
  const timingLine = `${template.timeLead} ${time}.`;
  const reassuranceLine = reassurance.endsWith('.') ? reassurance : `${reassurance}.`;

  const parts = [nextHappensLine, benefitLine, timingLine, `${template.reassuranceLead} ${reassuranceLine}`];
  const script = parts.join(' ')
    .replace(/minutesutes/gi, 'minutes')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    script,
    nextHappensLine,
    timingLine,
    reassuranceLine,
  };
}

export function buildWhatHappensNextPlan(input: WhatHappensNextInput, mode: WhatHappensNextMode, variantSeed = 0): WhatHappensNextPlan {
  const step = formatStep(input.nextStep, mode);
  const time = formatTimeEstimate(input);
  const reassurance = chooseReassurance(input, mode, `${variantSeed}:${step}:${time}`);
  const template = buildTemplate(mode, step, time, reassurance, input, `${variantSeed}:${mode}:${step}:${time}:${input.reasonForStep}:${input.delayOrComplication}:${input.customerConcern}`);
  const cleanerStep = step;

  const clarityFlags = Array.from(new Set([
    !input.nextStep ? 'Missing next step' : '',
    !input.estimatedTime ? 'Timing inferred' : '',
    input.delayOrComplication ? 'Delay acknowledged' : '',
    input.customerConcern ? 'Customer concern addressed' : '',
  ].filter(Boolean)));

  return {
    mode,
    script: template.script,
    nextHappensLine: template.nextHappensLine,
    timingLine: template.timingLine,
    reassuranceLine: template.reassuranceLine,
    whyItWorks: buildWhyItWorks(input, mode),
    cleanerStep,
    altVersion: `${template.nextHappensLine} ${time ? `That will probably take about ${time}.` : ''} ${reassurance}`.replace(/\s+/g, ' ').trim(),
    conciseVersion: `${step}. About ${time}. ${reassurance}`.replace(/\s+/g, ' ').trim(),
    modeHint: buildModeHint(mode, input),
    clarityFlags,
  };
}

function cxWeakestSignal(user?: User | null): { key: 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship'; score: number } | null {
  if (!user?.hasAutoDriveCX) return null;

  const scores = {
    empathy: readUserCxStatScore(user, 'empathy'),
    listening: readUserCxStatScore(user, 'listening'),
    trust: readUserCxStatScore(user, 'trust'),
    followUp: readUserCxStatScore(user, 'followUp'),
    closing: readUserCxStatScore(user, 'closing'),
    relationship: readUserCxStatScore(user, 'relationship'),
  };

  const [key, score] = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  return {
    key: key as 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship',
    score,
  };
}

export function getWhatHappensNextSprocketInsight(input: WhatHappensNextInput, plan: WhatHappensNextPlan): WhatHappensNextSprocketInsight {
  const vagueStep = input.nextStep.trim().length < 10 || /\b(work|something|stuff|figure it out|take care of it|working on it)\b/i.test(input.nextStep);
  const whyThisMatters = vagueStep
    ? 'If the next step sounds vague, the customer has to guess what happens next and the conversation feels less controlled.'
    : input.delayOrComplication
      ? 'A clear wait explanation keeps the customer calm and prevents the delay from sounding evasive.'
      : 'A crisp next step keeps the customer oriented and makes the handoff feel organized.';

  const cleanerStep = plan.cleanerStep || input.nextStep || 'move to the next step';
  const sayThisInstead = `${plan.nextHappensLine} ${plan.timingLine} ${plan.reassuranceLine}`.replace(/\s+/g, ' ').trim();

  const clarityFocus = Array.from(new Set([
    input.nextStep.trim().length < 10 ? 'Make the next step more specific' : '',
    !input.estimatedTime ? 'Use a realistic time window' : '',
    input.delayOrComplication ? 'Lead with the delay honestly' : '',
    input.customerConcern ? 'Acknowledge the customer concern' : '',
  ].filter(Boolean)));

  return {
    cleanerStep,
    whyThisMatters,
    sayThisInstead,
    clarityFocus,
  };
}

export function getWhatHappensNextCxInsight(input: WhatHappensNextInput, plan: WhatHappensNextPlan, user?: User | null): WhatHappensNextCxInsight {
  const weakest = cxWeakestSignal(user);
  if (!weakest) {
    return {
      recommendedTone: input.reassuranceTone,
      recommendedMode: plan.mode,
      rationale: 'No CX profile is available, so the current tone is the safest fit.',
      focus: ['Keep the language clear', 'Avoid overpromising timing'],
    };
  }

  if (weakest.key === 'trust') {
    return {
      recommendedTone: 'Calm',
      recommendedMode: input.delayOrComplication ? 'Delay recovery' : plan.mode,
      rationale: `Trust is the weakest CX signal (${Math.round(weakest.score)}), so a calmer, more transparent tone will land best.`,
      focus: ['Lead with transparency', 'Use a realistic time estimate', 'Offer a clear update path'],
    };
  }

  if (weakest.key === 'listening') {
    return {
      recommendedTone: 'Warm',
      recommendedMode: 'Warmer',
      rationale: `Listening is the weakest CX signal (${Math.round(weakest.score)}), so the customer will respond best to a warmer, more acknowledgement-led version.`,
      focus: ['Mirror the concern first', 'Keep the handoff simple', 'Avoid sounding rushed'],
    };
  }

  if (weakest.key === 'followUp') {
    return {
      recommendedTone: 'Organized',
      recommendedMode: 'Premium',
      rationale: `Follow-up consistency is the weakest CX signal (${Math.round(weakest.score)}), so make the next update point very explicit.`,
      focus: ['Set the next checkpoint', 'Repeat the timing window', 'Make ownership obvious'],
    };
  }

  if (weakest.key === 'closing') {
    return {
      recommendedTone: 'Direct',
      recommendedMode: 'Confident',
      rationale: `Closing confidence is the weakest CX signal (${Math.round(weakest.score)}), so a more direct and organized script will help.`,
      focus: ['State the next move clearly', 'Keep the ask simple', 'Do not add extra filler'],
    };
  }

  if (weakest.key === 'empathy') {
    return {
      recommendedTone: 'Warm',
      recommendedMode: 'Warmer',
      rationale: `Empathy is the weakest CX signal (${Math.round(weakest.score)}), so lead with a more human, lower-pressure explanation.`,
      focus: ['Acknowledge the customer first', 'Keep the tone calm', 'Slow the pace slightly'],
    };
  }

  return {
    recommendedTone: 'Premium',
    recommendedMode: plan.mode,
    rationale: `Relationship consistency is the weakest CX signal (${Math.round(weakest.score)}), so keep the handoff polished and predictable.`,
    focus: ['Keep the next step polished', 'Stay predictable', 'Avoid abrupt transitions'],
  };
}
