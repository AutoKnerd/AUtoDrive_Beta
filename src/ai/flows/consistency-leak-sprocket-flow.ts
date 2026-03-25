'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SectionSchema = z.enum(['wobble', 'happens', 'feels', 'consistency', 'behavior']);

const AnswersSchema = z.object({
  step1: z.string().max(200).optional().default(''),
  step2: z.string().max(200).optional().default(''),
  step3: z.string().max(200).optional().default(''),
  step4: z.string().max(600).optional().default(''),
  step5: z.string().max(600).optional().default(''),
});

const SectionHelpInputSchema = z.object({
  section: SectionSchema,
  answers: AnswersSchema,
});

const SectionHelpOutputSchema = z.object({
  suggestions: z.array(z.string()).min(1).max(2),
});

const RefineInputSchema = z.object({
  answers: AnswersSchema,
  current: z.object({
    recoveryMove: z.string().max(1200),
    sayNext: z.string().max(1200),
    avoid: z.string().max(1200),
  }),
});

const RefineOutputSchema = z.object({
  recoveryMove: z.string(),
  sayNext: z.string(),
  avoid: z.string(),
});

const PracticeInputSchema = z.object({
  answers: AnswersSchema,
  sayNext: z.string().max(1200),
});

const PracticeOutputSchema = z.object({
  softer: z.string(),
  direct: z.string(),
  consultative: z.string(),
});

function fallbackSectionHelp(input: z.infer<typeof SectionHelpInputSchema>): z.infer<typeof SectionHelpOutputSchema> {
  if (input.section === 'wobble') {
    return {
      suggestions: [
        'Pick the earliest stage where consistency breaks first.',
        'Choose one stage you can standardize this week.',
      ],
    };
  }
  if (input.section === 'happens') {
    return {
      suggestions: [
        'Name the behavior you can control every time.',
        'Choose the most frequent breakdown pattern.',
      ],
    };
  }
  if (input.section === 'feels') {
    return {
      suggestions: [
        'Select the feeling most likely to delay trust.',
        'If unsure, choose the emotion you hear most in objections.',
      ],
    };
  }
  if (input.section === 'consistency') {
    return {
      suggestions: [
        'Write one short sentence you can repeat under pressure.',
        'Avoid broad goals, choose a concrete repeatable move.',
      ],
    };
  }
  return {
    suggestions: [
      'Pick one behavior you can execute in under 60 seconds.',
      'Make it measurable: same trigger, same action, every deal.',
    ],
  };
}

function fallbackRefine(input: z.infer<typeof RefineInputSchema>): z.infer<typeof RefineOutputSchema> {
  const stage = (input.answers.step1 || 'this step').toLowerCase();
  const emotion = (input.answers.step3 || 'unsure').toLowerCase();

  return {
    recoveryMove: `I want to slow ${stage} down for a second so this feels clear and easy.`,
    sayNext: `Here is what happens next, and I will keep it simple so you do not feel ${emotion}.`,
    avoid: 'Rushing to the next topic before the customer feels settled.',
  };
}

