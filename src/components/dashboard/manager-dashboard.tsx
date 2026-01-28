

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LessonLog, Lesson, LessonRole, CxTrait, Dealership, Badge, UserRole } from '@/lib/definitions';
import { managerialRoles, noPersonalDevelopmentRoles, allRoles } from '@/lib/definitions';
import { getCombinedTeamData, getLessons, getConsultantActivity, getDealerships, getDealershipById, getManageableUsers, getEarnedBadgesByUserId, getDailyLessonLimits } from '@/lib/data';
import { BarChart, BookOpen, CheckCircle, ShieldOff, Smile, Star, Users, PlusCircle, Store, TrendingUp, TrendingDown, Building, MessageSquare, Ear, Handshake, Repeat, Target, Info, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge as UiBadge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, buttonVariants } from '../ui/button';
import { CreateLessonForm } from '../lessons/create-lesson-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamMemberCard } from './team-member-card';
import { AssignUserForm } from '../admin/assign-user-form';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RemoveUserForm } from '../admin/remove-user-form';
import { cn } from '@/lib/utils';
import { calculateLevel } from '@/lib/xp';
import { Logo } from '@/components/layout/logo';
import { BadgeShowcase } from '../profile/badge-showcase';
import { ManageDealershipForm } from '../admin/ManageDealershipForm';
import { SendMessageForm } from '../messenger/send-message-form';
import { UserNav } from '../layout/user-nav';
import { useAuth } from '@/hooks/use-auth';
import { RegisterDealershipForm } from '../admin/register-dealership-form';
import { CreateDealershipForm } from '../admin/create-dealership-form';


interface ManagerDashboardProps {
  user: User;
}

type TeamMemberStats = {
  consultant: User;
  lessonsCompleted: number;
  totalXp: number;
  avgScore: number;
};

type DealershipInsight = {
    trait: string;
    score: number;
};

const metricIcons: Record<CxTrait, React.ElementType> = {
  empathy: Smile,
  listening: Ear,
  trust: Handshake,
  followUp: Repeat,
  closing: Target,
  relationshipBuilding: Users,
};

function LevelDisplay({ user }: { user: User }) {
    const { level, levelXp, nextLevelXp, progress } = calculateLevel(user.xp);

    if (level >= 100) {
        return (
             <div className="space-y-2">
                <p className="text-2xl font-bold">Level 100 - Master</p>
                <p className="text-sm text-cyan-400">You have reached the pinnacle of sales excellence!</p>
            </div>
        )
    }

    return (
        <div className="w-full space-y-2">
            <div className="flex items-baseline gap-4">
                <p className="text-3xl font-bold text-white">Level {level}</p>
                <Progress value={progress} className="h-4 bg-slate-700/50 border border-slate-600 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-blue-500" />
            </div>
            <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()}</span>
                <p className="text-muted-foreground">{user.role === 'manager' ? 'Sales Manager' : user.role}</p>
            </div>
             <p className="text-cyan-400 text-right font-semibold">Total: {user.xp.toLocaleString()} XP</p>
        </div>
    );
}

