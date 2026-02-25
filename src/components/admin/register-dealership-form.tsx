'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import QRCode from 'react-qr-code';
import { createDealershipEnrollmentLink, createInvitationLink, getTeamMemberRoles } from '@/lib/data.client';
import { User, UserRole, Dealership, allRoles } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const directInviteSchema = z.object({
  dealershipId: z.string().min(1, 'A dealership must be selected.'),
  userEmail: z.string().email('Please enter a valid email address.'),
  role: z.string().min(1, "A role must be selected."),
});

const dealershipLinkSchema = z.object({
  dealershipId: z.string().min(1, 'A dealership must be selected.'),
});

type DirectInviteFormValues = z.infer<typeof directInviteSchema>;
type DealershipLinkFormValues = z.infer<typeof dealershipLinkSchema>;

type InviteMode = 'direct' | 'dealership-link';

type GeneratedLink = {
  mode: InviteMode;
  url: string;
  userEmail?: string;
  dealershipName?: string;
  allowedRoles?: UserRole[];
};

export function RegisterDealershipForm({ user, dealerships, onUserInvited }: InviteUserFormProps) {
  const [mode, setMode] = useState<InviteMode>('direct');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
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

  const directInviteForm = useForm<DirectInviteFormValues>({
    resolver: zodResolver(directInviteSchema),
    defaultValues: {
      dealershipId: '',
      userEmail: '',
      role: '',
    },
  });

  const dealershipLinkForm = useForm<DealershipLinkFormValues>({
    resolver: zodResolver(dealershipLinkSchema),
    defaultValues: {
      dealershipId: '',
    },
  });
  
  useEffect(() => {
    // Pre-select dealership if user only belongs to one
    if (managedDealerships.length === 1 && !isAdmin) {
      directInviteForm.setValue('dealershipId', managedDealerships[0].id);
      dealershipLinkForm.setValue('dealershipId', managedDealerships[0].id);
    }
  }, [managedDealerships, isAdmin, directInviteForm, dealershipLinkForm]);

  useEffect(() => {
    if (generatedLink && inputRef.current) {
      inputRef.current.select();
    }
  }, [generatedLink]);

  useEffect(() => {
    setIsNativeShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);


  async function onSubmitDirect(data: DirectInviteFormValues) {
    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const { url } = await createInvitationLink(data.dealershipId, data.userEmail, data.role as UserRole, user.userId);
      setGeneratedLink({
        mode: 'direct',
        url,
        userEmail: data.userEmail,
        dealershipName: managedDealerships.find((dealership) => dealership.id === data.dealershipId)?.name,
      });

      toast({
        title: 'Invitation Link Created',
        description: `Share this link directly with ${data.userEmail}.`,
      });

      directInviteForm.reset({
        ...directInviteForm.getValues(),
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

  async function onSubmitDealershipLink(data: DealershipLinkFormValues) {
    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const { url, allowedRoles } = await createDealershipEnrollmentLink(data.dealershipId, user.userId);
      const dealershipName = managedDealerships.find((dealership) => dealership.id === data.dealershipId)?.name;

      setGeneratedLink({
        mode: 'dealership-link',
        url,
        dealershipName,
        allowedRoles,
      });

      toast({
        title: 'Enrollment Link Created',
        description: `${dealershipName || 'Dealership'} QR/link is ready to share.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Enrollment Link Failed',
        description: (error as Error).message || 'An error occurred while creating the enrollment link.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCopyLink = async () => {
    if (!generatedLink?.url) return;
    try {
      await navigator.clipboard.writeText(generatedLink.url);
      toast({ title: 'Link Copied!', description: 'The link has been copied to your clipboard.' });
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
    if (!generatedLink?.url || !isNativeShareSupported) return;
    const shareText = generatedLink.mode === 'direct'
      ? `You're invited to join AutoDrive. Register here: ${generatedLink.url}`
      : `Join our dealership on AutoDrive. Enroll here: ${generatedLink.url}`;

    try {
      await navigator.share({
        title: generatedLink.mode === 'direct' ? 'AutoDrive Invitation' : 'AutoDrive Enrollment Link',
        text: shareText,
        url: generatedLink.url,
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
  
  if (generatedLink) {
    const shareLabel = generatedLink.mode === 'direct'
      ? "You're invited to AutoDrive"
      : `Join ${generatedLink.dealershipName || 'our dealership'} on AutoDrive`;
    const emailBody = generatedLink.mode === 'direct'
      ? `Hi,\n\nYou're invited to join AutoDrive. Use this link to register:\n${generatedLink.url}\n\n`
      : `Hi,\n\nUse this link to enroll in AutoDrive for ${generatedLink.dealershipName || 'our dealership'}:\n${generatedLink.url}\n\nChoose your role when you enroll.`;
    const smsBody = `${shareLabel}: ${generatedLink.url}`;
    const emailHref = `mailto:${generatedLink.userEmail || ''}?subject=${encodeURIComponent(shareLabel)}&body=${encodeURIComponent(emailBody)}`;
    const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;

    return (
      <div className="text-center space-y-4">
        <Alert>
          <LinkIcon className="h-4 w-4" />
          <AlertTitle>{generatedLink.mode === 'direct' ? 'Invitation Link Created' : 'Dealership Enrollment Link Created'}</AlertTitle>
          <AlertDescription>
            {generatedLink.mode === 'direct' ? (
              <>Share this registration link directly with <strong>{generatedLink.userEmail}</strong>.</>
            ) : (
              <>
                Share this QR/link with new team members at <strong>{generatedLink.dealershipName || 'this dealership'}</strong>.
                {generatedLink.allowedRoles && generatedLink.allowedRoles.length > 0 && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Users will pick from: {generatedLink.allowedRoles.map((role) => (role === 'manager' ? 'Sales Manager' : role)).join(', ')}.
                  </span>
                )}
              </>
            )}
          </AlertDescription>
        </Alert>
        <div className="mx-auto w-fit rounded-lg bg-white p-3">
          <QRCode value={generatedLink.url} size={180} />
        </div>
        <p className="text-xs text-muted-foreground">
          {generatedLink.mode === 'direct' ? 'Scan QR to open invitation' : 'Scan QR to open dealership enrollment'}
        </p>
        <Input ref={inputRef} value={generatedLink.url} readOnly />
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
        <Button onClick={() => { setGeneratedLink(null); onUserInvited?.(); }} className="w-full">
            Create Another Link
        </Button>
      </div>
    );
  }

  const renderDealershipSelect = (field: { value: string; onChange: (value: string) => void }) => (
    <Select onValueChange={field.onChange} value={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="Select a dealership..." />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {managedDealerships.map((dealership) => (
          <SelectItem key={dealership.id} value={dealership.id}>{dealership.name}</SelectItem>
        ))}
        {dealerships.length === 0 && (
          <SelectItem value="none" disabled>No dealerships available to invite to.</SelectItem>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(value) => setMode(value as InviteMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="direct">Direct Individual Invite</TabsTrigger>
          <TabsTrigger value="dealership-link">Dealership QR Link</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'direct' ? (
        <Form {...directInviteForm}>
          <form onSubmit={directInviteForm.handleSubmit(onSubmitDirect)} className="grid gap-4 py-2">
            <FormField
              control={directInviteForm.control}
              name="dealershipId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealership</FormLabel>
                  {renderDealershipSelect(field)}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={directInviteForm.control}
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
                control={directInviteForm.control}
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
      ) : (
        <Form {...dealershipLinkForm}>
          <form onSubmit={dealershipLinkForm.handleSubmit(onSubmitDealershipLink)} className="grid gap-4 py-2">
            <FormField
              control={dealershipLinkForm.control}
              name="dealershipId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealership</FormLabel>
                  {renderDealershipSelect(field)}
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Generates a reusable QR/link that pre-assigns users to this dealership and lets them choose an allowed role during enrollment.
            </p>
            <Button type="submit" disabled={isSubmitting || dealerships.length === 0}>
              {isSubmitting ? <Spinner size="sm" /> : 'Create Dealership Enrollment Link'}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
