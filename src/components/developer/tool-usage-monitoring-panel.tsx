'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ToolUsageSummaryRow = {
  toolId: string;
  name: string;
  category: string;
  access: string;
  totalCount: number;
  authenticatedCount: number;
  anonymousCount: number;
  lastOpenedAt: string | null;
  lastSource: string | null;
};

type ToolUsageRecentEvent = {
  id: string;
  toolId: string;
  name: string;
  source: string | null;
  role: string | null;
  isAuthenticated: boolean;
  createdAt: string | null;
};

type ToolUsageResponse = {
  summary: ToolUsageSummaryRow[];
  recentEvents: ToolUsageRecentEvent[];
  totals: {
    totalOpens: number;
    trackedTools: number;
  };
};

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

export function ToolUsageMonitoringPanel() {
  const firebaseAuth = useFirebaseAuth();
  const [data, setData] = useState<ToolUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadToolUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required for tool usage monitoring.');
      }

      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/tool-usage', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load tool usage.');
      }

      setData({
        summary: Array.isArray(payload?.summary) ? payload.summary : [],
        recentEvents: Array.isArray(payload?.recentEvents) ? payload.recentEvents : [],
        totals: {
          totalOpens: Number(payload?.totals?.totalOpens || 0),
          trackedTools: Number(payload?.totals?.trackedTools || 0),
        },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load tool usage.');
    } finally {
      setLoading(false);
    }
  }, [firebaseAuth]);

  useEffect(() => {
    void loadToolUsage();
  }, [loadToolUsage]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Tool Usage</CardTitle>
            <CardDescription>Counts every AutoShop tool open logged from the tools experience.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadToolUsage()} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Opens</p>
              <p className="mt-2 text-2xl font-semibold">{data?.totals.totalOpens ?? 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tracked Tools</p>
              <p className="mt-2 text-2xl font-semibold">{data?.totals.trackedTools ?? 0}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading usage summary...</p>
          ) : !data || data.summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tool usage events have been logged yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Authed</TableHead>
                  <TableHead>Anon</TableHead>
                  <TableHead>Last Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.map((row) => (
                  <TableRow key={row.toolId}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.toolId}</div>
                    </TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.totalCount}</TableCell>
                    <TableCell>{row.authenticatedCount}</TableCell>
                    <TableCell>{row.anonymousCount}</TableCell>
                    <TableCell>{formatDateTime(row.lastOpenedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tool Opens</CardTitle>
          <CardDescription>Latest logged opens for quick spot checks.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading recent events...</p>
          ) : !data || data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent tool opens yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>User Type</TableHead>
                  <TableHead>Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.name}</TableCell>
                    <TableCell>{event.source || '-'}</TableCell>
                    <TableCell>{event.role || '-'}</TableCell>
                    <TableCell>{event.isAuthenticated ? 'Authenticated' : 'Anonymous'}</TableCell>
                    <TableCell>{formatDateTime(event.createdAt)}</TableCell>
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
