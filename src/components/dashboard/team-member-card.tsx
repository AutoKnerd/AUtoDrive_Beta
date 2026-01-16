'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait, LessonRole } from '@/lib/definitions';
import { getLessons, getConsultantActivity } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface TeamMemberCardProps {
  user: User;
}

const metricIcons: Record<CxTrait, LucideIcon> = {
  empathy: Smile,
  listening: Ear,
  trust: Handshake,
  followUp: Repeat,
  closing: Target,
  relationshipBuilding: Users,
};

export function TeamMemberCard({ user }: TeamMemberCardProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [loading, setLoading] = useState(true);

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
                    <CardDescription>{user.role} at {user.dealershipId}</CardDescription>
                </div>
            </CardHeader>
        </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Average CX Scores</CardTitle>
          <CardDescription>Average performance across all completed lessons.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : Object.keys(averageScores).length > 0 && averageScores.empathy > 0 ? (
            Object.entries(averageScores).map(([key, value]) => {
              const Icon = metricIcons[key as keyof typeof metricIcons];
              const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return (
                <div key={key} className="flex flex-col items-center justify-center space-y-2 rounded-lg border p-4">
                  <Icon className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">{title}</span>
                  <span className="text-2xl font-bold">{value}%</span>
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
