import type { User } from '@/lib/definitions';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';

export const PRESSURE_DIFFUSER_SCENARIOS = [
  'price concern',
  'wait time',
  'repair cost',
  'trade value',
  'availability issue',
  'missed expectation',
  'angry customer',
  'confused customer',
] as const;

export const PRESSURE_DIFFUSER_EMOTIONS = [
  'frustrated',
  'skeptical',
  'rushed',
  'overwhelmed',
  'defensive',
  'disappointed',
] as const;

export const PRESSURE_DIFFUSER_OUTCOMES = [
  'reset expectations',
  'ask a better question',
  'slow the conversation down',
  'regain trust',
  'move to next step',
] as const;

export type PressureDiffuserScenario = typeof PRESSURE_DIFFUSER_SCENARIOS[number];
export type PressureDiffuserEmotion = typeof PRESSURE_DIFFUSER_EMOTIONS[number];
export type PressureDiffuserOutcome = typeof PRESSURE_DIFFUSER_OUTCOMES[number];

export type PressureDiffuserInput = {
  scenario: PressureDiffuserScenario;
  customerEmotion: PressureDiffuserEmotion;
  desiredOutcome: PressureDiffuserOutcome;
  consultantNote: string;
};

export type PressureDiffuserResponseFramework = {
  acknowledge: string;
  validate: string;
  clarify: string;
  calmNextStep: string;
};

export type PressureDiffuserPlan = {
  framework: PressureDiffuserResponseFramework;
  sayThis: string;
  avoidThis: string;
  quickCopy: string;
  calmSms: string;
  nextBestQuestion: string;
  coachPrompt: string;
};

export type PressureDiffuserSprocketInsight = {
  emotionRead: string;
  rewrittenResponse: string;
  riskyPhrases: string[];
  nextBestQuestion: string;
  calmSms: string;
  coachingNote: string;
};

export type PressureDiffuserCxNote = {
  label: 'Tone' | 'Pacing' | 'Trust' | 'Empathy' | 'Objection handling' | 'Follow-up';
  note: string;
};

export type PressureDiffuserCxInsight = {
  hasProfile: boolean;
  focusSkill: PressureDiffuserCxNote['label'];
  personalNote: string;
  coachingNotes: PressureDiffuserCxNote[];
};

export type PressureDiffuserSavedEntry = {
  id: string;
  signature: string;
  createdAt: string;
  variantSeed: number;
  scenario: PressureDiffuserScenario;
  customerEmotion: PressureDiffuserEmotion;
  desiredOutcome: PressureDiffuserOutcome;
  consultantNote: string;
  framework: PressureDiffuserResponseFramework;
  sayThis: string;
  avoidThis: string;
  quickCopy: string;
  calmSms: string;
  nextBestQuestion: string;
  favorite?: boolean;
  sprocketInsight?: PressureDiffuserSprocketInsight | null;
  cxInsight?: PressureDiffuserCxInsight | null;
};

type ScenarioPack = {
  acknowledge: readonly string[];
  validate: readonly string[];
  clarify: readonly string[];
  nextStep: readonly string[];
  sayThis: readonly string[];
  avoidThis: readonly string[];
  questions: readonly string[];
  sms: readonly string[];
  risks: readonly string[];
  coachPrompt: string;
};

type EmotionPack = {
  read: string;
  validate: readonly string[];
  risk: string;
  tone: string;
  pace: string;
  empathy: string;
};

