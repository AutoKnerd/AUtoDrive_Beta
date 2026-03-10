'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';

type GmDashboardResponse = {
  dealership_id: string;
  dealership_name: string;
  rep_performance: Array<{
    user_id: string;
    name: string;
    missions_completed: number;
    skill_score: number;
    last_activity: string | null;
  }>;
  coaching_alerts: string[];
  completion_tracking: Array<{
    user_id: string;
    name: string;
    missions_completed: number;
  }>;
};

export default function DealerGmDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();

  const [data, setData] = useState<GmDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const fbUser = firebaseAuth.currentUser;
        if (!fbUser) throw new Error('Authentication required.');
        const token = await fbUser.getIdToken(true);
        const response = await fetch('/api/dealer/gm', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Failed to load GM dashboard.');
        }
        setData(payload as GmDashboardResponse);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load GM dashboard.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    if (user) {
      void loadDashboard();
    }
  }, [user?.userId]);

  if (loading || !user) {
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
        <Card className="border-cyan-400/30 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-2xl text-cyan-200">General Manager Dashboard</CardTitle>
            <CardDescription className="text-slate-300">{data?.dealership_name || 'Dealership'} operational coaching view.</CardDescription>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border-red-400/50 bg-red-500/10">
            <CardContent className="p-6 text-sm text-red-100">{error}</CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading dashboard...</CardContent></Card>
        ) : data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Rep Performance Board</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salesperson</TableHead>
                      <TableHead>Missions Completed</TableHead>
                      <TableHead>Skill Score</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rep_performance.map((rep) => (
                      <TableRow key={rep.user_id}>
                        <TableCell>{rep.name}</TableCell>
                        <TableCell>{rep.missions_completed}</TableCell>
                        <TableCell>{rep.skill_score.toLocaleString('en-US')}</TableCell>
                        <TableCell>{rep.last_activity ? new Date(rep.last_activity).toLocaleString() : 'No activity'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coaching Alerts</CardTitle>
                <CardDescription>Focus reps needing immediate coaching attention.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.coaching_alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active coaching alerts.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.coaching_alerts.map((alert, index) => (
                      <li key={`${alert}-${index}`} className="rounded-md border p-2">{alert}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Training Completion Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.completion_tracking.map((rep) => (
                  <div key={rep.user_id} className="rounded-md border p-3">
                    <p className="font-medium">{rep.name}</p>
                    <p className="text-sm text-muted-foreground">{rep.missions_completed} missions completed</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
