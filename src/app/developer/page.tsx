'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { allRoles, managerialRoles, UserRole, User, Dealership } from '@/lib/definitions';
import { hasDealershipAssignment } from '@/lib/billing/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { SlidersHorizontal } from 'lucide-react';
import { getManageableUsers, getDealerships } from '@/lib/data.client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RegisterDealershipForm } from '@/components/admin/register-dealership-form';
import { RemoveUserForm } from '@/components/admin/remove-user-form';
import { CreateDealershipForm } from '@/components/admin/create-dealership-form';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { AssignDealershipsForm } from '@/components/admin/assign-dealerships-form';
import { ManageDealershipForm } from '@/components/admin/ManageDealershipForm';
import { EditUserForm } from '@/components/admin/edit-user-form';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type DashboardMode = 'role_based' | 'single_user';

type LiveCxTrait = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';
type LiveCxScores = Record<LiveCxTrait, number>;

const LIVE_CX_TRAITS: Array<{ key: LiveCxTrait; label: string }> = [
  { key: 'empathy', label: 'Empathy' },
  { key: 'listening', label: 'Listening' },
  { key: 'trust', label: 'Trust' },
  { key: 'followUp', label: 'Follow Up' },
  { key: 'closing', label: 'Closing' },
  { key: 'relationship', label: 'Relationship' },
];

