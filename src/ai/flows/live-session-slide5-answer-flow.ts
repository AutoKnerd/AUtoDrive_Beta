'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const Slide5AiInputSchema = z.object({
  participantName: z.string().min(1),
  question: z.string().min(1),
});

const Slide5AiOutputSchema = z.object({
  aiAnswer: z.string(),
  aiNote: z.string(),
});

export type Slide5AiInput = z.infer<typeof Slide5AiInputSchema>;
export type Slide5AiOutput = z.infer<typeof Slide5AiOutputSchema>;

const slide5AiPrompt = ai.definePrompt({
  name: 'liveSessionSlide5AnswerPrompt',
  input: { schema: Slide5AiInputSchema },
  output: { schema: Slide5AiOutputSchema },
  prompt: `You are Sprocket, an AI learning support assistant inside a live training presentation.

Your job is to help the room by giving a short, useful answer to an audience question without replacing the trainer.

Participant name: {{participantName}}
Question: {{question}}

Rules:
- "aiAnswer" should sound like a short live response a trainer could confidently build on.
- "aiNote" should be one short learning note or facilitation cue for the trainer.
- Keep each field under 34 words when possible.
- No markdown.
- No bullets.
- No multiple options.
- Be helpful, calm, practical, and learning-focused.
- If the question is broad, answer with one useful next step instead of overexplaining.
`,
});

function buildFallbackOutput(input: Slide5AiInput): Slide5AiOutput {
  const lowerQuestion = input.question.toLowerCase();

  if (lowerQuestion.includes('adapt') || lowerQuestion.includes('industry')) {
    return {
      aiAnswer: 'Yes. The same training engine can be adapted by changing examples, scenarios, and reinforcement prompts while keeping the learning structure consistent.',
      aiNote: 'Bridge the answer back to reuse, customization, and trainer control so the room sees flexibility without complexity.',
    };
  }

  if (lowerQuestion.includes('measure') || lowerQuestion.includes('track') || lowerQuestion.includes('engagement')) {
    return {
      aiAnswer: 'Engagement can be tracked through live responses, participation patterns, and follow-up activity so the trainer can see what is landing.',
      aiNote: 'Keep the answer concrete and tie measurement back to better coaching decisions after the session.',
    };
  }

  return {
    aiAnswer: 'That question is a great opening to connect the lesson to real behavior change, so the answer should stay practical and easy to apply right away.',
    aiNote: 'Use the question to reinforce one clear learning takeaway, then invite one example from the room.',
  };
}

const slide5AiFlow = ai.defineFlow(
  {
    name: 'liveSessionSlide5AnswerFlow',
    inputSchema: Slide5AiInputSchema,
    outputSchema: Slide5AiOutputSchema,
  },
  async (input) => {
    const response = await slide5AiPrompt(input);
    return response.output ?? buildFallbackOutput(input);
  },
);

export async function generateLiveSessionSlide5Answer(input: Slide5AiInput): Promise<Slide5AiOutput> {
  try {
    const result = await slide5AiFlow(input);

    return {
      aiAnswer: typeof result?.aiAnswer === 'string' && result.aiAnswer.trim()
        ? result.aiAnswer.trim()
        : buildFallbackOutput(input).aiAnswer,
      aiNote: typeof result?.aiNote === 'string' && result.aiNote.trim()
        ? result.aiNote.trim()
        : buildFallbackOutput(input).aiNote,
    };
  } catch {
    return buildFallbackOutput(input);
  }
}
