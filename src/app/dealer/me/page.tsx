'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type SalespersonDashboardResponse = {
  dealership_id: string;
  dealership_name: string;
  today_mission: {
    title: string;
    description: string;
  };
  training_streak: number;
  skill_score: number;
  recent_missions: Array<{
    completed_at: string;
    lesson_id: string;
    xp_gained: number;
  }>;
};

export default function DealerMePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();

  const [data, setData] = useState<SalespersonDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [loading, user, router]);

  async function getAuthToken() {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error('Authentication required.');
    return fbUser.getIdToken(true);
  }

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/dealer/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load dashboard.');
      }
      setData(payload as SalespersonDashboardResponse);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      void loadDashboard();
    }
  }, [user?.userId]);

  async function completeMission() {
    setIsSubmitting(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/dealer/me', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to complete mission.');
      }
      await loadDashboard();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to complete mission.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card className="border-cyan-400/30 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="text-2xl text-cyan-200">My Training</CardTitle>
            <CardDescription className="text-slate-300">{data?.dealership_name || 'Dealership'} daily mission.</CardDescription>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border-red-400/50 bg-red-500/10">
            <CardContent className="p-6 text-sm text-red-100">{error}</CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
        ) : data && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s Mission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-lg font-semibold">{data.today_mission.title}</p>
                  <p className="text-sm text-muted-foreground">{data.today_mission.description}</p>
                </div>
                <Button disabled={isSubmitting} onClick={completeMission}>
                  {isSubmitting ? 'Completing...' : 'Complete Mission'}
                </Button>
              </CardContent>
            </Card>

            <section className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Training Streak</CardDescription>
                  <CardTitle className="text-3xl">{data.training_streak}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Skill Score</CardDescription>
                  <CardTitle className="text-3xl">{data.skill_score.toLocaleString('en-US')}</CardTitle>
                </CardHeader>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Recent Missions</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recent_missions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent missions completed.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.recent_missions.map((mission, index) => (
                      <li key={`${mission.lesson_id}-${mission.completed_at}-${index}`} className="rounded-md border p-2">
                        <p className="font-medium">{mission.lesson_id || 'Mission'}</p>
                        <p className="text-muted-foreground">
                          {new Date(mission.completed_at).toLocaleString()} · XP {mission.xp_gained}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
