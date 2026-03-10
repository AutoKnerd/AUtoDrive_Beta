'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { Spinner } from '@/components/ui/spinner';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';

type ConsultantSalesResponse = {
  consultant: string;
  subscriber_count: number;
  monthly_revenue: number;
};

type ConsultantCustomerRow = {
  customer_email: string;
  plan: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  monthly_amount: number;
  joined_date: string;
  next_billing_date: string;
  subscription_id: string;
};

type ConsultantCustomersResponse = {
  consultant: string;
  customers: ConsultantCustomerRow[];
};

const COMMISSION_RATE = 0.25;

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ConsultantSalesReportPage() {
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

  const [sales, setSales] = useState<ConsultantSalesResponse | null>(null);
  const [customersData, setCustomersData] = useState<ConsultantCustomersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  useEffect(() => {
    if (!isAuthorized) {
      if (!isChecking) {
        setIsLoading(false);
      }
      return;
    }

    const controller = new AbortController();

    async function loadReport() {
      setIsLoading(true);
      setError(null);

      try {
        const [salesRes, customersRes] = await Promise.all([
          fetch(`/api/consultant-sales?id=${encodeURIComponent(consultantId)}`, { signal: controller.signal }),
          fetch(`/api/consultant-customers?id=${encodeURIComponent(consultantId)}`, { signal: controller.signal }),
        ]);

        const [salesPayload, customersPayload] = await Promise.all([
          salesRes.json(),
          customersRes.json(),
        ]);

        if (!salesRes.ok) {
          throw new Error(salesPayload.error || 'Unable to load consultant sales.');
        }
        if (!customersRes.ok) {
          throw new Error(customersPayload.error || 'Unable to load consultant customers.');
        }

        setSales(salesPayload as ConsultantSalesResponse);
        setCustomersData(customersPayload as ConsultantCustomersResponse);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load sales report.';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => controller.abort();
  }, [consultantId, isAuthorized, isChecking]);

  const consultantDisplayName = useMemo(() => {
    return toDisplayName(consultantId || sales?.consultant || customersData?.consultant || '');
  }, [consultantId, sales?.consultant, customersData?.consultant]);

  const timelineRows = useMemo(() => {
    const rows = [...(customersData?.customers || [])]
      .sort((a, b) => (Date.parse(b.joined_date) || 0) - (Date.parse(a.joined_date) || 0))
      .map((row) => ({
        ...row,
        commission: Math.round(row.monthly_amount * COMMISSION_RATE * 100) / 100,
      }));

    return rows;
  }, [customersData?.customers]);

  const commissionSummary = useMemo(() => {
    const totalSubscribers = timelineRows.length;
    const revenueEligibleStatuses = new Set(['active', 'trialing', 'past_due', 'incomplete']);
    const monthlyRevenue = timelineRows
      .filter((row) => revenueEligibleStatuses.has(row.status))
      .reduce((sum, row) => sum + row.monthly_amount, 0);
    const lifetimeRevenue = timelineRows.reduce((sum, row) => sum + row.monthly_amount, 0);
    const lifetimeCommission = lifetimeRevenue * COMMISSION_RATE;
    const pendingCommission = timelineRows
      .filter((row) => row.status === 'trialing')
      .reduce((sum, row) => sum + row.monthly_amount * COMMISSION_RATE, 0);

    return {
      totalSubscribers,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      lifetimeRevenue: Math.round(lifetimeRevenue * 100) / 100,
      lifetimeCommission: Math.round(lifetimeCommission * 100) / 100,
      pendingCommission: Math.round(pendingCommission * 100) / 100,
    };
  }, [timelineRows]);

  const monthlyLedger = useMemo(() => {
    const grouped = new Map<string, { monthDate: Date; subscriptions: number; revenue: number; commission: number }>();

    for (const row of timelineRows) {
      const joined = new Date(row.joined_date);
      if (Number.isNaN(joined.getTime())) continue;

      const monthStart = new Date(joined.getFullYear(), joined.getMonth(), 1);
      const key = monthStart.toISOString();
      const existing = grouped.get(key) || { monthDate: monthStart, subscriptions: 0, revenue: 0, commission: 0 };
      existing.subscriptions += 1;
      existing.revenue += row.monthly_amount;
      existing.commission += row.monthly_amount * COMMISSION_RATE;
      grouped.set(key, existing);
    }

    return [...grouped.values()]
      .sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime())
      .map((entry) => ({
        month: entry.monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        subscriptions: entry.subscriptions,
        revenue: Math.round(entry.revenue * 100) / 100,
        commission: Math.round(entry.commission * 100) / 100,
      }));
  }, [timelineRows]);

  const performance = useMemo(() => {
    const trialsStarted = timelineRows.filter((row) => row.status === 'trialing').length;
    const activeSubscribers = timelineRows.filter((row) => row.status === 'active').length;
    const conversionRate = trialsStarted > 0 ? (activeSubscribers / trialsStarted) * 100 : 0;
    const averageSubscriptionValue = activeSubscribers > 0 ? commissionSummary.monthlyRevenue / activeSubscribers : 0;

    return {
      trialsStarted,
      activeSubscribers,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageSubscriptionValue: Math.round(averageSubscriptionValue * 100) / 100,
    };
  }, [timelineRows, commissionSummary.monthlyRevenue]);

  if (isChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="sales_report" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">Consultant Sales Intelligence</CardTitle>
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

            {!isAuthorized && (
              <Card className="border-red-400/40 bg-red-500/10">
                <CardContent className="p-6">
                  <p className="text-sm text-red-200">
                    Access denied. Logged-in consultant ({mappedReferralCode || 'unknown'}) does not match route consultant ({normalizedRouteConsultantId || 'unknown'}).
                  </p>
                  {accessError && <p className="mt-2 text-xs text-red-100">{accessError}</p>}
                </CardContent>
              </Card>
            )}

            {isAuthorized && isLoading && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Loading sales intelligence...</p>
                </CardContent>
              </Card>
            )}

            {isAuthorized && error && (
              <Card className="border-red-400/40 bg-red-500/10">
                <CardContent className="p-6">
                  <p className="text-sm text-red-200">{error}</p>
                </CardContent>
              </Card>
            )}

            {isAuthorized && !isLoading && !error && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Card><CardHeader className="pb-2"><CardDescription>Total Subscribers</CardDescription><CardTitle className="text-3xl">{commissionSummary.totalSubscribers}</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Monthly Revenue</CardDescription><CardTitle className="text-3xl">${commissionSummary.monthlyRevenue.toLocaleString('en-US')}</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Lifetime Revenue</CardDescription><CardTitle className="text-3xl">${commissionSummary.lifetimeRevenue.toLocaleString('en-US')}</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Lifetime Commission</CardDescription><CardTitle className="text-3xl">${commissionSummary.lifetimeCommission.toLocaleString('en-US')}</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Pending Commission</CardDescription><CardTitle className="text-3xl">${commissionSummary.pendingCommission.toLocaleString('en-US')}</CardTitle></CardHeader></Card>
                </section>

                <Card>
                  <CardHeader>
                    <CardTitle>Sales Timeline</CardTitle>
                    <CardDescription>All attributed subscriptions, newest first.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer Email</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Subscription Status</TableHead>
                          <TableHead>Monthly Amount</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Stripe Subscription ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timelineRows.map((row, index) => (
                          <TableRow key={`${row.subscription_id}-${index}`}>
                            <TableCell>{row.joined_date ? new Date(row.joined_date).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>{row.customer_email || 'Unknown'}</TableCell>
                            <TableCell>{row.plan}</TableCell>
                            <TableCell className="capitalize">{row.status.replace('_', ' ')}</TableCell>
                            <TableCell>${row.monthly_amount.toLocaleString('en-US')}</TableCell>
                            <TableCell>${row.commission.toLocaleString('en-US')}</TableCell>
                            <TableCell className="font-mono text-xs">{row.subscription_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Customer Status</CardTitle>
                    <CardDescription>Current status and billing timeline by customer.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer Email</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Monthly Value</TableHead>
                          <TableHead>Next Billing Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timelineRows.map((row, index) => (
                          <TableRow key={`status-${row.subscription_id}-${index}`}>
                            <TableCell>{row.customer_email || 'Unknown'}</TableCell>
                            <TableCell>{row.plan}</TableCell>
                            <TableCell className="capitalize">{row.status.replace('_', ' ')}</TableCell>
                            <TableCell>${row.monthly_amount.toLocaleString('en-US')}</TableCell>
                            <TableCell>{row.next_billing_date ? new Date(row.next_billing_date).toLocaleDateString() : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Commission Ledger</CardTitle>
                    <CardDescription>Grouped commission ledger by month.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Subscriptions</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Commission Rate</TableHead>
                          <TableHead>Commission Earned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyLedger.map((row) => (
                          <TableRow key={row.month}>
                            <TableCell>{row.month}</TableCell>
                            <TableCell>{row.subscriptions}</TableCell>
                            <TableCell>${row.revenue.toLocaleString('en-US')}</TableCell>
                            <TableCell>25%</TableCell>
                            <TableCell>${row.commission.toLocaleString('en-US')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card><CardHeader className="pb-2"><CardDescription>Trials Started</CardDescription><CardTitle className="text-3xl">{performance.trialsStarted}</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Active Subscribers</CardDescription><CardTitle className="text-3xl">{performance.activeSubscribers}</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Trial → Paid Conversion Rate</CardDescription><CardTitle className="text-3xl">{performance.conversionRate.toLocaleString('en-US')}%</CardTitle></CardHeader></Card>
                  <Card><CardHeader className="pb-2"><CardDescription>Average Subscription Value</CardDescription><CardTitle className="text-3xl">${performance.averageSubscriptionValue.toLocaleString('en-US')}</CardTitle></CardHeader></Card>
                </section>

              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
