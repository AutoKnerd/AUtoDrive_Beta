import type { User } from '@/lib/definitions';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';

export const LIVE_OBSERVATION_ROLES = ['Sales Associate', 'Service Advisor'] as const;
export const LIVE_OBSERVATION_REACTIONS = [
  'frustrated',
  'skeptical',
  'rushed',
  'overwhelmed',
  'defensive',
  'disappointed',
  'confused',
  'unknown',
] as const;
export const LIVE_OBSERVATION_THEMES = [
  'greeting',
  'discovery',
  'objection',
  'price/payment',
  'trade',
  'repair approval',
  'status update',
  'handoff',
  'follow-up',
  'general',
] as const;

export type LiveObservationRole = typeof LIVE_OBSERVATION_ROLES[number];
export type LiveObservationReaction = typeof LIVE_OBSERVATION_REACTIONS[number];
export type LiveObservationTheme = typeof LIVE_OBSERVATION_THEMES[number];
export type LiveObservationMetric = 'clarity' | 'listening' | 'confidence' | 'next-step control';
export type LiveObservationMetricLabel = 'Clarity' | 'Listening' | 'Confidence' | 'Next-step control';

export const LIVE_OBSERVATION_METRICS: LiveObservationMetric[] = ['clarity', 'listening', 'confidence', 'next-step control'];

export type LiveObservationInput = {
  role: LiveObservationRole;
  whatHappened: string;
  customerReaction: string;
  associateBehavior: string;
  missedOpportunity: string;
  clarity: number;
  listening: number;
  confidence: number;
  nextStepControl: number;
  managerNote: string;
  associateName?: string;
};

export type LiveObservationScoreMetric = {
  label: LiveObservationMetricLabel;
  value: number;
  note: string;
};

export type LiveObservationPlan = {
  observationTheme: LiveObservationTheme;
  coachingHeadline: string;
  reinforce: string;
  adjust: string;
  practiceRep: string;
  followUpCommitment: string;
  coachThisWay: string;
  avoidThis: string;
  bestDrill: string;
  summary: string;
  quickCopy: string;
  scorecard: LiveObservationScoreMetric[];
};

export type LiveObservationSprocketInsight = {
  rootCause: string;
  coachingLanguage: string;
  bestDrill: string;
  riskyPhrases: string[];
  nextCoachMove: string;
  calmText: string;
};

export type LiveObservationCxMetric = {
  label: LiveObservationMetricLabel;
  note: string;
};

export type LiveObservationHistorySummary = {
  totalSaved: number;
  repeatMetric?: LiveObservationMetricLabel;
  repeatCount?: number;
  recentRole?: LiveObservationRole;
  recentTheme?: LiveObservationTheme;
  recentBehavior?: string;
  recentReaction?: string;
};

export type LiveObservationCxInsight = {
  hasProfile: boolean;
  focusSkill: LiveObservationMetricLabel;
  trendType: 'one-off' | 'trend';
  personalNote: string;
  coachingNotes: LiveObservationCxMetric[];
};

export type LiveObservationSavedEntry = {
  id: string;
  signature: string;
  createdAt: string;
  variantSeed: number;
  role: LiveObservationRole;
  whatHappened: string;
  customerReaction: string;
  associateBehavior: string;
  missedOpportunity: string;
  clarity: number;
  listening: number;
  confidence: number;
  nextStepControl: number;
  managerNote: string;
  associateName?: string;
  observationTheme: LiveObservationTheme;
  coachingHeadline: string;
  reinforce: string;
  adjust: string;
  practiceRep: string;
  followUpCommitment: string;
  coachThisWay: string;
  avoidThis: string;
  bestDrill: string;
  summary: string;
  quickCopy: string;
  scorecard: LiveObservationScoreMetric[];
  favorite?: boolean;
  sprocketInsight?: LiveObservationSprocketInsight | null;
  cxInsight?: LiveObservationCxInsight | null;
};