export function ManagerDashboard({ user }: ManagerDashboardProps) {
  const { originalUser, isTouring } = useAuth();
  const [stats, setStats] = useState<{ totalLessons: number; avgScores: Record<CxTrait, number> | null } | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamMemberStats[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [managerActivity, setManagerActivity] = useState<LessonLog[]>([]);
  const [managerBadges, setManagerBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateLessonOpen, setCreateLessonOpen] = useState(false);
  const [isManageUsersOpen, setManageUsersOpen] = useState(false);
  const [isMessageDialogOpen, setMessageDialogOpen] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [showTourWelcome, setShowTourWelcome] = useState(false);


  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealershipsForAdmin, setAllDealershipsForAdmin] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [allDealershipStats, setAllDealershipStats] = useState<Record<string, { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null }>>({});
  const router = useRouter();


  const teamContext = useMemo(() => {
    switch (user.role) {
      case 'manager':
        return { memberLabel: 'Sales Consultants', description: 'Across your sales team' };
      case 'Service Manager':
        return { memberLabel: 'Service Writers', description: 'Across your service team' };
      case 'Parts Manager':
        return { memberLabel: 'Parts Consultants', description: 'Across your parts team' };
      default:
        return { memberLabel: 'Team Members', description: 'Across your entire team' };
    }
  }, [user.role]);

  const fetchData = useCallback(async (dealershipId: string | null) => {
      if (!dealershipId) return;

      setLoading(true);
      
      const combinedDataPromise = getCombinedTeamData(dealershipId, user.role);

      const [combinedData, usersToManage, fetchedLessons, fetchedManagerActivity, fetchedBadges, limits] = await Promise.all([
        combinedDataPromise,
        getManageableUsers(user.userId),
        getLessons(user.role as LessonRole),
        getConsultantActivity(user.userId),
        getEarnedBadgesByUserId(user.userId),
        getDailyLessonLimits(user.userId),
      ]);
      
      setStats(combinedData.managerStats);
      setTeamActivity(combinedData.teamActivity);
      setManageableUsers(usersToManage);
      setLessons(fetchedLessons);
      setManagerActivity(fetchedManagerActivity);
      setManagerBadges(fetchedBadges);
      setLessonLimits(limits);
      setLoading(false);
  }, [user.userId, user.role]);

  const fetchAdminData = useCallback(async () => {
    const fetchedDealerships = await getDealerships(user);
    if (['Admin', 'Developer'].includes(user.role)) {
      setAllDealershipsForAdmin(fetchedDealerships);
    }
    setDealerships(fetchedDealerships.filter(d => ['Admin', 'Developer'].includes(user.role) ? true : d.status !== 'deactivated'));
  }, [user]);

  useEffect(() => {
    const fetchInitialData = async () => {
        if (!managerialRoles.includes(user.role)) {
            return;
        }
        setLoading(true);

        await fetchAdminData();
        let initialDealerships: Dealership[] = await getDealerships(user);
        
        let currentSelectedId = selectedDealershipId;

        if (currentSelectedId === null) {
            if (['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
                currentSelectedId = 'all';
            } else if (initialDealerships.length > 0) {
                currentSelectedId = initialDealerships[0].id;
            }
        }
       
        if (currentSelectedId === 'all' && ['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
            const statsPromises = initialDealerships.map(d => getCombinedTeamData(d.id, user.role).then(data => data.managerStats));
            const results = await Promise.all(statsPromises);
            
            const newAllDealershipStats: Record<string, { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null }> = {};
            
            results.forEach((result, index) => {
                const dealershipId = initialDealerships[index].id;
                let insights: { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null } = { bestStat: null, watchStat: null };

                if (result && result.avgScores) {
                    const scores = Object.entries(result.avgScores) as [CxTrait, number][];
                    if (scores.length > 0) {
                         const bestStatEntry = scores.reduce((max, entry) => entry[1] > max[1] ? entry : max, scores[0]);
                         const watchStatEntry = scores.reduce((min, entry) => entry[1] < min[1] ? entry : min, scores[0]);
                         const formatTrait = (trait: CxTrait) => trait.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                         insights = {
                            bestStat: { trait: formatTrait(bestStatEntry[0]), score: bestStatEntry[1] },
                            watchStat: { trait: formatTrait(watchStatEntry[0]), score: watchStatEntry[1] }
                         };
                    }
                }
                newAllDealershipStats[dealershipId] = insights;
            });
            setAllDealershipStats(newAllDealershipStats);
        }

        if (currentSelectedId) {
            if (selectedDealershipId === null) { // Set initial ID if not set
                setSelectedDealershipId(currentSelectedId);
            }
            await fetchData(currentSelectedId);
        } else {
            setLoading(false);
        }
    };

    fetchInitialData();
  }, [user, selectedDealershipId, fetchData, fetchAdminData]);

  useEffect(() => {
    if (user.memberSince) {
      setMemberSince(new Date(user.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }
  }, [user.memberSince]);

  useEffect(() => {
    if (isTouring) {
      const hasSeenWelcome = sessionStorage.getItem(`tourWelcomeSeen_${user.role}`);
      if (!hasSeenWelcome) {
        setShowTourWelcome(true);
      }
    }
  }, [isTouring, user.role]);
  
  const handleWelcomeDialogChange = (open: boolean) => {
    if (!open) {
      sessionStorage.setItem(`tourWelcomeSeen_${user.role}`, 'true');
    }
    setShowTourWelcome(open);
  }

  const handleDealershipChange = (dealershipId: string) => {
    setSelectedDealershipId(dealershipId);
  };

  const managerAverageScores = useMemo(() => {
      if (!managerActivity.length) {
        return {
            empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0
        };
      }

      const total = managerActivity.reduce((acc, log) => {
        acc.empathy += log.empathy || 0;
        acc.listening += log.listening || 0;
        acc.trust += log.trust || 0;
        acc.followUp += log.followUp || 0;
        acc.closing += log.closing || 0;
        acc.relationshipBuilding += log.relationshipBuilding || 0;
        return acc;
      }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

      const count = managerActivity.length;
      
      return Object.fromEntries(
          Object.entries(total).map(([key, value]) => [key, Math.round(value / count)])
      ) as typeof total;
  }, [managerActivity]);

  const recommendedLesson = useMemo(() => {
    if (loading || lessons.length === 0 || !managerAverageScores) return null;

    const lowestScoringTrait = Object.entries(managerAverageScores).reduce((lowest, [trait, score]) => {
        if (score < lowest.score) {
            return { trait: trait as CxTrait, score };
        }
        return lowest;
    }, { trait: 'empathy' as CxTrait, score: 101 });

    const lesson = lessons.find(l => l.associatedTrait === lowestScoringTrait.trait);

    return lesson || lessons[0];
  }, [loading, lessons, managerAverageScores]);

  const statDescription = useMemo(() => {
    if (['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
      const dealershipName = dealerships.find(d => d.id === selectedDealershipId)?.name;
      return selectedDealershipId === 'all' ? 'Across all dealerships' : `For ${dealershipName}`;
    }
    return teamContext.description;
  }, [user.role, selectedDealershipId, dealerships, teamContext.description]);

  const dealershipInsights = useMemo(() => {
    if (!stats?.avgScores) {
        return { bestStat: null, watchStat: null };
    }

    const scores = Object.entries(stats.avgScores) as [CxTrait, number][];
    
    if (scores.length === 0) {
        return { bestStat: null, watchStat: null };
    }

    const bestStat = scores.reduce((max, entry) => entry[1] > max[1] ? entry : max, scores[0]);
    const watchStat = scores.reduce((min, entry) => entry[1] < min[1] ? entry : min, scores[0]);

    const formatTrait = (trait: CxTrait) => trait.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    return {
        bestStat: { trait: formatTrait(bestStat[0]), score: bestStat[1] },
        watchStat: { trait: formatTrait(watchStat[0]), score: watchStat[1] }
    };
  }, [stats]);
  
  async function handleUserManaged() {
    await fetchAdminData();
    if (!['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
        setManageUsersOpen(false);
    }
    fetchData(selectedDealershipId);
  }

  const getStatusBadge = (status: Dealership['status']) => {
      switch(status) {
          case 'active':
              return <UiBadge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Active</UiBadge>;
          case 'paused':
              return <UiBadge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">Paused</UiBadge>;
          case 'deactivated':
              return <UiBadge variant="destructive">Deactivated</UiBadge>;
      }
  }

  const isDeveloperViewing = originalUser?.role === 'Developer';
  const showPersonalDevelopment = !noPersonalDevelopmentRoles.includes(user.role) && !isDeveloperViewing;
  const isSoloManager = teamActivity.length === 0 && selectedDealershipId !== 'all' && !loading;
  const canManage = ['Admin', 'Trainer', 'Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager', 'Developer'].includes(user.role);
  const canMessage = ['Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager'].includes(user.role);
  const isSuperAdmin = ['Admin', 'Developer'].includes(user.role);
  const showInsufficientDataWarning = stats?.totalLessons === -1;

  return (
    <div className="space-y-8 pb-8">
        <Dialog open={showTourWelcome} onOpenChange={handleWelcomeDialogChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-2xl">Welcome, {user.role === 'manager' ? 'Sales Manager' : user.role}!</DialogTitle>
                    <DialogDescription className="pt-2">
                    This is your command center. From here, you can monitor team-wide statistics, track individual member activity, and create custom training lessons.
                    <br /><br />
                    <strong>To begin, try creating a new lesson for your team or select a dealership to view detailed performance insights.</strong>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
      </Dialog>
      <header className="flex items-center justify-between">
          <Logo variant="full" width={183} height={61} />
          <UserNav user={user} avatarClassName="h-14 w-14 border-2 border-cyan-400/50" withBlur />
      </header>
    
      <section className="space-y-3">
            {loading ? <Skeleton className="h-24 w-full" /> : (
            <div>
                <LevelDisplay user={user} />
                {memberSince && (
                    <p className="text-sm text-muted-foreground mt-2">
                        Member since {memberSince}
                    </p>
                )}
            </div>
            )}
      </section>

        <section>
            {loading ? (
            <Skeleton className="h-40 w-full" />
            ) : (
            <BadgeShowcase badges={managerBadges} />
            )}
        </section>

        {isSuperAdmin && (
            <>
                <Card>
                    <CardHeader>
                    <CardTitle>Create New Dealership</CardTitle>
                    <CardDescription>Add a new dealership to the system. This must be done before you can invite users to it.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <CreateDealershipForm user={user} onDealershipCreated={handleUserManaged} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                    <CardTitle>Invite New User</CardTitle>
                    <CardDescription>Send an email invitation for a new user to join a dealership.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <RegisterDealershipForm
                        user={user}
                        dealerships={allDealershipsForAdmin}
                        onUserInvited={handleUserManaged}
                    />
                    </CardContent>
                </Card>
            </>
        )}

        {showPersonalDevelopment && (
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">My Development</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="flex flex-col justify-between p-6 bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 shadow-lg shadow-cyan-500/10">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <BookOpen className="h-8 w-8 text-cyan-400" />
                                <h3 className="text-2xl font-bold text-white">Recommended Lesson</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">A daily lesson focused on your area for greatest improvement as a leader.</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : recommendedLesson && !lessonLimits.recommendedTaken ? (
                            <Link href={`/lesson/${recommendedLesson.lessonId}?recommended=true`} className={cn("w-full", buttonVariants({ className: "w-full font-bold" }))}>
                                Start: {recommendedLesson.title}
                            </Link>
                        ) : (
                            <Button variant="outline" disabled className="w-full bg-slate-800/50 border-slate-700">
                                {recommendedLesson ? 
                                    <><CheckCircle className="mr-2 h-4 w-4" /> Completed for today</> :
                                    "No lesson available"
                                }
                            </Button>
                        )}
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>My Personal CX Scores</CardTitle>
                            <CardDescription>Your performance across completed lessons.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-x-8 gap-y-4">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                        ) : managerAverageScores ? (
                            Object.entries(managerAverageScores).map(([key, value]) => {
                                const Icon = metricIcons[key as keyof typeof metricIcons];
                                const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                return (
                                    <div key={key} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">{title}</span>
                                    </div>
                                    <span className="font-bold text-cyan-400">{value}%</span>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-muted-foreground col-span-full text-center">No scores available yet.</p>
                        )}
                        </CardContent>
                    </Card>
                </div>
            </section>
        )}

      {(['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role) || (dealerships && dealerships.length > 1)) && (
        <Card>
            <CardHeader>
                <CardTitle>Dealership Overview</CardTitle>
                <CardDescription>Select a dealership to view its performance statistics.</CardDescription>
            </CardHeader>
            <CardContent>
                <Select value={selectedDealershipId || ''} onValueChange={handleDealershipChange}>
                    <SelectTrigger className="w-full md:w-1/3">
                        <SelectValue placeholder="Select a dealership" />
                    </SelectTrigger>
                    <SelectContent>
                        {['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role) && <SelectItem value="all">All Dealerships</SelectItem>}
                        {dealerships.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      )}
      
      {isSoloManager ? (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, Manager!</CardTitle>
                    <CardDescription>Your dashboard is ready. Onboard your team to unlock powerful analytics and coaching tools.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6 text-center">
                        <div className="rounded-full border bg-background p-3">
                            <Users className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold">Ready to build a winning team?</h3>
                        <p className="max-w-md text-muted-foreground">Add your dealership and invite your team members to start tracking progress and assigning custom training.</p>
                         <Dialog open={isManageUsersOpen} onOpenChange={setManageUsersOpen}>
                            <DialogTrigger asChild>
                                <Button size="lg">
                                    <PlusCircle className="mr-2 h-5 w-5" />
                                    Onboard Your Team
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="sm:max-w-[625px]">
                                <DialogHeader>
                                    <DialogTitle>Manage Team</DialogTitle>
                                    <DialogDescription>
                                        Invite new team members and manage their dealership assignments.
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[70vh] p-1">
                                    <Tabs defaultValue="invite" className="pt-4">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="invite">Invite New</TabsTrigger>
                                            <TabsTrigger value="assign">Assign Existing</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="invite" className="pt-2">
                                             <RegisterDealershipForm
                                                user={user}
                                                dealerships={dealerships}
                                                onUserInvited={handleUserManaged}
                                            />
                                        </TabsContent>
                                        <TabsContent value="assign" className="pt-2">
                                            <AssignUserForm 
                                                manageableUsers={manageableUsers}
                                                dealerships={dealerships}
                                                onUserAssigned={handleUserManaged} 
                                            />
                                        </TabsContent>
                                    </Tabs>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

        </>
      ) : (
        <>
            <Card>
              <CardHeader>
                <CardTitle>Team Statistics</CardTitle>
                <CardDescription>{statDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                  {loading ? (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                      </div>
                  ) : showInsufficientDataWarning ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-6 text-center">
                        <Info className="h-8 w-8 text-muted-foreground" />
                        <h3 className="font-semibold">Insufficient Data for Reporting</h3>
                        <p className="max-w-md text-sm text-muted-foreground">To protect individual privacy, aggregated performance statistics are only shown for active teams of 3 or more members.</p>
                    </div>
                  ) : (
                      <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4"/>Total Lessons</p>
                              <p className="text-2xl font-bold">{stats?.totalLessons.toString() || '0'}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/>{teamContext.memberLabel}</p>
                              <p className="text-2xl font-bold">{teamActivity.length.toString()}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="h-4 w-4"/>Total XP</p>
                              <p className="text-2xl font-bold">{teamActivity.reduce((sum, member) => sum + member.totalXp, 0).toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500"/>Top Skill</p>
                              <p className="text-2xl font-bold">{dealershipInsights.bestStat?.trait || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-500"/>Watch Area</p>
                              <p className={cn("text-2xl font-bold", dealershipInsights.watchStat && dealershipInsights.watchStat.score < 50 && "text-destructive")}>
                                  {dealershipInsights.watchStat?.trait || 'N/A'}
                              </p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4"/>Avg. Empathy</p>
                              <p className="text-2xl font-bold">{stats?.avgScores ? `${stats.avgScores.empathy}%` : 'N/A'}</p>
                          </div>
                      </div>
                  )}
              </CardContent>
            </Card>
      
            {user.role !== 'Finance Manager' && !isSuperAdmin && (
              <Card>
                  <CardHeader className="flex-col gap-4">
                      <div>
                          <CardTitle className="flex items-center gap-2">
                              <BarChart className="h-5 w-5" />
                              Team Activity
                          </CardTitle>
                          <CardDescription>
                              {selectedDealershipId === 'all'
                                  ? 'Select a dealership to view its team activity.'
                                  : `Activity overview for ${dealerships.find(d => d.id === selectedDealershipId)?.name}.`}
                          </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {canManage && (
                              <Dialog open={isManageUsersOpen} onOpenChange={setManageUsersOpen}>
                                  <DialogTrigger asChild>
                                      <Button variant="outline">
                                          {isDeveloperViewing ? <Settings className="mr-2 h-4 w-4" /> : <Users className="mr-2 h-4 w-4" />}
                                          {isDeveloperViewing ? 'Admin Panel' : 'Manage Team'}
                                      </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[625px]">
                                      <DialogHeader>
                                          <DialogTitle>{isDeveloperViewing ? 'Admin Panel' : 'Manage Team'}</DialogTitle>
                                          <DialogDescription>
                                            {isDeveloperViewing ? 'Invite new users, manage assignments, dealerships, and remove users across the platform.' : 'Invite new team members and manage their dealership assignments.'}
                                          </DialogDescription>
                                      </DialogHeader>
                                      <ScrollArea className="max-h-[70vh] p-1">
                                          <Tabs defaultValue="invite" className="pt-4">
                                              <TabsList className={`grid w-full ${isDeveloperViewing || isSuperAdmin ? 'grid-cols-4' : 'grid-cols-2'}`}>
                                                  <TabsTrigger value="invite">Invite New</TabsTrigger>
                                                  <TabsTrigger value="assign">Assign Existing</TabsTrigger>
                                                  {(isDeveloperViewing || isSuperAdmin) && <TabsTrigger value="remove" className="text-destructive">Remove User</TabsTrigger>}
                                                  {(isDeveloperViewing || isSuperAdmin) && <TabsTrigger value="dealerships">Dealerships</TabsTrigger>}
                                              </TabsList>
                                              <TabsContent value="invite" className="pt-2">
                                                  <RegisterDealershipForm
                                                      user={user}
                                                      dealerships={dealerships}
                                                      onUserInvited={handleUserManaged}
                                                  />
                                              </TabsContent>
                                              <TabsContent value="assign" className="pt-2">
                                                  <AssignUserForm 
                                                      manageableUsers={manageableUsers}
                                                      dealerships={dealerships}
                                                      onUserAssigned={handleUserManaged} 
                                                  />
                                              </TabsContent>
                                              {(isDeveloperViewing || isSuperAdmin) && (
                                                  <TabsContent value="remove" className="pt-2">
                                                      <RemoveUserForm 
                                                          manageableUsers={manageableUsers}
                                                          onUserRemoved={handleUserManaged} 
                                                      />
                                                  </TabsContent>
                                              )}
                                              {(isDeveloperViewing || isSuperAdmin) && (
                                                  <TabsContent value="dealerships" className="pt-2">
                                                      <ManageDealershipForm 
                                                          dealerships={allDealershipsForAdmin}
                                                          onDealershipManaged={handleUserManaged} 
                                                      />
                                                  </TabsContent>
                                              )}
                                          </Tabs>
                                      </ScrollArea>
                                  </DialogContent>
                              </Dialog>
                          )}
                          {canMessage && (
                              <Dialog open={isMessageDialogOpen} onOpenChange={setMessageDialogOpen}>
                                  <DialogTrigger asChild>
                                      <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> Send Message</Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[625px]">
                                      <DialogHeader>
                                      <DialogTitle>Send a new message</DialogTitle>
                                      <DialogDescription>
                                          Broadcast a message to your team, a dealership, or the entire organization.
                                      </DialogDescription>
                                      </DialogHeader>
                                      <SendMessageForm user={user} dealerships={dealerships} onMessageSent={() => setMessageDialogOpen(false)} />
                                  </DialogContent>
                              </Dialog>
                          )}
                          <Dialog open={isCreateLessonOpen} onOpenChange={setCreateLessonOpen}>
                              <DialogTrigger asChild>
                                  <Button>
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Create Lesson
                                  </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[625px]">
                                  <DialogHeader>
                                      <DialogTitle>Create New Training Lesson</DialogTitle>
                                      <DialogDescription>
                                          Design a new lesson for your team. Use AI to suggest a scenario based on your team's performance.
                                      </DialogDescription>
                                  </DialogHeader>
                                  <CreateLessonForm user={user} onLessonCreated={() => setCreateLessonOpen(false)} />
                              </DialogContent>
                          </Dialog>
                      </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : selectedDealershipId && selectedDealershipId !== 'all' ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Team Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-center">Lessons Completed</TableHead>
                            <TableHead className="text-center">Total XP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamActivity.length > 0 ? teamActivity.map(member => {
                            return (
                              <Dialog key={member.consultant.userId}>
                                <DialogTrigger asChild>
                                    <TableRow className="cursor-pointer">
                                        <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                            <AvatarImage src={member.consultant.avatarUrl} data-ai-hint="person portrait" />
                                            <AvatarFallback>{member.consultant.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                            <p className="font-medium">{member.consultant.name}</p>
                                            <p className="text-sm text-muted-foreground">{member.consultant.email}</p>
                                            </div>
                                        </div>
                                        </TableCell>
                                        <TableCell>
                                            <UiBadge variant="outline">{member.consultant.role === 'manager' ? 'Sales Manager' : member.consultant.role}</UiBadge>
                                        </TableCell>
                                        <TableCell className="text-center font-medium">{member.lessonsCompleted}</TableCell>
                                        <TableCell className="text-center font-medium">{member.totalXp.toLocaleString()}</TableCell>
                                    </TableRow>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Performance Snapshot</DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-[70vh]">
                                        <div className="pr-6">
                                            <TeamMemberCard user={member.consultant} currentUser={user} dealerships={dealerships} onAssignmentUpdated={() => fetchData(selectedDealershipId)} />
                                        </div>
                                    </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            );
                          }) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No team activity found for this dealership.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {dealerships.map(dealership => {
                              const insights = allDealershipStats[dealership.id];
                              return (
                                  <Card 
                                  key={dealership.id} 
                                  className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
                                  onClick={() => handleDealershipChange(dealership.id)}
                                  >
                                  <CardHeader>
                                      <CardTitle className="flex items-center justify-between">
                                      {dealership.name}
                                      <Store className="h-5 w-5 text-muted-foreground" />
                                      </CardTitle>
                                      {dealership.status !== 'active' && (
                                          <CardDescription>
                                              Status: {getStatusBadge(dealership.status)}
                                          </CardDescription>
                                      )}
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                      {dealership.status === 'paused' ? (
                                          <p className="text-sm text-muted-foreground">This dealership's activity is currently paused.</p>
                                      ) : (!insights || (!insights.bestStat && !insights.watchStat)) ? (
                                          <p className="text-sm text-muted-foreground">Click to view team performance.</p>
                                      ) : (
                                          <>
                                              {insights.bestStat && (
                                                  <div className="flex items-center gap-2 text-sm">
                                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                                      <span className="font-medium text-muted-foreground">Top Skill:</span>
                                                      <span className="font-semibold">{insights.bestStat.trait}</span>
                                                  </div>
                                              )}
                                              {insights.watchStat && (
                                                  <div className="flex items-center gap-2 text-sm">
                                                      <TrendingDown className="h-4 w-4 text-amber-500" />
                                                      <span className="font-medium text-muted-foreground">Watch Area:</span>
                                                      <span className="font-semibold">{insights.watchStat.trait}</span>
                                                  </div>
                                              )}
                                          </>
                                      )}
                                  </CardContent>
                                  </Card>
                              );
                          })}
                      </div>
                    )}
                  </CardContent>
              </Card>
            )}
        </>
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">
        *XP is earned based on the quality of the interaction during lessons.
      </p>
    </div>
  );
}
