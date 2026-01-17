
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait, LessonRole, Dealership } from '@/lib/definitions';
import { getLessons, getConsultantActivity, updateUserDealerships } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';


interface TeamMemberCardProps {
  user: User;
  currentUser: User;
  dealerships: Dealership[];
  onAssignment: () => void;
}

const metricIcons: Record<CxTrait, LucideIcon> = {
  empathy: Smile,
  listening: Ear,
  trust: Handshake,
  followUp: Repeat,
  closing: Target,
  relationshipBuilding: Users,
};

export function TeamMemberCard({ user, currentUser, dealerships, onAssignment }: TeamMemberCardProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedDealerships, setSelectedDealerships] = useState(user.dealershipIds);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (!user) return;
      const [fetchedLessons, fetchedActivity] = await Promise.all([
        getLessons(user.role as LessonRole),
        getConsultantActivity(user.userId),
      ]);
      setLessons(fetchedLessons);
      setActivity(fetchedActivity);
      setLoading(false);
    }
    fetchData();
  }, [user]);
  
  const currentDealershipNames = useMemo(() => {
    return user.dealershipIds
        .map(id => dealerships.find(d => d.id === id)?.name)
        .filter(Boolean)
        .join(', ');
  }, [dealerships, user.dealershipIds]);

  async function handleAssignDealerships() {
    setIsAssigning(true);
    try {
        await updateUserDealerships(user.userId, selectedDealerships);
        toast({
            title: 'Success',
            description: `${user.name} has been assigned to new dealerships.`,
        });
        onAssignment(); // This will trigger a re-fetch in the parent
    } catch(e) {
        toast({
            variant: 'destructive',
            title: 'Assignment Failed',
            description: (e as Error).message || 'An error occurred.',
        });
    } finally {
        setIsAssigning(false);
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

  const recentActivity = useMemo(() => {
    if (!activity.length) return null;
    return activity[0];
  }, [activity]);
  
  const averageScores = useMemo(() => {
    if (!activity.length) return {
      empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0
    };

    const total = activity.reduce((acc, log) => {
        acc.empathy += log.empathy;
        acc.listening += log.listening;
        acc.trust += log.trust;
        acc.followUp += log.followUp;
        acc.closing += log.closing;
        acc.relationshipBuilding += log.relationshipBuilding;
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
  
  const canAssign = ['Owner', 'Admin', 'Trainer'].includes(currentUser.role) && ['manager', 'Service Manager', 'Parts Manager', 'Finance Manager'].includes(user.role)

  return (
    <div className="space-y-4">
        <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                 <Avatar className="h-16 w-16">
                    <AvatarImage src={user.avatarUrl} data-ai-hint="person portrait" />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-2xl">{user.name}</CardTitle>
                    <CardDescription>{user.role} at {currentDealershipNames}</CardDescription>
                </div>
            </CardHeader>
        </Card>

        {canAssign && (
            <Card>
                <CardHeader>
                    <CardTitle>Assign Dealerships</CardTitle>
                    <CardDescription>Assign this manager to one or more dealerships.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <span className="truncate">
                                    {selectedDealerships.length > 0 ? 
                                        dealerships.filter(d => selectedDealerships.includes(d.id)).map(d => d.name).join(', ') :
                                        "Select dealerships..."}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="start">
                            <DropdownMenuLabel>Dealerships</DropdownMenuLabel>
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
                    <Button onClick={handleAssignDealerships} disabled={isAssigning || isEqual([...user.dealershipIds].sort(), [...selectedDealerships].sort())}>
                        {isAssigning ? <Spinner size="sm" /> : "Assign"}
                    </Button>
                </CardContent>
            </Card>
        )}
      
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
            ) : recentActivity ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-primary">{lessons.find(l => l.lessonId === recentActivity.lessonId)?.title || 'Unknown Lesson'}</p>
                <p className="text-sm text-muted-foreground">
                  Completed on {new Date(recentActivity.timestamp).toLocaleDateString()}
                </p>
                <p className="text-2xl font-bold text-accent">+{recentActivity.xpGained} XP</p>
              </div>
            ) : (
              <p className="text-muted-foreground">No recent activity found.</p>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
