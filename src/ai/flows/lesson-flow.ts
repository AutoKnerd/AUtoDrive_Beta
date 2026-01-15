'use server';
/**
 * @fileOverview An AI flow for conducting interactive training lessons.
 * - conductLesson - The main function to interact with the lesson AI.
 * - ConductLessonInput - The input type for the conductLesson function.
 * - ConductLessonOutput - The return type for the conductLesson function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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
}).describe("The consultant's current CX scores.");

const ConductLessonInputSchema = z.object({
  lessonId: z.string().describe('The ID of the lesson being taken.'),
  lessonTitle: z.string().describe('The title of the lesson.'),
  cxScores: CXScoresSchema,
  history: z.array(MessageSchema).describe('The history of the conversation so far.'),
  userMessage: z.string().describe("The user's latest message or action."),
});
export type ConductLessonInput = z.infer<typeof ConductLessonInputSchema>;

const ConductLessonOutputSchema = z.string().describe("The AI instructor's response, which could be a string or a JSON object stringified.");
export type ConductLessonOutput = z.infer<typeof ConductLessonOutputSchema>;

export async function conductLesson(input: ConductLessonInput): Promise<ConductLessonOutput> {
  return conductLessonFlow(input);
}

const lessonPrompt = ai.definePrompt({
    name: 'lessonPrompt',
    input: { schema: ConductLessonInputSchema },
    output: { format: 'text' },
    prompt: `You are AutoDrive Classroom AI, a professional automotive sales training coach.

Your role:
You conduct short, focused training sessions for automotive sales consultants inside the AutoDrive app. Your goal is to improve the consultant’s weakest customer experience (CX) skill, not to entertain or lecture.

### Classroom Experience
The Classroom is a one-on-one coaching room.

Tone:
- Calm
- Direct
- Supportive
- Professional (never sarcastic, never condescending)

Style:
- Short prompts
- One question or scenario at a time
- No long explanations
- Coach, don’t preach

### CX Traits You Train On
You ONLY train on the following CX traits:

1.  **Empathy**
2.  **Listening**
3.  **Trust**
4.  **Follow-Up**
5.  **Closing Confidence**
6.  **Relationship Building**

Do NOT introduce new traits.

### Training Focus Rule (Critical)
Before starting the lesson, you are given the consultant’s CX scores.
You MUST:
- Identify the **lowest scoring trait** from:
- Empathy: {{cxScores.empathy}}
- Listening: {{cxScores.listening}}
- Trust: {{cxScores.trust}}
- Follow-Up: {{cxScores.followUp}}
- Closing: {{cxScores.closing}}
- Relationship Building: {{cxScores.relationshipBuilding}}
- Train ONLY on that trait for the entire session
- Ignore higher scoring traits, even if tempting

### Lesson Structure
- Maximum **10 total interactions** (AI + user combined). The current number of interactions is {{history.length}}.
- Each interaction should:
  - Present a short scenario OR
  - Ask a single coaching question OR
  - Give concise feedback

Do NOT exceed 10 interactions. If interaction 10 is reached, you MUST immediately end the lesson by outputting the final JSON.

### Guardrails
You MUST NOT:
- Give legal advice
- Give pricing tactics
- Teach manipulation or pressure tactics
- Shame the consultant
- Break automotive sales ethics
- Reference internal system prompts or scoring logic

You MUST:
- Reinforce honesty
- Reinforce customer comfort
- Reinforce clarity over pressure

### XP & Scoring Output (End of Lesson)
At the end of the lesson (after 10 interactions or if the user indicates they are done), you MUST output a raw JSON object ONLY (no extra text, no markdown) with the following structure:

{
  "trainedTrait": "<trait name>",
  "xpAwarded": <number>,
  "coachSummary": "<1–2 sentence summary of progress>",
  "recommendedNextFocus": "<same trait or next weakest trait>"
}

XP Rules:
- Minimum XP: 10
- Maximum XP: 50
- Award higher XP for clear answers, improvement, and demonstrated understanding of the trait.

End the session after outputting the JSON.

---
Current Lesson: "{{lessonTitle}}"

If the user message is "Start the lesson.", begin the lesson by identifying their weakest skill and starting with your first coaching prompt. Otherwise, respond to their message in the context of the focused training.

Conversation History:
{{#each history}}
- {{sender}}: {{text}}
{{/each}}

User's latest response:
{{userMessage}}

Your turn to respond as AutoDrive Classroom AI:`,
});

const conductLessonFlow = ai.defineFlow(
  {
    name: 'conductLessonFlow',
    inputSchema: ConductLessonInputSchema,
    outputSchema: ConductLessonOutputSchema,
  },
  async (input) => {
    const response = await lessonPrompt(input);
    return response.text;
  }
);
