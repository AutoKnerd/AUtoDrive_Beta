
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { UserRole as UserRoleType, CxTrait as CxTraitType, LessonCategory as LessonCategoryType } from '@/lib/definitions';

const UserRoleSchema = z.enum(['Developer', 'Admin', 'Owner', 'Trainer', 'General Manager', 'manager', 'Service Manager', 'Parts Manager', 'Finance Manager', 'Sales Consultant', 'Service Writer', 'Parts Consultant']);
const CxTraitSchema = z.enum(['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding']);
const LessonCategorySchema = z.enum([
    'Sales - Meet and Greet',
    'Sales - Needs Assessment',
    'Sales - Vehicle Presentation',
    'Sales - Test Drive',
    'Sales - Negotiation',
    'Sales - Closing',
    'Sales - Delivery',
    'Sales - Follow-up',
    'Service - Appointment',
    'Service - Write-up',
    'Service - Walk-around',
    'Service - Presenting MPI',
    'Service - Status Updates',
    'Service - Active Delivery',
    'Parts - Identifying Needs',
    'Parts - Sourcing',
    'F&I - Menu Selling',
    'F&I - Objection Handling',
    'Product Knowledge',
]);


const SuggestScenarioInputSchema = z.object({
  lessonTitle: z.string().describe("The title for the lesson being created."),
  targetRole: UserRoleSchema,
  category: LessonCategorySchema,
  cxTrait: CxTraitSchema,
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
  prompt: `You are a training content creator for the automotive industry. Your task is to write a short, realistic training scenario for a lesson with the title "{{lessonTitle}}".

The scenario should be tailored for the following context:

- Role to be trained: {{targetRole}}
- Lesson Category: {{category}}
- Customer Experience Trait to focus on: {{cxTrait}}

Based on this, generate a single, concise scenario that this team member might encounter. The scenario should be written from the customer's perspective or as a neutral observation. It should be directly relevant to the lesson title, category, and target CX trait. Do not include any questions or instructions for the trainee. Just the scenario itself.

Example for a 'followUp' lesson: A customer who bought a car three weeks ago calls, and they sound frustrated. "I was promised a call back last week about the scratch we noticed on delivery, but I haven't heard from anyone."`,
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
