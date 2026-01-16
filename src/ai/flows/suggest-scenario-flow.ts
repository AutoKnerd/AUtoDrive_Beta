'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { UserRole as UserRoleType, CxTrait as CxTraitType } from '@/lib/definitions';

const UserRoleSchema = z.enum(['consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'Owner', 'Trainer', 'Admin']);
const CxTraitSchema = z.enum(['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding']);


const SuggestScenarioInputSchema = z.object({
  targetRole: UserRoleSchema,
  cxTrait: CxTraitSchema,
  teamPerformanceSummary: z.string().describe("A brief summary of the team's weakest areas related to the CX trait."),
});
export type SuggestScenarioInput = z.infer<typeof SuggestScenarioInputSchema>;

const SuggestScenarioOutputSchema = z.object({
  scenario: z.string().describe("A short, realistic dealership scenario text for training purposes."),
});
export type SuggestScenarioOutput = z.infer<typeof SuggestScenarioOutputSchema>;

export async function suggestScenario(input: SuggestScenarioInput): Promise<SuggestScenarioOutput> {
  const result = await suggestScenarioFlow(input);
  return result;
}

const scenarioPrompt = ai.definePrompt({
  name: 'suggestScenarioPrompt',
  input: { schema: SuggestScenarioInputSchema },
  output: { schema: SuggestScenarioOutputSchema },
  prompt: `You are a training content creator for the automotive industry. Your task is to write a short, realistic training scenario.

Role to be trained: {{targetRole}}
Customer Experience Trait to focus on: {{cxTrait}}
Summary of team's weakness: {{teamPerformanceSummary}}

Based on this, generate a single, concise scenario that this team member might encounter. The scenario should be written from the customer's perspective or as a neutral observation. Do not include any questions or instructions for the trainee. Just the scenario itself.

Example: A customer who bought a car three weeks ago calls, and they sound frustrated. "I was promised a call back last week about the scratch we noticed on delivery, but I haven't heard from anyone."`,
});

const suggestScenarioFlow = ai.defineFlow(
  {
    name: 'suggestScenarioFlow',
    inputSchema: SuggestScenarioInputSchema,
    outputSchema: SuggestScenarioOutputSchema,
  },
  async (input) => {
    const response = await scenarioPrompt(input);
    return response.output!;
  }
);
