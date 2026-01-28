

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sendInvitation, getTeamMemberRoles } from '@/lib/data';
import { User, UserRole, Dealership } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { MailCheck } from 'lucide-react';
import { Input } from '../ui/input';

interface InviteUserFormProps {
  user: User;
  dealerships: Dealership[];
  onUserInvited?: () => void;
}

const inviteSchema = z.object({
  dealershipId: z.string().min(1, 'A dealership must be selected.'),
  userEmail: z.string().email('Please enter a valid email address.'),
  role: z.string().min(1, "A role must be selected."),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function RegisterDealershipForm({ user, dealerships, onUserInvited }: InviteUserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const { toast } = useToast();

  const registrationRoles = getTeamMemberRoles(user.role);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      dealershipId: '',
      userEmail: '',
      role: '',
    },
  });
  
  useEffect(() => {
    // Pre-select dealership if user only belongs to one
    if (dealerships.length === 1 && !['Admin', 'Developer', 'Trainer'].includes(user.role)) {
        form.setValue('dealershipId', dealerships[0].id);
    }
  }, [dealerships, user.role, form]);


  async function onSubmit(data: InviteFormValues) {
    setIsSubmitting(true);
    setInvitationSent(false);
    try {
      await sendInvitation(data.dealershipId, data.userEmail, data.role as UserRole, user.userId);
      
      setInvitationSent(true);
      toast({
        title: 'Invitation Sent!',
        description: `An invitation has been sent to ${data.userEmail}.`,
      });
      
      onUserInvited?.();
      form.reset({
        ...form.getValues(),
        userEmail: '',
        role: '',
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Invitation Failed',
        description: (error as Error).message || 'An error occurred while sending the invitation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (invitationSent) {
    return (
      <div className="text-center">
        <Alert>
          <MailCheck className="h-4 w-4" />
          <AlertTitle>Invitation Sent Successfully!</AlertTitle>
          <AlertDescription>
            <p className="mb-4">
              An invitation email has been sent to <span className="font-semibold">{form.getValues('userEmail')}</span>. They can use the link in the email to create their account.
            </p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => setInvitationSent(false)} className="mt-4">
            Send Another Invitation
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <FormField
          control={form.control}
          name="dealershipId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dealership</FormLabel>
                <Select 
                    onValueChange={field.onChange}
                    value={field.value}
                >
                <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a dealership..." />
                    </SelectTrigger>
                </FormControl>
                <SelectContent>
                    {dealerships.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                    {dealerships.length === 0 && <SelectItem value="" disabled>No dealerships available to invite to.</SelectItem>}
                </SelectContent>
                </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
            control={form.control}
            name="userEmail"
            render={({ field }) => (
                <FormItem>
                <FormLabel>New User's Email</FormLabel>
                <FormControl>
                    <Input placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>New User's Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a role..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {registrationRoles.length === 0 && <SelectItem value="" disabled>No roles available to invite.</SelectItem>}
                            {registrationRoles.map(role => (
                                <SelectItem key={role} value={role}>
                                    {role === 'manager' ? 'Sales Manager' : role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <Button type="submit" disabled={isSubmitting || registrationRoles.length === 0 || dealerships.length === 0}>
          {isSubmitting ? <Spinner size="sm" /> : 'Send Invitation'}
        </Button>
      </form>
    </Form>
  );
}
