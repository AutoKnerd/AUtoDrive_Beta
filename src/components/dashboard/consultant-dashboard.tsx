
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Lesson, LessonLog, CxTrait } from '@/lib/definitions';
import { getLessons, getConsultantActivity, getDailyLessonLimits, getAssignedLessons } from '@/lib/data';
import { calculateLevel } from '@/lib/xp';
import { BookOpen, TrendingUp, Check, ArrowUp, Trophy, Spline, Gauge, LucideIcon, CheckCircle, Lock, ChevronRight, Users, Ear, Handshake, Repeat, Target, Smile, LogOut, User as UserIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConsultantDashboardProps {
  user: User;
}

const SteeringWheelIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 14v5" />
        <path d="m10.5 10.5-4.24-4.24" />
        <path d="m13.5 10.5 4.24-4.24" />
    </svg>
);


const lessonIcons: Record<string, LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>> = {
  'Advanced Cornering': Spline,
  'Efficient Driving': Gauge,
  'Advanced Hopping': SteeringWheelIcon,
  'Building Rapport on the Lot': Users,
  'Uncovering Customer Needs': Ear,
  'Handling Price Objections': Handshake,
  'Confident Closing': Target,
  'Service Follow-up Excellence': Repeat,
  'The Perfect Service Greeting': Smile,
};

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

const activityIcons: Record<string, LucideIcon> = {
    'completed': Check,
    'achievement': Trophy,
    'levelup': ArrowUp,
}

const RecentActivityItem = ({ icon, text }: { icon: LucideIcon, text: string }) => {
    const Icon = icon;
    return (
        <div className="flex items-center gap-4 py-3">
            <Icon className="h-5 w-5 text-cyan-400" />
            <div className="flex-1">
                <p className="text-sm text-foreground">{text}</p>
            </div>
        </div>
    );
};


