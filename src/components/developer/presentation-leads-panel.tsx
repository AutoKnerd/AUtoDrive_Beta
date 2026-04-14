'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LiveSessionPresentationLeadRecord } from '@/lib/live-session';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

export function PresentationLeadsPanel() {
  const firebaseAuth = useFirebaseAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<LiveSessionPresentationLeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const loadPresentationLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to view presentation leads.');
      }

      const token = await fbUser.getIdToken(true);
      const url = new URL('/api/live-session/presentation-leads', window.location.origin);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load presentation leads.');
      }

      setRecords(Array.isArray(payload?.leads) ? payload.leads : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load presentation leads.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [firebaseAuth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        setRecords([]);
        setLoading(false);
        setError('Authentication required to view presentation leads.');
        return;
      }

      void loadPresentationLeads();
    });

    return () => unsubscribe();
  }, [firebaseAuth, loadPresentationLeads]);

  const capturedCount = useMemo(
    () => records.filter((group) => Boolean(group.email)).length,
    [records]
  );
  const skippedCount = useMemo(
    () => records.filter((group) => group.status === 'skipped' && !group.email).length,
    [records]
  );
  const ctaCount = useMemo(
    () => records.filter((group) => group.finalCtaClicked).length,
    [records]
  );

  const filteredRecords = useMemo(() => {
    const start = appliedStartDate ? new Date(`${appliedStartDate}T00:00:00`) : null;
    const end = appliedEndDate ? new Date(`${appliedEndDate}T23:59:59.999`) : null;

    return records.filter((record) => {
      const stamp = Date.parse(record.latestAt || record.updatedAt || record.createdAt || '');
      if (!Number.isFinite(stamp)) return true;
      if (start && stamp < start.getTime()) return false;
      if (end && stamp > end.getTime()) return false;
      return true;
    });
  }, [appliedEndDate, appliedStartDate, records]);

  const displayStartDate = appliedStartDate || 'Start';
  const displayEndDate = appliedEndDate || 'End';

  const applyDateRange = useCallback(() => {
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  }, [endDateInput, startDateInput]);

  const clearDateRange = useCallback(() => {
    setStartDateInput('');
    setEndDateInput('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  }, []);

  const copyEmails = useCallback(async () => {
    const emails = filteredRecords
      .map((group) => group.email?.trim())
      .filter((email): email is string => Boolean(email));

    if (emails.length === 0) {
      toast({
        title: 'Nothing to copy',
        description: 'No presentation lead emails are available yet.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(emails.join('\n'));
      toast({
        title: 'Copied',
        description: 'Presentation lead emails copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy presentation lead emails.',
        variant: 'destructive',
      });
    }
  }, [filteredRecords, toast]);

  const handleExportPdf = useCallback(async () => {
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to export presentation leads.');
      }

      const token = await fbUser.getIdToken(true);
      const url = new URL('/api/live-session/presentation-leads/export-pdf', window.location.origin);
      if (appliedStartDate) url.searchParams.set('startDate', appliedStartDate);
      if (appliedEndDate) url.searchParams.set('endDate', appliedEndDate);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Unable to export presentation leads PDF.');
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `presentation-leads${appliedStartDate || appliedEndDate ? `-${appliedStartDate || 'start'}-${appliedEndDate || 'end'}` : ''}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (nextError) {
      toast({
        title: 'PDF export failed',
        description: nextError instanceof Error ? nextError.message : 'Unable to export presentation leads PDF.',
        variant: 'destructive',
      });
    }
  }, [appliedEndDate, appliedStartDate, firebaseAuth, toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Presentation Leads</CardTitle>
            <CardDescription>Captured contact info and final CTA activity from the live presentation snapshot.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void copyEmails()} disabled={records.length === 0}>
              Copy Emails
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExportPdf()} disabled={filteredRecords.length === 0}>
              Export PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRefreshing(true);
                void loadPresentationLeads();
              }}
              disabled={isRefreshing}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Captured</p>
            <p className="mt-2 text-2xl font-semibold">{capturedCount}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Skipped</p>
            <p className="mt-2 text-2xl font-semibold">{skippedCount}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">CTA Clicks</p>
            <p className="mt-2 text-2xl font-semibold">{ctaCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Snapshot</CardTitle>
          <CardDescription>One row per presentation session, with contact info and the latest captured step.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 rounded-lg border bg-muted/20 p-3 lg:grid-cols-[1fr_1fr_auto_auto]">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Start Date</p>
              <Input
                type="date"
                value={startDateInput}
                onChange={(event) => setStartDateInput(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">End Date</p>
              <Input
                type="date"
                value={endDateInput}
                onChange={(event) => setEndDateInput(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={applyDateRange} className="w-full">
                Filter {displayStartDate} → {displayEndDate}
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={clearDateRange} className="w-full">
                Clear
              </Button>
            </div>
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading presentation leads...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No presentation leads captured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Dealership</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latest Step</TableHead>
                  <TableHead>Latest Response</TableHead>
                  <TableHead>Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{group.name || group.email || 'No contact captured'}</p>
                        {group.email ? (
                          <p className="text-xs text-muted-foreground">{group.email}</p>
                        ) : null}
                        {group.sessionToken ? (
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{group.sessionToken}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {group.dealership || '-'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full border border-[#8DC63F]/30 bg-[#8DC63F]/10 px-2 py-1 text-xs font-medium text-[#8DC63F]">
                        {group.email ? 'Captured' : group.status === 'skipped' ? 'Skipped' : 'Pending'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {group.slideNumber ? `Slide ${group.slideNumber}` : group.currentSlide || '-'}
                      {group.lastResponseKey ? (
                        <span className="block text-xs">{group.lastResponseKey}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                      {group.finalCtaClicked ? 'See This In Your Store' : group.lastResponseKey || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(group.latestAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
