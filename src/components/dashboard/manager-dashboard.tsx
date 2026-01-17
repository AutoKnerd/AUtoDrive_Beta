
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, LessonLog, Lesson, LessonRole, CxTrait, Dealership } from '@/lib/definitions';
import { getManagerStats, getTeamActivity, getLessons, getConsultantActivity, getDealerships, getDealershipById } from '@/lib/data';
import { BarChart, BookOpen, CheckCircle, Smile, Star, Users, PlusCircle, Store, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { CreateLessonForm } from '../lessons/create-lesson-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamMemberCard } from './team-member-card';
import { RegisterDealershipForm } from '../admin/register-dealership-form';

interface ManagerDashboardProps {
  user: User;
}

type TeamMemberStats = {
  consultant: User;
  lessonsCompleted: number;
  totalXp: number;
  avgScore: number;
};

export function ManagerDashboard({ user }: ManagerDashboardProps) {
  const [stats, setStats] = useState<{ totalLessons: number, avgEmpathy: number } | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamMemberStats[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [managerActivity, setManagerActivity] = useState<LessonLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateLessonOpen, setCreateLessonOpen] = useState(false);
  const [isRegisterOpen, setRegisterOpen] = useState(false);

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
        if(['Owner', 'Admin', 'Trainer'].includes(user.role)) {
            const fetchedDealerships = await getDealerships(user);
            setDealerships(fetchedDealerships);
            setSelectedDealershipId('all');
        } else {
            const managedDealerships = await Promise.all(
                user.dealershipIds.map(id => getDealershipById(id))
            );
            const validDealerships = managedDealerships.filter((d): d is Dealership => d !== null);
            setDealerships(validDealerships);
            if (validDealerships.length > 0) {
                setSelectedDealershipId(validDealerships[0].id);
            }
        }
    }
    fetchInitialData();
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!selectedDealershipId) return;

    setLoading(true);

    const promises: Promise<any>[] = [
      getManagerStats(selectedDealershipId, user.role),
      getTeamActivity(selectedDealershipId, user.role),
    ];

    if (!['Owner', 'Admin', 'Trainer'].includes(user.role)) {
      promises.push(getLessons(user.role as LessonRole));
      promises.push(getConsultantActivity(user.userId));
    } else {
      promises.push(Promise.resolve([]));
      promises.push(Promise.resolve([]));
    }

    const [managerStats, activity, fetchedLessons, fetchedManagerActivity] = await Promise.all(promises);
    
    setStats(managerStats as { totalLessons: number, avgEmpathy: number });
    setTeamActivity(activity as TeamMemberStats[]);
    if (fetchedLessons) {
      setLessons(fetchedLessons as Lesson[]);
    }
    if (fetchedManagerActivity) {
      setManagerActivity(fetchedManagerActivity as LessonLog[]);
    }

    setLoading(false);
  }, [user.userId, user.role, selectedDealershipId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


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
    return 'Across your entire team';
  }, [user.role, selectedDealershipId, dealerships]);
  
  async function handleDealershipRegistered() {
    if (['Admin', 'Trainer'].includes(user.role)) {
        const fetchedDealerships = await getDealerships(user);
        setDealerships(fetchedDealerships);
    }
    if (!['Owner', 'Admin', 'Trainer'].includes(user.role)) {
        setRegisterOpen(false);
    }
  }

  const canInvite = ['Admin', 'Trainer', 'Owner', 'manager', 'Service Manager', 'Parts Manager'].includes(user.role);
  const isPrivilegedInviter = ['Admin', 'Trainer'].includes(user.role);
  const inviteDialogTitle = isPrivilegedInviter ? 'Invite New User' : 'Invite Team Member';
  const inviteDialogDescription = isPrivilegedInviter
    ? 'Send an invitation to a user for a new or existing dealership.'
    : `Send an invitation to a new member of your team.`;


  return (
    <>
      {(['Owner', 'Admin', 'Trainer'].includes(user.role) || (dealerships && dealerships.length > 1)) && (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle>Dealership Overview</CardTitle>
                <CardDescription>Select a dealership to view its performance statistics.</CardDescription>
            </CardHeader>
            <CardContent>
                <Select value={selectedDealershipId || 'all'} onValueChange={setSelectedDealershipId}>
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
                  <Badge variant="secondary">{recommendedLesson.category}</Badge>
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
                 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4"/>Total Lessons</p>
                        <p className="text-2xl font-bold">{stats?.totalLessons.toString() || '0'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/>Team Members</p>
                        <p className="text-2xl font-bold">{teamActivity.length.toString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4"/>Avg. Empathy</p>
                        <p className="text-2xl font-bold">{`${stats?.avgEmpathy || 0}%`}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="h-4 w-4"/>Total XP</p>
                        <p className="text-2xl font-bold">{teamActivity.reduce((sum, member) => sum + member.totalXp, 0).toLocaleString()}</p>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

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
                {canInvite && (
                    <Dialog open={isRegisterOpen} onOpenChange={setRegisterOpen}>
                        <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Mail className="mr-2 h-4 w-4" />
                                    Invite User
                                </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[525px]">
                            <DialogHeader>
                                <DialogTitle>{inviteDialogTitle}</DialogTitle>
                                <DialogDescription>
                                    {inviteDialogDescription}
                                </DialogDescription>
                            </DialogHeader>
                            <RegisterDealershipForm user={user} onDealershipRegistered={handleDealershipRegistered} />
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
                {teamActivity.length > 0 ? teamActivity.map(member => (
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
                                <Badge variant="outline">{member.consultant.role === 'manager' ? 'Sales Manager' : member.consultant.role}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">{member.lessonsCompleted}</TableCell>
                            <TableCell className="text-center font-medium">{member.totalXp.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                                <span className="font-medium">{member.avgScore}%</span>
                                <Progress value={member.avgScore} className="h-2 w-20" />
                            </div>
                            </TableCell>
                        </TableRow>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Performance Snapshot</DialogTitle>
                        </DialogHeader>
                        <TeamMemberCard user={member.consultant} currentUser={user} dealerships={dealerships} onAssignment={fetchData} />
                    </DialogContent>
                  </Dialog>
                )) : (
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
                {dealerships.map(dealership => (
                    <Card 
                    key={dealership.id} 
                    className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
                    onClick={() => setSelectedDealershipId(dealership.id)}
                    >
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                        {dealership.name}
                        <Store className="h-5 w-5 text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Click to view team performance.</p>
                    </CardContent>
                    </Card>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
