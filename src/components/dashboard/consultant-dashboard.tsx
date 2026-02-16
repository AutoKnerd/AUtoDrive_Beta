
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait, Badge, Dealership } from '@/lib/definitions';
import { getLessons, getConsultantActivity, getDailyLessonLimits, getAssignedLessons, getAllAssignedLessonIds, getEarnedBadgesByUserId, getDealershipById } from '@/lib/data.client';
import { calculateLevel } from '@/lib/xp';
import { BookOpen, TrendingUp, Check, ArrowUp, Trophy, Spline, Gauge, LucideIcon, CheckCircle, Lock, ChevronRight, Users, Ear, Handshake, Repeat, Target, Smile, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { BadgeShowcase } from '../profile/badge-showcase';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { cn } from '@/lib/utils';
import { UserNav } from '../layout/user-nav';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BaselineAssessmentDialog } from './baseline-assessment-dialog';

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
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                <div className="text-right">
                    <p className="text-cyan-400">Total: {user.xp.toLocaleString()} XP</p>
                    <p className="text-muted-foreground">{user.role === 'manager' ? 'Sales Manager' : user.role}</p>
                </div>
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
  const [assignedLessonHistoryIds, setAssignedLessonHistoryIds] = useState<string[]>([]);
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const { isTouring } = useAuth();
  const [showTourWelcome, setShowTourWelcome] = useState(false);
  const [needsBaselineAssessment, setNeedsBaselineAssessment] = useState(false);
  const [showBaselineAssessment, setShowBaselineAssessment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);


  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [fetchedLessons, fetchedActivity, limits, fetchedAssignedLessons, fetchedAssignedHistoryIds, fetchedBadges] = await Promise.all([
        getLessons(user.role, user.userId),
        getConsultantActivity(user.userId),
        getDailyLessonLimits(user.userId),
        getAssignedLessons(user.userId),
        getAllAssignedLessonIds(user.userId),
        getEarnedBadgesByUserId(user.userId),
      ]);
      setLessons(fetchedLessons);
      setActivity(fetchedActivity);
      setLessonLimits(limits);
      setAssignedLessons(fetchedAssignedLessons);
      setAssignedLessonHistoryIds(fetchedAssignedHistoryIds);
      setBadges(fetchedBadges);
      const baselineEligible = !['Owner', 'Trainer', 'Admin', 'Developer'].includes(user.role);
      const hasBaselineLog = fetchedActivity.some(log => String(log.lessonId || '').startsWith('baseline-'));
      const baselineRequired = !isTouring && baselineEligible && !hasBaselineLog;
      setNeedsBaselineAssessment(baselineRequired);
      setShowBaselineAssessment(baselineRequired);
      
      if (user.dealershipIds.length > 0 && !isTouring) {
          const dealershipData = await Promise.all(user.dealershipIds.map(id => getDealershipById(id, user.userId)));
          const activeDealerships = dealershipData.filter(d => d && d.status === 'active');
          if (activeDealerships.length === 0) {
              setIsPaused(true);
          }
      }

      if (user.memberSince) {
        setMemberSince(new Date(user.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      }

      setLoading(false);
    }
    fetchData();
  }, [user, isTouring, refreshKey]);

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
  
  const averageScores = useMemo(() => {
    if (!activity.length) return {
      empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85
    };

    const total = activity.reduce((acc, log) => {
        Object.keys(acc).forEach(key => acc[key as CxTrait] += log[key as CxTrait] || 0);
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

    const assignedLessonIds = new Set(assignedLessonHistoryIds);
    const candidateLessons = lessons.filter(l => !assignedLessonIds.has(l.lessonId));
    const roleSpecificLessons = candidateLessons.filter(l => l.role === user.role);
    const globalLessons = candidateLessons.filter(l => l.role === 'global');

    // Always prioritize lessons targeted to the signed-in role.
    return (
      roleSpecificLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) ||
      roleSpecificLessons[0] ||
      globalLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) ||
      globalLessons[0] ||
      candidateLessons[0] ||
      null
    );
  }, [lessons, assignedLessonHistoryIds, averageScores, user.role]);

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
        <BaselineAssessmentDialog
          user={user}
          open={showBaselineAssessment}
          onOpenChange={setShowBaselineAssessment}
          onCompleted={async () => {
            setShowBaselineAssessment(false);
            setNeedsBaselineAssessment(false);
            setRefreshKey(prev => prev + 1);
          }}
        />
        <Dialog open={showTourWelcome} onOpenChange={handleWelcomeDialogChange}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-2xl">Welcome, {user.role === 'manager' ? 'Sales Manager' : user.role}!</DialogTitle>
                <DialogDescription className="pt-2">
                This is your personal dashboard, your launchpad for success. Here you can track your progress, see your average CX scores, and access daily training.
                <br /><br />
                <strong>Your first step is to take today's "Recommended" lesson.</strong> It's tailored to help you improve your weakest skill. Let's get started!
                </DialogDescription>
            </DialogHeader>
            </DialogContent>
        </Dialog>

        {/* Header */}
        <header className="flex items-center justify-between">
            <Logo variant="full" width={183} height={61} />
            <UserNav user={user} avatarClassName="h-14 w-14 border-2 border-cyan-400/50" withBlur />
        </header>

        {isPaused && (
            <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/50 text-destructive-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertTitle>Account Activity Paused</AlertTitle>
                <AlertDescription>
                    Your dealership's account is currently paused. Access to new lessons is temporarily unavailable. Please contact your manager for more information.
                </AlertDescription>
            </Alert>
        )}

        {/* Level & XP */}
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
        
        {/* Today's Lessons */}
        <section id="lessons" className="space-y-4">
            <h2 className="text-xl font-bold text-white">Today's Lessons</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recommended Lesson Card */}
                {loading ? (
                    <Skeleton className="h-full min-h-[160px] rounded-2xl" />
                ) : (
                    <Card className={cn(
                        "flex flex-col justify-between p-6 bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 shadow-lg shadow-cyan-500/10",
                        isPaused && "opacity-50 pointer-events-none"
                    )}>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <SteeringWheelIcon className="h-8 w-8 text-cyan-400" />
                                <h3 className="text-2xl font-bold text-white">Recommended</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">A daily lesson focused on your area for greatest improvement.</p>
                        </div>
                        {needsBaselineAssessment ? (
                            <div className="grid grid-cols-2 gap-2">
                                {recommendedLesson && !lessonLimits.recommendedTaken ? (
                                    <Link href={`/lesson/${recommendedLesson.lessonId}?recommended=true`} className={cn("w-full", buttonVariants({ className: "w-full font-bold" }))}>
                                        Recommended Lesson
                                    </Link>
                                ) : (
                                    <Button variant="outline" disabled className="w-full bg-slate-800/50 border-slate-700">
                                        {recommendedLesson ? 'Completed for today' : 'No lesson available'}
                                    </Button>
                                )}
                                <Button
                                  className="w-full font-bold bg-[#8DC63F] text-black hover:bg-[#7FB735] shadow-[0_0_20px_rgba(141,198,63,0.35)]"
                                  onClick={() => setShowBaselineAssessment(true)}
                                >
                                    Take Baseline Assessment
                                </Button>
                            </div>
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
                )}
                
                {/* Assigned Lesson Card */}
                {loading ? (
                    <Skeleton className="h-full min-h-[160px] rounded-2xl" />
                ) : (
                    <Card className={cn(
                        "flex flex-col p-6 bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 shadow-lg shadow-cyan-500/10",
                        isPaused && "opacity-50 pointer-events-none"
                    )}>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <BookOpen className="h-8 w-8 text-cyan-400" />
                                <h3 className="text-2xl font-bold text-white">Assigned</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">Lessons assigned to you by your manager.</p>
                        </div>
                        <div className="space-y-2">
                            {assignedLessons.length > 0 ? (
                                assignedLessons.map(lesson => (
                                    <Link
                                      key={lesson.lessonId}
                                      href={`/lesson/${lesson.lessonId}`}
                                      className={cn(
                                        "w-full justify-between text-black hover:text-black",
                                        buttonVariants({
                                          className: "w-full font-normal bg-[#8DC63F] hover:bg-[#7FB735] shadow-[0_0_20px_rgba(141,198,63,0.35)]",
                                        })
                                      )}
                                    >
                                        <span className="truncate">{lesson.title}</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground p-4 rounded-md bg-slate-800/50 border border-slate-700">
                                    No assigned lessons
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </section>

        {/* My Stats */}
        <section id="stats">
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

        {/* My Badges */}
        <section>
             {loading ? (
                <Skeleton className="h-40 w-full rounded-2xl bg-slate-900/50" />
             ) : (
                <BadgeShowcase badges={badges} className="bg-slate-900/50 backdrop-blur-md border border-cyan-400/30" />
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

        <p className="pt-4 text-center text-xs text-muted-foreground">
            *XP is earned based on the quality of the interaction during lessons.
        </p>
    </div>
  );
}
