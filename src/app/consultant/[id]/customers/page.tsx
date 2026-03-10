'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConsultantSidebar } from '@/components/consultant/consultant-sidebar';
import { useConsultantRouteAccess } from '@/hooks/use-consultant-route-access';

type ConsultantCustomerRow = {
  customer_email: string;
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  monthly_amount: number;
  joined_date: string;
  subscription_id: string;
};

type ConsultantCustomersResponse = {
  consultant: string;
  customers: ConsultantCustomerRow[];
};

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ConsultantCustomersPage() {
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

  const [data, setData] = useState<ConsultantCustomersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && consultantId) {
      console.log('Admin viewing consultant dashboard:', consultantId);
    }
  }, [isAdmin, consultantId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/consultant-customers?id=${encodeURIComponent(consultantId)}`, {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load consultant customers.');
        }

        setData(payload as ConsultantCustomersResponse);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : 'Unable to load consultant customers.';
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    if (consultantId && isAuthorized) {
      void loadCustomers();
    } else if (!isChecking) {
      setIsLoading(false);
    }

    return () => controller.abort();
  }, [consultantId, isAuthorized, isChecking]);

  const consultantDisplayName = useMemo(() => {
    return data?.consultant ? toDisplayName(data.consultant) : toDisplayName(consultantId);
  }, [data?.consultant, consultantId]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ConsultantSidebar consultantId={consultantId} active="customers" />
          <div className="space-y-6">
            <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
              <CardHeader>
                <CardTitle className="text-2xl text-cyan-200">Customers</CardTitle>
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

            <Card>
              <CardHeader>
                <CardTitle>Customer Roster</CardTitle>
                <CardDescription>
                  Stripe subscriptions attributed to this consultant.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isChecking ? (
                  <p className="text-sm text-muted-foreground">Validating consultant access...</p>
                ) : !isAuthorized ? (
                  <p className="text-sm text-muted-foreground">You do not have access to this consultant route.</p>
                ) : isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading customers...</p>
                ) : error ? (
                  <p className="text-sm text-red-500">{error}</p>
                ) : !data || data.customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customers found for this consultant.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Monthly Amount</TableHead>
                        <TableHead>Joined Date</TableHead>
                        <TableHead>Stripe Subscription ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customers.map((customer) => (
                        <TableRow key={customer.subscription_id}>
                          <TableCell>{customer.customer_email || 'Unknown'}</TableCell>
                          <TableCell>{customer.plan}</TableCell>
                          <TableCell className="capitalize">{customer.status.replace('_', ' ')}</TableCell>
                          <TableCell>${customer.monthly_amount.toLocaleString('en-US')}</TableCell>
                          <TableCell>{new Date(customer.joined_date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs">{customer.subscription_id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
