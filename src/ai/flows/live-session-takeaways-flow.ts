'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Sprocket AI: personalized end-of-session takeaways (slide 25). Turns a
// consultant's performance into 3 short, actionable "what to remember" lines.

const TakeawaysInputSchema = z.object({
  strongPersona: z.string().optional(),
  weakPersona: z.string().optional(),
  topMisses: z.array(z.string()).optional(), // feature labels they missed
  jamieScore: z.number().nullable().optional(),
  ryanScore: z.number().nullable().optional(),
});

const TakeawaysOutputSchema = z.object({
  takeaways: z.array(z.string()).length(3),
});

export type TakeawaysInput = z.infer<typeof TakeawaysInputSchema>;
export type TakeawaysOutput = z.infer<typeof TakeawaysOutputSchema>;

const takeawaysPrompt = ai.definePrompt({
  name: 'liveSessionTakeawaysPrompt',
  input: { schema: TakeawaysInputSchema },
  output: { schema: TakeawaysOutputSchema },
  prompt: `You are "DRIVE_OS", giving a Kia sales consultant their 3 personal takeaways from an ADAS workshop, based on how they matched features to two customer personas (Jamie: downtown garage parker + highway commuter; Ryan: family man, dark roads with cyclists, weekend trips).

Their stronger persona: {{strongPersona}}
Their weaker persona: {{weakPersona}}
Features they missed: {{#each topMisses}}{{this}}; {{/each}}
Jamie match: {{jamieScore}} | Ryan match: {{ryanScore}}

Write exactly 3 takeaways, each a short imperative coaching line (under 18 words) that ties an ADAS feature or habit to a customer type. Be specific and encouraging. No numbering, no markdown.`,
});

const takeawaysFlow = ai.defineFlow(
  {
    name: 'liveSessionTakeawaysFlow',
    inputSchema: TakeawaysInputSchema,
    outputSchema: TakeawaysOutputSchema,
  },
  async (input) => {
    const response = await takeawaysPrompt(input);
    return response.output ?? fallback(input);
  },
);

function fallback(input: TakeawaysInput): TakeawaysOutput {
  const miss = (input.topMisses && input.topMisses[0]) || 'the features you skipped';
  const weak = input.weakPersona || 'your weaker customer type';
  return {
    takeaways: [
      `Lead with the ADAS features that match each customer's daily drive.`,
      `Practice ${miss} — you skipped it in the activity.`,
      `Spend extra reps consulting customers like ${weak}.`,
    ],
  };
}

export async function generateTakeaways(input: TakeawaysInput): Promise<TakeawaysOutput> {
  try {
    const result = await takeawaysFlow(input);
    const t = result?.takeaways;
    if (Array.isArray(t) && t.length === 3 && t.every((x) => typeof x === 'string' && x.trim())) {
      return { takeaways: t.map((x) => x.trim()) };
    }
    return fallback(input);
  } catch {
    return fallback(input);
  }
}
