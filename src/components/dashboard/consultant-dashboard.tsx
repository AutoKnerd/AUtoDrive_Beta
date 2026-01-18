
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait } from '@/lib/definitions';
import { getLessons, getConsultantActivity, getDailyLessonLimits } from '@/lib/data';
import { calculateLevel } from '@/lib/xp';
import { BookOpen, TrendingUp, Check, ArrowUp, Trophy, Spline, Gauge, LucideIcon, CheckCircle, Lock, ChevronRight, Users, Ear, Handshake, Repeat, Target, Smile } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Carousel, CarouselContent, CarouselItem } from '../ui/carousel';
import { Separator } from '../ui/separator';

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
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [fetchedLessons, fetchedActivity, limits] = await Promise.all([
        getLessons('Sales Consultant'),
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

  const otherLessons = useMemo(() => lessons.filter(l => l.lessonId !== recommendedLesson?.lessonId), [lessons, recommendedLesson]);

  const recentActivities = useMemo(() => {
    if (!activity.length) return [];
    
    const activities = activity.slice(0, 4).map(log => {
      const lessonTitle = lessons.find(l => l.lessonId === log.lessonId)?.title || 'a lesson';
      return {
        icon: activityIcons.completed,
        text: `Completed: ${lessonTitle} on ${new Date(log.timestamp).toLocaleDateString()}`
      };
    });

    return activities;
  }, [activity, lessons]);

  return (
    <div className="space-y-8 pb-24 text-gray-300">
        {/* Header */}
        <header className="flex items-center justify-between">
             <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-gray-200 tracking-wide">AutoDrive</h1>
                <p className="text-sm font-light text-gray-400 -mt-1">powered by AutoKnerd</p>
            </div>
            <div className="relative">
                <Avatar className="h-14 w-14 border-2 border-cyan-400/50">
                    <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                 <div className="absolute inset-0 rounded-full border-2 border-cyan-400 blur-md" />
            </div>
        </header>

        {/* Recommended Lesson */}
        <section>
             <div className="bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-cyan-500/10">
                <div className="p-3 bg-slate-900/70 rounded-lg border border-white/10">
                    <SteeringWheelIcon className="h-12 w-12 text-cyan-400 drop-shadow-[0_0_8px_hsl(var(--primary))]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white">Recommended Lesson</h2>
                    <p className="text-sm text-muted-foreground">A daily lesson focused on your area for greatest improvement.</p>
                     {loading ? (
                        <Skeleton className="h-5 w-3/4 mt-2" />
                    ) : lessonLimits.recommendedTaken ? (
                       <p className="text-sm font-medium text-green-400 mt-1 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Completed for today!</p>
                    ) : recommendedLesson ? (
                       <Link href={`/lesson/${recommendedLesson.lessonId}?recommended=true`} className="text-sm font-medium text-cyan-400 hover:text-cyan-300 mt-1 flex items-center gap-1">
                           Start: {recommendedLesson.title} <ChevronRight className="h-4 w-4" />
                       </Link>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-1">No recommended lessons available.</p>
                    )}
                </div>
            </div>
        </section>

        {/* Additional Lessons */}
        <section className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Additional Lessons</h2>
                <button className="text-sm font-semibold text-cyan-400 bg-slate-800/80 border border-cyan-400/30 px-3 py-1 rounded-lg hover:bg-slate-700">View All</button>
            </div>
            {loading ? (
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-28 w-full rounded-xl" />
                    <Skeleton className="h-28 w-full rounded-xl" />
                </div>
            ) : lessonLimits.otherTaken ? (
                <div className="bg-slate-900/50 backdrop-blur-md border border-white/20 rounded-xl p-4 flex items-center gap-3 text-muted-foreground">
                    <Lock className="h-5 w-5" />
                    <p className="font-medium text-sm">You have completed your additional lesson for today.</p>
                </div>
            ) : (
                <Carousel opts={{ align: "start", slidesToScroll: 1 }}>
                    <CarouselContent className="-ml-2">
                        {otherLessons.map((lesson) => {
                            const Icon = lessonIcons[lesson.title] || BookOpen;
                            return (
                                <CarouselItem key={lesson.lessonId} className="basis-[45%] md:basis-1/3 pl-2">
                                     <Link href={`/lesson/${lesson.lessonId}`}>
                                        <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center aspect-square text-center space-y-2 transition-all hover:border-cyan-400/50 hover:-translate-y-1 shadow-md">
                                            <Icon className="h-10 w-10 text-gray-300" strokeWidth={1.5} />
                                            <p className="font-semibold text-sm text-white">{lesson.title}</p>
                                        </div>
                                    </Link>
                                </CarouselItem>
                            );
                        })}
                    </CarouselContent>
                </Carousel>
            )}
        </section>

        {/* Level & XP */}
        <section className="space-y-3">
             {loading ? <Skeleton className="h-20 w-full" /> : <LevelDisplay xp={user.xp} />}
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