function fallbackPractice(input: z.infer<typeof PracticeInputSchema>): z.infer<typeof PracticeOutputSchema> {
  const stage = (input.answers.step1 || 'this step').toLowerCase();
  const emotion = (input.answers.step3 || 'unsure').toLowerCase();

  return {
    softer: `No rush, let us take ${stage} one step at a time so this feels comfortable.`,
    direct: `Next step is simple: we handle ${stage} now and keep it clean.`,
    consultative: `What matters most to you here, so I can keep this clear and avoid any ${emotion} feeling?`,
  };
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tokenSet(value: string): Set<string> {
  const words = normalizeLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
  return new Set(words);
}

function overlapRatio(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let overlap = 0;
  setA.forEach((word) => {
    if (setB.has(word)) overlap += 1;
  });
  return overlap / Math.min(setA.size, setB.size);
}

const sectionHelpPrompt = ai.definePrompt({
  name: 'consistencyLeakFinderSectionHelpPrompt',
  input: { schema: SectionHelpInputSchema },
  output: { schema: SectionHelpOutputSchema },
  prompt: `You are Sprocket, a concise assistant inside Consistency Leak Finder.

Section: {{section}}
Current answers:
- leak stage: {{answers.step1}}
- pattern: {{answers.step2}}
- customer feeling: {{answers.step3}}
- consistency sentence: {{answers.step4}}
- weekly behavior: {{answers.step5}}

Return exactly 1 or 2 suggestions that help the user decide faster.
Rules:
- Each suggestion must be 8-18 words.
- Practical, no fluff.
- No numbering, no labels, no extra commentary.`,
});

const refinePrompt = ai.definePrompt({
  name: 'consistencyLeakFinderRefinePrompt',
  input: { schema: RefineInputSchema },
  output: { schema: RefineOutputSchema },
  prompt: `You are Sprocket refining output for a mobile-first coaching tool.

User answers:
- leak stage: {{answers.step1}}
- what usually happens: {{answers.step2}}
- customer feels: {{answers.step3}}
- stronger consistency line: {{answers.step4}}
- weekly behavior: {{answers.step5}}

Current output:
- Recovery Move: {{current.recoveryMove}}
- What to Say Next: {{current.sayNext}}
- What to Avoid: {{current.avoid}}

Rewrite all three so they are concise, natural, and conversational.
Rules:
- 1 sentence each.
- Every line must sound like a consultant speaking directly to a customer.
- Recovery Move: one live line the consultant can say to reset momentum.
- What to Say Next: one clear next-step line the consultant can say immediately.
- What to Avoid: one specific mistake.
- Do not copy wording from user answers.
- Keep all three clearly different in structure and wording.
- Avoid training/meta language like "the process", "from your perspective", or "walk you through".
- No markdown.`,
});

const practicePrompt = ai.definePrompt({
  name: 'consistencyLeakFinderPracticePrompt',
  input: { schema: PracticeInputSchema },
  output: { schema: PracticeOutputSchema },
  prompt: `You are Sprocket generating quick practice variations.

Context:
- leak stage: {{answers.step1}}
- pattern: {{answers.step2}}
- customer feels: {{answers.step3}}
- line to vary: {{sayNext}}

Return three alternatives:
- softer
- direct
- consultative

Rules:
- 1 sentence each.
- Keep each under 22 words.
- Preserve intent while changing tone.
- Each variant must use a different sentence structure.
- Do not reuse the same opening words across variants.
- Do not copy user text verbatim.
- Every line must sound like real spoken consultant language.
- Avoid phrases like "the process", "walk you through", or "from your perspective".
- No markdown.`,
});

const sectionHelpFlow = ai.defineFlow(
  {
    name: 'consistencyLeakFinderSectionHelpFlow',
    inputSchema: SectionHelpInputSchema,
    outputSchema: SectionHelpOutputSchema,
  },
  async (input) => {
    const response = await sectionHelpPrompt(input);
    return response.output!;
  }
);

const refineFlow = ai.defineFlow(
  {
    name: 'consistencyLeakFinderRefineFlow',
    inputSchema: RefineInputSchema,
    outputSchema: RefineOutputSchema,
  },
  async (input) => {
    const response = await refinePrompt(input);
    return response.output!;
  }
);

const practiceFlow = ai.defineFlow(
  {
    name: 'consistencyLeakFinderPracticeFlow',
    inputSchema: PracticeInputSchema,
    outputSchema: PracticeOutputSchema,
  },
  async (input) => {
    const response = await practicePrompt(input);
    return response.output!;
  }
);

export async function getConsistencySectionHelp(
  input: z.infer<typeof SectionHelpInputSchema>
): Promise<z.infer<typeof SectionHelpOutputSchema>> {
  try {
    const result = await sectionHelpFlow(input);
    const suggestions = result?.suggestions?.filter((line) => !!line?.trim()).slice(0, 2) || [];
    if (suggestions.length > 0) {
      return { suggestions };
    }
    return fallbackSectionHelp(input);
  } catch {
    return fallbackSectionHelp(input);
  }
}

export async function refineConsistencyReset(
  input: z.infer<typeof RefineInputSchema>
): Promise<z.infer<typeof RefineOutputSchema>> {
  try {
    const result = await refineFlow(input);
    const recoveryMove = normalizeLine(result?.recoveryMove || '');
    const sayNext = normalizeLine(result?.sayNext || '');
    const avoid = normalizeLine(result?.avoid || '');

    const validShape = !!(recoveryMove && sayNext && avoid);
    const distinctEnough = validShape
      && overlapRatio(recoveryMove, sayNext) < 0.68
      && overlapRatio(recoveryMove, avoid) < 0.68
      && overlapRatio(sayNext, avoid) < 0.68;

    if (distinctEnough) {
      return { recoveryMove, sayNext, avoid };
    }
    return fallbackRefine(input);
  } catch {
    return fallbackRefine(input);
  }
}

export async function practiceConsistencyReset(
  input: z.infer<typeof PracticeInputSchema>
): Promise<z.infer<typeof PracticeOutputSchema>> {
  try {
    const result = await practiceFlow(input);
    const softer = normalizeLine(result?.softer || '');
    const direct = normalizeLine(result?.direct || '');
    const consultative = normalizeLine(result?.consultative || '');

    const validShape = !!(softer && direct && consultative);
    const distinctEnough = validShape
      && overlapRatio(softer, direct) < 0.62
      && overlapRatio(softer, consultative) < 0.62
      && overlapRatio(direct, consultative) < 0.62;

    if (distinctEnough) {
      return { softer, direct, consultative };
    }
    return fallbackPractice(input);
  } catch {
    return fallbackPractice(input);
  }
}
