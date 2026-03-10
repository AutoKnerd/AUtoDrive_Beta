'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';

type DealerPipelineStage = 'lead' | 'contacted' | 'demo' | 'trial' | 'closed_won' | 'closed_lost';

type DealerPipelineRecord = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant_id: string;
  stage: DealerPipelineStage;
  notes: string;
  created_at: string;
  updated_at: string;
};

type DealerRegistration = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const STAGE_OPTIONS: DealerPipelineStage[] = [
  'lead',
  'contacted',
  'demo',
  'trial',
  'closed_won',
  'closed_lost',
];

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStageLabel(stage: DealerPipelineStage): string {
  if (stage === 'closed_won') return 'Closed Won';
  if (stage === 'closed_lost') return 'Closed Lost';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export default function ConsultantDealerPipelinePage() {
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

  const [rows, setRows] = useState<DealerPipelineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationRows, setRegistrationRows] = useState<DealerRegistration[]>([]);
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [dealerName, setDealerName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  async function loadPipeline() {
    if (!consultantId) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dealer-pipeline?consultant=${encodeURIComponent(consultantId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load dealer pipeline.');
      }

      setRows(payload.pipeline || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dealer pipeline.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRegistrations() {
    if (!consultantId) {
      setRegistrationRows([]);
      setIsLoadingRegistrations(false);
      return;
    }

    setIsLoadingRegistrations(true);
    setRegistrationError(null);
    try {
      const response = await fetch(`/api/dealer-registrations?consultant=${encodeURIComponent(consultantId)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load dealer registrations.');
      }
      setRegistrationRows(payload.registrations || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dealer registrations.';
      setRegistrationError(message);
    } finally {
      setIsLoadingRegistrations(false);
    }
  }

  useEffect(() => {
    if (isAuthorized) {
      void loadPipeline();
      void loadRegistrations();
      return;
    }

    if (!isChecking) {
      setRows([]);
      setIsLoading(false);
      setRegistrationRows([]);
      setIsLoadingRegistrations(false);
    }
  }, [consultantId, isAuthorized, isChecking]);

  async function handleRegistrationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthorized) {
      setRegistrationError('Access denied.');
      return;
    }

    setIsSubmittingRegistration(true);
    setRegistrationError(null);

    try {
      const response = await fetch('/api/dealer-registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealer_name: dealerName,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          city,
          state: stateValue,
          consultant: consultantId,
          notes,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit dealer registration.');
      }

      setDealerName('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setCity('');
      setStateValue('');
      setNotes('');

      await Promise.all([loadRegistrations(), loadPipeline()]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to submit dealer registration.';
      setRegistrationError(message);
    } finally {
      setIsSubmittingRegistration(false);
    }
  }

  async function handleStageChange(id: string, stage: DealerPipelineStage) {
    if (!isAuthorized) {
      setError('Access denied.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/dealer-pipeline/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultant_id: consultantId,
          stage,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update stage.');
      }

      setRows((previous) =>
        previous.map((row) => (row.id === id ? { ...row, stage: payload.record.stage, updated_at: payload.record.updated_at } : row))
      );
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Failed to update stage.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const metrics = useMemo(() => {
    const leads = rows.filter((row) => row.stage === 'lead').length;
    const demos = rows.filter((row) => row.stage === 'demo').length;
    const trials = rows.filter((row) => row.stage === 'trial').length;
    const closedWon = rows.filter((row) => row.stage === 'closed_won').length;
    const conversionRate = rows.length > 0 ? (closedWon / rows.length) * 100 : 0;

    return {
      leads,
      demos,
      trials,
      closedWon,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }, [rows]);

  const consultantLabel = useMemo(() => toDisplayName(consultantId), [consultantId]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="dealer_pipeline" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">Dealer Pipeline</CardTitle>
                <CardDescription className="text-slate-300">Consultant: {consultantLabel || 'Unknown'}</CardDescription>
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
                    <CardTitle>Dealer Registrations</CardTitle>
                    <CardDescription>Lead intake is now part of pipeline management.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <details className="group rounded-md border bg-muted/10 p-4">
                      <summary className="cursor-pointer list-none text-sm font-medium">
                        <span className="inline-flex items-center gap-2">
                          New Dealer Registration + My Registrations
                          <span className="text-xs text-muted-foreground group-open:hidden">(Click to expand)</span>
                          <span className="text-xs text-muted-foreground hidden group-open:inline">(Click to collapse)</span>
                        </span>
                      </summary>
                      <div className="mt-4 space-y-6">
                        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleRegistrationSubmit}>
                          <div className="space-y-2">
                            <Label htmlFor="dealer-name">Dealer Name</Label>
                            <Input id="dealer-name" value={dealerName} onChange={(event) => setDealerName(event.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contact-name">Contact Name</Label>
                            <Input id="contact-name" value={contactName} onChange={(event) => setContactName(event.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contact-email">Contact Email</Label>
                            <Input id="contact-email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contact-phone">Contact Phone</Label>
                            <Input id="contact-phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" value={stateValue} onChange={(event) => setStateValue(event.target.value)} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <Button type="submit" disabled={isSubmittingRegistration}>
                              {isSubmittingRegistration ? 'Saving...' : 'Submit Registration'}
                            </Button>
                          </div>
                        </form>

                        {registrationError && <p className="text-sm text-red-500">{registrationError}</p>}

                        <div className="space-y-2">
                          <p className="text-sm font-medium">My Dealer Registrations</p>
                          {isLoadingRegistrations ? (
                            <p className="text-sm text-muted-foreground">Loading registrations...</p>
                          ) : registrationRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No registrations yet.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Dealer Name</TableHead>
                                  <TableHead>Contact</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Created</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {registrationRows.slice(0, 10).map((row) => (
                                  <TableRow key={row.id}>
                                    <TableCell>{row.dealer_name}</TableCell>
                                    <TableCell>{row.contact_name}</TableCell>
                                    <TableCell>{row.status}</TableCell>
                                    <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                    </details>
                  </CardContent>
                </Card>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Leads</CardDescription>
                      <CardTitle className="text-3xl">{metrics.leads}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Demos</CardDescription>
                      <CardTitle className="text-3xl">{metrics.demos}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Trials</CardDescription>
                      <CardTitle className="text-3xl">{metrics.trials}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Closed Won</CardDescription>
                      <CardTitle className="text-3xl">{metrics.closedWon}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Conversion Rate</CardDescription>
                      <CardTitle className="text-3xl">{metrics.conversionRate.toLocaleString('en-US')}%</CardTitle>
                    </CardHeader>
                  </Card>
                </section>

                <Card>
                  <CardHeader>
                    <CardTitle>Pipeline</CardTitle>
                    <CardDescription>Track leads from intake through close.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading pipeline...</p>
                    ) : rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No dealer pipeline records yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dealer</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.dealer_name}</TableCell>
                              <TableCell>{row.contact_name}</TableCell>
                              <TableCell>{formatStageLabel(row.stage)}</TableCell>
                              <TableCell>{row.city || '-'}</TableCell>
                              <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={row.stage}
                                    onValueChange={(value) => handleStageChange(row.id, value as DealerPipelineStage)}
                                  >
                                    <SelectTrigger className="w-[160px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STAGE_OPTIONS.map((stage) => (
                                        <SelectItem key={stage} value={stage}>
                                          {formatStageLabel(stage)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isSaving}
                                    onClick={() => void loadPipeline()}
                                  >
                                    Refresh
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
