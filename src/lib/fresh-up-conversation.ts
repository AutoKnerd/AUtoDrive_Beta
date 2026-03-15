import type {
  FreshUpEndingType,
  FreshUpMemoryState,
  FreshUpOutcomeTag,
  FreshUpProfile,
  FreshUpRecommendedNextStep,
} from '@/lib/definitions';

const OPENING_BY_STAGE: Record<string, string[]> = {
  'just browsing': [
    'I am mostly just looking right now, but this caught my eye.',
    'I am not fully shopping yet, just trying to get a feel for this.',
  ],
  'comparing models': [
    'I have already looked at a couple options, but I wanted to see this one in person.',
    'I am comparing a few models and trying to figure out what actually fits.',
  ],
  'trade-in evaluation': [
    'I am thinking about trading mine in, but I am not sure it makes sense yet.',
    'I might trade mine, but I need to understand what it is worth first.',
  ],
  'payment discussion': [
    'I am open to this, but I need to stay in a certain payment range.',
    'I can talk numbers, but monthly payment is the big one for me.',
  ],
  'ready to buy': [
    'If this makes sense today, I am prepared to move forward.',
    'I am close to making a decision if the details line up.',
  ],
};

const SPROCKET_OPENERS = [
  'Fresh up on the floor. Read the room before you read the brochure.',
  'New up. Tone first, details second.',
  'Alright, here we go. Match the customer before you move the process.',
  'Fresh up. Win trust first, then move the conversation.',
];

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function applyPersonality(base: string, personality: string): string {
  if (personality === 'analytical') return `${base} I have been comparing details pretty closely.`;
  if (personality === 'friendly') return `${base} I am happy to talk it through.`;
  if (personality === 'skeptical') return `${base} I am still cautious about what I hear at dealerships.`;
  if (personality === 'impatient') return `${base} I do not have a lot of time, so I need direct answers.`;
  if (personality === 'overwhelmed') return `${base} I am trying not to overcomplicate this.`;
  if (personality === 'excited') return `${base} I am excited about this one, honestly.`;
  if (personality === 'defensive') return `${base} I just do not want to get pushed around.`;
  return base;
}

function applyCommunicationStyle(base: string, style: string, concern: string): string {
  if (style === 'reserved') return base.split('.').slice(0, 1).join('.').trim() + '.';
  if (style === 'direct') return `${base} My main concern is ${concern}.`;
  if (style === 'sarcastic') return `${base} Hopefully this is less complicated than the last place I visited.`;
  if (style === 'story-driven') return `${base} I have been through this recently and want to get it right this time.`;
  if (style === 'cautious') return `${base} I just want clear information before I commit to anything.`;
  if (style === 'rapid-fire questions') return `${base} What does this really cost me monthly? How does this compare long term?`;
  return base;
}

function applyEmotion(base: string, emotion: string): string {
  if (emotion === 'guarded') return `${base} I am not trying to do a lot of back-and-forth today.`;
  if (emotion === 'curious') return `${base} I wanted to see how it feels in person.`;
  if (emotion === 'stressed') return `${base} I am under some time pressure right now.`;
  if (emotion === 'excited') return `${base} This is one I have been looking forward to seeing.`;
  if (emotion === 'frustrated') return `${base} I have had a rough experience before, so I am cautious.`;
  if (emotion === 'optimistic') return `${base} I have heard good things, so I am hopeful.`;
  return base;
}

function toSentenceLimit(text: string, max = 3): string {
  const parts = text
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, max);
  return `${parts.join('. ')}.`;
}

export function generateFreshUpOpening(profile: FreshUpProfile): {
  sprocketLine: string;
  customerOpening: string;
} {
  const seed = hashSeed(`${profile.freshUpId}:${profile.customerName}:${profile.buyingStage}`);
  const stageOpeners = OPENING_BY_STAGE[profile.buyingStage] || OPENING_BY_STAGE['just browsing'];
  let opening = pick(stageOpeners, seed);
  opening = applyPersonality(opening, profile.personalityType);
  opening = applyCommunicationStyle(opening, profile.communicationStyle, profile.primaryConcern);
  opening = applyEmotion(opening, profile.emotionalState);

  return {
    sprocketLine: pick(SPROCKET_OPENERS, seed),
    customerOpening: toSentenceLimit(opening, 3),
  };
}

