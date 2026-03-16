'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';
import { generateOutreachTemplate } from '@/ai/flows/generate-outreach-template-flow';

type MarketingMetrics = {
  consultant_id: string;
  clicks: number;
  signups: number;
  conversions: number;
  conversion_rate: number;
  demo_visits: number;
  demo_conversions: number;
};

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ConsultantDealerOutreachPage() {
  const params = useParams<{ id: string }>();
  const consultantId = (params.id || '').toLowerCase();
  const {
    isAuthorized,
    isChecking,
    isAdmin,
    error: accessError,
    mappedReferralCode,
    normalizedRouteConsultantId,
  } = useConsultantRouteAccess(consultantId);

  const [metrics, setMetrics] = useState<MarketingMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'friendly' | 'direct' | 'urgent'>('professional');
  const [generatingChannel, setGeneratingChannel] = useState<'email' | 'linkedin' | 'text' | null>(null);

  const marketingBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://autodrivecx.com';
    return window.location.origin;
  }, []);
  const dealerInviteLink = `${marketingBaseUrl}/join/${encodeURIComponent(consultantId)}`;
  const demoLink = `${marketingBaseUrl}/demo/${encodeURIComponent(consultantId)}`;
  const tourLink = `${marketingBaseUrl}/tour/${encodeURIComponent(consultantId)}`;
  const referralLink = `${marketingBaseUrl}/join/${encodeURIComponent(consultantId)}`;

  const defaultEmailTemplate = useMemo(() => {
    return `Subject: Quick invite to AutoDriveCX for your dealership team

Hi,

I wanted to invite you to try AutoDriveCX for your dealership.

Dealer signup link:
${dealerInviteLink}

If you want a quick preview first, here is the demo:
${demoLink}

Best,
${toDisplayName(consultantId)}`;
  }, [consultantId, dealerInviteLink, demoLink]);

  const defaultLinkedInTemplate = useMemo(() => {
    return `Dealership leaders: if you want stronger customer conversations and better execution consistency, check out AutoDriveCX.\n\nDealer signup: ${dealerInviteLink}\n\n#automotive #dealership #customerservice`;
  }, [dealerInviteLink]);

  const defaultTextMessageTemplate = useMemo(() => {
    return `Here’s the AutoDriveCX dealer signup link I mentioned: ${dealerInviteLink}`;
  }, [dealerInviteLink]);
  const [emailTemplate, setEmailTemplate] = useState('');
  const [linkedInTemplate, setLinkedInTemplate] = useState('');
  const [textMessageTemplate, setTextMessageTemplate] = useState('');

  useEffect(() => {
    setEmailTemplate(defaultEmailTemplate);
  }, [defaultEmailTemplate]);

  useEffect(() => {
    setLinkedInTemplate(defaultLinkedInTemplate);
  }, [defaultLinkedInTemplate]);

  useEffect(() => {
    setTextMessageTemplate(defaultTextMessageTemplate);
  }, [defaultTextMessageTemplate]);

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  async function trackEvent(eventType: string, source: string) {
    try {
      await fetch('/api/consultant-marketing-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultant_id: consultantId,
          event_type: eventType,
          source,
        }),
      });
    } catch {
      // Best-effort analytics tracking.
    }
  }

  async function loadMetrics() {
    setIsLoadingMetrics(true);
    setError(null);

    try {
      const response = await fetch(`/api/consultant-marketing-metrics?id=${encodeURIComponent(consultantId)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load outreach metrics.');
      }
      setMetrics(payload as MarketingMetrics);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load outreach metrics.';
      setError(message);
    } finally {
      setIsLoadingMetrics(false);
    }
  }

  useEffect(() => {
    if (consultantId && isAuthorized) {
      void loadMetrics();
      return;
    }

    if (!isChecking) {
      setIsLoadingMetrics(false);
    }
  }, [consultantId, isAuthorized, isChecking]);

  async function copyText(text: string, eventType: string, source: string) {
    try {
      await navigator.clipboard.writeText(text);
      await trackEvent(eventType, source);
      await loadMetrics();
    } catch {
      setError('Unable to copy text.');
    }
  }

  async function openDealerSignup() {
    await trackEvent('referral_click', 'open_dealer_signup');
    window.open(dealerInviteLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function sendEmailInvite() {
    const subject = encodeURIComponent('AutoDriveCX dealer invite');
    const body = encodeURIComponent(emailTemplate);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    await trackEvent('email_invite', 'mailto');
    await loadMetrics();
  }

  async function openDemo() {
    await trackEvent('referral_click', 'open_demo');
    window.open(demoLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function openTour() {
    await trackEvent('share', 'open_tour');
    window.open(tourLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function generateTemplate(channel: 'email' | 'linkedin' | 'text') {
    setTemplateError(null);
    setGeneratingChannel(channel);
    try {
      const generated = await generateOutreachTemplate({
        channel,
        tone: aiTone,
        consultantName: consultantDisplayName || toDisplayName(consultantId),
        consultantId,
        dealerInviteLink,
        demoLink,
        criteria: aiCriteria.trim() || undefined,
      });

      const content = generated.content.trim();
      if (!content) {
        throw new Error('AI returned empty content. Please try different criteria.');
      }

      if (channel === 'email') setEmailTemplate(content);
      if (channel === 'linkedin') setLinkedInTemplate(content);
      if (channel === 'text') setTextMessageTemplate(content);

      await trackEvent('share', `ai_generate_${channel}`);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'Unable to generate template.';
      setTemplateError(message);
    } finally {
      setGeneratingChannel(null);
    }
  }

  const consultantDisplayName = useMemo(() => toDisplayName(consultantId), [consultantId]);
  const dealerClicks = metrics?.clicks ?? 0;
  const dealerTrials = metrics?.signups ?? 0;
  const activeDealerAccounts = metrics?.conversions ?? 0;
  const conversionRate = metrics?.conversion_rate ?? 0;
  const demoVisits = metrics?.demo_visits ?? 0;
  const demoConversionRate = demoVisits > 0 ? ((metrics?.demo_conversions ?? 0) / demoVisits) * 100 : 0;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="marketing" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">Dealer Outreach</CardTitle>
                <CardDescription className="text-slate-300">Consultant: {consultantDisplayName || 'Unknown'}</CardDescription>
              </CardHeader>
            </Card>

            {isAdmin && (
              <Card className="border-amber-400/50 bg-amber-500/10">
                <CardContent className="p-4">
                  <p className="text-sm text-amber-100">Admin viewing consultant dashboard: {consultantId}</p>
                </CardContent>
              </Card>
            )}

            {!isChecking && !isAuthorized && (
              <Card className="border-red-400/50 bg-red-500/10">
                <CardContent className="p-6">
                  <p className="text-sm text-red-200">
                    Access denied. Logged-in consultant ({mappedReferralCode || 'unknown'}) does not match route consultant ({normalizedRouteConsultantId || 'unknown'}).
                  </p>
                  {accessError && <p className="mt-2 text-xs text-red-100">{accessError}</p>}
                </CardContent>
              </Card>
            )}

            {isAuthorized && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Invite a Dealer</CardTitle>
                    <CardDescription>Primary action: invite dealerships to start their trial.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{dealerInviteLink}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => copyText(dealerInviteLink, 'referral_click', 'copy_invite_link')}>Copy Invite Link</Button>
                      <Button variant="outline" onClick={openDealerSignup}>Open Dealer Signup</Button>
                      <Button variant="outline" onClick={sendEmailInvite}>Send Email Invite</Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Dealer Clicks</p>
                        <p className="mt-1 text-xl font-semibold">{dealerClicks}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Dealer Trials Started</p>
                        <p className="mt-1 text-xl font-semibold">{dealerTrials}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Active Dealer Accounts</p>
                        <p className="mt-1 text-xl font-semibold">{activeDealerAccounts}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Conversion Rate</p>
                        <p className="mt-1 text-xl font-semibold">{conversionRate.toLocaleString('en-US')}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dealer Demo Link</CardTitle>
                    <CardDescription>Invite dealers to preview before starting trial.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{demoLink}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => copyText(demoLink, 'share', 'copy_demo_link')}>Copy Demo Link</Button>
                      <Button variant="outline" onClick={openDemo}>Open Demo</Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Demo Visits</p>
                        <p className="mt-1 text-xl font-semibold">{demoVisits}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Demo → Trial Conversion Rate</p>
                        <p className="mt-1 text-xl font-semibold">{demoConversionRate.toLocaleString('en-US')}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dealer Guided Tour</CardTitle>
                    <CardDescription>Invite dealers to watch the AutoDriveCX walkthrough before starting a trial.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input value={tourLink} readOnly />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => copyText(tourLink, 'share', 'copy_tour_link')}>Copy Tour Link</Button>
                      <Button variant="outline" onClick={openTour}>Open Tour</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Outreach Templates</CardTitle>
                    <CardDescription>Copy-ready templates with your referral attribution baked in. Use AI to generate variations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-md border p-4 space-y-3">
                      <p className="text-sm font-medium">AI Prompt Criteria</p>
                      <Textarea
                        value={aiCriteria}
                        onChange={(event) => setAiCriteria(event.target.value)}
                        rows={3}
                        placeholder="Optional: audience, offer, pain points, objections, campaign goal, or seasonal context..."
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="w-48">
                          <Select value={aiTone} onValueChange={(value) => setAiTone(value as 'professional' | 'friendly' | 'direct' | 'urgent')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select tone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="direct">Direct</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">AI keeps your dealer signup and demo links in every variation.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Email Invite Template</p>
                      <Textarea value={emailTemplate} onChange={(event) => setEmailTemplate(event.target.value)} rows={8} />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => copyText(emailTemplate, 'email_invite', 'copy_email')}>Copy Email</Button>
                        <Button variant="outline" onClick={sendEmailInvite}>
                          Open Email
                        </Button>
                        <Button variant="outline" onClick={() => void generateTemplate('email')} disabled={generatingChannel !== null}>
                          {generatingChannel === 'email' ? 'Generating…' : 'Generate Email Variant'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">LinkedIn Post Template</p>
                      <Textarea value={linkedInTemplate} onChange={(event) => setLinkedInTemplate(event.target.value)} rows={4} />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => copyText(linkedInTemplate, 'share', 'copy_linkedin_post')}>
                          Copy LinkedIn Post
                        </Button>
                        <Button variant="outline" onClick={() => void generateTemplate('linkedin')} disabled={generatingChannel !== null}>
                          {generatingChannel === 'linkedin' ? 'Generating…' : 'Generate LinkedIn Variant'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Text Message Template</p>
                      <Textarea value={textMessageTemplate} onChange={(event) => setTextMessageTemplate(event.target.value)} rows={3} />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => copyText(textMessageTemplate, 'share', 'copy_text_message')}>
                          Copy Text Message
                        </Button>
                        <Button variant="outline" onClick={() => void generateTemplate('text')} disabled={generatingChannel !== null}>
                          {generatingChannel === 'text' ? 'Generating…' : 'Generate Text Variant'}
                        </Button>
                      </div>
                    </div>

                    {templateError && <p className="text-sm text-red-500">{templateError}</p>}

                    <p className="text-xs text-muted-foreground">
                      Base referral link used in templates: {referralLink}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Attribution Summary</CardTitle>
                    <CardDescription>Invite Dealer → Demo Platform → Convert Dealer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingMetrics ? (
                      <p className="text-sm text-muted-foreground">Loading attribution metrics...</p>
                    ) : error ? (
                      <p className="text-sm text-red-500">{error}</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Dealer Clicks</p>
                          <p className="mt-1 text-xl font-semibold">{dealerClicks}</p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Dealer Trials</p>
                          <p className="mt-1 text-xl font-semibold">{dealerTrials}</p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Active Dealer Accounts</p>
                          <p className="mt-1 text-xl font-semibold">{activeDealerAccounts}</p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Conversion Rate</p>
                          <p className="mt-1 text-xl font-semibold">{conversionRate.toLocaleString('en-US')}%</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