export function ConsultantDashboard({ user }: ConsultantDashboardProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [assignedLessons, setAssignedLessons] = useState<Lesson[]>([]);
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const router = useRouter();


  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [fetchedLessons, fetchedActivity, limits, fetchedAssignedLessons] = await Promise.all([
        getLessons(user.role),
        getConsultantActivity(user.userId),
        getDailyLessonLimits(user.userId),
        getAssignedLessons(user.userId),
      ]);
      setLessons(fetchedLessons);
      setActivity(fetchedActivity);
      setLessonLimits(limits);
      setAssignedLessons(fetchedAssignedLessons);
      setLoading(false);
    }
    fetchData();
  }, [user.userId, user.role]);
  
  const averageScores = useMemo(() => {
    if (!activity.length) return {
      empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85
    };

    const total = activity.reduce((acc, log) => {
        Object.keys(acc).forEach(key => acc[key as CxTrait] += log[key as CxTrait]);
        return acc;
    }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

    const count = activity.length;
    return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Math.round(value / count)])) as typeof total;
  }, [activity]);

  const recommendedLesson = useMemo(() => {
    if (lessons.length === 0) return null;
    const lowestScoringTrait = Object.entries(averageScores).reduce((lowest, [trait, score]) => 
        score < lowest.score ? { trait: trait as CxTrait, score } : lowest, { trait: 'empathy' as CxTrait, score: 101 }
    );
    return lessons.find(l => l.associatedTrait === lowestScoringTrait.trait) || lessons[0];
  }, [lessons, averageScores]);

  const recentActivities = useMemo(() => {
    if (!activity || !user) return [];

    const allLessons = [...lessons, ...assignedLessons];
    const combinedActivities: { type: string; timestamp: Date; text: string }[] = [];
    let currentXp = user.xp;

    // The activity is sorted from newest to oldest. We'll iterate backwards.
    for (const log of activity) {
        const xpAfter = currentXp;
        const levelAfter = calculateLevel(xpAfter).level;
        
        const xpBefore = xpAfter - log.xpGained;
        const levelBefore = calculateLevel(xpBefore).level;

        // Add the lesson completion activity
        const lessonTitle = allLessons.find(l => l.lessonId === log.lessonId)?.title || 'a lesson';
        combinedActivities.push({
            type: 'completed',
            timestamp: new Date(log.timestamp),
            text: `Completed "${lessonTitle}" and earned ${log.xpGained} XP.`
        });

        // Check if a level up occurred after this lesson
        if (levelAfter > levelBefore) {
            combinedActivities.push({
                type: 'levelup',
                // Place level-up event slightly after the lesson for correct sorting
                timestamp: new Date(new Date(log.timestamp).getTime() + 1),
                text: `Congratulations! You've reached Level ${levelAfter}!`
            });
        }
        
        currentXp = xpBefore;
    }

    // Sort all generated activities by timestamp (newest first) and take the top 4
    return combinedActivities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 4)
        .map(act => ({
            icon: activityIcons[act.type],
            text: act.text
        }));
  }, [activity, lessons, assignedLessons, user]);

  return (
    <div className="space-y-8 pb-24 text-gray-300">
        {/* Header */}
        <header className="flex items-center justify-between">
             <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-gray-200 tracking-wide">AutoDrive</h1>
                <p className="text-sm font-light text-gray-400 -mt-1">powered by AutoKnerd</p>
            </div>
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

        {/* Level & XP */}
        <section className="space-y-3">
             {loading ? <Skeleton className="h-20 w-full" /> : <LevelDisplay xp={user.xp} />}
        </section>

        {/* My Stats */}
        <section>
            <Card className="bg-slate-900/50 backdrop-blur-md border border-cyan-400/30">
                <CardHeader>
                <CardTitle>My Average CX Scores</CardTitle>
                <CardDescription>Your average performance across all completed lessons.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                ) : averageScores ? (
                    Object.entries(averageScores).map(([key, value]) => {
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
        </section>

        {/* Recommended Lesson */}
        <section>
            {loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
            ) : recommendedLesson && !lessonLimits.recommendedTaken ? (
                <Link href={`/lesson/${recommendedLesson.lessonId}?recommended=true`} className="block group">
                    <div className="bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-cyan-500/10 transition-all group-hover:border-cyan-400/80 group-hover:bg-slate-900/70">
                        <div className="p-3 bg-slate-900/70 rounded-lg border border-white/10">
                            <SteeringWheelIcon className="h-12 w-12 text-cyan-400 drop-shadow-[0_0_8px_hsl(var(--primary))]" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white">Recommended Lesson</h2>
                            <p className="text-sm text-muted-foreground">A daily lesson focused on your area for greatest improvement.</p>
                            <div className="text-sm font-medium text-cyan-400 mt-1 flex items-center gap-1 transition-colors group-hover:text-cyan-300">
                               Start: {recommendedLesson.title} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                           </div>
                        </div>
                    </div>
                </Link>
            ) : (
                <div className="bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-cyan-500/10 opacity-70 cursor-not-allowed">
                    <div className="p-3 bg-slate-900/70 rounded-lg border border-white/10">
                        <SteeringWheelIcon className="h-12 w-12 text-cyan-400" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white">Recommended Lesson</h2>
                        <p className="text-sm text-muted-foreground">A daily lesson focused on your area for greatest improvement.</p>
                        {lessonLimits.recommendedTaken ? (
                           <p className="text-sm font-medium text-green-400 mt-1 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Completed for today!</p>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-1">No recommended lessons available.</p>
                        )}
                    </div>
                </div>
            )}
        </section>

        {/* Assigned Lessons */}
        <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">Assigned Lessons</h2>
            {loading ? (
                <Skeleton className="h-28 w-full rounded-xl" />
            ) : assignedLessons.length > 0 ? (
                <div className="space-y-4">
                    {assignedLessons.map((lesson) => {
                         const Icon = lessonIcons[lesson.title] || BookOpen;
                         return (
                            <Link key={lesson.lessonId} href={`/lesson/${lesson.lessonId}`} className="block group">
                                <div className="bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-cyan-500/10 transition-all group-hover:border-cyan-400/80 group-hover:bg-slate-900/70">
                                    <div className="p-3 bg-slate-900/70 rounded-lg border border-white/10">
                                        <Icon className="h-12 w-12 text-cyan-400 drop-shadow-[0_0_8px_hsl(var(--primary))]" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white">{lesson.title}</h3>
                                        <p className="text-sm text-muted-foreground">{lesson.category}</p>
                                        <div className="text-sm font-medium text-cyan-400 mt-1 flex items-center gap-1 transition-colors group-hover:text-cyan-300">
                                            Start Lesson <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                         );
                    })}
                </div>
            ) : (
                <div className="bg-slate-900/50 backdrop-blur-md border border-white/20 rounded-xl p-4 flex items-center justify-center gap-3 text-muted-foreground">
                    <p className="font-medium text-sm text-center">You have no lessons assigned by your manager.</p>
                </div>
            )}
        </section>

        {/* Recent Activity */}
        <section className="space-y-2">
            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
             {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : recentActivities.length > 0 ? (
                <div className="px-2 divide-y divide-slate-700/80">
                   {recentActivities.map((item, index) => (
                       <RecentActivityItem key={index} icon={item.icon} text={item.text} />
                   ))}
                </div>
            ) : (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/80 rounded-xl p-4 text-center text-muted-foreground text-sm">
                    No recent activity to show.
                </div>
            )}
        </section>
    </div>
  );
}
