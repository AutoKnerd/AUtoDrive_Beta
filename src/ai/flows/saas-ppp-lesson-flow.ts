'use server';
/**
 * @fileOverview AI flow for SaaS PPP lesson coaching and pass/not-yet outcomes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ASSISTANT_NAME } from '@/lib/assistant';

const SaasPppMessageSchema = z.object({
  sender: z.enum(['user', 'ai']),
  text: z.string(),
});

const SaasPppLessonInputSchema = z.object({
  lessonId: z.string(),
  level: z.number(),
  levelTitle: z.string(),
  userRole: z.string(),
  lessonTitle: z.string(),
  objective: z.string(),
  scenario: z.string(),
  phase: z.enum(['primary', 'secondary']).optional(),
  channelLabel: z.string().optional(),
  repeatedFailures: z.number(),
  abandonmentCounter: z.number(),
  history: z.array(SaasPppMessageSchema),
  userMessage: z.string(),
});

export type ConductSaasPppLessonInput = z.infer<typeof SaasPppLessonInputSchema>;

const SaasPppLessonOutputSchema = z.string();
export type ConductSaasPppLessonOutput = z.infer<typeof SaasPppLessonOutputSchema>;

export async function conductSaasPppLesson(input: ConductSaasPppLessonInput): Promise<ConductSaasPppLessonOutput> {
  return conductSaasPppLessonFlow(input);
}

const saasPppLessonPrompt = ai.definePrompt({
  name: 'saasPppLessonPrompt',
  input: { schema: SaasPppLessonInputSchema },
  output: { format: 'text' },
  prompt: `You are ${ASSISTANT_NAME}, AutoDrive's SaaS PPP instructor.

Mission:
Coach one SaaS PPP lesson at a time with private, professional development. Show only Pass / Not Yet outcomes.

Tone and behavior rules:
- Calm, supportive, and direct.
- Never shame or belittle the learner.
- Keep responses practical and concise.
- Ask one question at a time.
- Use fictional SaaS sales scenarios.
- Adapt to user role context: Sales, Service, Parts, F&I, Manager, GM.

Current lesson context:
- Level: LVL {{level}} - {{levelTitle}}
- Role: {{userRole}}
- Lesson: {{lessonTitle}}
- Objective: {{objective}}
- Scenario seed: {{scenario}}
- Phase: {{phase}}
- Channel: {{channelLabel}}
- Repeated failures: {{repeatedFailures}}
- Abandonment counter: {{abandonmentCounter}}

Background evaluation dimensions (never show numbers):
- Tone
- Authority
- Pace
- Emotional Stability
- Alignment Quality

Critical constraints:
- Do not reveal numeric scoring.
- Do not mention percentages or internal scoring buckets.
- No manager oversight language.
- This is private coaching.

Adaptive requirements:
- If repeatedFailures >= 2, simplify instructions and provide a short response framework.
- If repeatedFailures >= 4, coach one micro-behavior only.
- If abandonmentCounter >= 3, include one short supportive stability line.

When userMessage is exactly "@evaluate_saas_ppp":
Return raw JSON ONLY (no markdown) in this exact shape:
{
  "outcome": "pass" | "not_yet",
  "coachFeedback": "1-3 concise sentences about what worked and what to improve.",
  "nextStep": "One actionable behavior for immediate retry or reinforcement.",
  "adaptationHint": "How the next attempt will adapt if needed."
}

Pass / Not Yet decision guidance:
- PASS only when the learner demonstrates stable execution of this lesson objective.
- NOT_YET when the execution is unstable, unclear, premature, or misaligned.

When userMessage is "Start SaaS PPP lesson.":
- Briefly introduce the lesson objective.
- Present one realistic SaaS scenario aligned to role and channel.
- Ask: "Do you want to debrief this interaction?" and provide two options:
  1) "Yes, debrief"
  2) "No, run simulation"

If the user chooses to debrief and provides a real interaction summary or pasted message:
- Coach against tone, authority, pace, emotional stability, and alignment quality.
- Keep feedback practical and specific.

If user declines debrief:
- Continue with simulation.
- Do not apply penalty language.

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

const conductSaasPppLessonFlow = ai.defineFlow(
  {
    name: 'conductSaasPppLessonFlow',
    inputSchema: SaasPppLessonInputSchema,
    outputSchema: SaasPppLessonOutputSchema,
  },
  async (input) => {
    const response = await saasPppLessonPrompt(input);
    return response.text;
  }
);
