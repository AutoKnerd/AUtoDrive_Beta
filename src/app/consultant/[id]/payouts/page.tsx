'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';

type PayoutRow = {
  month: string;
  revenue: number;
  commission: number;
  status: string;
};

type PayoutResponse = {
  consultant_id: string;
  rows: PayoutRow[];
  totals: {
    total_earned: number;
    total_paid: number;
    pending_payout: number;
  };
};

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ConsultantPayoutsPage() {
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

  const [data, setData] = useState<PayoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPayouts() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/consultant-payouts?id=${encodeURIComponent(consultantId)}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load payouts.');
        }
        setData(payload as PayoutResponse);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load payouts.';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    if (consultantId && isAuthorized) {
      void loadPayouts();
    } else if (!isChecking) {
      setIsLoading(false);
    }

    return () => controller.abort();
  }, [consultantId, isAuthorized, isChecking]);

  const consultantDisplayName = useMemo(() => {
    return toDisplayName(data?.consultant_id || consultantId);
  }, [data?.consultant_id, consultantId]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="payouts" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">Consultant Payouts</CardTitle>
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
                <section className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Earned</CardDescription>
                      <CardTitle className="text-3xl">${(data?.totals.total_earned || 0).toLocaleString('en-US')}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Paid</CardDescription>
                      <CardTitle className="text-3xl">${(data?.totals.total_paid || 0).toLocaleString('en-US')}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Pending Payout</CardDescription>
                      <CardTitle className="text-3xl">${(data?.totals.pending_payout || 0).toLocaleString('en-US')}</CardTitle>
                    </CardHeader>
                  </Card>
                </section>

                <Card>
                  <CardHeader>
                    <CardTitle>Commission Ledger</CardTitle>
                    <CardDescription>Monthly consultant commission records.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading payouts...</p>
                    ) : error ? (
                      <p className="text-sm text-red-500">{error}</p>
                    ) : !data || data.rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payout records found.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Revenue</TableHead>
                            <TableHead>Commission</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.rows.map((row) => (
                            <TableRow key={`${row.month}-${row.status}`}>
                              <TableCell>{row.month}</TableCell>
                              <TableCell>${row.revenue.toLocaleString('en-US')}</TableCell>
                              <TableCell>${row.commission.toLocaleString('en-US')}</TableCell>
                              <TableCell className="capitalize">{row.status.replace('_', ' ')}</TableCell>
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
