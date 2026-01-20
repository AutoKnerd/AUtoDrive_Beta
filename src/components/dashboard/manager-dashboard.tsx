'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LessonLog, Lesson, LessonRole, CxTrait, Dealership, Badge } from '@/lib/definitions';
import { getManagerStats, getTeamActivity, getLessons, getConsultantActivity, getDealerships, getDealershipById, getManageableUsers, getEarnedBadgesByUserId } from '@/lib/data';
import { BarChart, BookOpen, CheckCircle, Smile, Star, Users, PlusCircle, Store, Mail, LogOut, User as UserIcon, ShieldOff, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge as UiBadge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { CreateLessonForm } from '../lessons/create-lesson-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamMemberCard } from './team-member-card';
import { RegisterDealershipForm } from '../admin/register-dealership-form';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AssignUserForm } from '../admin/assign-user-form';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RemoveUserForm } from '../admin/remove-user-form';
import { cn } from '@/lib/utils';
import { calculateLevel } from '@/lib/xp';
import { Logo } from '@/components/layout/logo';
import { BadgeShowcase } from '../profile/badge-showcase';

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

function LevelDisplay({ xp }: { xp: number }) {
    const { level, levelXp, nextLevelXp, progress } = calculateLevel(xp);

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
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                <span className="text-cyan-400">Total: {xp.toLocaleString()} XP</span>
            </div>
        </div>
    );
}

