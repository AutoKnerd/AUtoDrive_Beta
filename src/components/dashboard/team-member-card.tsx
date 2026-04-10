'use client';

import { useState, useEffect, useMemo } from 'react';
import type { User, Lesson, LessonLog, CxTrait, LessonRole, Dealership, Badge } from '@/lib/definitions';
import { getLessons, getConsultantActivity, updateUserDealerships, assignLesson, getTeamMemberRoles, getEarnedBadgesByUserId, convertUserToSingleUser, getDealerFreshUpInsights, getWeeklyFreshUpDigests, getFreshUpRiskRadar, type DealerFreshUpInsights, type TrendDirection, type WeeklyFreshUpDigestRecord, type FreshUpRiskRadarRecord } from '@/lib/data.client';
import { calculateLevel } from '@/lib/xp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Smile, Ear, Handshake, Repeat, Target, Users, LucideIcon, Pencil, ShieldOff, Copy, KeyRound, ArrowUpRight, ArrowDownLeft, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '../ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { BadgeShowcase } from '../profile/badge-showcase';
import { managerialRoles } from '@/lib/definitions';
import { CxSoundwaveCard } from '@/components/cx/CxSoundwaveCard';
import { getDefaultScope } from '@/lib/cx/scope';
import { AvatarSoundRing } from '../profile/avatar-sound-ring';
import { computeWeightedTraitSummary, formatTraitLabel, getFreshUpInsightCopy, getFreshUpManagerRecommendation, getFreshUpSummaryTag } from '@/lib/fresh-up';
import { getRoleLabels, resolveRoleLabelKeyFromUserRole } from '@/config/roleLabels';
import { UI_TERMS } from '@/config/uiTerminology';

interface TeamMemberCardProps {
  user: User;
  currentUser: User;
  dealerships: Dealership[];
  onAssignmentUpdated: () => void | Promise<void>;
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
  const [selectedDealerships, setSelectedDealerships] = useState<string[]>(() => (
    Array.isArray(user.dealershipIds) ? user.dealershipIds : []
  ));
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [recentActivityDate, setRecentActivityDate] = useState<string | null>(null);
  const [freshUpInsights, setFreshUpInsights] = useState<DealerFreshUpInsights | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyFreshUpDigestRecord | null>(null);
  const [riskRadarRows, setRiskRadarRows] = useState<FreshUpRiskRadarRecord[]>([]);

  const themePreference = user.themePreference || (user.useProfessionalTheme ? 'executive' : 'vibrant');
  const viewerRoleForLabels = useMemo(() => resolveRoleLabelKeyFromUserRole(currentUser.role), [currentUser.role]);
  const meterLabel = useMemo(() => getRoleLabels(viewerRoleForLabels).meterLabel, [viewerRoleForLabels]);
  const interactionLabel = useMemo(() => getRoleLabels(viewerRoleForLabels).interactionLabel, [viewerRoleForLabels]);
  const insightLabel = UI_TERMS.interactionInsight;
  const normalizedUserDealershipIds = useMemo(() => (
    Array.isArray(user.dealershipIds) ? user.dealershipIds : []
  ), [user.dealershipIds]);
  const managementPrivateDataViewingDisabled = useMemo(() => (
    normalizedUserDealershipIds.some((dealershipId) => (
      dealerships.find((dealership) => dealership.id === dealershipId)?.disableManagementPrivateDataViewing === true
    ))
  ), [normalizedUserDealershipIds, dealerships]);


  const displayXp = useMemo(() => {
    const profileXp = typeof user.xp === 'number' ? user.xp : 0;
    const activityXp = activity.reduce((sum, log) => (
      sum + (Number.isFinite(log.xpGained) ? log.xpGained : 0)
    ), 0);
    return Math.max(profileXp, activityXp);
  }, [user.xp, activity]);

  const { level } = calculateLevel(displayXp);

