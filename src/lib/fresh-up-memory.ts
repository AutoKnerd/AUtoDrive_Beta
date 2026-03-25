import type { FreshUpMemoryState, FreshUpProfile } from '@/lib/definitions';

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function extractAcknowledgedConcerns(message: string, profile: FreshUpProfile): string[] {
  const normalized = message.toLowerCase();
  const candidates = [profile.primaryConcern, profile.secondaryConcern];
  return candidates.filter((concern) => concern && normalized.includes(concern.toLowerCase()));
}

function extractPromisePhrases(message: string): string[] {
  const normalized = message.toLowerCase();
  const promises: string[] = [];
  if (normalized.includes('i will') || normalized.includes('we will')) promises.push('follow-through commitment');
  if (normalized.includes('let me explain') || normalized.includes('i can explain')) promises.push('explanation commitment');
  if (normalized.includes('i will show') || normalized.includes('let me show')) promises.push('demonstration commitment');
  return promises;
}

function hasPressureLanguage(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    'you need to decide now',
    'today only',
    'sign now',
    'this is your only option',
    'if you do not move today',
  ].some((phrase) => normalized.includes(phrase));
}

export function createFreshUpMemoryState(profile: FreshUpProfile): FreshUpMemoryState {
  return {
    rememberedConcerns: [profile.primaryConcern, profile.secondaryConcern].filter(Boolean),
    acknowledgedConcerns: [],
    promisesMade: [],
    promisesResolved: [],
    rapportMoments: 0,
    trustBreaks: 0,
    repeatedQuestions: 0,
    positiveMoments: 0,
    emotionalShifts: [],
    askedQuestions: [],
  };
}

export function updateFreshUpMemoryState(input: {
  state: FreshUpMemoryState;
  userMessage: string;
  profile: FreshUpProfile;
}): {
  nextState: FreshUpMemoryState;
  momentumDelta: number;
} {
  const { state, userMessage, profile } = input;
  const acknowledged = extractAcknowledgedConcerns(userMessage, profile);
  const promises = extractPromisePhrases(userMessage);
  const question = userMessage.includes('?') ? normalizeQuestion(userMessage) : '';
  const repeatedQuestion = !!question && state.askedQuestions.includes(question);
  const pressure = hasPressureLanguage(userMessage);
  const empathyHit = /\b(i understand|that makes sense|i hear you|i appreciate)\b/i.test(userMessage);
  const transparentHit = /\b(to be transparent|to be clear|honestly|upfront)\b/i.test(userMessage);
  const promiseResolved = state.promisesMade.some((entry) => userMessage.toLowerCase().includes(entry.split(' ')[0]));

  const nextState: FreshUpMemoryState = {
    ...state,
    acknowledgedConcerns: Array.from(new Set([...state.acknowledgedConcerns, ...acknowledged])),
    promisesMade: Array.from(new Set([...state.promisesMade, ...promises])),
    promisesResolved: promiseResolved
      ? Array.from(new Set([...state.promisesResolved, ...state.promisesMade]))
      : state.promisesResolved,
    rapportMoments: state.rapportMoments + (empathyHit ? 1 : 0),
    trustBreaks: state.trustBreaks + (pressure ? 1 : 0),
    repeatedQuestions: state.repeatedQuestions + (repeatedQuestion ? 1 : 0),
    positiveMoments: state.positiveMoments + ((empathyHit || transparentHit || acknowledged.length > 0) ? 1 : 0),
    emotionalShifts: [...state.emotionalShifts],
    askedQuestions: question ? [...state.askedQuestions, question].slice(-12) : state.askedQuestions,
  };

  let momentumDelta = 0;
  if (acknowledged.length > 0) momentumDelta += 4;
  if (empathyHit) momentumDelta += 3;
  if (transparentHit) momentumDelta += 3;
  if (promiseResolved) momentumDelta += 4;
  if (repeatedQuestion) momentumDelta -= 4;
  if (pressure) momentumDelta -= 8;
  if (nextState.promisesMade.length > nextState.promisesResolved.length + 2) momentumDelta -= 3;

  return { nextState, momentumDelta };
}
