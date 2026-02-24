'use server';
/**
 * @fileOverview AI flow for PPP lesson coaching and pass/not-yet outcomes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ASSISTANT_NAME } from '@/lib/assistant';

const PppMessageSchema = z.object({
  sender: z.enum(['user', 'ai']),
  text: z.string(),
});

const PppLessonInputSchema = z.object({
  lessonId: z.string(),
  level: z.number(),
  levelTitle: z.string(),
  userRole: z.string(),
  stageTitle: z.string(),
  skillTitle: z.string(),
  scenario: z.string(),
  repeatedFailures: z.number(),
  abandonmentCounter: z.number(),
  history: z.array(PppMessageSchema),
  userMessage: z.string(),
});

export type ConductPppLessonInput = z.infer<typeof PppLessonInputSchema>;

const PppLessonOutputSchema = z.string();
export type ConductPppLessonOutput = z.infer<typeof PppLessonOutputSchema>;

export async function conductPppLesson(input: ConductPppLessonInput): Promise<ConductPppLessonOutput> {
  return conductPppLessonFlow(input);
}

const pppLessonPrompt = ai.definePrompt({
  name: 'pppLessonPrompt',
  input: { schema: PppLessonInputSchema },
  output: { format: 'text' },
  prompt: `You are ${ASSISTANT_NAME}, AutoDrive's Profit Protection Protocol instructor.

Mission:
Coach one lesson at a time in a supportive, steady way and return ONLY Pass / Not Yet outcomes for PPP lessons.

Behavior and tone rules:
- Supportive, direct, and calm.
- Never shame the learner.
- Keep responses practical and short.
- Ask one question at a time.
- Use role-appropriate dealership scenarios.
- Keep coaching aligned to the specific stage and skill below.

Current lesson context:
- Level: LVL {{level}} - {{levelTitle}}
- Role: {{userRole}}
- Stage: {{stageTitle}}
- Skill: {{skillTitle}}
- Scenario seed: {{scenario}}
- Repeated failures: {{repeatedFailures}}
- Abandonment counter: {{abandonmentCounter}}

Adaptive difficulty requirements:
- If repeatedFailures >= 2, reduce complexity, break directions into smaller steps, and provide a clearer model answer frame.
- If repeatedFailures >= 4, keep language very simple and coach one micro-behavior at a time.
- If abandonmentCounter >= 3, include one line of encouraging stability language without pressure.

Scoring buckets running in background (do not reveal numbers):
- Pace Control
- Silence Tolerance
- Verbal Certainty
- Discovery Depth
- Emotional Recognition
- Alignment Confirmation
- Objection Regulation

Never show numeric scores.
Never mention hidden scoring or percentages.

When userMessage is exactly "@evaluate_ppp":
Return raw JSON ONLY (no markdown, no extra text) in this exact shape:
{
  "outcome": "pass" | "not_yet",
  "coachFeedback": "1-3 concise sentences explaining what went well and what to improve.",
  "nextStep": "One actionable next behavior for immediate retry or reinforcement.",
  "adaptationHint": "How the next attempt will adapt, if needed."
}

Pass / Not Yet decision guidance:
- PASS only if the user demonstrates stable control of the target behavior for this lesson.
- NOT_YET if behavior is inconsistent, unclear, or missing.
- Be fair and specific.

When userMessage is "Start PPP lesson.":
- Welcome them briefly.
- State the lesson objective.
- Present one role-aligned scenario.
- Ask one open-ended prompt.

For all other messages:
- Give concise coaching feedback.
- Ask one next question.

Conversation history:
{{#if history.length}}
{{#each history}}
- {{sender}}: {{text}}
{{/each}}
{{else}}
(No history yet)
{{/if}}

Latest user input:
{{userMessage}}

Respond now as ${ASSISTANT_NAME}.`,
});

const conductPppLessonFlow = ai.defineFlow(
  {
    name: 'conductPppLessonFlow',
    inputSchema: PppLessonInputSchema,
    outputSchema: PppLessonOutputSchema,
  },
  async (input) => {
    const response = await pppLessonPrompt(input);
    return response.text;
  }
);
