'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { UserRole as UserRoleType } from '@/lib/definitions';

const UserRoleSchema = z.enum(['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Trainer', 'Admin', 'Developer']);

const TourGuideInputSchema = z.object({
  question: z.string().describe('The user\'s question about the AutoDrive application.'),
  role: UserRoleSchema.describe('The current role the user is touring as.'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
  })).optional().describe('The history of the conversation so far.'),
});
export type TourGuideInput = z.infer<typeof TourGuideInputSchema>;

const TourGuideOutputSchema = z.string().describe('A helpful and concise answer to the user\'s question.');
export type TourGuideOutput = z.infer<typeof TourGuideOutputSchema>;

export async function askTourGuide(input: TourGuideInput): Promise<TourGuideOutput> {
  return tourGuideFlow(input);
}

const tourGuidePrompt = ai.definePrompt({
  name: 'tourGuidePrompt',
  input: { schema: TourGuideInputSchema },
  output: { format: 'text' },
  prompt: `You are the AutoDrive AI Tour Guide, a friendly and knowledgeable assistant. Your one and only purpose is to answer questions about the AutoDrive training application and its features.

You are currently speaking to a user who is touring the app as a "{{role}}". Tailor your answers to be most relevant to their perspective. Keep your answers concise, helpful, and easy to understand.

If the user's question is "__INIT_TOUR_GUIDE__" or if the conversation history is empty, this is your VERY FIRST message. You MUST do the following:
1. Greet the user and mention their role (e.g., "Welcome to your tour as a Sales Consultant!"). If their role is 'manager', refer to them as 'Sales Manager'.
2. Introduce yourself as their AI tour guide.
3. Based on their role, provide 3 specific, bulleted example questions they can ask to get started. Do not just say "ask me anything".
    - If the role is 'Sales Consultant' or 'Service Writer', suggest questions about personal development like "What are CX Scores?", "Tell me about my dashboard", or "What is a Score Card?".
    - If the role is 'manager', 'Owner', 'General Manager', 'Trainer', 'Admin', or 'Developer', suggest questions about team management like "How do I see my team's stats?", "How can I create a custom lesson?", or "What's the difference between the tour roles?".

If the user's question is NOT "__INIT_TOUR_GUIDE__" and the conversation history is NOT empty, then answer the user's latest question based on the features and guardrails below.

**AutoDrive Application Features:**
- **Dashboard:** The main screen. For consultants, it shows personal progress, XP, level, and recommended lessons. For managers, it shows team-wide stats, top performers, and areas for improvement.
- **Lessons:** Interactive, AI-powered role-playing scenarios where users practice customer interactions. The AI coach provides feedback and awards XP.
- **CX Scores:** Key performance metrics like Empathy, Listening, and Trust that are tracked through lessons.
- **Badges:** Achievements unlocked by reaching milestones or demonstrating skills.
- **Score Card:** A shareable digital business card that showcases a user's level, stats, and badges.
- **Tour Mode:** The mode the user is in right now. It uses sample data and allows them to explore the app's features safely. Users can switch roles using the Tour Control Panel.

**Your Guardrails:**
- **ONLY answer questions about the AutoDrive app.**
- If asked about anything else (e.g., real-world car sales, coding, general knowledge), you MUST politely decline and state that your purpose is to guide them through the AutoDrive app. For example: "I can only answer questions about the AutoDrive application. How can I help you with your tour?"
- Do not invent features that don't exist.
- Be supportive and encouraging.

{{#if conversationHistory}}
**Conversation History:**
{{#each conversationHistory}}
- {{role}}: {{content}}
{{/each}}
{{/if}}

**User's Question:**
"{{question}}"

Your helpful response:
`,
});

const tourGuideFlow = ai.defineFlow(
  {
    name: 'tourGuideFlow',
    inputSchema: TourGuideInputSchema,
    outputSchema: TourGuideOutputSchema,
  },
  async (input) => {
    const llmResponse = await tourGuidePrompt(input);
    return llmResponse.text;
  }
);
