'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { createDealershipEnrollmentLink } from '@/lib/data.client';
import { User, UserRole, Dealership } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

type GeneratedLink = {
  url: string;
  dealershipName?: string;
  allowedRoles?: UserRole[];
};

export function RegisterDealershipForm({ user, dealerships, onUserInvited }: InviteUserFormProps) {
  const [selectedDealershipId, setSelectedDealershipId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
  const [isNativeShareSupported, setIsNativeShareSupported] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = ['Admin', 'Developer'].includes(user.role);
  const isOwner = user.role === 'Owner';
  
  // For Owners: only show their assigned dealerships
  // For others: show all managed dealerships
  const managedDealerships = isOwner 
    ? dealerships.filter(d => user.dealershipIds?.includes(d.id))
    : dealerships;
  
  useEffect(() => {
    // Pre-select dealership if user only belongs to one
    if (managedDealerships.length === 1 && !isAdmin) {
      setSelectedDealershipId(managedDealerships[0].id);
      return;
    }
    if (managedDealerships.length === 0) {
      setSelectedDealershipId('');
      return;
    }
    if (
      selectedDealershipId.length > 0 &&
      !managedDealerships.some((dealership) => dealership.id === selectedDealershipId)
    ) {
      setSelectedDealershipId('');
    }
  }, [managedDealerships, isAdmin, selectedDealershipId]);

  useEffect(() => {
    if (generatedLink && inputRef.current) {
      inputRef.current.select();
    }
  }, [generatedLink]);

  useEffect(() => {
    setIsNativeShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  async function onSubmitDealershipLink() {
    if (!selectedDealershipId) {
      toast({
        variant: 'destructive',
        title: 'Dealership required',
        description: 'Please select a dealership before generating the enrollment link.',
      });
      return;
    }

    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const { url, allowedRoles } = await createDealershipEnrollmentLink(selectedDealershipId, user.userId);
      const dealershipName = managedDealerships.find((dealership) => dealership.id === selectedDealershipId)?.name;

      setGeneratedLink({
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
    const shareText = `Join our dealership on AutoDrive. Enroll here: ${generatedLink.url}`;

    try {
      await navigator.share({
        title: 'AutoDrive Enrollment Link',
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
    const shareLabel = `Join ${generatedLink.dealershipName || 'our dealership'} on AutoDrive`;
    const emailBody = `Hi,\n\nUse this link to enroll in AutoDrive for ${generatedLink.dealershipName || 'our dealership'}:\n${generatedLink.url}\n\nChoose your role when you enroll.`;
    const smsBody = `${shareLabel}: ${generatedLink.url}`;
    const emailHref = `mailto:?subject=${encodeURIComponent(shareLabel)}&body=${encodeURIComponent(emailBody)}`;
    const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;

    return (
      <div className="text-center space-y-4">
        <Alert>
          <LinkIcon className="h-4 w-4" />
          <AlertTitle>Dealership Enrollment Link Created</AlertTitle>
          <AlertDescription>
            <>
              Share this QR/link with new team members at <strong>{generatedLink.dealershipName || 'this dealership'}</strong>.
              {generatedLink.allowedRoles && generatedLink.allowedRoles.length > 0 && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Users will pick from: {generatedLink.allowedRoles.map((role) => (role === 'manager' ? 'Sales Manager' : role)).join(', ')}.
                </span>
              )}
            </>
          </AlertDescription>
        </Alert>
        <div className="mx-auto w-fit rounded-lg bg-white p-3">
          <QRCode value={generatedLink.url} size={180} />
        </div>
        <p className="text-xs text-muted-foreground">Scan QR to open dealership enrollment</p>
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

  const renderDealershipSelect = () => (
    <Select onValueChange={setSelectedDealershipId} value={selectedDealershipId}>
      <SelectTrigger>
        <SelectValue placeholder="Select a dealership..." />
      </SelectTrigger>
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
      <div className="grid gap-4 py-2">
        <div className="space-y-2">
          <Label>Dealership</Label>
          {renderDealershipSelect()}
        </div>
        <p className="text-xs text-muted-foreground">
          Generates a reusable QR/link that pre-assigns users to this dealership and lets them choose an allowed role during enrollment.
        </p>
        <Button type="button" onClick={onSubmitDealershipLink} disabled={isSubmitting || dealerships.length === 0 || !selectedDealershipId}>
          {isSubmitting ? <Spinner size="sm" /> : 'Create Dealership Enrollment Link'}
        </Button>
      </div>
    </div>
  );
}
