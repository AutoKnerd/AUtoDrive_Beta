'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  buildFallbackImpactInsight,
  buildFallbackImpactLearning,
} from '@/lib/live-session/impact-profile';

// Sprocket AI narrative for the Session Impact finale. Turns the session's
// before/after metrics into a short impact summary + a manager-facing note.

const ImpactInsightInputSchema = z.object({
  mode: z.enum(['individual', 'room']).default('room'),
  prePct: z.number(),
  postPct: z.number(),
  knowledgeLift: z.number(),
  confPre: z.number(),
  confPost: z.number(),
  confLift: z.number(),
  passRate: z.number(),
  optInRate: z.number(),
  participantCount: z.number().optional(),
  topGaps: z.array(z.string()).optional(), // topics staff missed most on the post-test
});

const ImpactInsightOutputSchema = z.object({
  insight: z.string(),
  learningFocus: z.string(),
});

export type ImpactInsightInput = z.infer<typeof ImpactInsightInputSchema>;
export type ImpactInsightOutput = z.infer<typeof ImpactInsightOutputSchema>;

const impactInsightPrompt = ai.definePrompt({
  name: 'liveSessionImpactInsightPrompt',
  input: { schema: ImpactInsightInputSchema },
  output: { schema: ImpactInsightOutputSchema },
  prompt: `You are "DRIVE_OS", the AI summarizing the measurable impact of a Kia ADAS dealer workshop that just ended.

Context mode: {{mode}}
{{#if participantCount}}Consultants: {{participantCount}}{{/if}}
Knowledge: {{prePct}}% before -> {{postPct}}% after (lift {{knowledgeLift}})
Confidence (1-5): {{confPre}} -> {{confPost}} (lift {{confLift}})
Pass rate at 80%: {{passRate}}%
Quick Tips opt-in rate: {{optInRate}}%
Topics staff missed most on the post-test: {{#each topGaps}}{{this}}; {{/each}}

Rules:
- "insight": 1-2 sentences celebrating the measurable result. If room, speak about "the room"; if individual, speak to "you". Lead with the knowledge lift and pass rate; mention confidence and opt-in.
- "learningFocus": one short, manager-facing coaching note. If topGaps are present, name the top 1-2 topics the team should work on next; otherwise note who to follow up on (those under the 80% bar) or keeping opt-ins engaged.
- Under 40 words each. No markdown, no bullets, no surrounding quotes. Confident, results-oriented.`,
});

const impactInsightFlow = ai.defineFlow(
  {
    name: 'liveSessionImpactInsightFlow',
    inputSchema: ImpactInsightInputSchema,
    outputSchema: ImpactInsightOutputSchema,
  },
  async (input) => {
    const response = await impactInsightPrompt(input);
    return response.output ?? fallback(input);
  },
);

function fallback(input: ImpactInsightInput): ImpactInsightOutput {
  const m = {
    prePct: input.prePct, postPct: input.postPct, knowledgeLift: input.knowledgeLift,
    confPre: input.confPre, confPost: input.confPost, confLift: input.confLift,
    passRate: input.passRate, optInRate: input.optInRate,
  };
  return {
    insight: buildFallbackImpactInsight(m, input.mode === 'individual' ? 'You' : 'The room'),
    learningFocus: buildFallbackImpactLearning(m),
  };
}

export async function generateImpactInsight(input: ImpactInsightInput): Promise<ImpactInsightOutput> {
  try {
    const result = await impactInsightFlow(input);
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
