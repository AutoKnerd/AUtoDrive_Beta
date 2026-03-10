'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const OutreachChannelSchema = z.enum(['email', 'linkedin', 'text']);
const OutreachToneSchema = z.enum(['professional', 'friendly', 'direct', 'urgent']);

const GenerateOutreachTemplateInputSchema = z.object({
  channel: OutreachChannelSchema,
  tone: OutreachToneSchema,
  consultantName: z.string().min(1),
  consultantId: z.string().min(1),
  dealerInviteLink: z.string().url(),
  demoLink: z.string().url(),
  criteria: z.string().max(1200).optional(),
});

export type GenerateOutreachTemplateInput = z.infer<typeof GenerateOutreachTemplateInputSchema>;

const GenerateOutreachTemplateOutputSchema = z.object({
  content: z.string(),
});

export type GenerateOutreachTemplateOutput = z.infer<typeof GenerateOutreachTemplateOutputSchema>;

export async function generateOutreachTemplate(
  input: GenerateOutreachTemplateInput
): Promise<GenerateOutreachTemplateOutput> {
  try {
    const result = await generateOutreachTemplateFlow(input);
    if (result?.content?.trim()) {
      return result;
    }
    return { content: buildFallbackTemplate(input) };
  } catch {
    // Graceful fallback when AI provider key/config is unavailable.
    return { content: buildFallbackTemplate(input) };
  }
}

function normalizeCriteria(criteria?: string): string {
  const value = (criteria || '').trim();
  if (!value) return '';
  const firstLine = value.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
  return firstLine;
}

function buildFallbackTemplate(input: GenerateOutreachTemplateInput): string {
  const criteria = normalizeCriteria(input.criteria);
  const consultant = input.consultantName;
  const criteriaLine = criteria ? `\nContext: ${criteria}` : '';

  if (input.channel === 'email') {
    const toneSubject = input.tone === 'urgent'
      ? 'Quick invite: improve dealer execution this week'
      : input.tone === 'friendly'
        ? 'Quick AutoDriveCX invite for your dealership'
        : input.tone === 'direct'
          ? 'AutoDriveCX dealer trial invite'
          : 'Invitation: AutoDriveCX for dealership teams';
    return `Subject: ${toneSubject}

Hi,

I wanted to share AutoDriveCX for dealership teams that want stronger customer execution and consistency.${criteriaLine}

Dealer signup link:
${input.dealerInviteLink}

Demo:
${input.demoLink}

Best,
${consultant}`;
  }

  if (input.channel === 'linkedin') {
    const opener = input.tone === 'urgent'
      ? 'Dealership leaders: if execution consistency is slipping, take a look at AutoDriveCX.'
      : input.tone === 'friendly'
        ? 'Dealership leaders, sharing a practical way to strengthen team consistency with AutoDriveCX.'
        : input.tone === 'direct'
          ? 'AutoDriveCX helps dealership teams improve customer execution consistency.'
          : 'Dealership teams using AutoDriveCX build stronger execution consistency.';
    return `${opener}${criteria ? `\n\nFocus: ${criteria}` : ''}
\nDealer signup: ${input.dealerInviteLink}
\nDemo: ${input.demoLink}
\n#automotive #dealership #customerservice`;
  }

  const textPrefix = input.tone === 'urgent'
    ? 'Quick one:'
    : input.tone === 'friendly'
      ? 'Hey,'
      : input.tone === 'direct'
        ? 'AutoDriveCX signup link:'
        : 'Sharing this:';
  return `${textPrefix} AutoDriveCX dealer signup: ${input.dealerInviteLink}${criteria ? ` | Focus: ${criteria}` : ''}`;
}

const generateOutreachTemplatePrompt = ai.definePrompt({
  name: 'generateOutreachTemplatePrompt',
  input: { schema: GenerateOutreachTemplateInputSchema },
  output: { schema: GenerateOutreachTemplateOutputSchema },
  prompt: `You write high-performing outreach copy for dealership software consultants.

Channel: {{channel}}
Tone: {{tone}}
Consultant name: {{consultantName}}
Consultant referral code: {{consultantId}}
Dealer signup link (must include exactly once): {{dealerInviteLink}}
Demo link (optional, include at most once): {{demoLink}}
Criteria from consultant:
{{criteria}}

Rules:
- Return only the final copy for the requested channel in plain text.
- No markdown formatting.
- Keep claims realistic and avoid hype.
- Include a clear CTA.
- Preserve exact URLs, do not alter them.
- Do not mention internal systems or AI.

Channel-specific requirements:
- email: include a concise Subject line on first line as "Subject: ...", then the email body. Keep body under 170 words.
- linkedin: 3-6 short lines, skimmable, with 1-3 relevant hashtags at the end.
- text: max 320 characters, concise and human.
`,
});

const generateOutreachTemplateFlow = ai.defineFlow(
  {
    name: 'generateOutreachTemplateFlow',
    inputSchema: GenerateOutreachTemplateInputSchema,
    outputSchema: GenerateOutreachTemplateOutputSchema,
  },
  async (input) => {
    const response = await generateOutreachTemplatePrompt(input);
    return response.output!;
  }
);
