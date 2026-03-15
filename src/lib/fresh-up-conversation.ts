import type {
  AisRoleType,
  FreshUpEndingType,
  FreshUpMemoryState,
  FreshUpOutcomeTag,
  FreshUpProfile,
  FreshUpRecommendedNextStep,
} from '@/lib/definitions';
import { getAisInteractionLabel, getRoleAwareSprocketOpeners } from '@/lib/ais-role-adaptive';
import { getRoleToneProfile } from '@/config/roleToneProfiles';

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

const SERVICE_OPENING_BY_STAGE: Record<string, string[]> = {
  'appointment check-in': [
    'I have an appointment, but I need to understand what is actually going on with my vehicle.',
    'I am here for my service visit and I need a clear timeline before I commit to anything.',
  ],
  'diagnosis review': [
    'Can you walk me through what you found in plain language?',
    'I need a clear explanation of the diagnosis before we move forward.',
  ],
  'repair authorization': [
    'Before I approve this, I need to understand the cost and why this work matters.',
    'I am open to getting this done, but I need to feel confident about the recommendation.',
  ],
  'timeline update': [
    'I need a realistic update on timing because this is impacting my day.',
    'Can we go over where this stands and what I should expect next?',
  ],
  'ready for pickup': [
    'Before pickup, I just want to make sure everything was completed correctly.',
    'I am here for pickup and want a quick recap so I know what was done.',
  ],
};

const PARTS_OPENING_BY_STAGE: Record<string, string[]> = {
  'availability request': [
    'I need to check if you have this part in stock today.',
    'Can you confirm availability before I make the trip over?',
  ],
  'fitment confirmation': [
    'I want to make sure this part actually fits before I order it.',
    'Can you verify fitment so I do not have to return this later?',
  ],
  'special-order discussion': [
    'If this has to be special ordered, I need clear timing upfront.',
    'I can special order it, but I need a realistic expectation on delivery.',
  ],
  'eta update': [
    'Can you give me an ETA update? I am trying to plan around this.',
    'I need a status update on that order before I commit to next steps.',
  ],
  'pickup-ready confirmation': [
    'I got the pickup notice and wanted to confirm everything is ready.',
    'Before I head over, can you confirm the order is complete and correct?',
  ],
};

const FI_OPENING_BY_STAGE: Record<string, string[]> = {
  'menu discussion': [
    'Before we go too far, I want to understand these options clearly.',
    'I am open to the review, but I need this explained in a way that is easy to follow.',
  ],
  'payment structure review': [
    'Can we walk through the payment structure step by step?',
    'I want to make sure I understand how these terms impact me long term.',
  ],
  'lender approval discussion': [
    'Can you explain where things stand with approval and what options I actually have?',
    'I need clarity on lender options before I decide anything.',
  ],
  'paperwork review': [
    'I want to understand this paperwork before I sign anything.',
    'Can we slow down and make sure each section is clear?',
  ],
  'signing readiness': [
    'I am close, but I need to feel confident before the signing step.',
    'If this all makes sense, I can move forward today.',
  ],
};

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

function applyCommunicationStyle(base: string, style: string, concern: string, roleType: AisRoleType): string {
  const toneProfile = getRoleToneProfile(roleType);
  const roleConcern = concern || toneProfile.typicalConcerns[0] || 'next step';
  if (style === 'reserved') return base.split('.').slice(0, 1).join('.').trim() + '.';
  if (style === 'direct') return `${base} My main concern is ${roleConcern}.`;
  if (style === 'sarcastic') return `${base} Hopefully this is less complicated than the last place I visited.`;
  if (style === 'story-driven') return `${base} I have been through this recently and want to get it right this time.`;
  if (style === 'cautious') return `${base} I just want clear information before I commit to anything.`;
  if (style === 'rapid-fire questions') {
    if (roleType === 'service') return `${base} What is the actual issue? How long will this take?`;
    if (roleType === 'parts') return `${base} Do you have it in stock? Can you confirm fitment today?`;
    if (roleType === 'fi') return `${base} What is required? What is optional? How does this affect payment clarity?`;
    return `${base} What does this really cost me monthly? How does this compare long term?`;
  }
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

function applyArchetypeOpeningStyle(base: string, profile: FreshUpProfile): string {
  const archetypeId = String(profile.customerArchetypeId || '').toLowerCase();
  if (archetypeId === 'skeptic') return `${base} Yeah, I am not trying to get boxed into anything.`;
  if (archetypeId === 'over-researcher') return `${base} I have already compared a few options, so I care about how this really stacks up.`;
  if (archetypeId === 'friendly-talker') return `${base} I have been talking about making this move for a while.`;
  if (archetypeId === 'silent-analyzer') return `${base.split('.').slice(0, 1).join('.').trim()}.`;
  if (archetypeId === 'rushed-parent') return `${base} I do not have a lot of time, so I need this clear and efficient.`;
  if (archetypeId === 'joke-machine') return `${base} Either I am deciding today or making some expensive eye contact.`;
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

export function generateFreshUpOpening(profile: FreshUpProfile, roleType: AisRoleType = 'sales'): {
  sprocketLine: string;
  customerOpening: string;
} {
  const seed = hashSeed(`${profile.freshUpId}:${profile.customerName}:${profile.buyingStage}`);
  const stageMap = roleType === 'service'
    ? SERVICE_OPENING_BY_STAGE
    : (roleType === 'parts'
      ? PARTS_OPENING_BY_STAGE
      : (roleType === 'fi' ? FI_OPENING_BY_STAGE : OPENING_BY_STAGE));
  const fallbackStage = roleType === 'sales' ? 'just browsing' : Object.keys(stageMap)[0];
  const stageOpeners = stageMap[profile.buyingStage] || stageMap[fallbackStage] || OPENING_BY_STAGE['just browsing'];
  let opening = pick(stageOpeners, seed);
  opening = applyPersonality(opening, profile.personalityType);
  opening = applyCommunicationStyle(opening, profile.communicationStyle, profile.primaryConcern, roleType);
  opening = applyEmotion(opening, profile.emotionalState);
  opening = applyArchetypeOpeningStyle(opening, profile);

  return {
    sprocketLine: pick(getRoleAwareSprocketOpeners(roleType), seed),
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
  roleType?: AisRoleType;
}): string {
  const roleType = input.roleType ?? 'sales';
  const interactionLabel = getAisInteractionLabel(roleType);
  if (input.endingType === 'appointment_ready') return roleType === 'sales'
    ? 'That helps. I am comfortable taking the next step from here.'
    : `That helps. I am comfortable moving to the next ${interactionLabel.toLowerCase()} step.`;
  if (input.endingType === 'positive_progress') return `I feel better about this ${interactionLabel.toLowerCase()} now than when we started.`;
  if (input.endingType === 'neutral_pause') return 'I still need to think on it a little, but this was helpful.';
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