export function captureOpeningMemoryHooks(openingText: string): string[] {
  const normalized = openingText.toLowerCase();
  const hooks: string[] = [];
  if (normalized.includes('trade')) hooks.push('trade');
  if (normalized.includes('kids') || normalized.includes('family')) hooks.push('family_situation');
  if (normalized.includes('time') || normalized.includes('rush') || normalized.includes('pressure')) hooks.push('time_pressure');
  if (normalized.includes('budget') || normalized.includes('payment') || normalized.includes('cost')) hooks.push('budget_concern');
  if (normalized.includes('rough') || normalized.includes('bad experience') || normalized.includes('last place')) hooks.push('past_experience');
  if (normalized.includes('feature') || normalized.includes('tech') || normalized.includes('compare')) hooks.push('feature_curiosity');
  return hooks;
}

export function enrichMemoryStateFromOpening(state: FreshUpMemoryState, openingText: string): FreshUpMemoryState {
  const hooks = captureOpeningMemoryHooks(openingText);
  return {
    ...state,
    rememberedConcerns: Array.from(new Set([...state.rememberedConcerns, ...hooks])),
  };
}

export function detectFreshUpEndingFallback(input: {
  trustScore: number;
  upMeterStart: number;
  upMeterEnd: number;
  upMeterPeak: number;
  endingEmotion: string;
  memoryState: FreshUpMemoryState;
}): {
  endingType: FreshUpEndingType;
  outcomeTag: FreshUpOutcomeTag;
  recommendedNextStep: FreshUpRecommendedNextStep;
  trustShift: number;
} {
  const trustShift = Math.round(input.upMeterEnd - input.upMeterStart);
  const emotion = input.endingEmotion.toLowerCase();

  if (input.upMeterEnd >= 82 && input.trustScore >= 78) {
    return { endingType: 'appointment_ready', outcomeTag: 'Appointment Set', recommendedNextStep: 'closing_lesson', trustShift };
  }
  if (emotion === 'resistant' || emotion === 'frustrated' || input.memoryState.trustBreaks >= 2 || input.upMeterEnd <= 25) {
    return { endingType: 'trust_break', outcomeTag: 'Conversation Breakdown', recommendedNextStep: 'trust_building_lesson', trustShift };
  }
  if (input.upMeterEnd >= 65 && input.trustScore >= 68) {
    return { endingType: 'positive_progress', outcomeTag: 'Trust Established', recommendedNextStep: 'closing_lesson', trustShift };
  }
  if (input.upMeterPeak - input.upMeterEnd >= 20 || input.memoryState.repeatedQuestions >= 2) {
    return { endingType: 'stalled_conversation', outcomeTag: 'Lost Momentum', recommendedNextStep: 'discovery_lesson', trustShift };
  }
  return { endingType: 'neutral_pause', outcomeTag: 'Customer Engaged', recommendedNextStep: 'follow_up_lesson', trustShift };
}

export function generateFinalCustomerResponse(input: {
  endingType: FreshUpEndingType;
  endingEmotion: string;
  memoryState: FreshUpMemoryState;
}): string {
  if (input.endingType === 'appointment_ready') return 'That helps. I am comfortable taking the next step from here.';
  if (input.endingType === 'positive_progress') return 'I feel better about this now than when I walked in.';
  if (input.endingType === 'neutral_pause') return 'I still need to think on it, but this was helpful.';
  if (input.endingType === 'stalled_conversation') return 'I am still not sure this is clicking for me yet.';
  if (input.memoryState.trustBreaks > 0) return 'I do not think this is really where I need to be right now.';
  return 'I am probably going to keep looking for now.';
}

export function generateSprocketEndingLine(input: {
  endingType: FreshUpEndingType;
  trustShift: number;
}): string {
  if (input.endingType === 'appointment_ready') return 'Nice pacing. You earned the next step without forcing it.';
  if (input.endingType === 'positive_progress') return 'Good work. Trust moved in the right direction.';
  if (input.endingType === 'neutral_pause') return 'Solid conversation. Next time, create one clearer commitment moment.';
  if (input.endingType === 'stalled_conversation') return 'You had the conversation, but momentum flattened late.';
  return 'This one needed reassurance and consistency more than speed.';
}
