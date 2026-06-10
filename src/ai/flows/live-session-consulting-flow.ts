'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  buildFallbackConsultingInsight,
  buildFallbackConsultingLearning,
} from '@/lib/live-session/consulting-profile';

// Sprocket AI coaching layer for the Consulting Performance summary (section 2).
// Turns a consultant's (or the room's) persona-match scores, missed features, and
// actual pitch wording into short sales coaching. Numbers are computed
// deterministically elsewhere; this writes the human coaching, with a templated
// fallback when the model is unavailable.

const ConsultingInsightInputSchema = z.object({
  mode: z.enum(['individual', 'room']).default('individual'),
  jamieScore: z.number().nullable().optional(),
  ryanScore: z.number().nullable().optional(),
  topMisses: z.array(z.string()).optional(), // feature labels the room/person missed
  jamiePitch: z.string().optional(), // their one-line talk track
  ryanPitch: z.string().optional(),
  pitchSamples: z.array(z.string()).optional(), // room: a few sample pitches
  participantCount: z.number().optional(),
});

const ConsultingInsightOutputSchema = z.object({
  insight: z.string(),
  learningFocus: z.string(),
});

export type ConsultingInsightInput = z.infer<typeof ConsultingInsightInputSchema>;
export type ConsultingInsightOutput = z.infer<typeof ConsultingInsightOutputSchema>;

const consultingInsightPrompt = ai.definePrompt({
  name: 'liveSessionConsultingInsightPrompt',
  input: { schema: ConsultingInsightInputSchema },
  output: { schema: ConsultingInsightOutputSchema },
  prompt: `You are "DRIVE_OS", an AI sales coach inside a Kia ADAS dealer workshop. Consultants just matched ADAS features to two customer personas and wrote a one-line pitch for each.

Persona Jamie: single, downtown apartment with a parking garage, highway commuter who hates stop-and-go, fills her trunk with thrifted finds.
Persona Ryan: married business owner, three sons, drives home in the dark on congested roads with cyclists, enjoys camping and weekend trips.

Context mode: {{mode}}
{{#if participantCount}}Consultants represented: {{participantCount}}{{/if}}
Jamie match score: {{jamieScore}}
Ryan match score: {{ryanScore}}
Most-missed features: {{#each topMisses}}{{this}}; {{/each}}
{{#if jamiePitch}}Their Jamie pitch: "{{jamiePitch}}"{{/if}}
{{#if ryanPitch}}Their Ryan pitch: "{{ryanPitch}}"{{/if}}
{{#if pitchSamples}}Sample pitches from the room: {{#each pitchSamples}}"{{this}}"; {{/each}}{{/if}}

Rules:
- "insight": 1-2 sentences of sales coaching. If individual, speak to the consultant ("you"); if room, speak about the group ("the room"). Name the weaker persona and the key missed feature, and—if a pitch is given—react to the actual pitch wording.
- "learningFocus": one short, tactical coaching cue (what to practice / how to tie a feature to the customer's lifestyle).
- Under 40 words each. No markdown, no bullets, no surrounding quotes. Practical, encouraging, like a great sales trainer.`,
});

const consultingInsightFlow = ai.defineFlow(
  {
    name: 'liveSessionConsultingInsightFlow',
    inputSchema: ConsultingInsightInputSchema,
    outputSchema: ConsultingInsightOutputSchema,
  },
  async (input) => {
    const response = await consultingInsightPrompt(input);
    return response.output ?? fallback(input);
  },
);

function fallback(input: ConsultingInsightInput): ConsultingInsightOutput {
  const topMisses = (input.topMisses || []).map((label) => ({ slug: '', label }));
  return {
    insight: buildFallbackConsultingInsight({
      jamieScore: input.jamieScore ?? null,
      ryanScore: input.ryanScore ?? null,
      topMisses,
      mode: input.mode,
    }),
    learningFocus: buildFallbackConsultingLearning(topMisses),
  };
}

export async function generateConsultingInsight(
  input: ConsultingInsightInput,
): Promise<ConsultingInsightOutput> {
  try {
    const result = await consultingInsightFlow(input);
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
