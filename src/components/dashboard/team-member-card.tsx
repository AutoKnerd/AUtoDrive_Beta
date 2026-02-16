
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait, LessonRole, Dealership, Badge } from '@/lib/definitions';
import { getLessons, getConsultantActivity, updateUserDealerships, assignLesson, getTeamMemberRoles, getEarnedBadgesByUserId } from '@/lib/data.client';
import { calculateLevel } from '@/lib/xp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon, Pencil, PlusCircle, ShieldOff } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '../ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreateLessonForm } from '../lessons/create-lesson-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { BadgeShowcase } from '../profile/badge-showcase';
import { managerialRoles } from '@/lib/definitions';

interface TeamMemberCardProps {
  user: User;
  currentUser: User;
  dealerships: Dealership[];
  onAssignmentUpdated: () => void;
}

const metricIcons: Record<CxTrait, LucideIcon> = {
  empathy: Smile,
  listening: Ear,
  trust: Handshake,
  followUp: Repeat,
  closing: Target,
  relationshipBuilding: Users,
};

export function TeamMemberCard({ user, currentUser, dealerships, onAssignmentUpdated }: TeamMemberCardProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedDealerships, setSelectedDealerships] = useState(user.dealershipIds);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isCreateLessonOpen, setCreateLessonOpen] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [recentActivityDate, setRecentActivityDate] = useState<string | null>(null);


  const { level } = calculateLevel(user.xp);

  const viewerIsAdmin = currentUser.role === 'Admin' || currentUser.role === 'Developer';
  const viewerIsTrainer = currentUser.role === 'Trainer';
  const viewerIsOwner = currentUser.role === 'Owner';
  const viewerIsManager = managerialRoles.includes(currentUser.role) && !viewerIsAdmin && !viewerIsOwner && !viewerIsTrainer;
  const viewerIsSuperior = managerialRoles.includes(currentUser.role) && currentUser.userId !== user.userId;

  const hideMetrics =
    (viewerIsManager && user.isPrivate) ||
    (viewerIsOwner && user.isPrivateFromOwner);
  const showCriticalOnly = viewerIsSuperior && !hideMetrics && user.showDealerCriticalOnly === true;


  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (!user) return;
      if (hideMetrics) {
        setLoading(false);
        return;
      }
      const canViewBadges =
        currentUser.userId === user.userId ||
        viewerIsAdmin ||
        viewerIsTrainer ||
        viewerIsOwner ||
        viewerIsManager;
      const [fetchedLessons, fetchedActivity, fetchedBadges] = await Promise.all([
        getLessons(user.role as LessonRole, user.userId),
        getConsultantActivity(user.userId),
        canViewBadges ? getEarnedBadgesByUserId(user.userId) : Promise.resolve([]),
      ]);
      setLessons(fetchedLessons);
      setActivity(fetchedActivity);
      setBadges(fetchedBadges);
      
      if (user.memberSince) {
        setMemberSince(new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      }
      if (fetchedActivity.length > 0) {
        setRecentActivityDate(new Date(fetchedActivity[0].timestamp).toLocaleDateString());
      }

      setLoading(false);
    }
    fetchData();
  }, [user, hideMetrics]);
  
  const currentDealershipNames = useMemo(() => {
    if (user.dealershipIds && user.dealershipIds.length > 0) {
        return user.dealershipIds
            .map(id => dealerships.find(d => d.id === id)?.name)
            .filter(Boolean)
            .join(', ') || 'Unassigned';
    }
    if (user.selfDeclaredDealershipId) {
        const dealershipName = dealerships.find(d => d.id === user.selfDeclaredDealershipId)?.name;
        return dealershipName ? `${dealershipName}` : 'Unassigned';
    }
    return 'Unassigned';
  }, [dealerships, user.dealershipIds, user.selfDeclaredDealershipId]);

  async function handleUpdateAssignments() {
    setIsUpdating(true);
    try {
        await updateUserDealerships(user.userId, selectedDealerships);
        toast({
            title: 'Success',
            description: `${user.name}'s assignments have been updated.`,
        });
        setIsModifying(false);
        onAssignmentUpdated(); // This will trigger a re-fetch in the parent
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'Assignment Failed',
            description: (e as Error).message || 'An error occurred.',
        });
    } finally {
        setIsUpdating(false);
    }
  }

    async function handleUnassignUser() {
        setIsUpdating(true);
        try {
            await updateUserDealerships(user.userId, []);
            toast({
                title: 'User Unassigned',
                description: `${user.name} has been unassigned from all dealerships.`,
            });
            setIsModifying(false);
            setIsConfirmingRemoval(false);
            onAssignmentUpdated();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Unassignment Failed',
                description: (e as Error).message || 'An error occurred.',
            });
        } finally {
            setIsUpdating(false);
            setConfirmationInput('');
        }
    }

  const handleCheckedChange = (dealershipId: string, checked: boolean) => {
    setSelectedDealerships(prev => {
        if (checked) {
            return [...prev, dealershipId];
        } else {
            return prev.filter(id => id !== dealershipId);
        }
    });
  }

  const handleLessonCreated = () => {
    setCreateLessonOpen(false);
    toast({
      title: "Lesson Created & Assigned!",
      description: "The new lesson has been assigned to the user."
    })
  };

  const recentActivity = useMemo(() => {
    if (!activity.length) return null;
    return activity[0];
  }, [activity]);
  
  const averageScores = useMemo(() => {
    if (!activity.length) return {
      empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0
    };

    const total = activity.reduce((acc, log) => {
        acc.empathy += log.empathy || 0;
        acc.listening += log.listening || 0;
        acc.trust += log.trust || 0;
        acc.followUp += log.followUp || 0;
        acc.closing += log.closing || 0;
        acc.relationshipBuilding += log.relationshipBuilding || 0;
        return acc;
    }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

    const count = activity.length;
    return {
        empathy: Math.round(total.empathy / count),
        listening: Math.round(total.listening / count),
        trust: Math.round(total.trust / count),
        followUp: Math.round(total.followUp / count),
        closing: Math.round(total.closing / count),
        relationshipBuilding: Math.round(total.relationshipBuilding / count),
    };
  }, [activity]);

  const criticalTraits = useMemo(() => {
    if (!activity.length) return { topStrength: null as CxTrait | null, weakestSkill: null as CxTrait | null };
    const entries = Object.entries(averageScores) as [CxTrait, number][];
    if (entries.length === 0) return { topStrength: null as CxTrait | null, weakestSkill: null as CxTrait | null };

    const topStrength = entries.reduce((best, current) => (current[1] > best[1] ? current : best), entries[0])[0];
    const weakestSkill = entries.reduce((worst, current) => (current[1] < worst[1] ? current : worst), entries[0])[0];
    return { topStrength, weakestSkill };
  }, [activity, averageScores]);

  const formatTrait = (trait: CxTrait | null) => {
    if (!trait) return 'Not enough data';
    return trait
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };
  
  const canManageAssignments = currentUser.userId !== user.userId && getTeamMemberRoles(currentUser.role).includes(user.role);
  const canAssignLessons = ['Owner', 'Admin', 'Trainer', 'General Manager', 'manager', 'Service Manager', 'Parts Manager'].includes(currentUser.role);


  return (
    <div className="space-y-4">
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={user.avatarUrl} data-ai-hint="person portrait" />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-2xl">{user.name}</CardTitle>
                        <CardDescription>{user.role === 'manager' ? 'Sales Manager' : user.role} at {currentDealershipNames}</CardDescription>
                        {memberSince && (
                            <CardDescription className="pt-1">
                                Member since {memberSince}
                            </CardDescription>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">Level {level}</p>
                    <p className="font-bold text-lg">{user.xp.toLocaleString()} XP</p>
                </div>
            </CardHeader>
        </Card>

        {hideMetrics ? (
            <Card>
                <CardHeader className="text-center items-center">
                    <ShieldOff className="h-10 w-10 text-muted-foreground" />
                    <CardTitle>Metrics are Private</CardTitle>
                    <CardDescription>This user has chosen to hide their detailed performance metrics.</CardDescription>
                </CardHeader>
            </Card>
        ) : showCriticalOnly ? (
            <Card>
                <CardHeader>
                    <CardTitle>Dealer Critical Summary</CardTitle>
                    <CardDescription>
                        This user shares only top strength and area for improvement with leadership.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm text-muted-foreground">Top Strength</span>
                        <span className="font-semibold">{formatTrait(criticalTraits.topStrength)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm text-muted-foreground">Area for Improvement</span>
                        <span className="font-semibold">{formatTrait(criticalTraits.weakestSkill)}</span>
                    </div>
                </CardContent>
            </Card>
        ) : (
            <>
                <Card>
                    <CardHeader>
                    <CardTitle>Average CX Scores</CardTitle>
                    <CardDescription>Average performance across all completed lessons.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                    ) : Object.keys(averageScores).length > 0 && averageScores.empathy > 0 ? (
                        Object.entries(averageScores).map(([key, value]) => {
                        const Icon = metricIcons[key as keyof typeof metricIcons];
                        const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        return (
                            <div key={key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                                <span className="text-sm font-medium">{title}</span>
                            </div>
                            <span className="font-bold">{value}%</span>
                            </div>
                        );
                        })
                    ) : (
                        <p className="text-muted-foreground col-span-full text-center">No scores available yet.</p>
                    )}
                    </CardContent>
                </Card>
                <BadgeShowcase badges={badges} />
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Most Recent Activity
                        </CardTitle>
                        <CardDescription>Performance from the last completed lesson.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-1/4" />
                        </div>
                        ) : recentActivity && recentActivityDate ? (
                        <div className="space-y-2">
                            <p className="text-lg font-semibold text-primary">{lessons.find(l => l.lessonId === recentActivity.lessonId)?.title || 'Unknown Lesson'}</p>
                            <p className="text-sm text-muted-foreground">
                            Completed on {recentActivityDate}
                            </p>
                            <p className="text-2xl font-bold text-accent">+{recentActivity.xpGained} XP</p>
                        </div>
                        ) : (
                        <p className="text-muted-foreground">No recent activity found.</p>
                        )}
                    </CardContent>
                </Card>

            </>
        )}
        
       

        {canAssignLessons && (
            <Card>
                <CardHeader>
                    <CardTitle>Create & Assign Custom Lesson</CardTitle>
                    <CardDescription>Design a new lesson and assign it directly to this team member.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CreateLessonForm 
                        user={currentUser} 
                        onLessonCreated={handleLessonCreated}
                        assignOnCreateToUserId={user.userId}
                        assignerId={currentUser.userId}
                    />
                </CardContent>
            </Card>
        )}
      
       {canManageAssignments && (
            <Card>
                <CardHeader>
                    <CardTitle>Dealership Assignments</CardTitle>
                    <CardDescription>
                        Modify which dealerships this user is assigned to.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isConfirmingRemoval ? (
                         <div className="space-y-4 rounded-lg border border-destructive bg-destructive/10 p-4">
                            <h4 className="font-semibold text-destructive">Confirm Unassignment</h4>
                            <p className="text-sm text-destructive/90">
                                To unassign {user.name} from all dealerships, type <strong>UNASSIGN</strong> below. This action does not delete the user account.
                            </p>
                            <Input 
                                value={confirmationInput}
                                onChange={(e) => setConfirmationInput(e.target.value)}
                                placeholder="UNASSIGN"
                                autoFocus
                                className="border-destructive/50 focus-visible:ring-destructive"
                            />
                            <div className='flex justify-end gap-2'>
                                <Button variant="ghost" onClick={() => { setIsConfirmingRemoval(false); setConfirmationInput(''); }}>Cancel</Button>
                                <Button 
                                    onClick={handleUnassignUser} 
                                    disabled={confirmationInput.toUpperCase() !== 'UNASSIGN' || isUpdating}
                                    variant="destructive"
                                >
                                    {isUpdating ? <Spinner size="sm" /> : 'Confirm Unassignment'}
                                </Button>
                            </div>
                        </div>
                    ) : !isModifying ? (
                         <div className='flex items-center justify-between'>
                            <p className='text-sm text-muted-foreground'>
                                Assigned to: <span className='font-medium text-foreground'>{currentDealershipNames}</span>
                            </p>
                            <Button variant="outline" onClick={() => setIsModifying(true)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modify
                            </Button>
                         </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Select the dealerships this user should be assigned to. Unselect all to unassign them.</p>
                            <div className="flex items-center gap-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <span className="truncate">
                                                {selectedDealerships.length > 0 ? 
                                                    dealerships.filter(d => selectedDealerships.includes(d.id)).map(d => d.name).join(', ') :
                                                    "Unassigned"}
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-64" align="start">
                                        <DropdownMenuLabel>Managed Dealerships</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {dealerships.map(dealership => (
                                            <DropdownMenuCheckboxItem
                                                key={dealership.id}
                                                checked={selectedDealerships.includes(dealership.id)}
                                                onCheckedChange={(checked) => handleCheckedChange(dealership.id, !!checked)}
                                            >
                                                {dealership.name}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                             <div className='flex justify-between items-center'>
                                <Button variant="destructive" onClick={() => setIsConfirmingRemoval(true)} disabled={isUpdating}>Remove User</Button>
                                <div className='flex gap-2'>
                                    <Button variant="ghost" onClick={() => { setIsModifying(false); setSelectedDealerships(user.dealershipIds); }}>Cancel</Button>
                                    <Button onClick={handleUpdateAssignments} disabled={isUpdating || isEqual([...user.dealershipIds].sort(), [...selectedDealerships].sort())}>
                                        {isUpdating ? <Spinner size="sm" /> : "Update Assignments"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}
    </div>
  );
}
