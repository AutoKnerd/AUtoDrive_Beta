'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';

type Customer = {
  name: string;
  email: string;
};

type ConsultantSalesResponse = {
  consultant: string;
  subscriber_count: number;
  monthly_revenue: number;
  consultant_commission: number;
  lifetime_revenue: number;
  average_subscription_value: number;
  customers: Customer[];
  recent_customers: Array<{
    customer_email: string;
    amount: number;
    commission: number;
    created_at: string;
  }>;
  payout_summary: {
    period_label: string;
    period_start: string;
    period_end: string;
    subscriptions_count: number;
    gross_revenue: number;
    commission_due: number;
    generated_at: string;
  };
};

type ConsultantDirectoryRow = {
  name: string;
  referral_code?: string;
  referralCode?: string;
};

function toDisplayName(consultantId: string) {
  return consultantId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ConsultantDashboardPage() {
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
  const [data, setData] = useState<ConsultantSalesResponse | null>(null);
  const [consultantDirectoryName, setConsultantDirectoryName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadConsultantName() {
      try {
        const response = await fetch('/api/admin/consultants', { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json() as { consultants?: ConsultantDirectoryRow[] };
        const consultants = payload?.consultants || [];
        const match = consultants.find((row) => {
          const code = String(row.referral_code || row.referralCode || '').trim().toLowerCase();
          return code === consultantId;
        });
        setConsultantDirectoryName(match?.name || '');
      } catch {
        if (controller.signal.aborted) return;
      }
    }

    if (consultantId) {
      void loadConsultantName();
    } else {
      setConsultantDirectoryName('');
    }

    return () => controller.abort();
  }, [consultantId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/consultant-sales?id=${encodeURIComponent(consultantId)}`, {
          signal: controller.signal,
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load consultant dashboard.');
        }

        setData(payload as ConsultantSalesResponse);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : 'Unable to load consultant dashboard.';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    if (consultantId && isAuthorized) {
      loadDashboard();
    } else if (!isChecking) {
      setIsLoading(false);
    }

    return () => controller.abort();
  }, [consultantId, isAuthorized, isChecking]);

  const consultantDisplayName = useMemo(() => {
    if (consultantDirectoryName) return consultantDirectoryName;
    return data?.consultant ? toDisplayName(data.consultant) : toDisplayName(consultantId);
  }, [consultantDirectoryName, data?.consultant, consultantId]);
  const calculatedMetrics = useMemo(() => {
    const subscriptionPrice = 50;
    const commissionRate = 0.25;
    const subscribers = data?.subscriber_count ?? 0;

    const lifetimeRevenue = subscribers * subscriptionPrice;
    const consultantCommission = lifetimeRevenue * commissionRate;
    const avgSubscriptionValue = subscribers > 0 ? lifetimeRevenue / subscribers : 0;

    return {
      lifetimeRevenue,
      consultantCommission,
      avgSubscriptionValue,
    };
  }, [data?.subscriber_count]);
  const recentCustomerRows = useMemo(() => {
    if (!data) {
      return [];
    }

    if (data.recent_customers.length > 0) {
      return data.recent_customers.map((row) => ({
        customer_email: row.customer_email,
        amount: row.amount,
        commission: row.commission,
        created_at: row.created_at,
        hasRevenueData: true,
      }));
    }

    return data.customers.map((customer) => ({
      customer_email: customer.email,
      amount: 0,
      commission: 0,
      created_at: '',
      hasRevenueData: false,
    }));
  }, [data]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="dashboard" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">AutoKnerd Consultant Dashboard</CardTitle>
                <CardDescription className="text-slate-300">
                  Consultant: {consultantDisplayName || 'Unknown'}
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

            {isChecking && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Validating consultant access...</p>
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

            {isAuthorized && isLoading && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Loading dashboard...</p>
                </CardContent>
              </Card>
            )}

            {isAuthorized && error && (
              <Card className="border-red-400/50 bg-red-500/10">
                <CardContent className="p-6">
                  <p className="text-sm text-red-200">Failed to load dashboard: {error}</p>
                </CardContent>
              </Card>
            )}

            {isAuthorized && !isLoading && !error && data && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Subscribers</CardDescription>
                      <CardTitle className="text-3xl">{data.subscriber_count}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Monthly Revenue</CardDescription>
                      <CardTitle className="text-3xl">${data.monthly_revenue.toLocaleString('en-US')}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Consultant Commission</CardDescription>
                      <CardTitle className="text-3xl">
                        ${calculatedMetrics.consultantCommission.toLocaleString('en-US')}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Lifetime Revenue</CardDescription>
                      <CardTitle className="text-3xl">${calculatedMetrics.lifetimeRevenue.toLocaleString('en-US')}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Average Subscription Value</CardDescription>
                      <CardTitle className="text-3xl">
                        ${calculatedMetrics.avgSubscriptionValue.toLocaleString('en-US')}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </section>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Customers</CardTitle>
                    <CardDescription>Latest subscription records and consultant earnings.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentCustomerRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No customers found for this consultant.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer Email</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Commission</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentCustomerRows.map((row, index) => (
                            <TableRow key={`${row.customer_email}-${row.created_at}-${index}`}>
                              <TableCell>{row.customer_email || 'Unknown'}</TableCell>
                              <TableCell>{row.hasRevenueData ? `$${row.amount.toLocaleString('en-US')}` : '-'}</TableCell>
                              <TableCell>{row.hasRevenueData ? `$${row.commission.toLocaleString('en-US')}` : '-'}</TableCell>
                              <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payout Snapshot ({data.payout_summary.period_label})</CardTitle>
                    <CardDescription>
                      Period: {new Date(data.payout_summary.period_start).toLocaleDateString()} -{' '}
                      {new Date(data.payout_summary.period_end).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Subscriptions in Period</p>
                      <p className="mt-2 text-2xl font-semibold">{data.payout_summary.subscriptions_count}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Gross Revenue</p>
                      <p className="mt-2 text-2xl font-semibold">
                        ${data.payout_summary.gross_revenue.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Commission Due</p>
                      <p className="mt-2 text-2xl font-semibold">
                        ${data.payout_summary.commission_due.toLocaleString('en-US')}
                      </p>
                    </div>
                    <p className="sm:col-span-3 text-xs text-muted-foreground">
                      Generated: {new Date(data.payout_summary.generated_at).toLocaleString()}
                    </p>
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
