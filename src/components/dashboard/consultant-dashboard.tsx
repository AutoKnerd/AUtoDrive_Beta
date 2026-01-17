
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait } from '@/lib/definitions';
import { getLessons, getConsultantActivity, getDailyLessonLimits } from '@/lib/data';
import { calculateLevel } from '@/lib/xp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, TrendingUp, Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon, Trophy, CheckCircle, Lock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';

interface ConsultantDashboardProps {
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

function LevelDisplay({ xp }: { xp: number }) {
    const { level, levelXp, nextLevelXp, progress } = calculateLevel(xp);

    if (level >= 100) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-400" />
                        Level 100 - Master
                    </CardTitle>
                    <CardDescription>You have reached the pinnacle of sales excellence!</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="font-bold text-primary">Congratulations!</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Level {level}</CardTitle>
                <CardDescription>Your progress to the next level.</CardDescription>
            </CardHeader>
            <CardContent>
                <Progress value={progress} className="mb-2 h-3" />
                <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                    <span className="font-bold text-primary">Total: {xp.toLocaleString()} XP</span>
                </div>
            </CardContent>
        </Card>
    );
}

export function ConsultantDashboard({ user }: ConsultantDashboardProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [fetchedLessons, fetchedActivity, limits] = await Promise.all([
        getLessons('consultant'),
        getConsultantActivity(user.userId),
        getDailyLessonLimits(user.userId),
      ]);
      setLessons(fetchedLessons);
      setActivity(fetchedActivity);
      setLessonLimits(limits);
      setLoading(false);
    }
    fetchData();
  }, [user.userId]);

  const recentActivity = useMemo(() => {
    if (!activity.length) return null;
    return activity[0];
  }, [activity]);
  
  const averageScores = useMemo(() => {
    if (!activity.length) return {
      empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85
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

  const recommendedLesson = useMemo(() => {
    if (lessons.length === 0) return null;

    const lowestScoringTrait = Object.entries(averageScores).reduce((lowest, [trait, score]) => {
        if (score < lowest.score) {
            return { trait: trait as CxTrait, score };
        }
        return lowest;
    }, { trait: 'empathy' as CxTrait, score: 101 });

    const lesson = lessons.find(l => l.associatedTrait === lowestScoringTrait.trait);

    return lesson || lessons[0];
  }, [lessons, averageScores]);

  const otherLessons = useMemo(() => {
      return lessons.filter(l => l.lessonId !== recommendedLesson?.lessonId);
  }, [lessons, recommendedLesson]);


  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    AutoDrive Recommended Lesson
                    </CardTitle>
                    <CardDescription>A daily lesson focused on your area for greatest improvement.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                    <Skeleton className="h-16 w-full" />
                    ) : lessonLimits.recommendedTaken ? (
                        <div className="flex items-center gap-3 rounded-lg border p-3 text-muted-foreground bg-muted/50">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <div>
                                <p className="font-medium">Completed for today!</p>
                                <p className="text-sm">Come back tomorrow for a new recommended lesson.</p>
                            </div>
                        </div>
                    ) : recommendedLesson ? (
                    <Link href={`/lesson/${recommendedLesson.lessonId}?recommended=true`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">{recommendedLesson.title}</p>
                            <p className="text-sm text-muted-foreground">Focus on your weakest skill: <span className="font-semibold capitalize">{recommendedLesson.associatedTrait.replace(/([A-Z])/g, ' $1')}</span></p>
                        </div>
                        <Badge variant="secondary">{recommendedLesson.category}</Badge>
                        </div>
                    </Link>
                    ) : (
                    <p className="text-muted-foreground">No recommended lessons available.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Additional Lessons
                    </CardTitle>
                    <CardDescription>Choose one additional lesson to complete per day.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                     {loading ? (
                        <>
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </>
                    ) : lessonLimits.otherTaken ? (
                        <div className="flex items-center gap-3 rounded-lg border p-3 text-muted-foreground bg-muted/50">
                            <Lock className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Daily Limit Reached</p>
                                <p className="text-sm">You have completed your additional lesson for today.</p>
                            </div>
                        </div>
                    ) : otherLessons.length > 0 ? (
                        otherLessons.map(lesson => (
                             <Link key={lesson.lessonId} href={`/lesson/${lesson.lessonId}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium">{lesson.title}</p>
                                    <Badge variant="outline">{lesson.category}</Badge>
                                </div>
                            </Link>
                        ))
                    ): (
                        <p className="text-muted-foreground">No other lessons available.</p>
                    )}
                </CardContent>
            </Card>

        </div>
        <div className="space-y-4">
            {loading || !user ? <Skeleton className="h-48 w-full" /> : <LevelDisplay xp={user.xp} />}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Recent Activity
                    </CardTitle>
                    <CardDescription>Your performance from the last completed lesson.</CardDescription>
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
                        <p className="text-lg font-semibold text-primary">{lessons.find(l => l.lessonId === recentActivity.lessonId)?.title}</p>

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
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Your Average Scores</CardTitle>
          <CardDescription>Your average performance across all completed lessons.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
          ) : (
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
          )}
        </CardContent>
      </Card>
    </>
  );
}