  const viewerIsAdmin = currentUser.role === 'Admin' || currentUser.role === 'Developer';
  const viewerIsTrainer = currentUser.role === 'Trainer';
  const viewerIsOwner = currentUser.role === 'Owner';
  const viewerIsManager = managerialRoles.includes(currentUser.role) && !viewerIsAdmin && !viewerIsOwner && !viewerIsTrainer;
  const viewerIsSuperior = managerialRoles.includes(currentUser.role) && currentUser.userId !== user.userId;

  const hideMetrics =
    (viewerIsManager && user.isPrivate) ||
    (viewerIsOwner && user.isPrivateFromOwner);
  const showCriticalOnly = viewerIsSuperior && !hideMetrics && (
    managementPrivateDataViewingDisabled || user.showDealerCriticalOnly === true
  );
  const targetDealerId = useMemo(() => {
    const viewerDealers = Array.isArray(currentUser.dealershipIds) ? currentUser.dealershipIds : [];
    const common = normalizedUserDealershipIds.find((id) => viewerDealers.includes(id));
    return common || normalizedUserDealershipIds[0] || user.selfDeclaredDealershipId || null;
  }, [currentUser.dealershipIds, normalizedUserDealershipIds, user.selfDeclaredDealershipId]);


  useEffect(() => {
    setSelectedDealerships(normalizedUserDealershipIds);
  }, [user.userId, normalizedUserDealershipIds]);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setLoading(true);
      if (!user) return;
      if (hideMetrics) {
        if (active) {
          setLoading(false);
        }
        return;
      }
      try {
        const canViewBadges =
          currentUser.userId === user.userId ||
          viewerIsAdmin ||
          viewerIsTrainer ||
          viewerIsOwner ||
          viewerIsManager;
        const [fetchedLessons, fetchedActivity, fetchedBadges, fetchedFreshUpInsights, fetchedWeeklyDigest, fetchedRisks] = await Promise.all([
          getLessons(user.role as LessonRole, user.userId),
          getConsultantActivity(user.userId),
          canViewBadges ? getEarnedBadgesByUserId(user.userId) : Promise.resolve([]),
          targetDealerId ? getDealerFreshUpInsights(targetDealerId) : Promise.resolve(null),
          targetDealerId ? getWeeklyFreshUpDigests({
            entityType: 'dealer',
            entityId: targetDealerId,
            latestOnly: true,
          }) : Promise.resolve({ latest: null, records: [] }),
          targetDealerId ? getFreshUpRiskRadar({
            dealerId: targetDealerId,
            isActive: true,
            dateFrom: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
            dateTo: new Date().toISOString().slice(0, 10),
          }) : Promise.resolve([]),
        ]);

        if (!active) return;

        setLessons(fetchedLessons);
        setActivity(fetchedActivity);
        setBadges(fetchedBadges);
        setFreshUpInsights(fetchedFreshUpInsights);
        setWeeklyDigest(fetchedWeeklyDigest.latest || null);
        setRiskRadarRows(fetchedRisks);
        
        setMemberSince(
          user.memberSince
            ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : null
        );
        if (fetchedActivity.length > 0) {
          setRecentActivityDate(new Date(fetchedActivity[0].timestamp).toLocaleDateString());
        } else {
          setRecentActivityDate(null);
        }
      } catch (error) {
        console.error('[TeamMemberCard] Failed to load member data', { userId: user.userId, error });
        if (!active) return;
        toast({
          variant: 'destructive',
          title: 'Member data unavailable',
          description: 'Could not load this profile snapshot right now.',
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      active = false;
    };
  }, [user, hideMetrics, currentUser.userId, viewerIsAdmin, viewerIsTrainer, viewerIsOwner, viewerIsManager, toast, targetDealerId]);
  
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
        await Promise.resolve(onAssignmentUpdated()); // trigger parent refresh and catch async failures
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
            await convertUserToSingleUser(user.userId);
            toast({
                title: 'Converted to Single User',
                description: `${user.name} is now in single-user mode with no dealership assignment.`,
            });
            setIsModifying(false);
            setIsConfirmingRemoval(false);
            // Force a clean refresh after conversion to avoid stale row/dialog state in the current roster.
            if (typeof window !== 'undefined') {
                window.location.reload();
                return;
            }
            await Promise.resolve(onAssignmentUpdated());
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
        const current = Array.isArray(prev) ? prev : [];
        if (checked) {
            return [...current, dealershipId];
        } else {
            return current.filter(id => id !== dealershipId);
        }
    });
  }

  const recentActivity = useMemo(() => {
    if (!activity.length) return null;
    return activity[0];
  }, [activity]);
  
  const averageScores = useMemo(() => {
    // Prefer rolling scores if available for this specific user
    const stats = user.stats;
    if (stats) {
      const empathy = stats.empathy?.score;
      const listening = stats.listening?.score;
      const trust = stats.trust?.score;
      const followUp = stats.followUp?.score;
      const closing = stats.closing?.score;
      const relationship = stats.relationship?.score;

      if ([empathy, listening, trust, followUp, closing, relationship].every(v => typeof v === 'number')) {
        return {
          empathy: Math.round(empathy!),
          listening: Math.round(listening!),
          trust: Math.round(trust!),
          followUp: Math.round(followUp!),
          closing: Math.round(closing!),
          relationshipBuilding: Math.round(relationship!),
        };
      }
    }

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
  }, [activity, user.stats]);

  const criticalTraits = useMemo(() => {
    if (!activity.length) return { topStrength: null as CxTrait | null, weakestSkill: null as CxTrait | null };
    // Dealer Critical Summary uses weighted trait rollups so Fresh Up sessions
    // contribute stronger signal than standard lessons.
    const weightedSummary = computeWeightedTraitSummary(activity);
    return {
      topStrength: weightedSummary.topStrength,
      weakestSkill: weightedSummary.areaForImprovement,
    };
  }, [activity]);

  const freshUpSummaryTag = useMemo(() => getFreshUpSummaryTag(activity), [activity]);
  const freshUpInsight = useMemo(() => {
    return getFreshUpInsightCopy(freshUpSummaryTag);
  }, [freshUpSummaryTag]);
  const managerCoachingRecommendation = useMemo(() => {
    return getFreshUpManagerRecommendation(freshUpSummaryTag);
  }, [freshUpSummaryTag]);
  const archetypeIntelligence = useMemo(() => {
    const rows = activity.filter((log) => log.activitySource === 'fresh-up');
    if (rows.length === 0) return null;

    const grouped = new Map<string, { count: number; trustTotal: number; trustShiftTotal: number; stallCount: number }>();
    for (const row of rows) {
      const key = row.customerArchetypeName || row.archetypeName || row.roleAdjustedArchetypeLabel || 'Unknown Archetype';
      const current = grouped.get(key) || { count: 0, trustTotal: 0, trustShiftTotal: 0, stallCount: 0 };
      current.count += 1;
      current.trustTotal += Number.isFinite(row.trust) ? row.trust : 0;
      current.trustShiftTotal += Number.isFinite(row.trustShift) ? Number(row.trustShift) : 0;
      if (
        row.endingType === 'stalled_conversation'
        || row.endingType === 'trust_break'
        || row.outcomeTag === 'Lost Momentum'
        || row.outcomeTag === 'Conversation Breakdown'
      ) {
        current.stallCount += 1;
      }
      grouped.set(key, current);
    }

    const metrics = Array.from(grouped.entries()).map(([name, values]) => ({
      name,
      count: values.count,
      avgTrust: values.count > 0 ? values.trustTotal / values.count : 0,
      avgTrustShift: values.count > 0 ? values.trustShiftTotal / values.count : 0,
      stallRate: values.count > 0 ? values.stallCount / values.count : 0,
    }));

    const mostCommon = metrics.slice().sort((a, b) => b.count - a.count)[0] || null;
    const strongest = metrics.slice().sort((a, b) => b.avgTrust - a.avgTrust)[0] || null;
    const weakest = metrics.slice().sort((a, b) => a.avgTrust - b.avgTrust)[0] || null;
    const highestTrustDrop = metrics.slice().sort((a, b) => a.avgTrustShift - b.avgTrustShift)[0] || null;
    const mostLikelyToStall = metrics.slice().sort((a, b) => b.stallRate - a.stallRate)[0] || null;

    return { mostCommon, strongest, weakest, highestTrustDrop, mostLikelyToStall };
  }, [activity]);
  const tempoIntelligence = useMemo(() => {
    const rows = activity.filter((log) => log.activitySource === 'fresh-up');
    if (rows.length === 0) return null;

    const grouped = new Map<string, { count: number; trustTotal: number; trustShiftTotal: number; stallCount: number }>();
    for (const row of rows) {
      const key = row.conversationTempoName || row.roleAdjustedTempoLabel || row.conversationTempoId || 'Unknown Tempo';
      const current = grouped.get(key) || { count: 0, trustTotal: 0, trustShiftTotal: 0, stallCount: 0 };
      current.count += 1;
      current.trustTotal += Number.isFinite(row.trust) ? row.trust : 0;
      current.trustShiftTotal += Number.isFinite(row.trustShift) ? Number(row.trustShift) : 0;
      if (
        row.endingType === 'stalled_conversation'
        || row.endingType === 'trust_break'
        || row.outcomeTag === 'Lost Momentum'
        || row.outcomeTag === 'Conversation Breakdown'
      ) {
        current.stallCount += 1;
      }
      grouped.set(key, current);
    }

    const metrics = Array.from(grouped.entries()).map(([name, values]) => ({
      name,
      count: values.count,
      avgTrust: values.count > 0 ? values.trustTotal / values.count : 0,
      avgTrustShift: values.count > 0 ? values.trustShiftTotal / values.count : 0,
      stallRate: values.count > 0 ? values.stallCount / values.count : 0,
    }));

    const mostCommon = metrics.slice().sort((a, b) => b.count - a.count)[0] || null;
    const strongest = metrics.slice().sort((a, b) => b.avgTrust - a.avgTrust)[0] || null;
    const weakest = metrics.slice().sort((a, b) => a.avgTrust - b.avgTrust)[0] || null;
    const highestTrustDrop = metrics.slice().sort((a, b) => a.avgTrustShift - b.avgTrustShift)[0] || null;
    const mostLikelyToStall = metrics.slice().sort((a, b) => b.stallRate - a.stallRate)[0] || null;

    return { mostCommon, strongest, weakest, highestTrustDrop, mostLikelyToStall };
  }, [activity]);

  const formatTrait = (trait: CxTrait | null) => {
    if (!trait) return 'Not enough data';
    return formatTraitLabel(trait);
  };
  
  const canManageAssignments = currentUser.userId !== user.userId && getTeamMemberRoles(currentUser.role).includes(user.role);

  const targetUserScope = useMemo(() => {
    return getDefaultScope(user);
  }, [user]);

  const pendingPasswordSetupLink = useMemo(() => {
    if (!['Admin', 'Developer'].includes(currentUser.role)) return null;
    const setup = user.passwordSetup;
    if (!setup || setup.status !== 'pending') return null;
    if (typeof setup.link !== 'string' || setup.link.length === 0) return null;
    return setup.link;
  }, [currentUser.role, user.passwordSetup]);

  const trendGlyph = (trend: TrendDirection) => {
    if (trend === 'up') return <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (trend === 'down') return <ArrowDown className="h-3.5 w-3.5 text-rose-400" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const freshUpMetricTiles = freshUpInsights ? [
    { label: 'Average Empathy Score', value: freshUpInsights.averageEmpathy.score, trend: freshUpInsights.averageEmpathy.trend },
    { label: 'Average Listening Score', value: freshUpInsights.averageListening.score, trend: freshUpInsights.averageListening.trend },
    { label: 'Average Trust Building Score', value: freshUpInsights.averageTrust.score, trend: freshUpInsights.averageTrust.trend },
    { label: 'Average Relationship Building Score', value: freshUpInsights.averageRelationship.score, trend: freshUpInsights.averageRelationship.trend },
    { label: 'Average Closing Score', value: freshUpInsights.averageClosing.score, trend: freshUpInsights.averageClosing.trend },
  ] : [];

  const freshUpInsightsCard = (
    <div className="rounded-md border p-3 md:col-span-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{UI_TERMS.interactionInsights}</span>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : !freshUpInsights || !freshUpInsights.available ? (
        <p className="text-sm text-muted-foreground">Run a few Fresh Ups to unlock interaction insights.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {freshUpMetricTiles.map((metric) => (
              <div key={metric.label} className="rounded border bg-muted/40 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="inline-flex items-center gap-1">{trendGlyph(metric.trend)}</span>
                </div>
                <p className="mt-1 font-semibold text-foreground">{metric.value.toFixed(1)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border bg-muted/40 p-2 text-sm">
              <p className="text-muted-foreground">{`Average ${meterLabel} Peak`}</p>
              <p className="mt-1 font-semibold text-foreground">{freshUpInsights.averageUpMeterPeak.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">{freshUpInsights.upMeterEngagementLabel}</p>
            </div>
            <div className="rounded border bg-muted/40 p-2 text-sm">
              <p className="text-muted-foreground">Session Activity</p>
              <p className="mt-1 font-semibold text-foreground">{freshUpInsights.totalFreshUpSessions} sessions</p>
              <p className="text-xs text-muted-foreground">Avg conversation length: {freshUpInsights.averageConversationLength.toFixed(1)} messages</p>
            </div>
          </div>
          {viewerIsSuperior && freshUpInsights.skillAlerts.length > 0 ? (
            <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
              {freshUpInsights.skillAlerts.map((alert) => (
                <p key={alert.skill} className="text-xs text-amber-100">
                  <span className="font-semibold">Skill Gap Detected: {alert.skill}</span> Recommendation: {alert.recommendation}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  const weeklyDigestCard = (
    <div className="rounded-md border p-3 md:col-span-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{UI_TERMS.interactionDigest}</span>
        <span className="text-xs text-muted-foreground">
          {weeklyDigest ? `${weeklyDigest.weekStart.toLocaleDateString()} - ${weeklyDigest.weekEnd.toLocaleDateString()}` : 'Latest week'}
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : !weeklyDigest ? (
        <p className="text-sm text-muted-foreground">No weekly digest yet for this dealer.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{weeklyDigest.headline}</p>
          <div className="space-y-1">
            {weeklyDigest.keyInsights.slice(0, 5).map((insight, index) => (
              <p key={`weekly-${index}`} className="text-xs text-muted-foreground">• {insight}</p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Recommended Coaching Focus:</span> {weeklyDigest.recommendedAction}
          </p>
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">View Full Digest</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{UI_TERMS.interactionDigest}</DialogTitle>
                  <DialogDescription>
                    {weeklyDigest.weekStart.toLocaleDateString()} - {weeklyDigest.weekEnd.toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm font-medium">{weeklyDigest.headline}</p>
                  <div className="space-y-1">
                    {weeklyDigest.keyInsights.map((insight, index) => (
                      <p key={`full-${index}`} className="text-sm text-muted-foreground">• {insight}</p>
                    ))}
                  </div>
                  {!!weeklyDigest.narrativeSummary && (
                    <p className="text-sm text-muted-foreground">{weeklyDigest.narrativeSummary}</p>
                  )}
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-semibold">Recommended Coaching Focus</p>
                    <p className="mt-1 text-sm text-muted-foreground">{weeklyDigest.recommendedAction}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const lines = [
                  `# ${UI_TERMS.interactionDigest}`,
                  '',
                  `Week Range: ${weeklyDigest.weekStart.toLocaleDateString()} - ${weeklyDigest.weekEnd.toLocaleDateString()}`,
                  '',
                  '## Headline Summary',
                  weeklyDigest.headline,
                  '',
                  '## Key Insights',
                  ...weeklyDigest.keyInsights.map((line) => `- ${line}`),
                  '',
                  '## Recommended Coaching Focus',
                  weeklyDigest.recommendedAction,
                  '',
                  weeklyDigest.narrativeSummary ? `## Narrative\n${weeklyDigest.narrativeSummary}` : '',
                ].filter(Boolean);
                const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `fresh-up-weekly-digest-${weeklyDigest.digestId}.md`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(url);
              }}
            >
              Export Digest (MD)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob([JSON.stringify(weeklyDigest, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `fresh-up-weekly-digest-${weeklyDigest.digestId}.json`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(url);
              }}
            >
              Export Digest (JSON)
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const riskRadarCard = (
    <div className="rounded-md border p-3 md:col-span-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">CX Risk Radar</span>
        <span className="text-xs text-muted-foreground">Active risks</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : riskRadarRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active CX risks flagged for this dealer right now.</p>
      ) : (
        <div className="space-y-2">
          {riskRadarRows.slice(0, 3).map((risk) => (
            <div key={risk.riskId} className="rounded-md border bg-muted/30 p-2">
              <p className="text-xs font-semibold text-foreground">
                {risk.riskType.replace(/_/g, ' ')} • {risk.riskLevel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{risk.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Action:</span> {risk.recommendedAction}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const archetypeIntelligenceCard = (
    <div className="rounded-md border p-3 md:col-span-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Archetype Intelligence</span>
        <span className="text-xs text-muted-foreground">Manager summary</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : !archetypeIntelligence ? (
        <p className="text-sm text-muted-foreground">Not enough archetype activity yet.</p>
      ) : (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span className="font-semibold text-foreground">Most common:</span> {archetypeIntelligence.mostCommon?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Strongest:</span> {archetypeIntelligence.strongest?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Weakest:</span> {archetypeIntelligence.weakest?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Highest trust drop:</span> {archetypeIntelligence.highestTrustDrop?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Most likely to stall:</span> {archetypeIntelligence.mostLikelyToStall?.name || 'Not enough data'}</p>
        </div>
      )}
    </div>
  );
  const tempoIntelligenceCard = (
    <div className="rounded-md border p-3 md:col-span-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Tempo Intelligence</span>
        <span className="text-xs text-muted-foreground">Manager summary</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-10/12" />
        </div>
      ) : !tempoIntelligence ? (
        <p className="text-sm text-muted-foreground">Not enough tempo activity yet.</p>
      ) : (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span className="font-semibold text-foreground">Most common:</span> {tempoIntelligence.mostCommon?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Strongest:</span> {tempoIntelligence.strongest?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Weakest:</span> {tempoIntelligence.weakest?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Highest trust drop:</span> {tempoIntelligence.highestTrustDrop?.name || 'Not enough data'}</p>
          <p><span className="font-semibold text-foreground">Most likely to stall:</span> {tempoIntelligence.mostLikelyToStall?.name || 'Not enough data'}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                        {/* Dynamic Sound Ring Frame for the performance snapshot */}
                        <AvatarSoundRing scores={averageScores} hasActivity={activity.length > 0} themePreference={themePreference} />
                        
                        <Avatar className="relative w-full h-full border-2 border-slate-700">
                            <AvatarImage src={user.avatarUrl} data-ai-hint="person portrait" />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </div>
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
                    <p className="font-bold text-lg">{displayXp.toLocaleString()} XP</p>
                </div>
            </CardHeader>
        </Card>

        {pendingPasswordSetupLink && (
            <Card className="border-cyan-800/40">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="h-4 w-4 text-cyan-400" />
                        First Login Password Setup Link
                    </CardTitle>
                    <CardDescription>
                        Visible until this user completes password setup.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input value={pendingPasswordSetupLink} readOnly />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(pendingPasswordSetupLink);
                                    toast({
                                        title: 'Copied',
                                        description: 'Password setup link copied.',
                                    });
                                } catch {
                                    toast({
                                        variant: 'destructive',
                                        title: 'Copy Failed',
                                        description: 'Could not copy password setup link.',
                                    });
                                }
                            }}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

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
                    <CardTitle>Performance Intelligence</CardTitle>
                    <CardDescription>
                        {`This user shares only top strength, area for improvement, and ${insightLabel.toLowerCase()} with leadership.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <ArrowDownLeft className="h-4 w-4 text-rose-400" />
                          <span className="text-sm text-muted-foreground">Area for Improvement</span>
                        </div>
                        <span className="font-semibold">{formatTrait(criticalTraits.weakestSkill)}</span>
                    </div>
                    <div className="rounded-md border p-3 md:text-right">
                        <div className="mb-1 flex items-center justify-start gap-2 md:justify-end">
                          <span className="text-sm text-muted-foreground">Top Strength</span>
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        </div>
                        <span className="font-semibold">{formatTrait(criticalTraits.topStrength)}</span>
                    </div>
                    <div className="rounded-md border p-3 md:col-span-3">
                        <div className="mb-1 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-sky-400" />
                          <span className="text-sm text-muted-foreground">{insightLabel}</span>
                        </div>
                        <span className="font-semibold">{freshUpInsight}</span>
                    </div>
                    {freshUpInsightsCard}
                    {weeklyDigestCard}
                    {riskRadarCard}
                    {archetypeIntelligenceCard}
                    {tempoIntelligenceCard}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Manager Coaching Recommendation:</span> {managerCoachingRecommendation}
                  </p>
                </CardContent>
            </Card>
        ) : (
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>Performance Intelligence</CardTitle>
                        <CardDescription>
                          {`Weighted by recent activity, with ${interactionLabel} results carrying extra influence.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <ArrowDownLeft className="h-4 w-4 text-rose-400" />
                          <span className="text-sm text-muted-foreground">Area for Improvement</span>
                        </div>
                        <span className="font-semibold">{formatTrait(criticalTraits.weakestSkill)}</span>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-muted-foreground">Top Strength</span>
                        </div>
                        <span className="font-semibold">{formatTrait(criticalTraits.topStrength)}</span>
                      </div>
                      <div className="rounded-md border p-3 md:col-span-3">
                        <div className="mb-1 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-sky-400" />
                          <span className="text-sm text-muted-foreground">{insightLabel}</span>
                        </div>
                        <span className="font-semibold">{freshUpInsight}</span>
                      </div>
                      {freshUpInsightsCard}
                      {weeklyDigestCard}
                      {riskRadarCard}
                      {archetypeIntelligenceCard}
                      {tempoIntelligenceCard}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Manager Coaching Recommendation:</span> {managerCoachingRecommendation}
                      </p>
                    </CardContent>
                </Card>
                {/* Unified Average CX Scores Trend Visualization */}
                <CxSoundwaveCard 
                  scope={targetUserScope} 
                  data={averageScores}
                  memberSince={user.memberSince}
                  themePreference={themePreference}
                />
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
                            <p className="text-lg font-semibold text-primary">
                              {recentActivity.activitySource === 'fresh-up'
                                ? interactionLabel
                                : (lessons.find(l => l.lessonId === recentActivity.lessonId)?.title || 'Unknown Lesson')}
                            </p>
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
                            <h4 className="font-semibold text-destructive">Convert to Single User</h4>
                            <p className="text-sm text-destructive/90">
                                To remove {user.name} from all dealership rosters and keep them as an individual account, type <strong>UNASSIGN</strong> below.
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
                                    {isUpdating ? <Spinner size="sm" /> : 'Convert to Single User'}
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
                                <Button variant="destructive" onClick={() => setIsConfirmingRemoval(true)} disabled={isUpdating}>Convert to Single User</Button>
                                <div className='flex gap-2'>
                                    <Button variant="ghost" onClick={() => { setIsModifying(false); setSelectedDealerships(normalizedUserDealershipIds); }}>Cancel</Button>
                                    <Button onClick={handleUpdateAssignments} disabled={isUpdating || isEqual([...normalizedUserDealershipIds].sort(), [...selectedDealerships].sort())}>
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
