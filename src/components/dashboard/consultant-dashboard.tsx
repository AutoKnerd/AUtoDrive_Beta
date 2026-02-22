'use client';

import { useState, useEffect, useMemo } from 'react';
import { isToday } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { User, Lesson, LessonLog, CxTrait, Badge, Dealership, LessonRole, ThemePreference } from '@/lib/definitions';
import {
  getLessons,
  getConsultantActivity,
  getDailyLessonLimits,
  getAssignedLessons,
  getAllAssignedLessonIds,
  getEarnedBadgesByUserId,
  getDealershipById,
  createUniqueRecommendedTestingLesson,
  ensureDailyRecommendedLesson,
} from '@/lib/data.client';
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
import { useToast } from '@/hooks/use-toast';
import { CxSoundwaveCard, type CxRange } from '@/components/cx/CxSoundwaveCard';
import { getDefaultScope } from '@/lib/cx/scope';

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

const dashboardFeatureCardClass =
  'border border-border bg-card/95 shadow-sm dark:border-cyan-400/30 dark:bg-slate-900/50 dark:backdrop-blur-md dark:shadow-lg dark:shadow-cyan-500/10';
const dashboardDisabledButtonClass =
  'w-full border-border bg-muted/70 text-muted-foreground dark:border-slate-700 dark:bg-slate-800/50';

