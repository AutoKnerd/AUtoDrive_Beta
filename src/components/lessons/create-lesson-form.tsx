'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, UserRole, CxTrait, LessonCategory } from '@/lib/definitions';
import { getTeamMemberRoles, createLesson } from '@/lib/data';
import { suggestScenario } from '@/ai/flows/suggest-scenario-flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Sparkles } from 'lucide-react';

interface CreateLessonFormProps {
  user: User;
  onLessonCreated?: () => void;
}

const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];
const lessonCategories: LessonCategory[] = ['Sales Process', 'Product Knowledge', 'Customer Service', 'Financing', 'Service', 'Parts'];

const createLessonSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  targetRole: z.string().min(1, 'You must select a target role for this lesson.'),
  associatedTrait: z.enum(cxTraits),
  category: z.enum(lessonCategories),
  scenario: z.string().min(20, 'The scenario must be at least 20 characters long.'),
});

type CreateLessonFormValues = z.infer<typeof createLessonSchema>;

export function CreateLessonForm({ user, onLessonCreated }: CreateLessonFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateLessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      title: '',
      scenario: '',
      category: 'Sales Process',
      associatedTrait: 'empathy',
    },
  });

  const canCreateGlobal = ['Owner', 'Admin', 'Trainer'].includes(user.role);
  const teamRoles = getTeamMemberRoles(user.role);
  
  const availableRoles = canCreateGlobal
    ? ['global', ...teamRoles]
    : teamRoles;

  const handleSuggestScenario = async () => {
    setIsSuggesting(true);
    const trait = form.getValues('associatedTrait');
    const role = form.getValues('targetRole');

    if (!trait || !role) {
      toast({
        variant: 'destructive',
        title: 'Please select a Trait and Role',
        description: 'AI needs a trait and target role to suggest a scenario.',
      });
      setIsSuggesting(false);
      return;
    }

    try {
      const result = await suggestScenario({
        targetRole: (role === 'global' ? 'consultant' : role) as UserRole, // AI needs a concrete role
        cxTrait: trait,
        teamPerformanceSummary: "The team struggles with proactively communicating delays and providing clear, empathetic explanations.",
      });
      form.setValue('scenario', result.scenario, { shouldValidate: true });
      toast({
        title: 'AI Scenario Suggested',
        description: 'The scenario has been generated and added to the form.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'AI Suggestion Failed',
        description: 'Could not generate a scenario at this time.',
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  async function onSubmit(data: CreateLessonFormValues) {
    setIsSubmitting(true);
    try {
      await createLesson({
        title: data.title,
        category: data.category,
        associatedTrait: data.associatedTrait,
        targetRole: data.targetRole as UserRole | 'global',
        scenario: data.scenario,
      });

      toast({
        title: 'Lesson Created!',
        description: `'${data.title}' has been added to the training curriculum.`,
      });
      form.reset();
      onLessonCreated?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Create Lesson',
        description: 'An error occurred while saving the lesson.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lesson Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Handling Price Objections" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="targetRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableRoles.map(role => (
                      <SelectItem key={role} value={role}>
                        {role === 'global' ? 'All Roles (Global)' : role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="associatedTrait"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CX Trait</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a trait..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cxTraits.map(trait => (
                      <SelectItem key={trait} value={trait}>
                        {trait.charAt(0).toUpperCase() + trait.slice(1).replace(/([A-Z])/g, ' $1')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
         <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lessonCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        <FormField
          control={form.control}
          name="scenario"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Training Scenario</FormLabel>
                <Button type="button" variant="ghost" size="sm" onClick={handleSuggestScenario} disabled={isSuggesting}>
                  {isSuggesting ? <Spinner size="sm" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Suggest with AI
                </Button>
              </div>
              <FormControl>
                <Textarea
                  placeholder="Describe a customer interaction or situation. The AI will use this to start the lesson."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" /> : 'Create Lesson'}
        </Button>
      </form>
    </Form>
  );
}
