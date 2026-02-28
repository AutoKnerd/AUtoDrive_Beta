

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, UserRole, CxTrait, LessonCategory, lessonCategories, lessonCategoriesByRole, LessonRole, Lesson } from '@/lib/definitions';
import { getTeamMemberRoles, createLesson, assignLesson } from '@/lib/data.client';
import { suggestScenario } from '@/ai/flows/suggest-scenario-flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateLessonFormProps {
  user: User;
  onLessonCreated?: (newLesson?: Lesson) => void;
  assignOnCreateToUserId?: string;
  assignerId?: string;
}

const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

const createLessonSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  targetRole: z.string().min(1, 'You must select a target role for this lesson.'),
  associatedTrait: z.enum(cxTraits),
  category: z.string(),
  scenario: z.string().min(20, 'The scenario must be at least 20 characters long.'),
}).refine((data) => {
    const role = data.targetRole as LessonRole;
    const availableCategories = role === 'global' 
      ? lessonCategories 
      : (lessonCategoriesByRole[role] || []);

    // If categories are available for the selected role, one must be chosen.
    if (availableCategories.length > 0) {
      return data.category && availableCategories.includes(data.category as LessonCategory);
    }
    
    // If no categories are available, this field is not required.
    return true;
}, {
  message: 'Please select a category from the list.',
  path: ['category'],
});

type CreateLessonFormValues = z.infer<typeof createLessonSchema>;

export function CreateLessonForm({ user, onLessonCreated, assignOnCreateToUserId, assignerId }: CreateLessonFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateLessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      title: '',
      targetRole: '',
      associatedTrait: 'empathy',
      category: '',
      scenario: '',
    },
  });
  
  const targetRole = form.watch('targetRole');
  const { getValues, setValue } = form;
  const [availableCategories, setAvailableCategories] = useState<LessonCategory[]>([]);

  useEffect(() => {
    let newCategories: LessonCategory[] = [];
    if (targetRole === 'global') {
      newCategories = lessonCategories;
    } else if (targetRole && lessonCategoriesByRole[targetRole]) {
      newCategories = lessonCategoriesByRole[targetRole];
    }
    
    setAvailableCategories(newCategories);

    const currentCategory = getValues('category');
    if (!newCategories.includes(currentCategory as LessonCategory)) {
        setValue('category', newCategories[0] || '', { shouldValidate: true });
    }
  }, [targetRole, getValues, setValue]);


  const canCreateGlobal = ['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role);
  const teamRoles = getTeamMemberRoles(user.role).filter(role => role !== 'Trainer');
  
  const availableRoles = canCreateGlobal
    ? ['global', ...teamRoles]
    : teamRoles;

  const handleSuggestScenario = async () => {
    setIsSuggesting(true);
    const { title, targetRole, associatedTrait, category } = form.getValues();

    if (!title || !targetRole || !associatedTrait || !category) {
      toast({
        variant: 'destructive',
        title: 'Please complete lesson details',
        description: 'AI needs the Title, Target Role, CX Trait, and Category to suggest a scenario.',
      });
      setIsSuggesting(false);
      return;
    }

    try {
      const result = await suggestScenario({
        lessonTitle: title,
        targetRole: (targetRole === 'global' ? 'Sales Consultant' : targetRole) as UserRole, // AI needs a concrete role
        cxTrait: associatedTrait,
        category: category as LessonCategory,
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
      const createLessonResult = await createLesson({
        title: data.title,
        category: data.category as LessonCategory,
        associatedTrait: data.associatedTrait,
        targetRole: data.targetRole as UserRole | 'global',
        scenario: data.scenario,
      }, user, { autoAssignByRole: !assignOnCreateToUserId });
      const newLesson = createLessonResult.lesson;

      if (assignOnCreateToUserId && assignerId) {
        await assignLesson(assignOnCreateToUserId, newLesson.lessonId, assignerId);
        toast({
          title: 'Lesson Created & Assigned!',
          description: `'${data.title}' has been created and assigned.`,
        });
      } else {
        if (createLessonResult.autoAssignFailed) {
          toast({
            variant: 'destructive',
            title: 'Lesson Created, Send Failed',
            description: `'${data.title}' was created, but auto-assignment could not be completed.`,
          });
        } else {
          toast({
            title: 'Lesson Sent!',
            description: createLessonResult.autoAssignedCount > 0
              ? `'${data.title}' was sent to ${createLessonResult.autoAssignedCount} team member${createLessonResult.autoAssignedCount === 1 ? '' : 's'}.`
              : `'${data.title}' was created. No matching team members were found to assign.`,
          });
        }
      }

      form.reset();
      onLessonCreated?.(newLesson);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Create Lesson',
        description: (error as Error).message || 'An error occurred while saving the lesson.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <ScrollArea className="max-h-[70vh]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 pr-6">
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.map(role => (
                        <SelectItem key={role} value={role}>
                          {role === 'global' ? 'All Roles (Global)' : (role === 'manager' ? 'Sales Manager' : role)}
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={!targetRole || availableCategories.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableCategories.map(cat => (
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
                    Create lesson
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
            {isSubmitting ? <Spinner size="sm" /> : 'Send lesson'}
          </Button>
        </form>
      </ScrollArea>
    </Form>
  );
}