function normalizeScore(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

type CxScoreSnapshot = Record<CxTrait, number>;

const DEFAULT_CX_SCORES: CxScoreSnapshot = {
  empathy: 75,
  listening: 62,
  trust: 80,
  followUp: 70,
  closing: 68,
  relationshipBuilding: 85,
};

function scoreSnapshotFromUserStats(user: User): CxScoreSnapshot | null {
  const stats = user.stats;
  if (!stats) return null;

  const empathy = normalizeScore(stats.empathy?.score);
  const listening = normalizeScore(stats.listening?.score);
  const trust = normalizeScore(stats.trust?.score);
  const followUp = normalizeScore(stats.followUp?.score);
  const closing = normalizeScore(stats.closing?.score);
  const relationshipBuilding = normalizeScore(stats.relationship?.score);

  if (
    empathy === null ||
    listening === null ||
    trust === null ||
    followUp === null ||
    closing === null ||
    relationshipBuilding === null
  ) {
    return null;
  }

  return {
    empathy,
    listening,
    trust,
    followUp,
    closing,
    relationshipBuilding,
  };
}

function scoreSnapshotFromActivity(logs: LessonLog[]): CxScoreSnapshot {
  if (!logs.length) return DEFAULT_CX_SCORES;

  const totals = logs.reduce((acc, log) => {
    acc.empathy += log.empathy || 0;
    acc.listening += log.listening || 0;
    acc.trust += log.trust || 0;
    acc.followUp += log.followUp || 0;
    acc.closing += log.closing || 0;
    acc.relationshipBuilding += log.relationshipBuilding || 0;
    return acc;
  }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

  const count = logs.length;
  return {
    empathy: Math.round(totals.empathy / count),
    listening: Math.round(totals.listening / count),
    trust: Math.round(totals.trust / count),
    followUp: Math.round(totals.followUp / count),
    closing: Math.round(totals.closing / count),
    relationshipBuilding: Math.round(totals.relationshipBuilding / count),
  };
}

function lowestTraitFromSnapshot(snapshot: CxScoreSnapshot): CxTrait {
  return Object.entries(snapshot).reduce((lowest, [trait, score]) => (
    score < lowest.score ? { trait: trait as CxTrait, score } : lowest
  ), { trait: 'empathy' as CxTrait, score: Number.POSITIVE_INFINITY }).trait;
}

type LessonRatingKey = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';

const lessonRatingLabels: Record<LessonRatingKey, string> = {
  empathy: 'Empathy',
  listening: 'Listening',
  trust: 'Trust',
  followUp: 'Follow Up',
  closing: 'Closing',
  relationship: 'Relationship',
};

function extractLessonRatings(log: LessonLog): Record<LessonRatingKey, number> {
  const fallback = {
    empathy: log.empathy,
    listening: log.listening,
    trust: log.trust,
    followUp: log.followUp,
    closing: log.closing,
    relationship: log.relationshipBuilding,
  };

  const source = log.ratings
    ? {
        empathy: log.ratings.empathy,
        listening: log.ratings.listening,
        trust: log.ratings.trust,
        followUp: log.ratings.followUp,
        closing: log.ratings.closing,
        relationship: log.ratings.relationship,
      }
    : fallback;

  return {
    empathy: Math.max(0, Math.min(100, Math.round(source.empathy))),
    listening: Math.max(0, Math.min(100, Math.round(source.listening))),
    trust: Math.max(0, Math.min(100, Math.round(source.trust))),
    followUp: Math.max(0, Math.min(100, Math.round(source.followUp))),
    closing: Math.max(0, Math.min(100, Math.round(source.closing))),
    relationship: Math.max(0, Math.min(100, Math.round(source.relationship))),
  };
}

function buildLessonActivityNote(log: LessonLog): string {
  const ratings = extractLessonRatings(log);
  const entries = Object.entries(ratings) as [LessonRatingKey, number][];

  const highestScore = Math.max(...entries.map(([, value]) => value));
  const lowestScore = Math.min(...entries.map(([, value]) => value));

  const strengths = entries
    .filter(([, value]) => value === highestScore)
    .map(([key]) => lessonRatingLabels[key])
    .join(', ');
  const improvements = entries
    .filter(([, value]) => value === lowestScore)
    .map(([key]) => lessonRatingLabels[key])
    .join(', ');

  const formatDelta = (value: number): string => {
    const rounded = Math.round(value);
    const sign = rounded >= 0 ? '+' : '';
    return `${sign}${rounded}`;
  };

  const deltaLine = log.scoreDelta
    ? `CX Delta: E${formatDelta(log.scoreDelta.empathy)}, L${formatDelta(log.scoreDelta.listening)}, T${formatDelta(log.scoreDelta.trust)}, F${formatDelta(log.scoreDelta.followUp)}, C${formatDelta(log.scoreDelta.closing)}, R${formatDelta(log.scoreDelta.relationshipBuilding)}`
    : `CX Delta: unavailable (run another lesson to populate deltas).`;
  const focusLine = `Went well: ${strengths} (${highestScore}). Improve: ${improvements} (${lowestScore}).`;
  const summary = log.coachSummary
    ? (log.coachSummary.length > 160 ? `${log.coachSummary.slice(0, 157)}...` : log.coachSummary)
    : '';
  const summaryLine = summary ? `Coach: ${summary}` : '';
  const violationLine = log.severity === 'behavior_violation'
    ? 'Behavior violation was flagged; penalty rules were applied.'
    : '';

  return [deltaLine, focusLine, summaryLine, violationLine].filter(Boolean).join(' ');
}

function LevelDisplay({ user }: { user: User }) {
    const { level, levelXp, nextLevelXp, progress } = calculateLevel(user.xp);

    if (level >= 100) {
        return (
             <div className="space-y-2">
                <p className="text-2xl font-bold">Level 100 - Master</p>
                <p className="text-sm text-primary">You have reached the pinnacle of sales excellence!</p>
            </div>
        )
    }

    return (
        <div className="w-full space-y-2">
            <div className="flex items-baseline gap-4">
                <p className="text-3xl font-bold text-foreground">Level {level}</p>
                <Progress
                  value={progress}
                  className="h-4 border border-border bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:[&>div]:from-cyan-400"
                />
            </div>
            <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</span>
                <div className="text-right">
                    <p className="text-primary">Total: {user.xp.toLocaleString()} XP</p>
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

const RecentActivityItem = ({ icon, text, note }: { icon: LucideIcon, text: string, note?: string }) => {
    const Icon = icon;
    return (
        <div className="flex items-center gap-4 py-3">
            <Icon className="h-5 w-5 text-primary" />
            <div className="flex-1">
                <p className="text-sm text-foreground">{text}</p>
                {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
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
  const [canRetakeRecommendedTesting, setCanRetakeRecommendedTesting] = useState(false);
  const [canUseNewRecommendedTesting, setCanUseNewRecommendedTesting] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const { isTouring, setUser } = useAuth();
  const [showTourWelcome, setShowTourWelcome] = useState(false);
  const [needsBaselineAssessment, setNeedsBaselineAssessment] = useState(false);
  const [showBaselineAssessment, setShowBaselineAssessment] = useState(false);
  const [creatingUniqueTestingLesson, setCreatingUniqueTestingLesson] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('personal');
  const [range, setRange] = useState<CxRange>('today');
  const router = useRouter();
  const { toast } = useToast();
  
  const scopedDealershipIds = useMemo(() => {
    const ids = [...(user.dealershipIds ?? [])];
    if (user.selfDeclaredDealershipId) {
      ids.push(user.selfDeclaredDealershipId);
    }
    return Array.from(new Set(ids));
  }, [user.dealershipIds, user.selfDeclaredDealershipId]);

  const themePreference = user.themePreference || (user.useProfessionalTheme ? 'executive' : 'vibrant');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const lessonRole: LessonRole = user.role === 'Owner' || user.role === 'Admin' ? 'global' : user.role;
      const [fetchedLessons, fetchedActivity, limits, fetchedAssignedLessons, fetchedAssignedHistoryIds, fetchedBadges] = await Promise.all([
        getLessons(lessonRole, user.userId),
        getConsultantActivity(user.userId),
        getDailyLessonLimits(user.userId),
        getAssignedLessons(user.userId),
        getAllAssignedLessonIds(user.userId),
        getEarnedBadgesByUserId(user.userId),
      ]);
      const baselineEligible = !['Owner', 'Trainer', 'Admin', 'Developer'].includes(user.role);

      const lowestTrait = lowestTraitFromSnapshot(
        scoreSnapshotFromUserStats(user) ?? scoreSnapshotFromActivity(fetchedActivity)
      );

      let lessonsForSelection = fetchedLessons;
      if (baselineEligible && lessonRole !== 'global') {
        const autoLesson = await ensureDailyRecommendedLesson(lessonRole, lowestTrait, user.userId);
        if (autoLesson && !lessonsForSelection.some(l => l.lessonId === autoLesson.lessonId)) {
          lessonsForSelection = [autoLesson, ...lessonsForSelection];
        }
      }

      setLessons(lessonsForSelection);
      setActivity(fetchedActivity);
      setLessonLimits(limits);
      setAssignedLessons(fetchedAssignedLessons);
      setAssignedLessonHistoryIds(fetchedAssignedHistoryIds);
      setBadges(fetchedBadges);
      const hasBaselineLog = fetchedActivity.some(log => String(log.lessonId || '').startsWith('baseline-'));
      const baselineRequired = !isTouring && baselineEligible && !hasBaselineLog;
      setNeedsBaselineAssessment(baselineRequired);
      setShowBaselineAssessment(baselineRequired);
      
      if (scopedDealershipIds.length > 0 && !isTouring) {
          const dealershipData = await Promise.all(scopedDealershipIds.map(id => getDealershipById(id, user.userId)));
          const activeDealerships = dealershipData.filter(d => d && d.status === 'active');
          const hasRetakeTestingAccess = dealershipData.some(d => d?.enableRetakeRecommendedTesting === true);
          const hasNewRecommendedTestingAccess = dealershipData.some(d => d?.enableNewRecommendedTesting === true);
          setCanRetakeRecommendedTesting(hasRetakeTestingAccess);
          setCanUseNewRecommendedTesting(hasNewRecommendedTestingAccess);
          if (activeDealerships.length === 0) {
              setIsPaused(true);
          } else {
              setIsPaused(false);
          }
      } else {
          setCanRetakeRecommendedTesting(false);
          setCanUseNewRecommendedTesting(false);
          setIsPaused(false);
      }

      if (user.memberSince) {
        setMemberSince(new Date(user.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      }

      setLoading(false);
    }
    fetchData();
  }, [user, isTouring, refreshKey, scopedDealershipIds]);

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
    const stats = user.stats;
    if (stats) {
      const empathy = normalizeScore(stats.empathy?.score);
      const listening = normalizeScore(stats.listening?.score);
      const trust = normalizeScore(stats.trust?.score);
      const followUp = normalizeScore(stats.followUp?.score);
      const closing = normalizeScore(stats.closing?.score);
      const relationshipBuilding = normalizeScore(stats.relationship?.score);

      if ([empathy, listening, trust, followUp, closing, relationshipBuilding].every(v => v !== null)) {
        return {
          empathy: empathy!,
          listening: listening!,
          trust: trust!,
          followUp: followUp!,
          closing: closing!,
          relationshipBuilding: relationshipBuilding!,
        };
      }
    }

    if (!activity.length) return DEFAULT_CX_SCORES;

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
    return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Math.round(value / count)])) as any;
  }, [activity, user.stats]);

  const recommendedLessonQueue = useMemo(() => {
    if (lessons.length === 0) return null;
    const lowestScoringTrait = Object.entries(averageScores).reduce((lowest, [trait, score]) => 
        (score as number) < lowest.score ? { trait: trait as CxTrait, score: score as number } : lowest, { trait: 'empathy' as CxTrait, score: 101 }
    );

    const assignedLessonIds = new Set(assignedLessonHistoryIds);
    const completedRecommendedIds = new Set(
      activity.filter(log => log.isRecommended).map(log => log.lessonId)
    );
    const candidateLessons = lessons.filter((lesson) => (
      !assignedLessonIds.has(lesson.lessonId) &&
      lesson.associatedTrait === lowestScoringTrait.trait
    ));
    const roleSpecificLessons = candidateLessons.filter(l => l.role === user.role);
    const globalLessons = candidateLessons.filter(l => l.role === 'global');
    const roleSpecificUnseen = roleSpecificLessons.filter(l => !completedRecommendedIds.has(l.lessonId));
    const globalUnseen = globalLessons.filter(l => !completedRecommendedIds.has(l.lessonId));

    const prioritized = [
      ...roleSpecificUnseen,
      ...globalUnseen,
      ...roleSpecificLessons,
      ...globalLessons,
    ];

    const dedupedById = prioritized.filter((lesson, index, all) => (
      all.findIndex(other => other.lessonId === lesson.lessonId) === index
    ));

    return dedupedById;
  }, [lessons, assignedLessonHistoryIds, averageScores, user.role, activity]);

  const availableRecommendedLesson = recommendedLessonQueue?.[0] ?? null;
  const todayRecommendedLessonId = activity.find(log => log.isRecommended && isToday(log.timestamp))?.lessonId ?? null;
  const todayRecommendedLesson = todayRecommendedLessonId
    ? lessons.find(lesson => lesson.lessonId === todayRecommendedLessonId) ?? null
    : null;
  const retakeTestingLesson = todayRecommendedLesson ?? availableRecommendedLesson;

  const lowestScoringTrait = useMemo(() => {
    return Object.entries(averageScores).reduce((lowest, [trait, score]) => (
      (score as number) < lowest.score ? { trait: trait as CxTrait, score: score as number } : lowest
    ), { trait: 'empathy' as CxTrait, score: Number.POSITIVE_INFINITY }).trait;
  }, [averageScores]);

  const handleCreateUniqueRecommendedTestingLesson = async () => {
    if (creatingUniqueTestingLesson) return;
    const lessonRole: LessonRole = user.role === 'Owner' || user.role === 'Admin' ? 'global' : user.role;
    if (lessonRole === 'global') {
      toast({ variant: 'destructive', title: 'Unavailable', description: 'Unique recommended testing is not available for this role.' });
      return;
    }

    setCreatingUniqueTestingLesson(true);
    try {
      const lesson = await createUniqueRecommendedTestingLesson(lessonRole, lowestScoringTrait, user.userId);
      if (!lesson) throw new Error('Could not generate a unique lesson.');
      setLessons(prev => (prev.some(existing => existing.lessonId === lesson.lessonId) ? prev : [lesson, ...prev]));
      router.push(`/lesson/${lesson.lessonId}?recommended=true&new=testing`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not create lesson', description: error?.message || 'Please try again.' });
    } finally {
      setCreatingUniqueTestingLesson(false);
    }
  };

  const showTestingControls = !needsBaselineAssessment && (canRetakeRecommendedTesting || canUseNewRecommendedTesting);

  const recentActivities = useMemo(() => {
    if (!activity || !user) return [];
    const allLessons = [...lessons, ...assignedLessons];
    const combinedActivities: { type: string; timestamp: Date; text: string; note?: string }[] = [];
    let currentXp = user.xp;

    for (const log of activity) {
        const xpAfter = currentXp;
        const levelAfter = calculateLevel(xpAfter).level;
        const xpBefore = xpAfter - log.xpGained;
        const levelBefore = calculateLevel(xpBefore).level;

        const lessonTitle = allLessons.find(l => l.lessonId === log.lessonId)?.title || 'a lesson';
        combinedActivities.push({
            type: 'completed',
            timestamp: new Date(log.timestamp),
            text: `Completed "${lessonTitle}" and earned ${log.xpGained} XP.`,
            note: buildLessonActivityNote(log),
        });

        if (levelAfter > levelBefore) {
            combinedActivities.push({
                type: 'levelup',
                timestamp: new Date(new Date(log.timestamp).getTime() + 1),
                text: `Congratulations! You've reached Level ${levelAfter}!`
            });
        }
        currentXp = xpBefore;
    }

    return combinedActivities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 4)
        .map(act => ({ icon: activityIcons[act.type], text: act.text, note: act.note }));
  }, [activity, lessons, assignedLessons, user]);

  return (
    <div className="space-y-8 pb-24 text-foreground">
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
            <UserNav user={user} avatarClassName="h-14 w-14 border-2 border-primary/50" withBlur />
        </header>

        {/* Control Bar */}
        <div className="flex items-center justify-center bg-card/50 backdrop-blur-sm border rounded-xl p-2 gap-4">
            <div className="flex bg-muted p-1 rounded-lg border">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('personal')}
                    className={cn(
                        "h-8 px-4 text-xs font-bold uppercase",
                        viewMode === 'personal' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                    )}
                >
                    Personal
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('team')}
                    className={cn(
                        "h-8 px-4 text-xs font-bold uppercase",
                        viewMode === 'team' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                    )}
                >
                    Dealership
                </Button>
            </div>
        </div>

        {isPaused && (
            <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/50 text-destructive-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertTitle>Account Activity Paused</AlertTitle>
                <AlertDescription>
                    Your dealership's account is currently paused. Access to new lessons is temporarily unavailable. Please contact your manager for more information.
                </AlertDescription>
            </Alert>
        )}

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
          <CxSoundwaveCard 
            scope={getDefaultScope(user)} 
            data={averageScores}
            memberSince={user.memberSince}
            themePreference={themePreference}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            range={range}
            onRangeChange={setRange}
            hideInternalToggle
          />
        </section>
        
        <section id="lessons" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Today's Lessons</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                    <Skeleton className="h-full min-h-[160px] rounded-2xl" />
                ) : (
                    <Card className={cn(
                        `flex flex-col justify-between p-6 ${dashboardFeatureCardClass}`,
                        isPaused && "opacity-50 pointer-events-none"
                    )}>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <SteeringWheelIcon className="h-8 w-8 text-primary dark:text-cyan-400" />
                                <h3 className="text-2xl font-bold text-foreground">Recommended</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">A daily lesson focused on your area for greatest improvement.</p>
                        </div>
                        {needsBaselineAssessment ? (
                            <div className="grid grid-cols-2 gap-2">
                                {availableRecommendedLesson && !lessonLimits.recommendedTaken ? (
                                    <Link href={`/lesson/${availableRecommendedLesson.lessonId}?recommended=true`} className={cn("w-full", buttonVariants({ className: "w-full font-bold" }))}>
                                        Recommended Lesson
                                    </Link>
                                ) : (
                                    <Button variant="outline" disabled className={dashboardDisabledButtonClass}>
                                        {availableRecommendedLesson ? 'Completed for today' : 'No lesson available'}
                                    </Button>
                                )}
                                <Button
                                  className="w-full font-bold bg-[#8DC63F] text-black hover:bg-[#7FB735] shadow-[0_0_20px_rgba(141,198,63,0.35)]"
                                  onClick={() => setShowBaselineAssessment(true)}
                                >
                                    Take Baseline
                                </Button>
                            </div>
                        ) : availableRecommendedLesson && !lessonLimits.recommendedTaken ? (
                            <Link href={`/lesson/${availableRecommendedLesson.lessonId}?recommended=true`} className={cn("w-full", buttonVariants({ className: "w-full font-bold" }))}>
                                {availableRecommendedLesson.title}
                            </Link>
	                        ) : (retakeTestingLesson || availableRecommendedLesson) && lessonLimits.recommendedTaken ? (
	                            <div className="space-y-2">
	                                <Button variant="outline" disabled className={dashboardDisabledButtonClass}>
	                                    <><CheckCircle className="mr-2 h-4 w-4" /> Completed for today</>
	                                </Button>
	                            </div>
	                        ) : (
	                            <Button variant="outline" disabled className={dashboardDisabledButtonClass}>
	                                No lesson available
	                            </Button>
	                        )}
                            {showTestingControls && (
                                <div className="mt-2 space-y-2">
                                    {canRetakeRecommendedTesting && retakeTestingLesson && (
                                        <Link
                                          href={`/lesson/${retakeTestingLesson.lessonId}?recommended=true&retake=testing`}
                                          className={cn(
                                            "w-full",
                                            buttonVariants({
                                              variant: "outline",
                                              className: "w-full font-semibold border-primary/50 text-primary hover:bg-primary/10 hover:text-primary dark:border-cyan-400/60 dark:text-cyan-200 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100",
                                            })
                                          )}
                                        >
                                          Retake Recommended (Testing)
                                        </Link>
                                    )}
                                    {canUseNewRecommendedTesting && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          disabled={creatingUniqueTestingLesson}
                                          onClick={handleCreateUniqueRecommendedTestingLesson}
                                          className="w-full font-semibold border-accent/60 text-foreground hover:bg-accent/10 hover:text-foreground dark:border-emerald-400/60 dark:text-emerald-200 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-100"
                                        >
                                          New Recommended (Testing)
                                        </Button>
                                    )}
                                </div>
                            )}
	                    </Card>
	                )}
                
                {loading ? (
                    <Skeleton className="h-full min-h-[160px] rounded-2xl" />
                ) : (
                    <Card className={cn(
                        `flex flex-col p-6 ${dashboardFeatureCardClass}`,
                        isPaused && "opacity-50 pointer-events-none"
                    )}>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <BookOpen className="h-8 w-8 text-primary dark:text-cyan-400" />
                                <h3 className="text-2xl font-bold text-foreground">Assigned</h3>
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
                                <div className="rounded-md border border-border bg-muted/50 p-4 text-center text-muted-foreground dark:border-slate-700 dark:bg-slate-800/50">
                                    No assigned lessons
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </section>

        <section>
             {loading ? (
                <Skeleton className="h-40 w-full rounded-2xl" />
             ) : (
                <BadgeShowcase badges={badges} className={dashboardFeatureCardClass} />
             )}
        </section>

        <section className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
             {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : recentActivities.length > 0 ? (
                <div className="divide-y divide-border px-2 dark:divide-slate-700/80">
                   {recentActivities.map((item, index) => (
                       <RecentActivityItem key={index} icon={item.icon} text={item.text} note={item.note} />
                   ))}
                </div>
            ) : (
                <div className="rounded-xl border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-800/50 dark:backdrop-blur-sm">
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
