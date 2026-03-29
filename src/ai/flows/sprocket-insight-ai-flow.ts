'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SprocketInsightAiInputSchema = z.object({
  toolId: z.string().min(1),
  userRole: z.string().optional(),
  cxSummary: z.string().optional(),
  output: z.record(z.string(), z.string()),
});

const SprocketInsightAiOutputSchema = z.object({
  output: z.record(z.string(), z.string()),
});

type SprocketInsightAiInput = z.infer<typeof SprocketInsightAiInputSchema>;
type SprocketInsightAiOutput = z.infer<typeof SprocketInsightAiOutputSchema>;

const sprocketInsightAiPrompt = ai.definePrompt({
  name: 'sprocketInsightAiPrompt',
  input: { schema: SprocketInsightAiInputSchema },
  output: { schema: SprocketInsightAiOutputSchema },
  prompt: `You are Sprocket AI, a dealership coaching assistant.

Rewrite the provided Sprocket insight fields to feel more natural, tactical, and specific while preserving meaning.

Context:
- Tool: {{toolId}}
- User role: {{userRole}}
- CX summary: {{cxSummary}}

Rules:
- Keep exactly the same keys.
- Keep one concise sentence per key (max 28 words).
- Keep direct, spoken language.
- No markdown, no bullets, no extra keys.
- Maintain the same strategic intent as each original field.

Original output fields:
{{{json output}}}
`,
});

const sprocketInsightAiFlow = ai.defineFlow(
  {
    name: 'sprocketInsightAiFlow',
    inputSchema: SprocketInsightAiInputSchema,
    outputSchema: SprocketInsightAiOutputSchema,
  },
  async (input) => {
    const response = await sprocketInsightAiPrompt(input);
    return response.output!;
  }
);

export async function enhanceSprocketInsightAi(input: SprocketInsightAiInput): Promise<SprocketInsightAiOutput> {
  try {
    const result = await sprocketInsightAiFlow(input);
    if (!result?.output || typeof result.output !== 'object') {
      return { output: input.output };
    }

    const keys = Object.keys(input.output);
    const normalized: Record<string, string> = {};
    keys.forEach((key) => {
      const aiValue = result.output[key];
      const fallback = input.output[key];
      const value = typeof aiValue === 'string' && aiValue.trim() ? aiValue.trim() : fallback;
      normalized[key] = value;
    });
    return { output: normalized };
  } catch {
    return { output: input.output };
  }
}
