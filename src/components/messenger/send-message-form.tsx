
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Dealership, UserRole } from '@/lib/definitions';
import { sendMessage, getTeamMemberRoles } from '@/lib/data.client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';

interface SendMessageFormProps {
  user: User;
  dealerships: Dealership[]; // Pass managed/owned dealerships from parent
  onMessageSent: () => void;
}

const messageSchema = z.object({
  target: z.string().min(1, 'You must select a target audience.'),
  content: z.string().min(10, 'Message must be at least 10 characters long.').max(500, 'Message cannot exceed 500 characters.'),
});

type MessageFormValues = z.infer<typeof messageSchema>;

export function SendMessageForm({ user, dealerships, onMessageSent }: SendMessageFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { target: '', content: '' },
  });

  const getTargetOptions = () => {
    const options: { value: string; label: string }[] = [];
    switch (user.role) {
      case 'Owner':
        options.push({ value: 'global--all', label: 'All Dealerships (Global)' });
        dealerships.forEach(d => options.push({ value: `dealership--${d.id}`, label: d.name }));
        break;
      case 'General Manager':
        options.push({ value: `dealership--all-managed`, label: 'All My Dealerships' });
        dealerships.forEach(d => {
            if (user.dealershipIds.includes(d.id)) {
                options.push({ value: `dealership--${d.id}`, label: d.name })
            }
        });
        break;
      case 'manager':
      case 'Service Manager':
      case 'Parts Manager':
        user.dealershipIds.forEach(id => {
            const dealership = dealerships.find(d => d.id === id);
            if (dealership) {
                const targetRole = getTeamMemberRoles(user.role)[0] || '';
                options.push({ value: `department--${id}--${targetRole}`, label: `${dealership.name} - My Department` });
            }
        });
        break;
    }
    return options;
  };
  
  const targetOptions = getTargetOptions();

  useEffect(() => {
    // pre-select if only one option
    if (targetOptions.length === 1) {
        form.setValue('target', targetOptions[0].value);
    }
  }, []);


  async function onSubmit(data: MessageFormValues) {
    setIsSubmitting(true);
    try {
        const [scope, targetId, targetRole] = data.target.split('--');
        
        await sendMessage(user, data.content, { 
            scope: scope as 'global' | 'dealership' | 'department', 
            targetId: targetId,
            targetRole: targetRole as UserRole | undefined
        });

      toast({
        title: 'Message Sent!',
        description: 'Your message has been broadcast to the selected audience.',
      });
      form.reset();
      onMessageSent();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Message',
        description: (error as Error).message || 'An error occurred.',
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
          name="target"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={targetOptions.length <= 1}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an audience..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {targetOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Type your announcement here..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" /> : 'Send Message'}
        </Button>
      </form>
    </Form>
  );
}
