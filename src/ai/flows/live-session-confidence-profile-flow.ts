'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  buildFallbackInsight,
  buildFallbackLearningFocus,
  type ConfidenceAnswers,
} from '@/lib/live-session/confidence-profile';

// Sprocket AI narrative layer for the DRIVE_OS Driver Confidence Profile.
// Turns a person's (or the room's) ADAS confidence answers into a short,
// spoken-feeling insight. Numbers/gauges are computed deterministically
// elsewhere — this flow only writes the human-sounding narrative, and always
// falls back to a templated line if the model is unavailable.

const ConfidenceInsightInputSchema = z.object({
  mode: z.enum(['individual', 'room']).default('individual'),
  categoryLabel: z.string().optional(),
  drivingConcernLabel: z.string().optional(),
  parkingConcernLabel: z.string().optional(),
  visibilityConcernLabel: z.string().optional(),
  participantCount: z.number().optional(),
  primaryFocus: z.string().optional(),
});

const ConfidenceInsightOutputSchema = z.object({
  insight: z.string(),
  learningFocus: z.string(),
});

export type ConfidenceInsightInput = z.infer<typeof ConfidenceInsightInputSchema>;
export type ConfidenceInsightOutput = z.infer<typeof ConfidenceInsightOutputSchema>;

const confidenceInsightPrompt = ai.definePrompt({
  name: 'liveSessionConfidenceInsightPrompt',
  input: { schema: ConfidenceInsightInputSchema },
  output: { schema: ConfidenceInsightOutputSchema },
  prompt: `You are "DRIVE_OS", an AI co-pilot inside a Kia ADAS dealer workshop. You generate a short driver confidence insight from a person's answers.

Context mode: {{mode}}
Top interest category: {{categoryLabel}}
Driving situation that concerns them: {{drivingConcernLabel}}
Parking scenario that concerns them: {{parkingConcernLabel}}
Visibility challenge that concerns them: {{visibilityConcernLabel}}
{{#if participantCount}}Number of participants represented: {{participantCount}}{{/if}}
Primary focus area: {{primaryFocus}}

Rules:
- "insight": one or two sentences. If mode is "individual", speak to the driver ("your responses…"). If mode is "room", speak about the group ("the room…").
- Recommend awareness/assistance ADAS technology that maps to the concerns named.
- "learningFocus": one short, tactical sentence telling them what to watch as they learn.
- Keep each field under 40 words. No markdown, no bullets, no quotes around the text. Calm, credible, human.`,
});

const confidenceInsightFlow = ai.defineFlow(
  {
    name: 'liveSessionConfidenceInsightFlow',
    inputSchema: ConfidenceInsightInputSchema,
    outputSchema: ConfidenceInsightOutputSchema,
  },
  async (input) => {
    const response = await confidenceInsightPrompt(input);
    return response.output ?? fallback(input);
  },
);

function fallback(input: ConfidenceInsightInput): ConfidenceInsightOutput {
  const answers: ConfidenceAnswers = {
    categoryLabel: input.categoryLabel,
    drivingConcernLabel: input.drivingConcernLabel,
    parkingConcernLabel: input.parkingConcernLabel,
    visibilityConcernLabel: input.visibilityConcernLabel,
  };
  return {
    insight: buildFallbackInsight(answers),
    learningFocus: buildFallbackLearningFocus(answers),
  };
}

export async function generateConfidenceInsight(
  input: ConfidenceInsightInput,
): Promise<ConfidenceInsightOutput> {
  try {
    const result = await confidenceInsightFlow(input);
    const fb = fallback(input);
    return {
      insight: typeof result?.insight === 'string' && result.insight.trim() ? result.insight.trim() : fb.insight,
      learningFocus:
        typeof result?.learningFocus === 'string' && result.learningFocus.trim()
          ? result.learningFocus.trim()
          : fb.learningFocus,
    };
  } catch {
    return fallback(input);
  }
}
