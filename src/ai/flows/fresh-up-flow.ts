'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ASSISTANT_NAME } from '@/lib/assistant';

const MessageSchema = z.object({
  sender: z.enum(['user', 'ai']),
  text: z.string(),
});

const CXScoresSchema = z.object({
  empathy: z.number(),
  listening: z.number(),
  trust: z.number(),
  followUp: z.number(),
  closing: z.number(),
  relationshipBuilding: z.number(),
});

const FreshUpProfileSchema = z.object({
  freshUpId: z.string(),
  sourceType: z.enum(['procedural', 'signature']),
  scenarioId: z.string().optional(),
  scenarioName: z.string().optional(),
  characterName: z.string(),
  customerName: z.string(),
  personalityType: z.string(),
  buyingStage: z.string(),
  communicationStyle: z.string(),
  emotionalState: z.string(),
  archetypeId: z.string(),
  archetypeName: z.string(),
  archetypeCategory: z.enum(['friendly', 'curious', 'funny', 'analytical', 'skeptical', 'budget_focused', 'high_stakes', 'family_complex', 'emotional', 'unusual']),
  humorLevel: z.number(),
  conversationPrompt: z.string(),
  scenarioPrompt: z.string().optional(),
  customerType: z.string(),
  vehicleInterest: z.string(),
  personalityTone: z.string(),
  primaryConcern: z.string(),
  secondaryConcern: z.string(),
  conversationStyle: z.string(),
  skillsTested: z.array(z.string()),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']),
  winCondition: z.string(),
  failurePattern: z.string(),
  coachingTag: z.enum([
    'price_first',
    'payment_focus',
    'trust_drop',
    'weak_discovery',
    'knowledge_gap',
    'strong_empathy',
    'empathy_builder',
    'missed_influence',
    'feature_confusion',
    'weak_follow_up',
    'trust_pressure',
    'discount_focus',
    'premature_close',
    'missed_connection',
    'trust_gap',
    'clarity_needed',
    'tech_resistance',
    'relationship_opportunity',
    'closing_miss',
    'needs_alignment',
    'trust_rebuild',
    'process_efficiency',
    'feature_miss',
    'comparison_gap',
    'loyalty_opportunity',
    'negotiation_pressure',
    'relationship_build',
    'strong_relationship',
    'trust_builder',
    'closing_strength',
    'needs_listening',
    'relationship_builder',
  ]),
});

const FreshUpMemoryStateSchema = z.object({
  rememberedConcerns: z.array(z.string()),
  acknowledgedConcerns: z.array(z.string()),
  promisesMade: z.array(z.string()),
  promisesResolved: z.array(z.string()),
  rapportMoments: z.number(),
  trustBreaks: z.number(),
  repeatedQuestions: z.number(),
  positiveMoments: z.number(),
  emotionalShifts: z.array(z.string()),
  askedQuestions: z.array(z.string()),
});

const ConductFreshUpInputSchema = z.object({
  lessonId: z.string(),
  lessonTitle: z.string(),
  lessonRole: z.string(),
  lessonCategory: z.string(),
  cxScores: CXScoresSchema,
  profile: FreshUpProfileSchema,
  upMeterCurrent: z.number(),
  memoryState: FreshUpMemoryStateSchema.optional(),
  currentEmotion: z.string().optional(),
  history: z.array(MessageSchema),
  userMessage: z.string(),
});

const ConductFreshUpOutputSchema = z.string();

export type ConductFreshUpInput = z.infer<typeof ConductFreshUpInputSchema>;
export type ConductFreshUpOutput = z.infer<typeof ConductFreshUpOutputSchema>;

export async function conductFreshUp(input: ConductFreshUpInput): Promise<ConductFreshUpOutput> {
  return conductFreshUpFlow(input);
}

