'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';

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

const LEAD_STATUSES = ['Lead', 'Contacted', 'Demo Scheduled', 'Trial Started', 'Customer', 'Lost'] as const;

export default function DealerRegistrationsPage() {
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

  const [dealerName, setDealerName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [notes, setNotes] = useState('');

  const [rows, setRows] = useState<DealerRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editStatus, setEditStatus] = useState<(typeof LEAD_STATUSES)[number]>('Lead');
  const [editNotes, setEditNotes] = useState('');

  const consultantLabel = useMemo(() => {
    return consultantId
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [consultantId]);

  async function loadRegistrations() {
    if (!consultantId) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dealer-registrations?consultant=${encodeURIComponent(consultantId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load dealer registrations.');
      }

      setRows(payload.registrations || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dealer registrations.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  useEffect(() => {
    if (isAuthorized) {
      void loadRegistrations();
      return;
    }

    if (!isChecking) {
      setRows([]);
      setIsLoading(false);
    }
  }, [consultantId, isAuthorized, isChecking]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthorized) {
      setError('Access denied.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

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

      await loadRegistrations();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to submit dealer registration.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(row: DealerRegistration) {
    setEditingId(row.id);
    setEditContactName(row.contact_name);
    setEditContactEmail(row.contact_email);
    setEditContactPhone(row.contact_phone);
    setEditStatus((LEAD_STATUSES.find((status) => status === row.status) || 'Lead'));
    setEditNotes(row.notes);
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditContactName('');
    setEditContactEmail('');
    setEditContactPhone('');
    setEditStatus('Lead');
    setEditNotes('');
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    if (!isAuthorized) {
      setError('Access denied.');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/dealer-registrations/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultant: consultantId,
          contact_name: editContactName,
          contact_email: editContactEmail,
          contact_phone: editContactPhone,
          status: editStatus,
          notes: editNotes,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update dealer registration.');
      }

      cancelEditing();
      await loadRegistrations();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Failed to update dealer registration.';
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="dealer_registrations" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">Dealer Registrations</CardTitle>
                <CardDescription className="text-slate-300">
                  Consultant: {consultantLabel || 'Unknown'}
                </CardDescription>
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
              <Card>
                <CardHeader>
                  <CardTitle>New Dealer Registration</CardTitle>
                  <CardDescription>Submit a new dealer lead.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
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
                    <Label htmlFor="consultant">Consultant</Label>
                    <Input id="consultant" value={consultantId} disabled readOnly />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </div>
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={isSubmitting || !isAuthorized || isChecking}>
                        {isSubmitting ? 'Saving...' : 'Submit Registration'}
                      </Button>
                    </div>
                  </form>
                  {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
                </CardContent>
              </Card>
            )}

            {isAuthorized && (
              <Card>
                <CardHeader>
                  <CardTitle>My Dealer Registrations</CardTitle>
                  <CardDescription>All dealer leads submitted by this consultant.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isChecking ? (
                    <p className="text-sm text-muted-foreground">Validating consultant access...</p>
                  ) : isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading registrations...</p>
                  ) : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No dealer registrations yet.</p>
                  ) : (
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dealer Name</TableHead>
                        <TableHead>Contact Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.dealer_name}</TableCell>
                          <TableCell>{row.contact_name}</TableCell>
                          <TableCell>{row.city || '-'}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</TableCell>
                          <TableCell>
                            <Button type="button" variant="outline" size="sm" onClick={() => startEditing(row)}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  )}

                  {isAuthorized && editingId && (
                    <form className="mt-6 grid gap-4 rounded-lg border p-4 md:grid-cols-2" onSubmit={handleUpdate}>
                    <div className="space-y-2">
                      <Label htmlFor="edit-contact-name">Contact Name</Label>
                      <Input
                        id="edit-contact-name"
                        value={editContactName}
                        onChange={(event) => setEditContactName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-contact-email">Contact Email</Label>
                      <Input
                        id="edit-contact-email"
                        type="email"
                        value={editContactEmail}
                        onChange={(event) => setEditContactEmail(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-contact-phone">Contact Phone</Label>
                      <Input
                        id="edit-contact-phone"
                        value={editContactPhone}
                        onChange={(event) => setEditContactPhone(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={(value) => setEditStatus(value as (typeof LEAD_STATUSES)[number])}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-notes">Notes</Label>
                      <Textarea id="edit-notes" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                    </div>
                      <div className="flex gap-2 md:col-span-2">
                        <Button type="submit" disabled={isUpdating || !isAuthorized || isChecking}>
                          {isUpdating ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelEditing} disabled={isUpdating}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
