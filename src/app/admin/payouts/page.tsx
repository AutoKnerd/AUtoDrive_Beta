'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

type CommissionRecord = {
  id: string;
  consultant_id: string;
  stripe_subscription_id: string;
  customer_email: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'voided' | 'paid';
  period_start: string;
  period_end: string;
  created_at: string;
  paid_at: string | null;
};

type ConsultantSummary = {
  consultant_id: string;
  revenue: number;
  commission: number;
  count: number;
};

type PayoutApiResponse = {
  records: CommissionRecord[];
  consultants: ConsultantSummary[];
};

export default function AdminPayoutsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();

  const [rows, setRows] = useState<CommissionRecord[]>([]);
  const [consultants, setConsultants] = useState<ConsultantSummary[]>([]);
  const [consultantFilter, setConsultantFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user && user.role !== 'Admin' && user.role !== 'Developer') {
      router.push('/');
    }
  }, [loading, user, router]);

  async function getAuthHeader() {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) {
      throw new Error('Authentication required. Please sign in again.');
    }

    const token = await fbUser.getIdToken(true);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async function loadRows() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeader();
      const query = consultantFilter.trim() ? `?consultant=${encodeURIComponent(consultantFilter.trim().toLowerCase())}` : '';
      const response = await fetch(`/api/admin/payouts${query}`, { headers });
      const payload = await response.json() as PayoutApiResponse;

      if (!response.ok) {
        throw new Error((payload as unknown as { message?: string }).message || 'Failed to load payouts.');
      }

      setRows(payload.records || []);
      setConsultants(payload.consultants || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load payouts.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, [user?.userId, user?.role, consultantFilter]);

  const metrics = useMemo(() => {
    const totalCommission = rows.filter((row) => row.status !== 'voided').reduce((sum, row) => sum + row.commission_amount, 0);
    const paid = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.commission_amount, 0);
    const pending = rows
      .filter((row) => row.status === 'pending' || row.status === 'approved')
      .reduce((sum, row) => sum + row.commission_amount, 0);

    return {
      totalCommission: Math.round(totalCommission * 100) / 100,
      totalPaid: Math.round(paid * 100) / 100,
      pending: Math.round(pending * 100) / 100,
    };
  }, [rows]);

  async function updateStatus(id: string, action: 'approve' | 'mark_paid') {
    setIsUpdating(true);
    setError(null);

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`/api/admin/payouts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to update payout status.');
      }

      await loadRows();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Failed to update payout status.';
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }

  async function exportCsv() {
    try {
      const headers = await getAuthHeader();
      const query = consultantFilter.trim() ? `&consultant=${encodeURIComponent(consultantFilter.trim().toLowerCase())}` : '';
      const response = await fetch(`/api/admin/payouts?format=csv${query}`, { headers });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || 'Failed to export CSV.');
      }

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'consultant-payouts.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Failed to export CSV.';
      setError(message);
    }
  }

  if (loading || !user || (user.role !== 'Admin' && user.role !== 'Developer')) {
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
        <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
          <CardHeader>
            <CardTitle className="text-2xl text-cyan-200">Admin Payout Dashboard</CardTitle>
            <CardDescription className="text-slate-300">Manage consultant commission approvals and payouts.</CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Earned</CardDescription>
              <CardTitle className="text-3xl">${metrics.totalCommission.toLocaleString('en-US')}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Paid</CardDescription>
              <CardTitle className="text-3xl">${metrics.totalPaid.toLocaleString('en-US')}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payout</CardDescription>
              <CardTitle className="text-3xl">${metrics.pending.toLocaleString('en-US')}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Payout Records</CardTitle>
            <CardDescription>Filter by consultant, approve commissions, and mark payouts as paid.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-xs"
                value={consultantFilter}
                onChange={(event) => setConsultantFilter(event.target.value)}
                placeholder="Filter by consultant id"
              />
              <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Consultant Totals</p>
              {consultants.length === 0 ? (
                <p className="text-muted-foreground">No consultant payout records yet.</p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {consultants.map((row) => (
                    <div key={row.consultant_id} className="rounded border p-2">
                      <p className="font-semibold">{row.consultant_id}</p>
                      <p className="text-xs text-muted-foreground">Records: {row.count}</p>
                      <p className="text-xs text-muted-foreground">Revenue: ${row.revenue.toLocaleString('en-US')}</p>
                      <p className="text-xs text-muted-foreground">Commission: ${row.commission.toLocaleString('en-US')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading payouts...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payout records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultant</TableHead>
                    <TableHead>Customer Email</TableHead>
                    <TableHead>Subscription ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.consultant_id}</TableCell>
                      <TableCell>{row.customer_email || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.stripe_subscription_id}</TableCell>
                      <TableCell>${row.amount.toLocaleString('en-US')}</TableCell>
                      <TableCell>${row.commission_amount.toLocaleString('en-US')}</TableCell>
                      <TableCell className="capitalize">{row.status.replace('_', ' ')}</TableCell>
                      <TableCell>
                        {row.period_start ? new Date(row.period_start).toLocaleDateString() : '-'} -{' '}
                        {row.period_end ? new Date(row.period_end).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating || row.status === 'approved' || row.status === 'paid' || row.status === 'voided'}
                          onClick={() => updateStatus(row.id, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          disabled={isUpdating || row.status !== 'approved'}
                          onClick={() => updateStatus(row.id, 'mark_paid')}
                        >
                          Mark Paid
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