export function ManagerDashboard({ user }: ManagerDashboardProps) {
  const [stats, setStats] = useState<{ totalLessons: number; avgScores: Record<CxTrait, number> | null } | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamMemberStats[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [managerActivity, setManagerActivity] = useState<LessonLog[]>([]);
  const [managerBadges, setManagerBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateLessonOpen, setCreateLessonOpen] = useState(false);
  const [isManageUsersOpen, setManageUsersOpen] = useState(false);


  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [allDealershipStats, setAllDealershipStats] = useState<Record<string, { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null }>>({});
  const { logout } = useAuth();
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

      const [managerStats, activity, usersToManage] = await Promise.all([
        getManagerStats(dealershipId, user.role),
        getTeamActivity(dealershipId, user.role),
        getManageableUsers(user.userId)
      ]);
      
      setStats(managerStats);
      setTeamActivity(activity);
      setManageableUsers(usersToManage);

      if (!['Owner', 'Admin', 'Trainer'].includes(user.role)) {
          const [fetchedLessons, fetchedManagerActivity, fetchedBadges] = await Promise.all([
              getLessons(user.role as LessonRole),
              getConsultantActivity(user.userId),
              getEarnedBadgesByUserId(user.userId)
          ]);
          setLessons(fetchedLessons);
          setManagerActivity(fetchedManagerActivity);
          setManagerBadges(fetchedBadges);
      }

      setLoading(false);
  }, [user.userId, user.role]);

  useEffect(() => {
    const fetchInitialData = async () => {
        setLoading(true);
        let initialDealerships: Dealership[];

        if (['Owner', 'Admin', 'Trainer'].includes(user.role)) {
            initialDealerships = await getDealerships(user);
        } else {
            const managedDealerships = await Promise.all(
                user.dealershipIds.map(id => getDealershipById(id))
            );
            initialDealerships = managedDealerships.filter((d): d is Dealership => d !== null);
        }
        setDealerships(initialDealerships);
        
        let currentSelectedId = selectedDealershipId;

        if (currentSelectedId === null) {
            if (['Owner', 'Admin', 'Trainer'].includes(user.role)) {
                currentSelectedId = 'all';
            } else if (initialDealerships.length > 0) {
                currentSelectedId = initialDealerships[0].id;
            }
        }
       
        if (currentSelectedId === 'all' && ['Owner', 'Admin', 'Trainer'].includes(user.role)) {
            const statsPromises = initialDealerships.map(d => getManagerStats(d.id, user.role));
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
  }, [user.role, user.userId, user.dealershipIds, selectedDealershipId, fetchData]);

  const handleDealershipChange = (dealershipId: string) => {
    setSelectedDealershipId(dealershipId);
  };

  const managerAverageScores = useMemo(() => {
      if (['Owner', 'Admin', 'Trainer'].includes(user.role)) return null;
      if (!managerActivity.length) return {
          empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85
      };

      const total = managerActivity.reduce((acc, log) => {
          acc.empathy += log.empathy;
          acc.listening += log.listening;
          acc.trust += log.trust;
          acc.followUp += log.followUp;
          acc.closing += log.closing;
          acc.relationshipBuilding += log.relationshipBuilding;
          return acc;
      }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

      const count = managerActivity.length;
      return {
          empathy: Math.round(total.empathy / count),
          listening: Math.round(total.listening / count),
          trust: Math.round(total.trust / count),
          followUp: Math.round(total.followUp / count),
          closing: Math.round(total.closing / count),
          relationshipBuilding: Math.round(total.relationshipBuilding / count),
      };
  }, [managerActivity, user.role]);

  const recommendedLesson = useMemo(() => {
    if (['Owner', 'Admin', 'Trainer'].includes(user.role) || loading || lessons.length === 0 || !managerAverageScores) return null;

    const lowestScoringTrait = Object.entries(managerAverageScores).reduce((lowest, [trait, score]) => {
        if (score < lowest.score) {
            return { trait: trait as CxTrait, score };
        }
        return lowest;
    }, { trait: 'empathy' as CxTrait, score: 101 });

    const lesson = lessons.find(l => l.associatedTrait === lowestScoringTrait.trait);

    return lesson || lessons[0];
  }, [loading, lessons, managerAverageScores, user.role]);

  const statDescription = useMemo(() => {
    if (['Owner', 'Admin', 'Trainer'].includes(user.role)) {
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
    if (['Admin', 'Trainer'].includes(user.role)) {
        const fetchedDealerships = await getDealerships(user);
        setDealerships(fetchedDealerships);
    }
    if (!['Owner', 'Admin', 'Trainer'].includes(user.role)) {
        setManageUsersOpen(false);
    }
    fetchData(selectedDealershipId);
  }


  const canManage = ['Admin', 'Trainer', 'Owner', 'manager', 'Service Manager', 'Parts Manager'].includes(user.role);

  return (
    <div className="space-y-8 pb-8">
      <header className="flex items-center justify-between">
          <Logo variant="full" width={183} height={61} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-14 w-14 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 p-0">
                <Avatar className="h-14 w-14 border-2 border-cyan-400/50">
                    <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400 blur-md" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push('/profile')}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </header>
      
      {!['Owner', 'Admin', 'Trainer'].includes(user.role) && (
        <section className="space-y-3">
             {loading ? <Skeleton className="h-24 w-full" /> : (
                <div>
                    <LevelDisplay xp={user.xp} />
                    {user.memberSince && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Member since {new Date(user.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    )}
                </div>
             )}
        </section>
      )}

      {!['Owner', 'Admin', 'Trainer'].includes(user.role) && (
        <section>
             {loading ? (
                <Skeleton className="h-40 w-full" />
             ) : (
                <BadgeShowcase badges={managerBadges} />
             )}
        </section>
      )}

      {(['Owner', 'Admin', 'Trainer'].includes(user.role) || (dealerships && dealerships.length > 1)) && (
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
                        {['Owner', 'Admin', 'Trainer'].includes(user.role) && <SelectItem value="all">All Dealerships</SelectItem>}
                        {dealerships.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      )}

      {!['Owner', 'Admin', 'Trainer'].includes(user.role) && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              My Recommended Lesson
            </CardTitle>
            <CardDescription>A lesson focused on your area for greatest improvement.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : recommendedLesson ? (
              <Link key={recommendedLesson.lessonId} href={`/lesson/${recommendedLesson.lessonId}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{recommendedLesson.title}</p>
                    <p className="text-sm text-muted-foreground">Focus on your weakest skill: <span className="font-semibold capitalize">{recommendedLesson.associatedTrait.replace(/([A-Z])/g, ' $1')}</span></p>
                  </div>
                  <UiBadge variant="secondary">{recommendedLesson.category}</UiBadge>
                </div>
              </Link>
            ) : (
                <p className="text-sm text-muted-foreground">No lessons available for your role.</p>
            )}
          </CardContent>
        </Card>
      )}

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
      
      {user.role !== 'Finance Manager' && (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart className="h-5 w-5" />
                        Dealer report
                    </CardTitle>
                    <CardDescription>
                        {selectedDealershipId === 'all'
                            ? 'Select a dealership to view its team performance.'
                            : `Performance overview of staff at ${dealerships.find(d => d.id === selectedDealershipId)?.name}.`}
                    </CardDescription>
                </div>
                 <div className="flex gap-2">
                    {canManage && (
                        <Dialog open={isManageUsersOpen} onOpenChange={setManageUsersOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Users className="mr-2 h-4 w-4" />
                                    Manage Team
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[625px]">
                                <DialogHeader>
                                    <DialogTitle>Manage Team</DialogTitle>
                                    <DialogDescription>
                                        Invite new members, assign existing users, or remove users from the system.
                                    </DialogDescription>
                                </DialogHeader>
                                <Tabs defaultValue="assign" className="pt-4">
                                    <TabsList className={`grid w-full ${user.role === 'Admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                        <TabsTrigger value="assign">Assign Existing</TabsTrigger>
                                        <TabsTrigger value="invite">Invite New</TabsTrigger>
                                        {user.role === 'Admin' && <TabsTrigger value="remove" className="text-destructive">Remove User</TabsTrigger>}
                                    </TabsList>
                                    <TabsContent value="assign" className="pt-2">
                                        <AssignUserForm 
                                            manageableUsers={manageableUsers}
                                            dealerships={dealerships}
                                            onUserAssigned={handleUserManaged} 
                                        />
                                    </TabsContent>
                                    <TabsContent value="invite" className="pt-2">
                                        <RegisterDealershipForm user={user} onDealershipRegistered={handleUserManaged} />
                                    </TabsContent>
                                    {user.role === 'Admin' && (
                                        <TabsContent value="remove" className="pt-2">
                                            <RemoveUserForm 
                                                manageableUsers={manageableUsers}
                                                onUserRemoved={handleUserManaged} 
                                            />
                                        </TabsContent>
                                    )}
                                </Tabs>
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
                      <TableHead className="text-right">Average Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamActivity.length > 0 ? teamActivity.map(member => {
                      const consultant = member.consultant;
                      const viewerIsAdmin = user.role === 'Admin';
                      const viewerIsOwner = user.role === 'Owner';
                      
                      const hideMetrics = (consultant.isPrivate && !viewerIsAdmin && !viewerIsOwner) || 
                                        (consultant.isPrivate && consultant.isPrivateFromOwner && viewerIsOwner);

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
                                  <TableCell className="text-right">
                                    {hideMetrics ? (
                                        <div className="flex items-center justify-end gap-2 text-muted-foreground italic">
                                            <ShieldOff className="h-4 w-4" />
                                            <span>Metrics Hidden</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="font-medium">{member.avgScore}%</span>
                                            <Progress value={member.avgScore} className="h-2 w-20" />
                                        </div>
                                    )}
                                  </TableCell>
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
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {(!insights || (!insights.bestStat && !insights.watchStat)) ? (
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

      <p className="pt-4 text-center text-xs text-muted-foreground">
        *XP is earned based on the quality of the interaction during lessons.
      </p>
    </div>
  );
}