const BENCHMARK_PRESET: LiveCxScores = {
  empathy: 75,
  listening: 75,
  trust: 75,
  followUp: 75,
  closing: 75,
  relationship: 75,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildLiveCxScoresFromUser(user: User): LiveCxScores {
  return {
    empathy: clampScore(user.stats?.empathy?.score ?? 60),
    listening: clampScore(user.stats?.listening?.score ?? 60),
    trust: clampScore(user.stats?.trust?.score ?? 60),
    followUp: clampScore(user.stats?.followUp?.score ?? 60),
    closing: clampScore(user.stats?.closing?.score ?? 60),
    relationship: clampScore(user.stats?.relationship?.score ?? 60),
  };
}

function buildDefaultLiveCxScores(): LiveCxScores {
  return {
    empathy: 60,
    listening: 60,
    trust: 60,
    followUp: 60,
    closing: 60,
    relationship: 60,
  };
}

function buildUserStatsFromLiveScores(scores: LiveCxScores): User['stats'] {
  const now = new Date();
  return {
    empathy: { score: scores.empathy, lastUpdated: now },
    listening: { score: scores.listening, lastUpdated: now },
    trust: { score: scores.trust, lastUpdated: now },
    followUp: { score: scores.followUp, lastUpdated: now },
    closing: { score: scores.closing, lastUpdated: now },
    relationship: { score: scores.relationship, lastUpdated: now },
  };
}

export default function DeveloperPage() {
  const { user, loading, setUser, originalUser } = useAuth();
  const router = useRouter();
  const originalUserIsAssigned = !!originalUser && hasDealershipAssignment(originalUser);

  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTool, setActiveTool] = useState('create_user');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('role_based');
  const [singleUserScores, setSingleUserScores] = useState<LiveCxScores>(() => (
    user ? buildLiveCxScoresFromUser(user) : buildDefaultLiveCxScores()
  ));

  const refreshData = useCallback(async () => {
    if (originalUser) {
      setDataLoading(true);
      const [users, dealerships] = await Promise.all([
        getManageableUsers(originalUser.userId),
        getDealerships()
      ]);
      setManageableUsers(users);
      setAllDealerships(dealerships);
      setDataLoading(false);
    }
  }, [originalUser]);

  useEffect(() => {
    if (!loading && originalUser) refreshData();
  }, [loading, originalUser, refreshData]);

  useEffect(() => {
    if (!loading && (!user || (originalUser?.role !== 'Developer' && originalUser?.role !== 'Admin'))) {
      router.push('/login');
      return;
    }

    if (!loading && originalUser && !originalUserIsAssigned) {
      router.push('/');
    }
  }, [user, loading, router, originalUser, originalUserIsAssigned]);

  useEffect(() => {
    if (!originalUser) return;
    if (dashboardMode !== 'single_user') return;
    setSingleUserScores(buildLiveCxScoresFromUser(originalUser));
  }, [dashboardMode, originalUser]);

  if (
    loading ||
    !user ||
    !originalUser ||
    !originalUserIsAssigned ||
    (originalUser.role !== 'Developer' && originalUser.role !== 'Admin')
  ) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Spinner size="lg" /></div>;
  }
  
  const handleSwitchRole = (newRole: UserRole) => {
    if (originalUser) setUser({ ...originalUser, role: newRole });
  };

  const updateSingleUserScore = useCallback((trait: LiveCxTrait, value: number) => {
    const clamped = clampScore(value);
    setSingleUserScores((previous) => ({ ...previous, [trait]: clamped }));
  }, []);

  const setAllSingleUserScores = useCallback((value: number) => {
    const clamped = clampScore(value);
    setSingleUserScores({
      empathy: clamped,
      listening: clamped,
      trust: clamped,
      followUp: clamped,
      closing: clamped,
      relationship: clamped,
    });
  }, []);

  const applyBenchmarkPreset = useCallback(() => {
    setSingleUserScores(BENCHMARK_PRESET);
  }, []);

  const resetSingleUserScores = useCallback(() => {
    if (!originalUser) return;
    setSingleUserScores(buildLiveCxScoresFromUser(originalUser));
  }, [originalUser]);

  const dashboardUser: User = useMemo(() => (
    dashboardMode === 'single_user'
      ? {
          ...user,
          role: 'Sales Consultant',
          dealershipIds: [],
          selfDeclaredDealershipId: undefined,
          stats: buildUserStatsFromLiveScores(singleUserScores),
        }
      : user
  ), [dashboardMode, singleUserScores, user]);

  const isViewingAsManager = managerialRoles.includes(dashboardUser.role);
  const canSeeDeveloperCxTuner = originalUser.role === 'Developer';
  const showDeveloperCxTuner = canSeeDeveloperCxTuner && dashboardMode === 'single_user';
  
  const managementTools = [
    { value: 'create_user', label: 'Create User' },
    { value: 'edit_user', label: 'Edit User' },
    { value: 'assign_dealerships', label: 'Assign Dealerships' },
    { value: 'invite', label: 'Invite to Store' },
    { value: 'remove', label: 'Remove User' },
    { value: 'create_dealership', label: 'Create Dealership' },
    { value: 'manage_dealerships', label: 'Manage Dealerships' },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col">
       <Header />
      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
        <Card className="border-[#8DC63F]/60 bg-[#8DC63F]/10 shadow-[0_0_24px_rgba(141,198,63,0.18)]">
          <CardHeader className="flex-row items-center gap-4">
            <SlidersHorizontal className="h-10 w-10 text-[#8DC63F] drop-shadow-[0_0_10px_rgba(141,198,63,0.5)]" />
            <div>
                <CardTitle className="text-2xl text-[#8DC63F]">God Mode</CardTitle>
                <CardDescription className="text-[#8DC63F]/80">Manage system-wide data or impersonate roles.</CardDescription>
            </div>
          </CardHeader>
        </Card>
        
        <Tabs defaultValue="impersonation" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="impersonation">Impersonation</TabsTrigger>
                <TabsTrigger value="management">System Management</TabsTrigger>
            </TabsList>
            <TabsContent value="impersonation" className="pt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Dashboard View</CardTitle>
                        <CardDescription>
                          Use role-based impersonation or jump directly into a single-user dashboard with no dealership assignment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap items-center gap-4">
                             <span className="text-sm font-medium">Mode:</span>
                            <Select onValueChange={(mode) => setDashboardMode(mode as DashboardMode)} value={dashboardMode}>
                              <SelectTrigger className="w-[240px]">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="role_based">Role-Based</SelectItem>
                                  <SelectItem value="single_user">Single User</SelectItem>
                              </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                             <span className="text-sm font-medium">Impersonating:</span>
                            <Select onValueChange={(role) => handleSwitchRole(role as UserRole)} value={user.role}>
                            <SelectTrigger className="w-[240px]" disabled={dashboardMode === 'single_user'}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allRoles.map((role) => (
                                <SelectItem key={role} value={role}>{role === 'manager' ? 'Sales Manager' : role}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            {dashboardMode === 'single_user' && (
                              <span className="text-xs text-muted-foreground">
                                Single User mode uses `Sales Consultant` with no dealership.
                              </span>
                            )}
                        </div>
                        {canSeeDeveloperCxTuner && !showDeveloperCxTuner && (
                          <Card className="mt-6 border-primary/30">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Developer CX Live Tuner</CardTitle>
                              <CardDescription>
                                This control set appears in Single User mode so you can preview CX score behavior in real time.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Button type="button" variant="outline" onClick={() => setDashboardMode('single_user')}>
                                Switch to Single User
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                        {showDeveloperCxTuner && (
                          <Card className="mt-6 border-primary/40">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">Developer CX Live Tuner</CardTitle>
                              <CardDescription>
                                Developer-only preview controls. Updates the Single User CX chart in real time without writing to Firestore.
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {LIVE_CX_TRAITS.map((trait) => (
                                <div key={trait.key} className="grid gap-2 md:grid-cols-[140px_1fr_90px] md:items-center">
                                  <Label className="text-sm font-medium">{trait.label}</Label>
                                  <Slider
                                    value={[singleUserScores[trait.key]]}
                                    min={0}
                                    max={100}
                                    step={1}
                                    onValueChange={(values) => updateSingleUserScore(trait.key, values[0] ?? 0)}
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={singleUserScores[trait.key]}
                                    onChange={(event) => updateSingleUserScore(trait.key, Number(event.target.value))}
                                    className="h-8"
                                  />
                                </div>
                              ))}
                              <div className="flex flex-wrap gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={resetSingleUserScores}>
                                  Reset to Profile
                                </Button>
                                <Button type="button" variant="outline" onClick={applyBenchmarkPreset}>
                                  Apply Benchmarks
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setAllSingleUserScores(60)}>
                                  Set All 60
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        <div className="border-t pt-8 mt-6">
                            {isViewingAsManager ? <ManagerDashboard user={dashboardUser} /> : <ConsultantDashboard user={dashboardUser} />}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="management" className="pt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Management Tools</CardTitle>
                        <CardDescription>Consolidated system administration.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {dataLoading ? <Spinner /> : (
                            <div className="w-full">
                                <div className="mb-6">
                                    <Select value={activeTool} onValueChange={setActiveTool}>
                                        <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue placeholder="Select a tool..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {managementTools.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="mt-4">
                                    {activeTool === 'create_user' && (
                                      <CreateUserForm
                                        onUserCreated={refreshData}
                                        dealerships={allDealerships}
                                      />
                                    )}
                                    {activeTool === 'edit_user' && <EditUserForm manageableUsers={manageableUsers} dealerships={allDealerships} onUserUpdated={refreshData} />}
                                    {activeTool === 'assign_dealerships' && <AssignDealershipsForm manageableUsers={manageableUsers} dealerships={allDealerships} currentUser={originalUser!} onDealershipsAssigned={refreshData} />}
                                    {activeTool === 'invite' && <RegisterDealershipForm user={originalUser!} dealerships={allDealerships} onUserInvited={refreshData} />}
                                    {activeTool === 'remove' && <RemoveUserForm manageableUsers={manageableUsers} onUserRemoved={refreshData} />}
                                    {activeTool === 'create_dealership' && <CreateDealershipForm user={originalUser!} onDealershipCreated={refreshData} />}
                                    {activeTool === 'manage_dealerships' && <ManageDealershipForm dealerships={allDealerships} onDealershipManaged={refreshData} />}
                                </div>
                            </div>
                        )}
                    </CardContent>
                 </Card>
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
