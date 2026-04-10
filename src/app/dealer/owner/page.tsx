'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { AutoForgeDialog, type AutoForgeContext } from '@/components/lessons/autoforge-dialog';

type OwnerDashboardResponse = {
  dealership_id: string;
  dealership_name: string;
  snapshot: {
    team_training_completion: number;
    team_engagement_rate: number;
    average_skill_score: number;
    active_users: number;
    salespeople: number;
  };
  team_overview: Array<{
    user_id: string;
    name: string;
    role: string;
    training_completion: number;
    missions_completed: number;
    last_activity: string | null;
    skill_score: number;
  }>;
  training_progress: {
    discovery_skills: number;
    trust_building: number;
    closing_skills: number;
  };
  billing: {
    current_plan: string;
    active_seats: number;
    monthly_cost: number;
    next_billing_date: string;
  };
};

export default function DealerOwnerDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();

  const [data, setData] = useState<OwnerDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
  }, [loading, user, router]);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) throw new Error('Authentication required.');
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/dealer/owner', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load owner dashboard.');
      }
      setData(payload as OwnerDashboardResponse);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load owner dashboard.';
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

  const autoForgeContext = useMemo<AutoForgeContext>(() => {
    if (!data) {
      return {
        department: 'Storewide Leadership',
        dealershipName: 'Dealership',
        dealershipScopeLabel: 'Owner view',
        departmentPerformanceSummary: '',
        memberSignals: [],
      };
    }

    const weakestTeamMember = [...data.team_overview]
      .sort((a, b) => a.training_completion - b.training_completion)[0];

    return {
      department: 'Storewide Leadership',
      dealershipName: data.dealership_name,
      dealershipScopeLabel: 'Owner view',
      departmentPerformanceSummary: [
        `Snapshot: ${data.snapshot.team_training_completion}% training completion, ${data.snapshot.team_engagement_rate}% engagement, and ${data.snapshot.average_skill_score} average skill score.`,
        weakestTeamMember
          ? `Lowest completion: ${weakestTeamMember.name} at ${weakestTeamMember.training_completion}% with ${weakestTeamMember.skill_score} skill score.`
          : '',
      ].filter(Boolean).join(' '),
      memberSignals: data.team_overview
        .slice()
        .sort((a, b) => a.training_completion - b.training_completion)
        .slice(0, 3)
        .map((member) => `${member.name} (${member.role}) - ${member.training_completion}% completion, ${member.skill_score} skill score.`),
    };
  }, [data]);

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
            <CardTitle className="text-2xl text-cyan-200">Owner Dashboard</CardTitle>
            <CardDescription className="text-slate-300">{data?.dealership_name || 'Dealership'} performance overview.</CardDescription>
          </CardHeader>
        </Card>

        <Card className="flex flex-col justify-between border border-red-500/80 bg-black p-6 shadow-[0_0_0_1px_rgba(239,68,68,0.45),0_0_28px_rgba(0,0,0,0.35)] dark:border-red-400/80 dark:bg-black">
          <CardHeader className="p-0 pb-4 text-center">
            <div className="flex items-center justify-center">
              <div className="relative h-36 w-72 overflow-hidden rounded-md">
                <Image
                  src="/AutoForge logo.png"
                  alt="AutoForge"
                  fill
                  sizes="288px"
                  className="object-contain"
                />
              </div>
            </div>
            <CardDescription className="text-center text-sm text-muted-foreground">
              A personal growth engine built from your own CX data.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <AutoForgeDialog
              user={user}
              autoForgeContext={autoForgeContext}
            />
          </CardContent>
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
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardDescription>Team Training Completion %</CardDescription><CardTitle className="text-3xl">{data.snapshot.team_training_completion.toLocaleString('en-US')}%</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>Team Engagement Rate</CardDescription><CardTitle className="text-3xl">{data.snapshot.team_engagement_rate.toLocaleString('en-US')}%</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>Average Skill Score</CardDescription><CardTitle className="text-3xl">{data.snapshot.average_skill_score.toLocaleString('en-US')}</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>Active Users</CardDescription><CardTitle className="text-3xl">{data.snapshot.active_users}</CardTitle></CardHeader></Card>
        </section>

        <Card>
              <CardHeader>
                <CardTitle>Team Activity</CardTitle>
                <CardDescription>{data.snapshot.salespeople} Salespeople</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salesperson</TableHead>
                      <TableHead>Training Completion</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Skill Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.team_overview.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.training_completion}%</TableCell>
                        <TableCell>{row.last_activity ? new Date(row.last_activity).toLocaleString() : 'No activity'}</TableCell>
                        <TableCell>{row.skill_score.toLocaleString('en-US')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Training Progress</CardTitle>
                <CardDescription>Team skill progression by focus area.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm"><span>Discovery Skills</span><span>{Math.round(data.training_progress.discovery_skills)}%</span></div>
                  <Progress value={data.training_progress.discovery_skills} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm"><span>Trust Building</span><span>{Math.round(data.training_progress.trust_building)}%</span></div>
                  <Progress value={data.training_progress.trust_building} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm"><span>Closing Skills</span><span>{Math.round(data.training_progress.closing_skills)}%</span></div>
                  <Progress value={data.training_progress.closing_skills} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Billing & Subscription</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Current Plan</p><p className="mt-1 text-lg font-semibold capitalize">{data.billing.current_plan}</p></div>
                <div><p className="text-xs text-muted-foreground">Active Seats</p><p className="mt-1 text-lg font-semibold">{data.billing.active_seats}</p></div>
                <div><p className="text-xs text-muted-foreground">Monthly Cost</p><p className="mt-1 text-lg font-semibold">${data.billing.monthly_cost.toLocaleString('en-US')}</p></div>
                <div><p className="text-xs text-muted-foreground">Next Billing Date</p><p className="mt-1 text-lg font-semibold">{new Date(data.billing.next_billing_date).toLocaleDateString()}</p></div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Button variant="outline" onClick={() => router.push('/subscribe')}>Manage Billing</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