type ThemePack = {
  headlines: readonly string[];
  reinforces: readonly string[];
  adjusts: readonly string[];
  reps: readonly string[];
  commitments: readonly string[];
  coachThisWay: readonly string[];
  avoidThis: readonly string[];
  drills: readonly string[];
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(items: readonly T[], seed: string): T {
  const safeItems = items.length > 0 ? items : [undefined as T];
  return safeItems[hashSeed(seed) % safeItems.length];
}

function ensureSentence(value: string): string {
  const text = normalizeText(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function joinSentences(parts: string[]): string {
  return parts
    .map((part) => ensureSentence(part))
    .filter(Boolean)
    .join(' ');
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, value));
}

function roleLine(role: LiveObservationRole, sales: string, service: string): string {
  return role === 'Sales Associate' ? sales : service;
}

function observationSubject(input: LiveObservationInput): string {
  const name = normalizeText(input.associateName || '');
  if (name) return name;
  return roleLine(input.role, 'the associate', 'the advisor');
}

function buildScorecard(input: LiveObservationInput): LiveObservationScoreMetric[] {
  return [
    {
      label: 'Clarity',
      value: clampScore(input.clarity),
      note: input.clarity >= 4
        ? 'Keep the message short enough for the customer to repeat back.'
        : 'Tighten the explanation so the next step is easier to hear.',
    },
    {
      label: 'Listening',
      value: clampScore(input.listening),
      note: input.listening >= 4
        ? 'The rep stayed present long enough to hear the customer.'
        : 'Coach one cleaner pause and one better question.',
    },
    {
      label: 'Confidence',
      value: clampScore(input.confidence),
      note: input.confidence >= 4
        ? 'The delivery felt steady and easy to trust.'
        : 'Coach a calmer voice and fewer filler words.',
    },
    {
      label: 'Next-step control',
      value: clampScore(input.nextStepControl),
      note: input.nextStepControl >= 4
        ? 'The next move was visible and owned.'
        : 'Coach a cleaner handoff and a more direct next step.',
    },
  ];
}

function lowestMetric(scorecard: LiveObservationScoreMetric[]): LiveObservationScoreMetric {
  return [...scorecard].sort((a, b) => a.value - b.value)[0];
}

function metricKeyFromLabel(label: LiveObservationMetricLabel): LiveObservationMetric {
  switch (label) {
    case 'Clarity':
      return 'clarity';
    case 'Listening':
      return 'listening';
    case 'Confidence':
      return 'confidence';
    case 'Next-step control':
      return 'next-step control';
    default:
      return 'clarity';
  }
}

function metricNote(metric: LiveObservationMetric, value: number, theme: LiveObservationTheme, role: LiveObservationRole): string {
  const metricNotes: Record<LiveObservationMetric, { strong: string; lift: string }> = {
    clarity: {
      strong: roleLine(role, 'The line should be easy to repeat back.', 'The update should be easy to repeat back.'),
      lift: theme === 'price/payment' || theme === 'repair approval'
        ? 'Coach the explanation down to one cleaner sentence.'
        : 'Coach one shorter sentence and one clearer next step.',
    },
    listening: {
      strong: roleLine(role, 'The rep stayed with the customer long enough to hear the concern.', 'The advisor stayed with the customer long enough to hear the concern.'),
      lift: theme === 'greeting' || theme === 'discovery'
        ? 'Coach a slower pause before steering the conversation.'
        : 'Coach one better question before any explanation.',
    },
    confidence: {
      strong: roleLine(role, 'The delivery had a steady tone.', 'The update had a steady tone.'),
      lift: theme === 'handoff' || theme === 'status update'
        ? 'Coach a steadier pace and fewer filler words.'
        : 'Coach a calmer voice and a cleaner landing.',
    },
    'next-step control': {
      strong: roleLine(role, 'The next move was easy to spot.', 'The next checkpoint was easy to spot.'),
      lift: theme === 'follow-up'
        ? 'Coach the next touch and the time frame more clearly.'
        : 'Coach the next move sooner and stop talking after it is named.',
    },
  };

  const pack = metricNotes[metric];
  return value >= 4 ? pack.strong : pack.lift;
}

function buildThemePack(role: LiveObservationRole, theme: LiveObservationTheme): ThemePack {
  const shared = {
    headlines: [
      roleLine(role, 'Tighten the live moment and make the next step obvious.', 'Tighten the live moment and make the next checkpoint obvious.'),
      roleLine(role, 'Coach the behavior, not the person.', 'Coach the behavior, not the person.'),
    ],
    reinforces: [
      roleLine(role, 'The rep/advisor gave the customer a real path forward.', 'The advisor gave the customer a real path forward.'),
      roleLine(role, 'The moment had a good opening to build trust.', 'The moment had a good opening to build trust.'),
    ],
    adjusts: [
      roleLine(role, 'Make the next sentence cleaner and more specific.', 'Make the next sentence cleaner and more specific.'),
      roleLine(role, 'Keep the customer from having to guess what happens next.', 'Keep the customer from having to guess what happens next.'),
    ],
    reps: [
      roleLine(role, 'Try the same moment again with one calmer pause.', 'Try the same moment again with one calmer pause.'),
      roleLine(role, 'Practice the line one more time and land the next step sooner.', 'Practice the line one more time and land the next checkpoint sooner.'),
    ],
    commitments: [
      roleLine(role, 'Next time, I will coach one visible behavior and one repeatable line.', 'Next time, I will coach one visible behavior and one repeatable line.'),
      roleLine(role, 'Next time, I will stay on the behavior long enough to hear it land.', 'Next time, I will stay on the behavior long enough to hear it land.'),
    ],
    coachThisWay: [
      roleLine(role, 'Keep the language calm, specific, and easy to act on.', 'Keep the language calm, specific, and easy to act on.'),
      roleLine(role, 'Give the customer direction without sounding pushy.', 'Give the customer direction without sounding pushy.'),
    ],
    avoidThis: [
      'Avoid turning the coaching into a performance review.',
      'Do not use labels that sound vague or personal.',
    ],
    drills: [
      'Run a one-moment coaching drill: name it, tighten it, repeat it.',
      'Run a pause-and-rep drill with one cleaner line.',
    ],
  };

  const themeOverrides: Record<LiveObservationTheme, Partial<ThemePack>> = {
    greeting: {
      headlines: [
        roleLine(role, 'Make the first moment warmer and clearer.', 'Make the first moment calmer and clearer.'),
        roleLine(role, 'The opening needs one cleaner welcome and one better question.', 'The opening needs one cleaner welcome and one better question.'),
      ],
      reinforces: [
        roleLine(role, 'The opening did not feel rude; it just needs a better landing.', 'The opening did not feel rude; it just needs a better landing.'),
        roleLine(role, 'There was a chance to slow down and earn trust right away.', 'There was a chance to slow down and earn trust right away.'),
      ],
      adjusts: [
        roleLine(role, 'Lead with welcome, then ask one simple question.', 'Lead with a calm welcome, then ask one simple question.'),
      ],
      reps: [
        roleLine(role, 'Try: “Good to see you. What brought you in today?”', 'Try: “Good to see you. What brings you in today?”'),
      ],
      commitments: [
        'Next time, I will coach the first ten seconds before anything else.',
      ],
      coachThisWay: [
        roleLine(role, 'Open warmly, then pause for the customer to answer.', 'Open warmly, then pause for the customer to answer.'),
      ],
      avoidThis: [
        'Avoid starting with too much business before the welcome lands.',
      ],
      drills: ['Run a greeting reset and repeat the first line at real speed.'],
    },
    discovery: {
      headlines: [
        roleLine(role, 'Slow the conversation and ask one better question.', 'Slow the conversation and ask one better question.'),
        roleLine(role, 'The rep/advisor moved too fast past discovery.', 'The rep/advisor moved too fast past discovery.'),
      ],
      reinforces: [
        roleLine(role, 'The customer gave a clue that should shape the next question.', 'The customer gave a clue that should shape the next question.'),
      ],
      adjusts: [
        roleLine(role, 'Ask once, pause, and listen before you explain.', 'Ask once, pause, and listen before you explain.'),
      ],
      reps: [
        roleLine(role, 'Try: “Tell me a little more about that.”', 'Try: “Tell me a little more about that.”'),
      ],
      commitments: [
        'Next time, I will coach one better question before any answer.',
      ],
      coachThisWay: [
        roleLine(role, 'Let the customer talk first and guide the next step.', 'Let the customer talk first and guide the next step.'),
      ],
      avoidThis: [
        'Avoid jumping to a fix before the real need is clear.',
      ],
      drills: ['Run a one-question discovery drill with a pause after the question.'],
    },
    objection: {
      headlines: [
        roleLine(role, 'Meet the pushback without getting defensive.', 'Meet the pushback without getting defensive.'),
        roleLine(role, 'The concern needs a calmer answer before the next step.', 'The concern needs a calmer answer before the next step.'),
      ],
      reinforces: [
        roleLine(role, 'The concern surfaced clearly, so there is room to coach the response.', 'The concern surfaced clearly, so there is room to coach the response.'),
      ],
      adjusts: [
        roleLine(role, 'Answer the concern first and keep the tone even.', 'Answer the concern first and keep the tone even.'),
      ],
      reps: [
        roleLine(role, 'Try: “I hear the concern. Let me show you the next step.”', 'Try: “I hear the concern. Let me show you the next step.”'),
      ],
      commitments: [
        'Next time, I will coach the pause before the answer.',
      ],
      coachThisWay: [
        roleLine(role, 'Stay calm, answer directly, and keep the customer with you.', 'Stay calm, answer directly, and keep the customer with you.'),
      ],
      avoidThis: [
        'Avoid arguing, explaining too much, or sounding annoyed.',
      ],
      drills: ['Run a calm-answer drill and repeat the concern in plain language.'],
    },
    'price/payment': {
      headlines: [
        roleLine(role, 'Keep the number clear and keep the tone calm.', 'Keep the number clear and keep the tone calm.'),
        roleLine(role, 'The price talk needs one cleaner landing.', 'The payment talk needs one cleaner landing.'),
      ],
      reinforces: [
        roleLine(role, 'The rep/advisor did not avoid the number.', 'The rep/advisor did not avoid the number.'),
      ],
      adjusts: [
        roleLine(role, 'State the number once, then give the reason and stop.', 'State the number once, then give the reason and stop.'),
      ],
      reps: [
        roleLine(role, 'Try: “Here is the number, and here is why it makes sense.”', 'Try: “Here is the number, and here is why it makes sense.”'),
      ],
      commitments: [
        'Next time, I will coach the number with one calm pause after it lands.',
      ],
      coachThisWay: [
        roleLine(role, 'Make the number easy to hear and easy to trust.', 'Make the number easy to hear and easy to trust.'),
      ],
      avoidThis: [
        'Avoid burying the number under extra words.',
      ],
      drills: ['Run a numbers-with-pause drill before the next price conversation.'],
    },
    trade: {
      headlines: [
        roleLine(role, 'Make the trade path transparent and easy to trust.', 'Make the trade path transparent and easy to trust.'),
        roleLine(role, 'The trade explanation needs a cleaner bridge.', 'The trade explanation needs a cleaner bridge.'),
      ],
      reinforces: [
        roleLine(role, 'There was a chance to build trust with a fair explanation.', 'There was a chance to build trust with a fair explanation.'),
      ],
      adjusts: [
        roleLine(role, 'Explain how the trade was handled in plain language.', 'Explain how the trade was handled in plain language.'),
      ],
      reps: [
        roleLine(role, 'Try: “Here is how we reviewed the trade.”', 'Try: “Here is how we reviewed the trade.”'),
      ],
      commitments: [
        'Next time, I will coach the explanation before the value is discussed.',
      ],
      coachThisWay: [
        roleLine(role, 'Keep the trade conversation fair, calm, and simple.', 'Keep the trade conversation fair, calm, and simple.'),
      ],
      avoidThis: [
        'Avoid making the trade feel hidden or defensive.',
      ],
      drills: ['Run a transparency drill and have the rep explain the trade in one line.'],
    },
    'repair approval': {
      headlines: [
        roleLine(role, 'Make the repair reason easy to understand.', 'Make the repair reason easy to understand.'),
        roleLine(role, 'The approval ask needs a cleaner explanation.', 'The approval ask needs a cleaner explanation.'),
      ],
      reinforces: [
        roleLine(role, 'The need for the repair was present, but the explanation can be simpler.', 'The need for the repair was present, but the explanation can be simpler.'),
      ],
      adjusts: [
        roleLine(role, 'Explain the need, then ask for approval plainly.', 'Explain the need, then ask for approval plainly.'),
      ],
      reps: [
        roleLine(role, 'Try: “Here is what we found, and here is the next step.”', 'Try: “Here is what we found, and here is the next step.”'),
      ],
      commitments: [
        'Next time, I will coach the repair explanation before the approval ask.',
      ],
      coachThisWay: [
        roleLine(role, 'Stay respectful, clear, and customer-first.', 'Stay respectful, clear, and customer-first.'),
      ],
      avoidThis: [
        'Avoid sounding like the repair is already decided.',
      ],
      drills: ['Run a need-first approval drill with one clean explanation.'],
    },
    'status update': {
      headlines: [
        roleLine(role, 'Give a short update and a real checkpoint.', 'Give a short update and a real checkpoint.'),
        roleLine(role, 'The customer needs a clearer status line.', 'The customer needs a clearer status line.'),
      ],
      reinforces: [
        roleLine(role, 'The update happened, but it can be easier to follow.', 'The update happened, but it can be easier to follow.'),
      ],
      adjusts: [
        roleLine(role, 'State what is known and when the next touch will happen.', 'State what is known and when the next touch will happen.'),
      ],
      reps: [
        roleLine(role, 'Try: “Here is where we are now, and here is the next checkpoint.”', 'Try: “Here is where we are now, and here is the next checkpoint.”'),
      ],
      commitments: [
        'Next time, I will coach one update and one checkpoint only.',
      ],
      coachThisWay: [
        roleLine(role, 'Keep the update short, current, and easy to trust.', 'Keep the update short, current, and easy to trust.'),
      ],
      avoidThis: [
        'Avoid giving a long update that still leaves the customer guessing.',
      ],
      drills: ['Run a clear-update drill with one status line and one next checkpoint.'],
    },
    handoff: {
      headlines: [
        roleLine(role, 'Make the handoff owned and explicit.', 'Make the handoff owned and explicit.'),
        roleLine(role, 'The transition needs a cleaner bridge.', 'The transition needs a cleaner bridge.'),
      ],
      reinforces: [
        roleLine(role, 'The conversation moved to the next person, but the bridge could be cleaner.', 'The conversation moved to the next person, but the bridge could be cleaner.'),
      ],
      adjusts: [
        roleLine(role, 'Name who is taking over and what happens next.', 'Name who is taking over and what happens next.'),
      ],
      reps: [
        roleLine(role, 'Try: “I’m going to hand this to the next step now.”', 'Try: “I’m going to hand this to the next step now.”'),
      ],
      commitments: [
        'Next time, I will coach the handoff line before the transition happens.',
      ],
      coachThisWay: [
        roleLine(role, 'Make the transition feel owned, not dropped.', 'Make the transition feel owned, not dropped.'),
      ],
      avoidThis: [
        'Avoid leaving the customer to guess who owns the next move.',
      ],
      drills: ['Run a handoff ownership drill and name the next owner out loud.'],
    },
    'follow-up': {
      headlines: [
        roleLine(role, 'Close the loop with one clear next touch.', 'Close the loop with one clear next touch.'),
        roleLine(role, 'The follow-up needs a firmer commitment.', 'The follow-up needs a firmer commitment.'),
      ],
      reinforces: [
        roleLine(role, 'The rep/advisor had a chance to lock in the next contact.', 'The rep/advisor had a chance to lock in the next contact.'),
      ],
      adjusts: [
        roleLine(role, 'State the next touch, the timing, and the owner.', 'State the next touch, the timing, and the owner.'),
      ],
      reps: [
        roleLine(role, 'Try: “I’ll follow up at this time with this next step.”', 'Try: “I’ll follow up at this time with this next step.”'),
      ],
      commitments: [
        'Next time, I will coach one clear follow-up line before the customer leaves.',
      ],
      coachThisWay: [
        roleLine(role, 'Keep the promise simple and easy to remember.', 'Keep the promise simple and easy to remember.'),
      ],
      avoidThis: [
        'Avoid a vague promise that the customer cannot hold onto.',
      ],
      drills: ['Run a next-touch drill and repeat the follow-up line exactly.'],
    },
    general: {
      headlines: [
        roleLine(role, 'Tighten the moment and make the next step obvious.', 'Tighten the moment and make the next step obvious.'),
        roleLine(role, 'Coach one cleaner behavior and one cleaner line.', 'Coach one cleaner behavior and one cleaner line.'),
      ],
      reinforces: [
        roleLine(role, 'The observation shows a real coaching moment.', 'The observation shows a real coaching moment.'),
      ],
      adjusts: [
        roleLine(role, 'Make the behavior easier to see and easier to repeat.', 'Make the behavior easier to see and easier to repeat.'),
      ],
      reps: [
        roleLine(role, 'Try the same moment again with a simpler line.', 'Try the same moment again with a simpler line.'),
      ],
      commitments: [
        'Next time, I will coach one visible behavior and one follow-through line.',
      ],
      coachThisWay: [
        roleLine(role, 'Keep the feedback behavioral, calm, and direct.', 'Keep the feedback behavioral, calm, and direct.'),
      ],
      avoidThis: [
        'Avoid vague feedback that does not change the next rep.',
      ],
      drills: ['Run a one-line coaching drill and repeat the behavior once more.'],
    },
  };

  return {
    ...shared,
    ...themeOverrides[theme],
    headlines: [...(themeOverrides[theme]?.headlines ?? shared.headlines)],
    reinforces: [...(themeOverrides[theme]?.reinforces ?? shared.reinforces)],
    adjusts: [...(themeOverrides[theme]?.adjusts ?? shared.adjusts)],
    reps: [...(themeOverrides[theme]?.reps ?? shared.reps)],
    commitments: [...(themeOverrides[theme]?.commitments ?? shared.commitments)],
    coachThisWay: [...(themeOverrides[theme]?.coachThisWay ?? shared.coachThisWay)],
    avoidThis: [...(themeOverrides[theme]?.avoidThis ?? shared.avoidThis)],
    drills: [...(themeOverrides[theme]?.drills ?? shared.drills)],
  };
}

function inferObservationTheme(input: LiveObservationInput): LiveObservationTheme {
  const text = [
    input.whatHappened,
    input.customerReaction,
    input.associateBehavior,
    input.missedOpportunity,
    input.managerNote,
  ].join(' ').toLowerCase();

  const matches: Array<[LiveObservationTheme, string[]]> = [
    ['greeting', ['greet', 'welcome', 'opened', 'opening', 'first moment', 'first contact']],
    ['discovery', ['discover', 'question', 'ask', 'need', 'needs', 'understand']],
    ['objection', ['objection', 'pushback', 'resist', 'skeptic', 'concern', 'defensive', 'push back']],
    ['price/payment', ['price', 'payment', 'number', 'numbers', 'monthly', 'payment plan', '$']],
    ['trade', ['trade', 'appraisal', 'trade-in', 'trade value']],
    ['repair approval', ['repair', 'approval', 'approve', 'estimate', 'repair order', 'recommendation']],
    ['status update', ['status', 'update', 'waiting', 'delay', 'delayed', 'progress', 'where we are']],
    ['handoff', ['handoff', 'handover', 'manager', 'finance', 'fi', 'f&i', 'transition']],
    ['follow-up', ['follow up', 'follow-up', 'call back', 'text back', 'return']],
  ];

  for (const [theme, keywords] of matches) {
    if (keywords.some((keyword) => text.includes(keyword))) return theme;
  }

  return 'general';
}

function buildObservationSummary(input: LiveObservationInput): string {
  const subject = observationSubject(input);
  return joinSentences([
    input.whatHappened,
    input.customerReaction ? `Customer reaction: ${input.customerReaction}` : '',
    input.associateBehavior ? `Observed behavior: ${input.associateBehavior}` : '',
    input.missedOpportunity ? `Missed opportunity: ${input.missedOpportunity}` : '',
    `${subject} can coach this through the next interaction.`,
  ]);
}

function bestDrillForTheme(theme: LiveObservationTheme, role: LiveObservationRole): string {
  const drillMap: Record<LiveObservationTheme, readonly string[]> = {
    greeting: [
      roleLine(role, 'Run a greeting reset drill and repeat the first line twice.', 'Run a greeting reset drill and repeat the first line twice.'),
      roleLine(role, 'Run a first-contact drill with one welcome and one question.', 'Run a first-contact drill with one welcome and one question.'),
    ],
    discovery: [
      roleLine(role, 'Run a one-question discovery drill with a pause.', 'Run a one-question discovery drill with a pause.'),
      roleLine(role, 'Run a discovery ladder and stop after the first answer.', 'Run a discovery ladder and stop after the first answer.'),
    ],
    objection: [
      roleLine(role, 'Run a calm-answer drill and repeat the concern back once.', 'Run a calm-answer drill and repeat the concern back once.'),
      roleLine(role, 'Run a pause-and-answer drill until the tone stays steady.', 'Run a pause-and-answer drill until the tone stays steady.'),
    ],
    'price/payment': [
      roleLine(role, 'Run a numbers-with-pause drill and keep the line short.', 'Run a numbers-with-pause drill and keep the line short.'),
      roleLine(role, 'Run a clear-number drill and coach the next sentence.', 'Run a clear-number drill and coach the next sentence.'),
    ],
    trade: [
      roleLine(role, 'Run a transparency drill and explain the trade in one line.', 'Run a transparency drill and explain the trade in one line.'),
      roleLine(role, 'Run a value-bridge drill with one clean handoff.', 'Run a value-bridge drill with one clean handoff.'),
    ],
    'repair approval': [
      roleLine(role, 'Run a need-first approval drill and keep it simple.', 'Run a need-first approval drill and keep it simple.'),
      roleLine(role, 'Run a repair explanation drill and stop after the first ask.', 'Run a repair explanation drill and stop after the first ask.'),
    ],
    'status update': [
      roleLine(role, 'Run a clear-update drill with one status line and one checkpoint.', 'Run a clear-update drill with one status line and one checkpoint.'),
      roleLine(role, 'Run a status-and-next-step drill at a steady pace.', 'Run a status-and-next-step drill at a steady pace.'),
    ],
    handoff: [
      roleLine(role, 'Run a handoff ownership drill and name the next owner out loud.', 'Run a handoff ownership drill and name the next owner out loud.'),
      roleLine(role, 'Run a transition drill and keep the bridge short.', 'Run a transition drill and keep the bridge short.'),
    ],
    'follow-up': [
      roleLine(role, 'Run a next-touch drill and repeat the follow-up line exactly.', 'Run a next-touch drill and repeat the follow-up line exactly.'),
      roleLine(role, 'Run a follow-up commitment drill with one date and one promise.', 'Run a follow-up commitment drill with one date and one promise.'),
    ],
    general: [
      roleLine(role, 'Run a one-line coaching drill and repeat the behavior once more.', 'Run a one-line coaching drill and repeat the behavior once more.'),
      roleLine(role, 'Run a reset drill with one cleaner line and one better pause.', 'Run a reset drill with one cleaner line and one better pause.'),
    ],
  };

  return pick(drillMap[theme], `${theme}|${role}`);
}

function buildMetricPack(role: LiveObservationRole, metric: LiveObservationMetric, theme: LiveObservationTheme): ThemePack {
  const themePack = buildThemePack(role, theme);
  const metricHeadline: Record<LiveObservationMetric, readonly string[]> = {
    clarity: [
      roleLine(role, 'Tighten the message and make the next step easier to hear.', 'Tighten the message and make the next checkpoint easier to hear.'),
      roleLine(role, 'The line needs one cleaner landing.', 'The line needs one cleaner landing.'),
    ],
    listening: [
      roleLine(role, 'Slow the pace and give the customer more room.', 'Slow the pace and give the customer more room.'),
      roleLine(role, 'The moment needed a better pause.', 'The moment needed a better pause.'),
    ],
    confidence: [
      roleLine(role, 'Speak with more ownership and fewer fillers.', 'Speak with more ownership and fewer fillers.'),
      roleLine(role, 'Keep the tone steady and certain.', 'Keep the tone steady and certain.'),
    ],
    'next-step control': [
      roleLine(role, 'Name the next move sooner and stop talking.', 'Name the next move sooner and stop talking.'),
      roleLine(role, 'Make the handoff visible and easy to follow.', 'Make the handoff visible and easy to follow.'),
    ],
  };

  const metricAdjust: Record<LiveObservationMetric, readonly string[]> = {
    clarity: [
      roleLine(role, 'Cut one sentence and make the point easier to repeat.', 'Cut one sentence and make the point easier to repeat.'),
      roleLine(role, 'Use plainer language and one cleaner ask.', 'Use plainer language and one cleaner ask.'),
    ],
    listening: [
      roleLine(role, 'Pause longer before steering the conversation.', 'Pause longer before steering the conversation.'),
      roleLine(role, 'Use one better question before any explanation.', 'Use one better question before any explanation.'),
    ],
    confidence: [
      roleLine(role, 'Slow the pace and remove filler words.', 'Slow the pace and remove filler words.'),
      roleLine(role, 'Coach a steadier voice at the turning point.', 'Coach a steadier voice at the turning point.'),
    ],
    'next-step control': [
      roleLine(role, 'Make the next step explicit and then stop.', 'Make the next step explicit and then stop.'),
      roleLine(role, 'Own the close or handoff in one direct line.', 'Own the close or handoff in one direct line.'),
    ],
  };

  const metricRep: Record<LiveObservationMetric, readonly string[]> = {
    clarity: [
      roleLine(role, 'Try: “Let me make the next step simple.”', 'Try: “Let me make the next step simple.”'),
      roleLine(role, 'Try: “Here is the plain-language version.”', 'Try: “Here is the plain-language version.”'),
    ],
    listening: [
      roleLine(role, 'Try: “Tell me a little more about that.”', 'Try: “Tell me a little more about that.”'),
      roleLine(role, 'Try: “What matters most to you right now?”', 'Try: “What matters most to you right now?”'),
    ],
    confidence: [
      roleLine(role, 'Try: “I can help with that, and here is the next step.”', 'Try: “I can help with that, and here is the next step.”'),
      roleLine(role, 'Try: “Let’s take this one step at a time.”', 'Try: “Let’s take this one step at a time.”'),
    ],
    'next-step control': [
      roleLine(role, 'Try: “Here is what happens next.”', 'Try: “Here is what happens next.”'),
      roleLine(role, 'Try: “I’ll take us to the next step now.”', 'Try: “I’ll take us to the next step now.”'),
    ],
  };

  const metricCommitment: Record<LiveObservationMetric, readonly string[]> = {
    clarity: ['Next time, I will coach one shorter line and one clearer ask.'],
    listening: ['Next time, I will coach one pause and one better question.'],
    confidence: ['Next time, I will coach the pace and the tone, not just the words.'],
    'next-step control': ['Next time, I will coach the next move and the pause that follows it.'],
  };

  const metricCoach: Record<LiveObservationMetric, readonly string[]> = {
    clarity: [
      roleLine(role, 'Keep the explanation short enough to repeat back.', 'Keep the explanation short enough to repeat back.'),
      roleLine(role, 'Lead with one clean sentence and one visible step.', 'Lead with one clean sentence and one visible checkpoint.'),
    ],
    listening: [
      roleLine(role, 'Hear the concern before you steer the next move.', 'Hear the concern before you steer the next move.'),
      roleLine(role, 'Let the customer finish, then respond once.', 'Let the customer finish, then respond once.'),
    ],
    confidence: [
      roleLine(role, 'Keep the voice calm, sure, and easy to follow.', 'Keep the voice calm, sure, and easy to follow.'),
      roleLine(role, 'Coach a steady pace and a clean landing.', 'Coach a steady pace and a clean landing.'),
    ],
    'next-step control': [
      roleLine(role, 'Give the customer the next move in one clear line.', 'Give the customer the next move in one clear line.'),
      roleLine(role, 'Own the handoff, the close, or the follow-up clearly.', 'Own the handoff, the close, or the follow-up clearly.'),
    ],
  };

  const metricAvoid: Record<LiveObservationMetric, readonly string[]> = {
    clarity: [
      'Avoid layering on extra detail before the customer is ready.',
      'Do not make the customer decode the point.',
    ],
    listening: [
      'Avoid talking over the customer or answering too early.',
      'Do not rush past the signal the customer is giving.',
    ],
    confidence: [
      'Avoid sounding like you are asking permission to speak.',
      'Do not let the line trail off at the end.',
    ],
    'next-step control': [
      'Avoid softening the ask until it disappears.',
      'Do not leave the conversation hanging open.',
    ],
  };

  const metricDrills: Record<LiveObservationMetric, readonly string[]> = {
    clarity: ['Run a one-sentence clarity drill and have the rep repeat it twice.'],
    listening: ['Run a pause-and-repeat drill until the rep hears the answer before responding.'],
    confidence: ['Run a voice-and-pace drill with one clean line and one clean pause.'],
    'next-step control': ['Run an ask-and-pause drill and have the rep name the next move out loud.'],
  };

  return {
    headlines: [...themePack.headlines, ...metricHeadline[metric]],
    reinforces: [...themePack.reinforces, metricNote(metric, 5, theme, role)],
    adjusts: [...themePack.adjusts, ...metricAdjust[metric]],
    reps: [...themePack.reps, ...metricRep[metric]],
    commitments: [...themePack.commitments, ...metricCommitment[metric]],
    coachThisWay: [...themePack.coachThisWay, ...metricCoach[metric]],
    avoidThis: [...themePack.avoidThis, ...metricAvoid[metric]],
    drills: [...themePack.drills, ...metricDrills[metric]],
  };
}

function buildRiskyPhrases(note: string, theme: LiveObservationTheme): string[] {
  const normalized = note.toLowerCase();
  const fallback = [
    'just',
    'you need to',
    'should',
    'obviously',
    'maybe',
    'we have to',
  ];

  const themeWords: Record<LiveObservationTheme, readonly string[]> = {
    greeting: ['busy', 'rush', 'speed up'],
    discovery: ['three questions', 'solve', 'jump in'],
    objection: ['calm down', 'trust me', 'not a big deal'],
    'price/payment': ['computer says', 'this is the number', 'because'],
    trade: ['best we can do', 'trade is fine', 'no room'],
    'repair approval': ['have to', 'must', 'needed'],
    'status update': ['soon', 'later', 'working on it'],
    handoff: ['someone else', 'not my area', 'they will'],
    'follow-up': ['maybe later', 'we can try', 'when we can'],
    general: fallback,
  };

  const matches = [...fallback, ...themeWords[theme]].filter((phrase) => normalized.includes(phrase.toLowerCase()));
  return matches.length > 0 ? Array.from(new Set(matches)) : [...themeWords[theme].slice(0, 3)];
}

function buildRootCause(input: LiveObservationInput, theme: LiveObservationTheme, dominant: LiveObservationMetric): string {
  const scoreText: Record<LiveObservationMetric, string> = {
    clarity: 'clarity',
    listening: 'listening',
    confidence: 'confidence',
    'next-step control': 'next-step control',
  };

  return joinSentences([
    `The observation shows a ${scoreText[dominant]} gap in a ${theme} moment.`,
    roleLine(
      input.role,
      'Coach the behavior, not the person, and keep the next step visible.',
      'Coach the behavior, not the person, and keep the next checkpoint visible.',
    ),
    theme === 'objection'
      ? 'The customer likely needed a calmer answer before the conversation could move again.'
      : 'The customer likely needed one cleaner line and a clearer next move.',
  ]);
}

function rewriteManagerLanguage(note: string, seed: string, fallback: string): string {
  const cleaned = normalizeText(note)
    .replace(/\byou need to\b/gi, 'let’s')
    .replace(/\byou have to\b/gi, 'we can')
    .replace(/\bwe have to\b/gi, 'let’s')
    .replace(/\bjust\b/gi, '')
    .replace(/\bkind of\b/gi, '')
    .replace(/\bmaybe\b/gi, 'likely')
    .replace(/\bshould\b/gi, 'can')
    .replace(/\btry and\b/gi, 'try to');

  const body = cleaned || fallback;
  return joinSentences([
    pick(['Coach it like this', 'Try this wording', 'Use this line'], seed),
    body,
  ]);
}

function determineTrendType(summary: LiveObservationHistorySummary | null | undefined, focusSkill: LiveObservationCxInsight['focusSkill']): 'one-off' | 'trend' {
  if (!summary || summary.totalSaved < 2) return 'one-off';
  if (summary.repeatMetric === focusSkill && (summary.repeatCount ?? 0) >= 2) return 'trend';
  return summary.totalSaved >= 4 ? 'trend' : 'one-off';
}

function buildCxNotes(
  focusSkill: LiveObservationCxInsight['focusSkill'],
  trendType: 'one-off' | 'trend',
  summary?: LiveObservationHistorySummary | null,
): LiveObservationCxMetric[] {
  const historyLine = summary?.recentRole
    ? `Recent observation: ${summary.recentRole}${summary.recentTheme ? ` / ${summary.recentTheme}` : ''}.`
    : 'Use the history to see whether the behavior is repeating.';

  const notes: Record<LiveObservationCxMetric['label'], string> = {
    Clarity: 'Coach one shorter line and one clearer ask.',
    Listening: 'Coach a cleaner pause and one better question.',
    Confidence: 'Coach a steadier voice and fewer fillers.',
    'Next-step control': 'Coach one visible next step and stop talking sooner.',
  };

  return [
    {
      label: 'Clarity',
      note: `${focusSkill === 'Clarity' ? 'This is the main lift point.' : 'Keep the explanation short and repeatable.'} ${notes.Clarity} ${trendType === 'trend' ? historyLine : ''}`,
    },
    {
      label: 'Listening',
      note: `${focusSkill === 'Listening' ? 'This is the main lift point.' : 'Give the customer more space before steering.'} ${notes.Listening} ${trendType === 'trend' ? historyLine : ''}`,
    },
    {
      label: 'Confidence',
      note: `${focusSkill === 'Confidence' ? 'This is the main lift point.' : 'Coach the delivery to sound steadier.'} ${notes.Confidence} ${trendType === 'trend' ? historyLine : ''}`,
    },
    {
      label: 'Next-step control',
      note: `${focusSkill === 'Next-step control' ? 'This is the main lift point.' : 'Keep the next move visible and simple.'} ${notes['Next-step control']} ${trendType === 'trend' ? historyLine : ''}`,
    },
  ];
}

export function getLiveObservationCoachCardPlan(input: LiveObservationInput, variantSeed = 0): LiveObservationPlan {
  const theme = inferObservationTheme(input);
  const seed = [
    input.role,
    theme,
    input.whatHappened,
    input.customerReaction,
    input.associateBehavior,
    input.missedOpportunity,
    input.clarity,
    input.listening,
    input.confidence,
    input.nextStepControl,
    normalizeText(input.managerNote),
    normalizeText(input.associateName ?? ''),
    String(variantSeed),
  ].join('|');

  const scorecard = buildScorecard(input);
  const dominant = metricKeyFromLabel(lowestMetric(scorecard).label);
  const pack = buildMetricPack(input.role, dominant, theme);
  const summary = buildObservationSummary(input);
  const coachThisWay = joinSentences([
    pick(pack.coachThisWay, seed),
    theme === 'general'
      ? 'Keep the feedback tied to what happened and what to do next.'
      : `Coach the ${theme} moment with one visible behavior and one cleaner line.`,
  ]);
  const avoidThis = joinSentences([
    pick(pack.avoidThis, seed),
    'Stay away from HR-style labels and keep it behavioral.',
  ]);

  const coachingHeadline = pick(pack.headlines, seed);
  const reinforce = pick(pack.reinforces, seed);
  const adjust = pick(pack.adjusts, seed);
  const practiceRep = pick(pack.reps, seed);
  const followUpCommitment = pick(pack.commitments, seed);
  const bestDrill = pick(pack.drills, seed);

  return {
    observationTheme: theme,
    coachingHeadline,
    reinforce,
    adjust,
    practiceRep,
    followUpCommitment,
    coachThisWay,
    avoidThis,
    bestDrill,
    summary,
    quickCopy: joinSentences([coachingHeadline, reinforce, adjust, practiceRep, followUpCommitment]),
    scorecard,
  };
}

export function getLiveObservationSprocketInsight(
  input: LiveObservationInput,
  plan: LiveObservationPlan,
  variantSeed = 0,
): LiveObservationSprocketInsight {
  const theme = plan.observationTheme;
  const seed = [
    input.role,
    theme,
    input.whatHappened,
    input.customerReaction,
    input.associateBehavior,
    input.missedOpportunity,
    normalizeText(input.managerNote),
    normalizeText(input.associateName ?? ''),
    String(variantSeed),
  ].join('|');

  const scorecard = buildScorecard(input);
  const dominant = metricKeyFromLabel(lowestMetric(scorecard).label);
  const riskyPhrases = buildRiskyPhrases(input.managerNote, theme);

  const rootCause = buildRootCause(input, theme, dominant);
  const coachingLanguage = rewriteManagerLanguage(
    input.managerNote,
    seed,
    joinSentences([
      plan.coachThisWay,
      roleLine(
        input.role,
        'Coach one clear behavior and one repeatable next step.',
        'Coach one clear behavior and one repeatable next checkpoint.',
      ),
    ]),
  );

  const bestDrill = pick([
    plan.bestDrill,
    bestDrillForTheme(theme, input.role),
    roleLine(
      input.role,
      'Run a 90-second coaching reset and repeat the observation once.',
      'Run a 90-second coaching reset and repeat the observation once.',
    ),
  ], seed);

  return {
    rootCause,
    coachingLanguage,
    bestDrill,
    riskyPhrases,
    nextCoachMove: bestDrillForTheme(theme, input.role),
    calmText: joinSentences([
      plan.adjust,
      'Keep the message specific, positive, and about what to do next.',
    ]),
  };
}

export function getLiveObservationCxInsight(
  input: LiveObservationInput,
  plan: LiveObservationPlan,
  user?: User | null,
  summary?: LiveObservationHistorySummary | null,
  _variantSeed = 0,
): LiveObservationCxInsight {
  const hasProfile = Boolean(user?.stats && Object.keys(user.stats as Record<string, unknown>).length > 0);
  const scores = [
    { skill: 'Clarity' as const, score: readUserCxStatScore(user, 'listening') },
    { skill: 'Listening' as const, score: readUserCxStatScore(user, 'empathy') },
    { skill: 'Confidence' as const, score: readUserCxStatScore(user, 'closing') },
    { skill: 'Next-step control' as const, score: readUserCxStatScore(user, 'followUp') },
  ];

  const lowest = [...scores].sort((a, b) => a.score - b.score)[0];
  const fallbackMetric = lowestMetric(buildScorecard(input)).label;
  const focusSkill = hasProfile
    ? lowest.skill
    : fallbackMetric;
  const trendType = determineTrendType(summary, focusSkill);
  const historyLine = summary?.totalSaved
    ? `You have ${summary.totalSaved} saved observations, so check for a pattern before calling it a one-off.`
    : 'Use saved observations to decide whether this is a one-off or a pattern.';

  return {
    hasProfile,
    focusSkill,
    trendType,
    personalNote: hasProfile
      ? `${historyLine} Your ${focusSkill.toLowerCase()} trend is the weakest CX signal, so coach this observation through that lens.`
      : `${historyLine} If the same behavior shows up again, treat it as a trend instead of a one-off.`,
    coachingNotes: buildCxNotes(focusSkill, trendType, summary),
  };
}

export function buildLiveObservationCoachCardSignature(input: LiveObservationInput, variantSeed = 0): string {
  return [
    String(input.role),
    String(input.whatHappened),
    String(input.customerReaction),
    String(input.associateBehavior),
    String(input.missedOpportunity),
    String(input.clarity),
    String(input.listening),
    String(input.confidence),
    String(input.nextStepControl),
    normalizeText(input.managerNote),
    normalizeText(input.associateName ?? ''),
    `seed:${variantSeed}`,
  ].map(normalizeText).join('|');
}

export function buildLiveObservationCoachCardSummary(input: LiveObservationInput): string {
  return buildObservationSummary(input);
}

export function buildLiveObservationCoachCardHistorySummary(entries: LiveObservationSavedEntry[]): LiveObservationHistorySummary {
  const sorted = [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sorted.length === 0) {
    return { totalSaved: 0 };
  }

  const repeatCounts = new Map<LiveObservationMetricLabel, number>();
  sorted.forEach((entry) => {
    const lowest = lowestMetric(entry.scorecard);
    repeatCounts.set(lowest.label, (repeatCounts.get(lowest.label) ?? 0) + 1);
  });

  const repeatMetricEntry = [...repeatCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const recent = sorted[0];

  return {
    totalSaved: sorted.length,
    repeatMetric: repeatMetricEntry && repeatMetricEntry[1] >= 2 ? repeatMetricEntry[0] : undefined,
    repeatCount: repeatMetricEntry?.[1],
    recentRole: recent.role,
    recentTheme: recent.observationTheme,
    recentBehavior: recent.associateBehavior,
    recentReaction: recent.customerReaction,
  };
}

export function buildLiveObservationCoachCardCloudContent(entry: LiveObservationSavedEntry): string {
  return JSON.stringify(entry);
}

export function parseLiveObservationCoachCardCloudContent(content: string): LiveObservationSavedEntry | null {
  try {
    const parsed = JSON.parse(content) as LiveObservationSavedEntry;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.role || !parsed.summary || !Array.isArray(parsed.scorecard)) return null;
    return parsed;
  } catch {
    return null;
  }
}