type OutcomePack = {
  frame: string;
  clarify: readonly string[];
  nextStep: readonly string[];
  question: readonly string[];
  sms: readonly string[];
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

const SCENARIO_LIBRARY: Record<PressureDiffuserScenario, ScenarioPack> = {
  'price concern': {
    acknowledge: [
      'I can see why the price is the first thing on your mind.',
      'That price question deserves a plain answer.',
    ],
    validate: [
      'That usually means they want confidence before moving ahead.',
      'That concern makes sense when the value is not fully clear yet.',
    ],
    clarify: [
      'Let me focus on the part that matters most to you.',
      'Let’s separate the main question from the extra noise.',
    ],
    nextStep: [
      'Next, I’ll walk through the value and keep the pace easy.',
      'Next, I’ll answer the price piece first so the rest stays calm.',
    ],
    sayThis: [
      'I hear you. Let me show you the part that matters most and keep the rest simple.',
      'Let’s make the price piece clear first, then we’ll move forward together.',
    ],
    avoidThis: [
      'Avoid saying “that’s just the price” or “you need to decide now.”',
      'Do not push urgency before the value is clear.',
    ],
    questions: [
      'Is the main concern the number itself, the value behind it, or the pace we are moving at?',
    ],
    sms: [
      'Quick update: I’m clarifying the price piece now and I’ll keep it simple.',
    ],
    risks: ['that’s just the price', 'you need to decide now', 'this is the best we can do'],
    coachPrompt: 'Price friction usually settles when the value explanation gets simpler and more respectful.',
  },
  'wait time': {
    acknowledge: [
      'I can see why the wait time is frustrating.',
      'That timing question deserves a clear answer.',
    ],
    validate: [
      'That usually means the customer wants control back over the clock.',
      'That reaction makes sense when the wait has started to feel uncertain.',
    ],
    clarify: [
      'Let me make the timing piece easier to follow.',
      'Let’s narrow this to the part of the wait that matters most.',
    ],
    nextStep: [
      'Next, I’ll give a realistic update and a clean next checkpoint.',
      'Next, I’ll reset the expectation and keep the timing simple.',
    ],
    sayThis: [
      'I hear you. Let me give you the timing in a clear way and keep you updated.',
      'Let’s make the wait easier to follow, then I’ll tell you exactly what happens next.',
    ],
    avoidThis: [
      'Avoid saying “it should be any minute now” if you do not know that for sure.',
      'Do not sound vague or dismissive about the wait.',
    ],
    questions: [
      'Would it help if I gave you the current status, the remaining time, or both?',
    ],
    sms: [
      'Quick update: I’m checking the timing now and I’ll keep it clear for you.',
    ],
    risks: ['any minute now', 'it will not be long', 'I am sure it is almost done'],
    coachPrompt: 'Wait tension usually drops when timing gets specific and the customer hears ownership.',
  },
  'repair cost': {
    acknowledge: [
      'I can see why the repair cost is hitting hard.',
      'That cost question deserves a calm explanation.',
    ],
    validate: [
      'That often means they are trying to understand the need before accepting the work.',
      'That reaction makes sense when the value of the repair is not obvious yet.',
    ],
    clarify: [
      'Let me break the cost into the part that matters most.',
      'Let’s separate the repair need from the total number.',
    ],
    nextStep: [
      'Next, I’ll explain what the repair solves and why it matters.',
      'Next, I’ll keep the cost explanation plain and move one step at a time.',
    ],
    sayThis: [
      'I hear you. Let me show you what the repair solves and why it is worth addressing.',
      'Let’s make the repair cost easier to understand so you can decide with confidence.',
    ],
    avoidThis: [
      'Avoid saying “that is just what it costs” or “you have to do it.”',
      'Do not sound defensive about the estimate.',
    ],
    questions: [
      'Would it help if I showed you what this repair prevents versus what it costs now?',
    ],
    sms: [
      'Quick update: I’m clarifying the repair cost and what it solves right now.',
    ],
    risks: ['that is just what it costs', 'you have to do it', 'it is expensive because it is'],
    coachPrompt: 'Repair cost tension drops when the need, not the number, leads the explanation.',
  },
  'trade value': {
    acknowledge: [
      'I can see why the trade value is the first thing you want to settle.',
      'That trade number deserves a clean explanation.',
    ],
    validate: [
      'That usually means the customer is protecting the fairness of the deal.',
      'That concern makes sense when the trade feels like the biggest variable.',
    ],
    clarify: [
      'Let me separate the trade question from everything else.',
      'Let’s keep the trade piece isolated so it stays easy to follow.',
    ],
    nextStep: [
      'Next, I’ll walk through how the value was reached and what happens next.',
      'Next, I’ll keep the trade explanation simple and low pressure.',
    ],
    sayThis: [
      'I hear you. Let me make the trade part clear first and keep the rest simple.',
      'Let’s make the trade piece easy to follow, then we can move on together.',
    ],
    avoidThis: [
      'Avoid saying “that is just what the book says” or “we cannot move on that.”',
      'Do not sound like the trade value is non-negotiable without explanation.',
    ],
    questions: [
      'Is the concern the number itself, the method behind it, or how it affects the rest of the deal?',
    ],
    sms: [
      'Quick update: I’m clarifying the trade value piece and keeping it simple.',
    ],
    risks: ['that is just what the book says', 'we cannot move on that', 'that is the trade value'],
    coachPrompt: 'Trade value pressure eases when the value method feels transparent and fair.',
  },
  'availability issue': {
    acknowledge: [
      'I can see why the availability issue is frustrating.',
      'That availability question deserves a direct answer.',
    ],
    validate: [
      'That usually means the customer wants certainty before moving ahead.',
      'That reaction makes sense when the option they wanted is not immediately available.',
    ],
    clarify: [
      'Let me narrow this to what is available right now.',
      'Let’s separate the current choice from the rest of the options.',
    ],
    nextStep: [
      'Next, I’ll explain the available path and keep the pace calm.',
      'Next, I’ll give you the cleanest next option without pressure.',
    ],
    sayThis: [
      'I hear you. Let me show you the available path and keep this simple.',
      'Let’s make the availability piece clear so we can decide the next step together.',
    ],
    avoidThis: [
      'Avoid saying “that is all we have” or “you will need to settle.”',
      'Do not make the customer feel cornered by the inventory situation.',
    ],
    questions: [
      'Would you rather look at what is available now or talk through the closest match?',
    ],
    sms: [
      'Quick update: I’m checking the available path now and I’ll keep it clear.',
    ],
    risks: ['that is all we have', 'you will need to settle', 'take it or leave it'],
    coachPrompt: 'Availability tension drops when the customer hears options instead of limitation.',
  },
  'missed expectation': {
    acknowledge: [
      'I can see why missing the expectation would feel disappointing.',
      'That expectation gap deserves a clear reset.',
    ],
    validate: [
      'That usually means the customer feels the process changed on them.',
      'That reaction makes sense when the earlier expectation was not met.',
    ],
    clarify: [
      'Let me reset the frame so we are looking at the same thing.',
      'Let’s clear up the mismatch before we move on.',
    ],
    nextStep: [
      'Next, I’ll restate the plan and the next step in one clean sentence.',
      'Next, I’ll set the new expectation and keep it simple.',
    ],
    sayThis: [
      'I hear you. Let me reset the expectation and make the next step clear.',
      'Let’s clear up what changed and get the conversation back on track.',
    ],
    avoidThis: [
      'Avoid saying “I thought you knew” or “that is not what we said.”',
      'Do not make the customer feel blamed for the mismatch.',
    ],
    questions: [
      'What part of the original expectation feels different now?',
    ],
    sms: [
      'Quick update: I’m resetting the expectation now and keeping it clear.',
    ],
    risks: ['I thought you knew', 'that is not what we said', 'we already went over this'],
    coachPrompt: 'Expectation misses recover fastest when ownership and clarity show up first.',
  },
  'angry customer': {
    acknowledge: [
      'I can hear that this feels really frustrating.',
      'You are right to slow down when the emotion is this high.',
    ],
    validate: [
      'That usually means the customer needs to feel heard before anything else.',
      'That reaction makes sense when the pressure has already built up.',
    ],
    clarify: [
      'Let me lower the pressure and focus on the one issue we can solve.',
      'Let’s make this simpler before we add any more detail.',
    ],
    nextStep: [
      'Next, I’ll keep the tone calm, shorten the explanation, and ask one question.',
      'Next, I’ll slow this down and move only as far as the customer can handle.',
    ],
    sayThis: [
      'I hear you, and I want to keep this calm and clear so we can work through it.',
      'Let’s slow this down together and focus on one step at a time.',
    ],
    avoidThis: [
      'Avoid arguing the point, matching the tone, or defending the process.',
      'Do not try to win the moment before the customer feels heard.',
    ],
    questions: [
      'What would help most right now: a reset, a clear answer, or the next step?',
    ],
    sms: [
      'Quick update: I’m slowing this down and making the next step clear.',
    ],
    risks: ['calm down', 'you are wrong', 'that is not my problem'],
    coachPrompt: 'Anger needs acknowledgment first, then one calm path forward.',
  },
  'confused customer': {
    acknowledge: [
      'I can see why this feels unclear.',
      'That is a lot to take in at once.',
    ],
    validate: [
      'That usually means the customer needs the conversation broken into smaller pieces.',
      'That reaction makes sense when the path is not easy to follow yet.',
    ],
    clarify: [
      'Let me narrow this to the one part we need to solve first.',
      'Let’s make the path easier to follow by taking one step at a time.',
    ],
    nextStep: [
      'Next, I’ll explain the next step in plain language and keep it short.',
      'Next, I’ll slow this down and check understanding before moving on.',
    ],
    sayThis: [
      'I hear you. Let me break this into one clear step so it feels easier to follow.',
      'Let’s slow this down and make the next step obvious.',
    ],
    avoidThis: [
      'Avoid packing too many details into one sentence.',
      'Do not assume the customer is resisting when they may just be unsure.',
    ],
    questions: [
      'Would it help if I explained the first step, the timing, or the reason behind it?',
    ],
    sms: [
      'Quick update: I’m breaking this into a simple step so it stays easy to follow.',
    ],
    risks: ['let me explain everything at once', 'it is pretty simple', 'you should already know'],
    coachPrompt: 'Confusion improves when the answer gets smaller, slower, and more specific.',
  },
};

const EMOTION_LIBRARY: Record<PressureDiffuserEmotion, EmotionPack> = {
  frustrated: {
    read: 'They may be worn down and want less explanation, more ownership.',
    validate: [
      'They are likely tired of repeating themselves.',
      'They probably want a cleaner answer, not a longer one.',
    ],
    risk: 'Avoid sounding defensive or like you are protecting the process.',
    tone: 'Use a calm, certain tone with no extra filler.',
    pace: 'Keep the pace steady and leave a small pause after the reassurance.',
    empathy: 'Lead with acknowledgment before any explanation.',
  },
  skeptical: {
    read: 'They are probably guarding against feeling sold.',
    validate: [
      'They want proof before they relax.',
      'They are checking whether the process is being explained or just defended.',
    ],
    risk: 'Avoid asking for blind trust or overexplaining too fast.',
    tone: 'Use transparent language and keep your voice even.',
    pace: 'Move one piece at a time and do not rush past the concern.',
    empathy: 'Name the concern before you explain the next step.',
  },
  rushed: {
    read: 'They want this to feel shorter and more controlled.',
    validate: [
      'They are protecting their clock and their attention.',
      'They want the conversation to feel efficient without pressure.',
    ],
    risk: 'Avoid promising speed you cannot actually deliver.',
    tone: 'Be concise and organized.',
    pace: 'Use one short sentence, then the next step.',
    empathy: 'Respect the clock before you explain anything else.',
  },
  overwhelmed: {
    read: 'They may have too many moving parts in their head right now.',
    validate: [
      'They are likely looking for structure, not more detail.',
      'They need the conversation broken into smaller pieces.',
    ],
    risk: 'Avoid stacking multiple points into one long answer.',
    tone: 'Keep the language simple and the delivery calm.',
    pace: 'Slow the sequence and confirm each step before moving on.',
    empathy: 'Break the path into one piece the customer can hold onto.',
  },
  defensive: {
    read: 'They are bracing for a push, so even small pressure can land wrong.',
    validate: [
      'They are likely protecting themselves from another hard sell.',
      'They may be waiting for the catch before they relax.',
    ],
    risk: 'Avoid sounding like you are trying to win the moment.',
    tone: 'Stay soft, steady, and direct.',
    pace: 'Use fewer words and give the customer room to respond.',
    empathy: 'Acknowledge the concern before you add detail.',
  },
  disappointed: {
    read: 'They expected something different and want acknowledgment before they soften.',
    validate: [
      'They likely feel let down by what changed.',
      'They may need ownership before they will re-engage.',
    ],
    risk: 'Avoid minimizing the gap or moving too quickly to a fix.',
    tone: 'Sound accountable and calm.',
    pace: 'Slow down enough to show you are actually listening.',
    empathy: 'Name the miss and confirm you understand it.',
  },
};

const OUTCOME_LIBRARY: Record<PressureDiffuserOutcome, OutcomePack> = {
  'reset expectations': {
    frame: 'The goal is to reset the frame without sounding argumentative.',
    clarify: [
      'Let me reset the expectation so we are looking at the same thing.',
      'I want to make the frame clear again before we move on.',
    ],
    nextStep: [
      'Then I’ll restate the next step in one clean sentence.',
      'Then I’ll make the new expectation simple and easy to follow.',
    ],
    question: [
      'What part of the plan would help make this feel clearer right now?',
      'What expectation should I clarify first?',
    ],
    sms: [
      'I’m resetting the expectation now and keeping it clear.',
    ],
  },
  'ask a better question': {
    frame: 'The next move should reveal the real concern with less pressure.',
    clarify: [
      'Let me ask the question that will make this easier to solve.',
      'I want to ask one better question before I explain more.',
    ],
    nextStep: [
      'Then I’ll let the answer guide the rest of the conversation.',
      'Then I’ll follow their answer instead of guessing.',
    ],
    question: [
      'What part matters most right now?',
      'What would make the next step feel right to you?',
    ],
    sms: [
      'I’m asking one better question so I can keep this simple.',
    ],
  },
  'slow the conversation down': {
    frame: 'The next move should lower speed and give the customer space.',
    clarify: [
      'Let me slow this down so it feels easier to follow.',
      'I want to take this one step at a time.',
    ],
    nextStep: [
      'Then I’ll pause after each point so the customer can stay with me.',
      'Then I’ll keep the next step small and clear.',
    ],
    question: [
      'Would slowing this down help most right now?',
      'What part should I slow down first?',
    ],
    sms: [
      'I’m slowing this down and keeping the next step simple.',
    ],
  },
  'regain trust': {
    frame: 'The next move should show honesty, control, and respect.',
    clarify: [
      'Let me be straight about what I know and what I am still checking.',
      'I want to make the next step feel trustworthy and clear.',
    ],
    nextStep: [
      'Then I’ll show the customer the cleanest path forward.',
      'Then I’ll confirm the next step so nothing feels hidden.',
    ],
    question: [
      'What would help rebuild confidence right now?',
      'What part do I need to make clearer for you?',
    ],
    sms: [
      'I’m keeping this clear so the next step feels trustworthy.',
    ],
  },
  'move to next step': {
    frame: 'The next move should be clear, simple, and easy to agree to.',
    clarify: [
      'Let me make the next step obvious and low pressure.',
      'I want to keep this moving without sounding rushed.',
    ],
    nextStep: [
      'Then I’ll ask for one small commitment and keep the pace comfortable.',
      'Then I’ll move us to the next step in a simple way.',
    ],
    question: [
      'What is the cleanest next step from here?',
      'What would make the next move feel easiest?',
    ],
    sms: [
      'I’m making the next step clear and easy to follow.',
    ],
  },
};

const COMMON_PRESSURE_PHRASES = [
  'calm down',
  'trust me',
  'you need to',
  'you have to',
  'we have to',
  'that is just the way it is',
  "that's just the way it is",
  'it will not take long',
  "it won't take long",
  'there is nothing i can do',
  "there's nothing i can do",
  'you should already know',
  'that is not my problem',
  "that's not my problem",
];

function rewriteConsultantNote(note: string, seed: string): string {
  const cleaned = normalizeText(note)
    .replace(/\bcalm down\b/gi, 'let’s slow this down')
    .replace(/\btrust me\b/gi, 'let me show you')
    .replace(/\byou need to\b/gi, 'let’s')
    .replace(/\byou have to\b/gi, 'we can')
    .replace(/\bwe have to\b/gi, 'let’s')
    .replace(/\bthat is just the way it is\b/gi, 'let me explain what is driving that')
    .replace(/\bthat's just the way it is\b/gi, 'let me explain what is driving that')
    .replace(/\bit will not take long\b/gi, 'I’ll keep this tight')
    .replace(/\bit won't take long\b/gi, 'I’ll keep this tight')
    .replace(/\bthere is nothing i can do\b/gi, 'let me see what I can clarify')
    .replace(/\bthere's nothing i can do\b/gi, 'let me see what I can clarify')
    .replace(/\bthat is not my problem\b/gi, 'let me help with what I can control')
    .replace(/\bthat's not my problem\b/gi, 'let me help with what I can control')
    .replace(/\byou should already know\b/gi, 'let me make it clear');

  if (!cleaned) return '';

  return joinSentences([
    pick(['Try this instead', 'A calmer version', 'Use this'], seed),
    cleaned,
  ]);
}

function detectRiskyPhrases(note: string, fallbackPhrases: readonly string[]): string[] {
  const lower = normalizeText(note).toLowerCase();
  const detected = new Set<string>();

  COMMON_PRESSURE_PHRASES.forEach((phrase) => {
    if (lower.includes(phrase.toLowerCase())) {
      detected.add(phrase);
    }
  });

  fallbackPhrases.forEach((phrase) => detected.add(phrase));

  return Array.from(detected).slice(0, 4);
}

function scenarioFocusSkill(scenario: PressureDiffuserScenario, outcome: PressureDiffuserOutcome): PressureDiffuserCxNote['label'] {
  if (scenario === 'angry customer' || scenario === 'missed expectation') return 'Empathy';
  if (scenario === 'wait time' || scenario === 'confused customer') return 'Pacing';
  if (scenario === 'availability issue' || scenario === 'price concern' || scenario === 'repair cost' || scenario === 'trade value') return 'Trust';
  if (outcome === 'move to next step') return 'Follow-up';
  if (outcome === 'ask a better question') return 'Objection handling';
  return 'Tone';
}

function buildCxNotes(
  focusSkill: PressureDiffuserCxNote['label'],
  scenario: PressureDiffuserScenario,
  emotion: PressureDiffuserEmotion,
  outcome: PressureDiffuserOutcome,
  hasProfile: boolean
): PressureDiffuserCxNote[] {
  const focusMessage: Record<PressureDiffuserCxNote['label'], string> = {
    Tone: hasProfile
      ? 'Your tone trend suggests a calmer, more certain delivery will carry best here.'
      : 'Keep the tone warm, certain, and free of filler.',
    Pacing: hasProfile
      ? 'Your pacing trend suggests one sentence at a time will lower pressure fastest.'
      : 'Shorten the first sentence and leave space after each answer.',
    Trust: hasProfile
      ? 'Your trust trend says clarity and ownership should lead before detail.'
      : 'State what is known, what is being checked, and when the update will come.',
    Empathy: hasProfile
      ? 'Your empathy trend says the acknowledgment line should come first, not last.'
      : 'Name the feeling before you move into the explanation.',
    'Objection handling': hasProfile
      ? 'Your objection-handling trend improves when the concern is answered directly and simply.'
      : 'Answer the concern itself before you add more detail.',
    'Follow-up': hasProfile
      ? 'Your follow-up trend improves when the next touch point is named clearly.'
      : 'End with one clear next step or touch point.',
  };

  const contextLine = {
    'price concern': 'Price pressure usually eases when the value explanation stays plain.',
    'wait time': 'Wait pressure eases when timing gets specific and predictable.',
    'repair cost': 'Repair pressure eases when the need and the cost are separated clearly.',
    'trade value': 'Trade pressure eases when the method feels transparent and fair.',
    'availability issue': 'Availability pressure eases when options are framed as choices, not limits.',
    'missed expectation': 'Expectation misses recover fastest when ownership shows up early.',
    'angry customer': 'Angry moments need acknowledgment before explanation.',
    'confused customer': 'Confusion improves when the answer gets smaller, slower, and more specific.',
  }[scenario];

  return [
    { label: 'Tone', note: `${focusSkill === 'Tone' ? 'This is your biggest lift point.' : 'Keep the tone warm and certain.'} ${focusMessage.Tone}` },
    { label: 'Pacing', note: `${focusSkill === 'Pacing' ? 'This is your biggest lift point.' : 'Do not rush the next line.'} ${focusMessage.Pacing}` },
    { label: 'Trust', note: `${focusSkill === 'Trust' ? 'This is your biggest lift point.' : 'Lead with what is known and what is being checked.'} ${focusMessage.Trust}` },
    { label: 'Empathy', note: `${focusSkill === 'Empathy' ? 'This is your biggest lift point.' : 'Start by naming the feeling.'} ${focusMessage.Empathy}` },
    { label: 'Objection handling', note: `${focusSkill === 'Objection handling' ? 'This is your biggest lift point.' : 'Answer the concern before the explanation grows.'} ${focusMessage['Objection handling']}` },
    { label: 'Follow-up', note: `${focusSkill === 'Follow-up' ? 'This is your biggest lift point.' : 'Leave one clear next touchpoint.'} ${focusMessage['Follow-up']} ${contextLine}` },
  ];
}

function buildQuickCopy(
  framework: PressureDiffuserResponseFramework,
): string {
  return joinSentences([
    framework.acknowledge,
    framework.validate,
    framework.clarify,
    framework.calmNextStep,
  ]);
}

export function getPressureDiffuserPlan(input: PressureDiffuserInput, variantSeed = 0): PressureDiffuserPlan {
  const scenario = SCENARIO_LIBRARY[input.scenario];
  const emotion = EMOTION_LIBRARY[input.customerEmotion];
  const outcome = OUTCOME_LIBRARY[input.desiredOutcome];
  const seed = [input.scenario, input.customerEmotion, input.desiredOutcome, normalizeText(input.consultantNote), String(variantSeed)].join('|');

  const framework: PressureDiffuserResponseFramework = {
    acknowledge: joinSentences([pick(scenario.acknowledge, seed), pick(emotion.validate, seed)]),
    validate: joinSentences([pick(scenario.validate, seed), emotion.empathy]),
    clarify: joinSentences([pick(scenario.clarify, seed), pick(outcome.clarify, seed)]),
    calmNextStep: joinSentences([pick(scenario.nextStep, seed), pick(outcome.nextStep, seed)]),
  };

  const question = joinSentences([pick(scenario.questions, seed), pick(outcome.question, seed)]);
  const sayThis = input.consultantNote.trim()
    ? rewriteConsultantNote(input.consultantNote, seed)
    : joinSentences([
      pick(scenario.sayThis, seed),
      pick(outcome.nextStep, seed),
    ]);

  return {
    framework,
    sayThis,
    avoidThis: joinSentences([pick(scenario.avoidThis, seed), emotion.risk]),
    quickCopy: buildQuickCopy(framework),
    calmSms: joinSentences([pick(scenario.sms, seed), pick(outcome.sms, seed)]),
    nextBestQuestion: question,
    coachPrompt: scenario.coachPrompt,
  };
}

export function getPressureDiffuserSprocketInsight(
  input: PressureDiffuserInput,
  plan: PressureDiffuserPlan,
  variantSeed = 0
): PressureDiffuserSprocketInsight {
  const scenario = SCENARIO_LIBRARY[input.scenario];
  const emotion = EMOTION_LIBRARY[input.customerEmotion];
  const outcome = OUTCOME_LIBRARY[input.desiredOutcome];
  const seed = [input.scenario, input.customerEmotion, input.desiredOutcome, normalizeText(input.consultantNote), String(variantSeed)].join('|');
  const riskyPhrases = detectRiskyPhrases(input.consultantNote, scenario.risks);

  return {
    emotionRead: joinSentences([emotion.read, scenario.coachPrompt]),
    rewrittenResponse: input.consultantNote.trim()
      ? rewriteConsultantNote(input.consultantNote, seed)
      : plan.quickCopy,
    riskyPhrases,
    nextBestQuestion: plan.nextBestQuestion,
    calmSms: plan.calmSms,
    coachingNote: joinSentences([emotion.pace, outcome.frame]),
  };
}

export function getPressureDiffuserCxInsight(
  input: PressureDiffuserInput,
  _plan: PressureDiffuserPlan,
  user?: User | null,
  _variantSeed = 0
): PressureDiffuserCxInsight {
  const hasProfile = Boolean(user?.stats && Object.keys(user.stats as Record<string, unknown>).length > 0);
  const skillScores = [
    { skill: 'Empathy' as const, score: readUserCxStatScore(user, 'empathy') },
    { skill: 'Pacing' as const, score: readUserCxStatScore(user, 'listening') },
    { skill: 'Trust' as const, score: readUserCxStatScore(user, 'trust') },
    { skill: 'Follow-up' as const, score: readUserCxStatScore(user, 'followUp') },
    { skill: 'Objection handling' as const, score: readUserCxStatScore(user, 'closing') },
    { skill: 'Tone' as const, score: readUserCxStatScore(user, 'relationship') },
  ];

  const lowest = [...skillScores].sort((a, b) => a.score - b.score)[0];
  const focusSkill = hasProfile ? lowest.skill : scenarioFocusSkill(input.scenario, input.desiredOutcome);

  return {
    hasProfile,
    focusSkill,
    personalNote: hasProfile
      ? `Your ${focusSkill.toLowerCase()} trend is the weakest CX signal, so this response should lead with that skill first.`
      : 'Connect CX stats to personalize tone, pacing, trust repair, empathy, objection handling, and follow-up.',
    coachingNotes: buildCxNotes(focusSkill, input.scenario, input.customerEmotion, input.desiredOutcome, hasProfile),
  };
}
