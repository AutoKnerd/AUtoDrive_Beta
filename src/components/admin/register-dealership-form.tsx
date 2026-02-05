

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sendInvitation, getTeamMemberRoles } from '@/lib/data.client';
import { User, UserRole, Dealership, allRoles } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Copy, MailCheck, MailWarning } from 'lucide-react';
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
  const [inviteUrl, setInviteUrl] = useState('');
  const [sentToEmail, setSentToEmail] = useState('');
  const [showLink, setShowLink] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = ['Admin', 'Developer'].includes(user.role);
  const registrationRoles = isAdmin ? allRoles : getTeamMemberRoles(user.role);

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
    if (dealerships.length === 1 && !isAdmin) {
        form.setValue('dealershipId', dealerships[0].id);
    }
  }, [dealerships, isAdmin, form]);

  useEffect(() => {
    if (showLink && inputRef.current) {
      inputRef.current.select();
    }
  }, [showLink]);


  async function onSubmit(data: InviteFormValues) {
    setIsSubmitting(true);
    setInvitationSent(false);
    setInviteUrl('');
    setShowLink(false);
    try {
      const { url, emailSent } = await sendInvitation(data.dealershipId, data.userEmail, data.role as UserRole, user.userId);
      setSentToEmail(data.userEmail);
      setInviteUrl(url);
      setInvitationSent(true);
      
      if (emailSent) {
        toast({
          title: 'Invitation Sent!',
          description: `An email has been sent to ${data.userEmail}.`,
        });
      } else {
        setShowLink(true); // Show the link immediately if email fails
        toast({
          variant: 'destructive',
          title: 'Invitation Created (Email Failed)',
          description: `The invitation was created, but we couldn't send the email. Please copy the link manually.`,
        });
      }
      
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
        description: (error as Error).message || 'An error occurred while creating the invitation.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: 'Link Copied!', description: 'The invitation link has been copied to your clipboard.' });
    } catch (err) {
      console.error('Failed to copy link: ', err);
      setShowLink(true);
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy link automatically. Please copy it manually below.',
      });
    }
  };
  
  if (invitationSent) {
    return (
      <div className="text-center space-y-4">
        <Alert variant={showLink ? "destructive" : "default"}>
          {showLink ? <MailWarning className="h-4 w-4" /> : <MailCheck className="h-4 w-4" />}
          <AlertTitle>{showLink ? 'Invitation Created (Email Failed)' : 'Invitation Sent!'}</AlertTitle>
          <AlertDescription>
            {showLink ? (
              <>We couldn&apos;t send an email to <strong>{sentToEmail}</strong>. This usually means the email service API key is missing. Please copy the link below and send it to them manually.</>
            ) : (
              <>An email has been sent to <strong>{sentToEmail}</strong>. If they don&apos;t receive it, you can share the fallback link.</>
            )}
          </AlertDescription>
        </Alert>
        {showLink ? (
          <Input ref={inputRef} value={inviteUrl} readOnly />
        ) : null}
        <Button onClick={handleCopyLink} variant="outline" className="w-full">
          <Copy className="mr-2 h-4 w-4" />
          {showLink ? 'Copy Link' : 'Copy Fallback Link'}
        </Button>
        <Button onClick={() => setInvitationSent(false)} className="w-full">
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
                    {dealerships.length === 0 && <SelectItem value="none" disabled>No dealerships available to invite to.</SelectItem>}
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
                            {registrationRoles.length === 0 && <SelectItem value="none" disabled>No roles available to invite.</SelectItem>}
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
