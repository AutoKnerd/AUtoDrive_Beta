

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import QRCode from 'react-qr-code';
import { createInvitationLink, getTeamMemberRoles } from '@/lib/data.client';
import { User, UserRole, Dealership, allRoles } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Copy, Link as LinkIcon, Mail, MessageSquare, Share2 } from 'lucide-react';
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
  const [isNativeShareSupported, setIsNativeShareSupported] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = ['Admin', 'Developer'].includes(user.role);
  const isOwner = user.role === 'Owner';
  const registrationRoles = isAdmin ? allRoles : getTeamMemberRoles(user.role);
  
  // For Owners: only show their assigned dealerships
  // For others: show all managed dealerships
  const managedDealerships = isOwner 
    ? dealerships.filter(d => user.dealershipIds?.includes(d.id))
    : dealerships;

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
    if (managedDealerships.length === 1 && !isAdmin) {
        form.setValue('dealershipId', managedDealerships[0].id);
    }
  }, [managedDealerships, isAdmin, form]);

  useEffect(() => {
    if (invitationSent && inputRef.current) {
      inputRef.current.select();
    }
  }, [invitationSent]);

  useEffect(() => {
    setIsNativeShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);


  async function onSubmit(data: InviteFormValues) {
    setIsSubmitting(true);
    setInvitationSent(false);
    setInviteUrl('');
    try {
      const { url } = await createInvitationLink(data.dealershipId, data.userEmail, data.role as UserRole, user.userId);
      setSentToEmail(data.userEmail);
      setInviteUrl(url);
      setInvitationSent(true);
      toast({
        title: 'Invitation Link Created',
        description: `Share this link directly with ${data.userEmail}.`,
      });
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
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Could not copy link automatically. Please copy it manually below.',
      });
    }
  };

  const handleNativeShare = async () => {
    if (!inviteUrl || !isNativeShareSupported) return;
    const shareText = `You're invited to join AutoDrive. Register here: ${inviteUrl}`;
    try {
      await navigator.share({
        title: 'AutoDrive Invitation',
        text: shareText,
        url: inviteUrl,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({
          variant: 'destructive',
          title: 'Share Failed',
          description: 'Could not open the share sheet on this device.',
        });
      }
    }
  };
  
  if (invitationSent) {
    const emailSubject = "You're invited to AutoDrive";
    const emailBody = `Hi,\n\nYou're invited to join AutoDrive. Use this link to register:\n${inviteUrl}\n\n`;
    const smsBody = `You're invited to join AutoDrive. Register here: ${inviteUrl}`;
    const emailHref = `mailto:${sentToEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;

    return (
      <div className="text-center space-y-4">
        <Alert>
          <LinkIcon className="h-4 w-4" />
          <AlertTitle>Invitation Link Created</AlertTitle>
          <AlertDescription>
            Share this registration link directly with <strong>{sentToEmail}</strong>.
          </AlertDescription>
        </Alert>
        <div className="mx-auto w-fit rounded-lg bg-white p-3">
          <QRCode value={inviteUrl} size={180} />
        </div>
        <p className="text-xs text-muted-foreground">Scan QR to open invitation</p>
        <Input ref={inputRef} value={inviteUrl} readOnly />
        {isNativeShareSupported ? (
          <Button onClick={handleNativeShare} className="w-full">
            <Share2 className="mr-2 h-4 w-4" />
            Share From Device
          </Button>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="w-full">
            <a href={emailHref}>
              <Mail className="mr-2 h-4 w-4" />
              Email Link
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={smsHref}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Text Link
            </a>
          </Button>
        </div>
        <Button onClick={handleCopyLink} variant="outline" className="w-full">
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </Button>
        <Button onClick={() => { setInvitationSent(false); onUserInvited?.(); }} className="w-full">
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
                    {managedDealerships.map(d => (
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
          {isSubmitting ? <Spinner size="sm" /> : 'Create Invitation Link'}
        </Button>
      </form>
    </Form>
  );
}
