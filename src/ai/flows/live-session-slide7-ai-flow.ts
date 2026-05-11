'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const Slide7AiInputSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  detail: z.string().optional(),
});

const Slide7AiOutputSchema = z.object({
  scenarioTitle: z.string(),
  trainerResponse: z.string(),
  coachingNote: z.string(),
});

export type Slide7AiInput = z.infer<typeof Slide7AiInputSchema>;
export type Slide7AiOutput = z.infer<typeof Slide7AiOutputSchema>;

const slide7AiPrompt = ai.definePrompt({
  name: 'liveSessionSlide7AiPrompt',
  input: { schema: Slide7AiInputSchema },
  output: { schema: Slide7AiOutputSchema },
  prompt: `You are a live AI coaching assistant inside a presentation called "AI supports the trainer, not replaces them."

Your job is to help a trainer respond to a live learning situation.

Scenario:
- Scenario ID: {{scenarioId}}
- Scenario Title: {{scenarioTitle}}
- Extra detail: {{detail}}

Rules:
- Keep the response practical, spoken, and supportive.
- The AI is assisting the trainer, not replacing them.
- "trainerResponse" must sound like one short thing the trainer could say next.
- "coachingNote" must be one short tactical note for the trainer.
- Keep each field under 28 words when possible.
- No markdown.
- No bullets.
- No multiple options.
- Stay calm, human, and credible.
- Preserve the scenario title exactly unless it needs light cleanup for readability.
`,
});

function buildFallbackOutput(input: Slide7AiInput): Slide7AiOutput {
  const detail = typeof input.detail === 'string' ? input.detail.trim() : '';
  const detailSuffix = detail ? ` Focus on ${detail.toLowerCase()}.` : '';

  const byScenario: Record<string, Slide7AiOutput> = {
    hesitant_learner: {
      scenarioTitle: input.scenarioTitle,
      trainerResponse: `Let's slow it down together and get one win before we move on.${detailSuffix}`.trim(),
      coachingNote: 'Reduce pressure, ask one open question, and reinforce a small success quickly.',
    },
    low_engagement: {
      scenarioTitle: input.scenarioTitle,
      trainerResponse: `Give me one real example from your day so we can make this useful right now.${detailSuffix}`.trim(),
      coachingNote: 'Reconnect the lesson to their real work before adding more explanation.',
    },
    confused_trainee: {
      scenarioTitle: input.scenarioTitle,
      trainerResponse: `Tell me which part feels unclear, and we will simplify just that part first.${detailSuffix}`.trim(),
      coachingNote: 'Narrow the confusion to one step and restate it in plain language.',
    },
    follow_up_gap: {
      scenarioTitle: input.scenarioTitle,
      trainerResponse: `Let's define the exact next action and when it should happen after this session.${detailSuffix}`.trim(),
      coachingNote: 'Turn the concept into a time-bound follow-up action the learner can actually repeat.',
    },
  };

  return byScenario[input.scenarioId] ?? {
    scenarioTitle: input.scenarioTitle,
    trainerResponse: `Start with one calm question, then tailor the next step to what the learner says.${detailSuffix}`.trim(),
    coachingNote: 'Keep the trainer in control and use AI as a quick coaching nudge, not a script replacement.',
  };
}

const slide7AiFlow = ai.defineFlow(
  {
    name: 'liveSessionSlide7AiFlow',
    inputSchema: Slide7AiInputSchema,
    outputSchema: Slide7AiOutputSchema,
  },
  async (input) => {
    const response = await slide7AiPrompt(input);
    return response.output ?? buildFallbackOutput(input);
  },
);

export async function generateLiveSessionSlide7Ai(input: Slide7AiInput): Promise<Slide7AiOutput> {
  try {
    const result = await slide7AiFlow(input);

    return {
      scenarioTitle: typeof result?.scenarioTitle === 'string' && result.scenarioTitle.trim()
        ? result.scenarioTitle.trim()
        : input.scenarioTitle,
      trainerResponse: typeof result?.trainerResponse === 'string' && result.trainerResponse.trim()
        ? result.trainerResponse.trim()
        : buildFallbackOutput(input).trainerResponse,
      coachingNote: typeof result?.coachingNote === 'string' && result.coachingNote.trim()
        ? result.coachingNote.trim()
        : buildFallbackOutput(input).coachingNote,
    };
  } catch {
    return buildFallbackOutput(input);
  }
}