const freshUpPrompt = ai.definePrompt({
  name: 'freshUpPrompt',
  input: { schema: ConductFreshUpInputSchema },
  output: { format: 'text' },
  prompt: `You are ${ASSISTANT_NAME}, AutoDrive's professional automotive customer experience coach.

You are leading a Fresh Up inside the AutoDrive classroom.

Fresh Up rules:
- This is a longer, more diagnostic interaction than a standard lesson.
- Target 8 to 12 total turns (AI + user combined), with at least 6 meaningful user exchanges before ending unless the user explicitly ends early. Current turn count is {{history.length}}.
- Stay professional, dealership-native, and realistic.
- Sprocket should sound calm, observant, and supportive.
- Do not turn this into a game, trivia, or entertainment.

Customer profile:
- Source type: {{profile.sourceType}}
- Scenario name: {{profile.scenarioName}}
- Character name: {{profile.characterName}}
- Customer name: {{profile.customerName}}
- Personality type: {{profile.personalityType}}
- Buying stage: {{profile.buyingStage}}
- Customer type: {{profile.customerType}}
- Archetype: {{profile.archetypeName}} ({{profile.archetypeCategory}}, humor {{profile.humorLevel}})
- Vehicle interest: {{profile.vehicleInterest}}
- Personality tone: {{profile.personalityTone}}
- Primary concern: {{profile.primaryConcern}}
- Secondary concern: {{profile.secondaryConcern}}
- Communication style: {{profile.communicationStyle}}
- Emotional state: {{profile.emotionalState}}
- Conversation style: {{profile.conversationStyle}}
- Skills being tested: {{#each profile.skillsTested}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Win condition: {{profile.winCondition}}
- Failure pattern: {{profile.failurePattern}}
- Difficulty level: {{profile.difficultyLevel}}
- Default coaching tag if needed: {{profile.coachingTag}}
- Prompt anchor: {{profile.conversationPrompt}}
- Signature prompt (if present): {{profile.scenarioPrompt}}

Conversation memory state (customer remembers and reacts to this):
- Remembered concerns: {{#each memoryState.rememberedConcerns}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Acknowledged concerns: {{#each memoryState.acknowledgedConcerns}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Promises made: {{#each memoryState.promisesMade}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Promises resolved: {{#each memoryState.promisesResolved}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Rapport moments: {{memoryState.rapportMoments}}
- Trust breaks: {{memoryState.trustBreaks}}
- Repeated questions: {{memoryState.repeatedQuestions}}
- Positive moments: {{memoryState.positiveMoments}}
- Emotional shifts: {{#each memoryState.emotionalShifts}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Current emotion state: {{currentEmotion}}

Trainee CX scores:
- Empathy: {{cxScores.empathy}}
- Listening: {{cxScores.listening}}
- Trust: {{cxScores.trust}}
- Follow Up: {{cxScores.followUp}}
- Closing: {{cxScores.closing}}
- Relationship Building: {{cxScores.relationshipBuilding}}

Critical behavior:
- Stay inside the dealership role context: {{lessonRole}}
- Keep the conversation grounded in showroom reality.
- Let the customer stay skeptical or uncertain when appropriate.
- Reward listening, calm pacing, discovery, trust-building, and appropriate next-step alignment.
- Do not give legal advice or manipulative tactics.

Conversation structure:
- Middle turns: respond as the customer while occasionally adding short Sprocket coaching nudges before the next customer beat.
- The customer should not become easy too quickly.
- Make the user earn progress through better pacing, discovery, empathy, and trust.
- Maintain memory continuity: reference earlier facts, concerns, promises, and tone naturally.
- If consultant acknowledges concerns, the customer can open up.
- If consultant breaks trust or skips promises, customer should become more guarded or resistant.
- Detect natural ending conditions rather than abrupt stops:
  - positive progress (trust built and next step identified),
  - neutral pause (polite but undecided),
  - stalled conversation (repetitive/disconnected),
  - trust break (guarded/frustrated ending),
  - appointment ready (clear next action).

Ending rule:
When the total interaction count reaches 12, when the user clearly finishes, or when the latest user message is "@skip_lesson", output ONLY a raw JSON object with this shape:
{
  "scores": {
    "empathy": <0-100>,
    "listening": <0-100>,
    "trust": <0-100>,
    "relationship": <0-100>,
    "closing": <0-100>
  },
  "upMeter": {
    "start": 35,
    "peak": <0-100>,
    "end": <0-100>
  },
  "upMeterInsight": "<one short sentence about what moved engagement most>",
  "outcomeTag": "Customer Engaged" | "Trust Established" | "Appointment Set" | "Lost Momentum" | "Conversation Breakdown",
  "skillTips": {
    "empathy": "<one short coaching line>",
    "listening": "<one short coaching line>",
    "trust": "<one short coaching line>",
    "relationship": "<one short coaching line>",
    "closing": "<one short coaching line>"
  },
  "xpAwarded": <number>,
  "coachSummary": "<short manager-safe coaching summary>",
  "recommendedNextFocus": "<one CX trait>",
  "ratings": {
    "empathy": <0-100>,
    "listening": <0-100>,
    "trust": <0-100>,
    "followUp": <0-100>,
    "closing": <0-100>,
    "relationship": <0-100>
  },
  "severity": "normal" | "behavior_violation",
  "flags": ["optional flags"],
  "outcome": "successful" | "mixed" | "needs-work",
  "coachingTag": "price_first" | "payment_focus" | "trust_drop" | "weak_discovery" | "knowledge_gap" | "strong_empathy" | "empathy_builder" | "missed_influence" | "feature_confusion" | "weak_follow_up" | "trust_pressure" | "discount_focus" | "premature_close" | "missed_connection" | "trust_gap" | "clarity_needed" | "tech_resistance" | "relationship_opportunity" | "closing_miss" | "needs_alignment" | "trust_rebuild" | "process_efficiency" | "feature_miss" | "comparison_gap" | "loyalty_opportunity" | "negotiation_pressure" | "relationship_build" | "strong_relationship" | "trust_builder" | "closing_strength" | "needs_listening" | "relationship_builder",
  "summaryTag": "price_first" | "payment_focus" | "trust_drop" | "weak_discovery" | "knowledge_gap" | "strong_empathy" | "empathy_builder" | "missed_influence" | "feature_confusion" | "weak_follow_up" | "trust_pressure" | "discount_focus" | "premature_close" | "missed_connection" | "trust_gap" | "clarity_needed" | "tech_resistance" | "relationship_opportunity" | "closing_miss" | "needs_alignment" | "trust_rebuild" | "process_efficiency" | "feature_miss" | "comparison_gap" | "loyalty_opportunity" | "negotiation_pressure" | "relationship_build" | "strong_relationship" | "trust_builder" | "closing_strength" | "needs_listening" | "relationship_builder",
  "sprocketCoachingLine": "<single encouraging coaching sentence for the consultant>",
  "endingEmotionalState": "guarded" | "cautious" | "open" | "trusting" | "frustrated" | "resistant" | "curious" | "comfortable" | "engaged" | "stressed" | "reassured" | "optimistic",
  "finalCustomerResponse": "<one realistic final customer line reflecting emotion and trust>",
  "endingType": "positive_progress" | "neutral_pause" | "stalled_conversation" | "trust_break" | "appointment_ready",
  "recommendedNextStep": "discovery_lesson" | "trust_building_lesson" | "closing_lesson" | "relationship_lesson" | "follow_up_lesson" | "no_recommendation",
  "trustShift": <integer shift from start to end trust/engagement>
}

Fresh Up scoring rules:
- XP must be between 40 and 150 for normal behavior.
- XP should be meaningfully higher than a standard lesson when performance is strong.
- Ratings should reflect the full conversation, not just the ending.
- "coachSummary" should be concise and useful.
- "sprocketCoachingLine" should feel supportive and action-oriented.
- "finalCustomerResponse" should sound like a real final customer statement, not an AI summary.
- "endingType" must reflect a natural conversation ending condition.
- Prefer the profile's default coaching tag when the conversation outcome is mixed.
- Reflect the current Up Meter signal in tone and difficulty. Current Up Meter: {{upMeterCurrent}}.

Conversation history:
{{#if history.length}}
{{#each history}}
- {{sender}}: {{text}}
{{/each}}
{{else}}
(No history yet)
{{/if}}

Latest trainee message:
{{userMessage}}

Respond as ${ASSISTANT_NAME}.`,
});

const conductFreshUpFlow = ai.defineFlow(
  {
    name: 'conductFreshUpFlow',
    inputSchema: ConductFreshUpInputSchema,
    outputSchema: ConductFreshUpOutputSchema,
  },
  async (input) => {
    const response = await freshUpPrompt(input);
    return response.text;
  }
);
