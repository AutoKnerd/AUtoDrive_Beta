'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';
import { generateOutreachTemplate } from '@/ai/flows/generate-outreach-template-flow';
import { buildConsultantOutreachLink } from '@/lib/consultant-share-links';
import { resolveConsultant } from '@/lib/consultant-referral';
import { Sparkles } from 'lucide-react';

type MarketingMetrics = {
  consultant_id: string;
  clicks: number;
  signups: number;
  conversions: number;
  conversion_rate: number;
  demo_visits: number;
  demo_conversions: number;
};

type MessageFormat =
  | 'email_cold_outreach'
  | 'email_follow_up'
  | 'email_post_meeting_recap'
  | 'linkedin_post'
  | 'linkedin_dm'
  | 'text_message'
  | 're_engagement_message'
  | 'appointment_request'
  | 'value_first_intro'
  | 'quick_check_in';

const FORMAT_OPTIONS: Array<{
  value: MessageFormat;
  label: string;
  channel: 'email' | 'linkedin' | 'text';
  tone: 'professional' | 'friendly' | 'direct' | 'urgent';
}> = [
  { value: 'email_cold_outreach', label: 'Email (Cold Outreach)', channel: 'email', tone: 'professional' },
  { value: 'email_follow_up', label: 'Email (Follow-Up)', channel: 'email', tone: 'friendly' },
  { value: 'email_post_meeting_recap', label: 'Email (Post-Meeting Recap)', channel: 'email', tone: 'professional' },
  { value: 'linkedin_post', label: 'LinkedIn Post', channel: 'linkedin', tone: 'professional' },
  { value: 'linkedin_dm', label: 'LinkedIn DM', channel: 'linkedin', tone: 'direct' },
  { value: 'text_message', label: 'Text Message', channel: 'text', tone: 'direct' },
  { value: 're_engagement_message', label: 'Re-Engagement Message', channel: 'text', tone: 'friendly' },
  { value: 'appointment_request', label: 'Appointment Request', channel: 'email', tone: 'direct' },
  { value: 'value_first_intro', label: 'Value-First Intro', channel: 'linkedin', tone: 'professional' },
  { value: 'quick_check_in', label: 'Quick Check-In', channel: 'text', tone: 'friendly' },
];

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ConsultantDealerOutreachPage() {
  const params = useParams<{ id: string }>();
  const consultantId = String(params.id || '').trim().toLowerCase();
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
  const [selectedFormat, setSelectedFormat] = useState<MessageFormat>('email_cold_outreach');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  const consultantCode = useMemo(() => {
    const resolvedFromRoute = resolveConsultant(consultantId);
    const resolvedFromMapped = resolveConsultant(mappedReferralCode || '');
    return resolvedFromMapped?.code || resolvedFromRoute?.code || consultantId;
  }, [consultantId, mappedReferralCode]);

  const dealerInviteLink = useMemo(() => buildConsultantOutreachLink('dealerReferral', consultantCode), [consultantCode]);
  const singleUserLink = useMemo(() => buildConsultantOutreachLink('singleUser', consultantCode), [consultantCode]);
  const guidedDemoLink = useMemo(() => buildConsultantOutreachLink('guidedDemo', consultantCode), [consultantCode]);
  const aboutLink = useMemo(() => buildConsultantOutreachLink('about', consultantCode), [consultantCode]);
  const toolsLink = useMemo(() => buildConsultantOutreachLink('tools', consultantCode), [consultantCode]);

  const selectedFormatConfig = useMemo(
    () => FORMAT_OPTIONS.find((option) => option.value === selectedFormat) || FORMAT_OPTIONS[0],
    [selectedFormat]
  );

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
          consultant_id: consultantCode.toLowerCase(),
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
      const response = await fetch(`/api/consultant-marketing-metrics?id=${encodeURIComponent(consultantCode.toLowerCase())}`);
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
    if (consultantCode && isAuthorized) {
      void loadMetrics();
      return;
    }

    if (!isChecking) {
      setIsLoadingMetrics(false);
    }
  }, [consultantCode, isAuthorized, isChecking]);

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

  async function openDemo() {
    await trackEvent('referral_click', 'open_demo');
    window.open(singleUserLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function openTour() {
    await trackEvent('share', 'open_tour');
    window.open(guidedDemoLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function openAboutPage() {
    await trackEvent('share', 'open_about');
    window.open(aboutLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function openToolsPage() {
    await trackEvent('share', 'open_tools');
    window.open(toolsLink, '_blank', 'noopener,noreferrer');
    await loadMetrics();
  }

  async function generateTemplate() {
    setTemplateError(null);
    setIsGeneratingMessage(true);
    try {
      const baseInstruction = `Write a ${selectedFormatConfig.label} message for a dealership decision maker introducing AutoDriveCX. The message should be clear, conversational, and focused on improving customer experience and consistency in dealership performance. Include a soft call-to-action using this link: ${aboutLink}.`;
      const formatRequirements =
        selectedFormatConfig.channel === 'email'
          ? 'Output requirements: include a Subject line, use short paragraphs, and include a clear CTA.'
          : selectedFormatConfig.value === 'linkedin_post'
            ? 'Output requirements: hook in the first line, then 2-4 short paragraphs with light formatting.'
            : selectedFormatConfig.value === 'linkedin_dm' || selectedFormatConfig.channel === 'text'
              ? 'Output requirements: keep it short, direct, conversational, and avoid fluff.'
              : 'Output requirements: keep it practical, concise, and action-focused.';
      const engagementRequirements =
        selectedFormatConfig.value === 'email_follow_up' || selectedFormatConfig.value === 're_engagement_message' || selectedFormatConfig.value === 'quick_check_in'
          ? 'Acknowledge prior contact and provide a light nudge, not a pushy close.'
          : '';
      const criteriaInstruction = aiCriteria.trim() ? `Additional criteria from consultant: ${aiCriteria.trim()}` : '';
      const promptCriteria = [baseInstruction, formatRequirements, engagementRequirements, criteriaInstruction]
        .filter(Boolean)
        .join('\n\n');

      const generated = await generateOutreachTemplate({
        channel: selectedFormatConfig.channel,
        format: selectedFormatConfig.label,
        tone: selectedFormatConfig.tone,
        consultantName: consultantDisplayName || toDisplayName(consultantId),
        consultantId: consultantCode.toLowerCase(),
        primaryLink: aboutLink,
        criteria: promptCriteria,
      });

      const content = generated.content.trim();
      if (!content) {
        throw new Error('AI returned empty content. Please try different criteria.');
      }

      setGeneratedMessage(content);

      await trackEvent('share', `ai_generate_${selectedFormatConfig.value}`);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'Unable to generate template.';
      setTemplateError(message);
    } finally {
      setIsGeneratingMessage(false);
    }
  }

  const consultantDisplayName = useMemo(() => toDisplayName(consultantId), [consultantId]);
  const dealerClicks = metrics?.clicks ?? 0;
  const dealerTrials = metrics?.signups ?? 0;
  const activeDealerAccounts = metrics?.conversions ?? 0;
  const conversionRate = metrics?.conversion_rate ?? 0;

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
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-cyan-400" />
                      Your Share Link
                    </CardTitle>
                    <CardDescription>Send this link to introduce AutoDriveCX to dealerships</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{aboutLink}</p>
                    <p className="text-xs text-muted-foreground">
                      This page explains what AutoDriveCX does and how it improves dealership performance.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => copyText(aboutLink, 'share', 'copy_about_link_primary')}>Copy Link</Button>
                      <Button variant="outline" onClick={openAboutPage}>Open</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Advanced Links</CardTitle>
                    <CardDescription>Optional alternatives when you need to skip the guided flow.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <details className="group rounded-md border">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
                        <span className="group-open:hidden">Show Advanced Options</span>
                        <span className="hidden group-open:inline">Hide Advanced Options</span>
                      </summary>
                      <div className="space-y-5 border-t px-4 py-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Guided Demo Experience</p>
                          <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{guidedDemoLink}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => copyText(guidedDemoLink, 'share', 'copy_guided_demo_link')}>Copy Link</Button>
                            <Button variant="outline" onClick={openTour}>Open</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Direct Signup (skip demo)</p>
                          <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{singleUserLink}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => copyText(singleUserLink, 'share', 'copy_single_user_link')}>Copy Link</Button>
                            <Button variant="outline" onClick={openDemo}>Open</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Tools Access</p>
                          <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{toolsLink}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => copyText(toolsLink, 'share', 'copy_tools_link')}>Copy Link</Button>
                            <Button variant="outline" onClick={openToolsPage}>Open</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">About Page</p>
                          <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{aboutLink}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => copyText(aboutLink, 'share', 'copy_about_link')}>Copy Link</Button>
                            <Button variant="outline" onClick={openAboutPage}>Open</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Dealer Referral Link</p>
                          <p className="rounded-md border bg-muted/40 p-3 text-sm break-all">{dealerInviteLink}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => copyText(dealerInviteLink, 'referral_click', 'copy_invite_link')}>Copy Link</Button>
                            <Button variant="outline" onClick={openDealerSignup}>Open</Button>
                          </div>
                        </div>
                      </div>
                    </details>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Outreach Templates</CardTitle>
                    <CardDescription>Format-driven AI generator with your consultant link inserted automatically.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-md border p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">AI Prompt Criteria</p>
                          <Textarea
                            value={aiCriteria}
                            onChange={(event) => setAiCriteria(event.target.value)}
                            rows={4}
                            placeholder="Optional: audience, offer, pain points, objections, campaign goal, or seasonal context..."
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Message Format</p>
                          <Select value={selectedFormat} onValueChange={(value) => setSelectedFormat(value as MessageFormat)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select message format" />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMAT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Generated Message</p>
                      <Textarea
                        value={generatedMessage}
                        onChange={(event) => setGeneratedMessage(event.target.value)}
                        rows={10}
                        placeholder="Select a format and click Generate."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void generateTemplate()} disabled={isGeneratingMessage}>
                          {isGeneratingMessage ? 'Generating…' : 'Generate'}
                        </Button>
                        <Button variant="outline" onClick={() => void generateTemplate()} disabled={isGeneratingMessage}>
                          Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => copyText(generatedMessage, 'share', 'copy_generated_message')}
                          disabled={!generatedMessage.trim()}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>

                    {templateError && <p className="text-sm text-red-500">{templateError}</p>}

                    <p className="text-xs text-muted-foreground">
                      Base about link used in templates: {aboutLink}
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
