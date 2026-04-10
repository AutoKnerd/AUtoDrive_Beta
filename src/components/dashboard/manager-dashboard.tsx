
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import type { User, LessonLog, Lesson, LessonRole, CxTrait, Dealership, Badge, UserRole, PendingInvitation, ThemePreference } from '@/lib/definitions';
import { managerialRoles, noPersonalDevelopmentRoles, allRoles } from '@/lib/definitions';
import { getCombinedTeamData, getLessons, getConsultantActivity, getDealerships, getDealershipById, getManageableUsers, getEarnedBadgesByUserId, getDailyLessonLimits, getPendingInvitations, createInvitationLink, getAssignedLessons, getAllAssignedLessonIds, getSystemReport, getPppAccessForUser, getSaasPppAccessForUser, ensureDailyRecommendedLesson, recalculateDealershipData, getFreshUpCommandCenter, type FreshUpCommandCenterResult } from '@/lib/data.client';
import type { SystemReport } from '@/lib/data.client';
import { BarChart, CheckCircle, ShieldOff, Smile, Star, Users, Store, TrendingUp, TrendingDown, Building, MessageSquare, Ear, Handshake, Repeat, Target, Info, Settings, ArrowUpDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge as UiBadge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { AutoForgeDialog, type AutoForgeContext } from '../lessons/autoforge-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamMemberCard } from './team-member-card';
import { AssignUserForm } from '../admin/assign-user-form';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RemoveUserForm } from '../admin/remove-user-form';
import { cn } from '@/lib/utils';
import { calculateLevel } from '@/lib/xp';
import { Logo } from '@/components/layout/logo';
import { BadgeShowcase } from '../profile/badge-showcase';
import { AvatarSoundRing } from '../profile/avatar-sound-ring';
import { ManageDealershipForm } from '../admin/ManageDealershipForm';
import { SendMessageForm } from '../messenger/send-message-form';
import { UserNav } from '../layout/user-nav';
import { useAuth } from '@/hooks/use-auth';
import { RegisterDealershipForm } from '../admin/register-dealership-form';
import { CreateDealershipForm } from '../admin/create-dealership-form';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { BaselineAssessmentDialog } from './baseline-assessment-dialog';
import { CxSoundwaveCard, type CxRange } from '@/components/cx/CxSoundwaveCard';
import { getDefaultScope } from '@/lib/cx/scope';
import { PppDashboardCard } from '@/components/ppp/ppp-dashboard-card';
import { SaasPppDashboardCard } from '@/components/saas-ppp/saas-ppp-dashboard-card';
import { ManagerGuidedTour } from './manager-guided-tour';
import { getRoleLabels, resolveRoleLabelKeyFromUserRole } from '@/config/roleLabels';
import { TodaysDriveCard } from './todays-drive-card';
import { AutoshopCard } from './autoshop-card';

interface ManagerDashboardProps {
  user: User;
}

type TeamMemberStats = {
  consultant: User;
  lessonsCompleted: number;
  totalXp: number;
  avgScore: number;
  topStrength: CxTrait | null;
  weakestSkill: CxTrait | null;
  lastInteraction: Date | null;
  lastRecommendedInteraction: Date | null;
  tookRecommendedToday: boolean;
  pendingInvite?: PendingInvitation;
};
type TeamSortField = 'leaderboard' | 'name' | 'role' | 'lastInteraction' | 'topStrength' | 'weakestSkill';
type DealershipActivityEntry = {
  userId: string;
  memberName: string;
  memberRole: UserRole;
  lessonId: string;
  timestamp: Date;
  xpGained: number;
  isRecommended: boolean;
  trainedTrait?: string;
  severity?: 'normal' | 'behavior_violation';
};

type DealershipInsight = {
    trait: string;
    score: number;
};

type DealerOwnerDashboardResponse = {
  dealership_name: string;
  snapshot: {
    team_training_completion: number;
    team_engagement_rate: number;
    average_skill_score: number;
    active_users: number;
  };
};

type DealerGmDashboardResponse = {
  dealership_name: string;
  rep_performance: Array<{
    user_id: string;
    name: string;
    missions_completed?: number;
    skill_score?: number;
    last_activity?: string | null;
  }>;
  coaching_alerts: string[];
};

type DealerLeadershipResponse = DealerOwnerDashboardResponse | DealerGmDashboardResponse;

const dashboardFeatureCardClass =
  'border border-border bg-card/95 shadow-sm dark:border-cyan-400/30 dark:bg-slate-900/50 dark:backdrop-blur-md dark:shadow-lg dark:shadow-cyan-500/10';
function resolveThemePreference(value: unknown, useProfessionalTheme?: boolean): ThemePreference {
  const raw = String(value || '').trim().toLowerCase();

  if (raw === 'vibrant' || raw.includes('vibrant neon')) return 'vibrant';
  if (raw === 'executive' || raw.includes('elite executive')) return 'executive';
  if (raw === 'steel' || raw.includes('professional steel')) return 'steel';
  if (raw === 'patriot' || raw.includes('tricolor') || raw.includes('red, white, blue')) return 'patriot';
  if (raw === 'velocity' || raw.includes('orange, indigo, teal')) return 'velocity';
  if (raw === 'monochrome' || raw.includes('silver, graphite, charcoal')) return 'monochrome';
  if (raw === 'forest' || raw.includes('pine, mint, sage')) return 'forest';
  if (raw === 'sunset' || raw.includes('crimson, amber, rose')) return 'sunset';
  if (raw === 'oceanic' || raw.includes('navy, aqua, sand')) return 'oceanic';
  if (raw === 'cyber' || raw.includes('magenta, cyan, lime')) return 'cyber';

  return useProfessionalTheme ? 'executive' : 'vibrant';
}

function normalizeAvatarScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 60;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function extractStatScore(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === 'object' && 'score' in (raw as Record<string, unknown>)) {
    const nested = (raw as Record<string, unknown>).score;
    const numeric = typeof nested === 'number' ? nested : Number(nested);
    if (Number.isFinite(numeric)) return numeric;
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  return null;
}

function getUserAvatarScores(member: User) {
  const stats = member.stats as Record<string, unknown> | undefined;
  if (!stats) return undefined;

  // Support both current nested shape ({ score, lastUpdated }) and legacy numeric shape.
  const empathy = extractStatScore(stats.empathy);
  const listening = extractStatScore(stats.listening);
  const trust = extractStatScore(stats.trust);
  const followUp = extractStatScore(stats.followUp);
  const closing = extractStatScore(stats.closing);
  const relationship = extractStatScore(stats.relationship ?? stats.relationshipBuilding);

  if (
    empathy === null &&
    listening === null &&
    trust === null &&
    followUp === null &&
    closing === null &&
    relationship === null
  ) {
    return undefined;
  }

  return {
    empathy: normalizeAvatarScore(empathy ?? 60),
    listening: normalizeAvatarScore(listening ?? 60),
    trust: normalizeAvatarScore(trust ?? 60),
    followUp: normalizeAvatarScore(followUp ?? 60),
    closing: normalizeAvatarScore(closing ?? 60),
    relationshipBuilding: normalizeAvatarScore(relationship ?? 60),
  };
}

type CxScoreSnapshot = Record<CxTrait, number>;

function scoreSnapshotFromUserStats(user: User): CxScoreSnapshot | null {
  const stats = user.stats as Record<string, unknown> | undefined;
  if (!stats) return null;

  const empathy = extractStatScore(stats.empathy);
  const listening = extractStatScore(stats.listening);
  const trust = extractStatScore(stats.trust);
  const followUp = extractStatScore(stats.followUp);
  const closing = extractStatScore(stats.closing);
  const relationshipBuilding = extractStatScore(stats.relationship ?? stats.relationshipBuilding);

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
    empathy: normalizeAvatarScore(empathy),
    listening: normalizeAvatarScore(listening),
    trust: normalizeAvatarScore(trust),
    followUp: normalizeAvatarScore(followUp),
    closing: normalizeAvatarScore(closing),
    relationshipBuilding: normalizeAvatarScore(relationshipBuilding),
  };
}

function scoreSnapshotFromActivity(logs: LessonLog[]): CxScoreSnapshot {
  if (!logs.length) {
    return {
      empathy: 60,
      listening: 60,
      trust: 60,
      followUp: 60,
      closing: 60,
      relationshipBuilding: 60,
    };
  }

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
    empathy: normalizeAvatarScore(totals.empathy / count),
    listening: normalizeAvatarScore(totals.listening / count),
    trust: normalizeAvatarScore(totals.trust / count),
    followUp: normalizeAvatarScore(totals.followUp / count),
    closing: normalizeAvatarScore(totals.closing / count),
    relationshipBuilding: normalizeAvatarScore(totals.relationshipBuilding / count),
  };
}

function lowestTraitFromSnapshot(scores: CxScoreSnapshot): CxTrait {
  return (Object.entries(scores) as [CxTrait, number][])
    .reduce((lowest, current) => (current[1] < lowest[1] ? current : lowest), ['empathy', Number.POSITIVE_INFINITY])[0];
}

function inferDepartmentLabel(role: UserRole): string {
  switch (role) {
    case 'manager':
      return 'Sales';
    case 'Service Manager':
      return 'Service';
    case 'Parts Manager':
      return 'Parts';
    case 'Finance Manager':
      return 'F&I';
    case 'General Manager':
    case 'Owner':
      return 'Storewide Leadership';
    default:
      return 'Storewide';
  }
}

function buildAutoForgeContext(input: {
  department: string;
  dealershipName: string;
  dealershipScopeLabel: string;
  stats: { avgScores: Record<CxTrait, number> | null } | null;
  teamActivity: TeamMemberStats[];
}): AutoForgeContext {
  const activeMembers = input.teamActivity.filter((member) => !member.pendingInvite && member.consultant.role !== 'Owner');
  const scoredMembers = activeMembers
    .map((member) => scoreSnapshotFromUserStats(member.consultant))
    .filter((snapshot): snapshot is CxScoreSnapshot => snapshot !== null);
  const autoForgeAverageScores = scoredMembers.length
    ? (Object.keys(scoredMembers[0]) as CxTrait[]).reduce((acc, trait) => {
        const total = scoredMembers.reduce((sum, snapshot) => sum + snapshot[trait], 0);
        acc[trait] = total / scoredMembers.length;
        return acc;
      }, {} as Record<CxTrait, number>)
    : input.stats?.avgScores;
  const weakestMember = [...activeMembers].sort((a, b) => a.avgScore - b.avgScore)[0] || null;
  const weakestMemberSignals = [...activeMembers]
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 3)
    .map((member) => ({
      name: resolveTeamMemberName(member),
      role: member.consultant.role,
      weakestTrait: member.weakestSkill,
      avgScore: Math.round(member.avgScore),
    }));

  const weakestTeamTrait = autoForgeAverageScores
    ? (Object.entries(autoForgeAverageScores) as [CxTrait, number][])
        .sort((a, b) => a[1] - b[1])[0]
    : null;

  const summaryParts: string[] = [
    input.dealershipName ? `Dealership: ${input.dealershipName}.` : '',
    input.dealershipScopeLabel ? `Scope: ${input.dealershipScopeLabel}.` : '',
    weakestTeamTrait
      ? `Primary team gap: ${prettyTraitName(weakestTeamTrait[0])} at ${Math.round(weakestTeamTrait[1])}%.`
      : '',
    weakestMember
      ? `Lowest individual average: ${resolveTeamMemberName(weakestMember)} (${weakestMember.consultant.role}, ${Math.round(weakestMember.avgScore)}%).`
      : '',
    weakestMemberSignals.length
      ? `Key at-risk members: ${weakestMemberSignals
          .map((member) => `${member.name} (${member.role})${member.weakestTrait ? `, weakest ${prettyTraitName(member.weakestTrait)}` : ''}${typeof member.avgScore === 'number' ? `, ${member.avgScore}%` : ''}`)
          .join('; ')}.`
      : '',
  ].filter(Boolean);

  return {
    department: input.department,
    dealershipName: input.dealershipName,
    dealershipScopeLabel: input.dealershipScopeLabel,
    departmentPerformanceSummary: summaryParts.join(' '),
    memberSignals: weakestMemberSignals.map((member) => `${member.name} (${member.role})${member.weakestTrait ? `, weakest ${prettyTraitName(member.weakestTrait)}` : ''}${typeof member.avgScore === 'number' ? `, ${member.avgScore}%` : ''}`),
  };
}

function prettyTraitName(trait: CxTrait): string {
  return trait.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function parseCoachingAlert(alert: string): { repName: string; reason: string } {
  const normalized = alert.trim();
  if (!normalized) return { repName: 'Unknown rep', reason: 'No reason provided' };

  const patterns = [
    /(.*)\s+inactive for\s+(.*)$/i,
    /(.*)\s+showing\s+(.*)$/i,
    /(.*)\s+has\s+(.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        repName: match[1].trim(),
        reason: match[2].trim(),
      };
    }
  }

  return { repName: normalized, reason: 'Review this alert in Team Activity.' };
}

function resolveTeamMemberName(member: TeamMemberStats): string {
  const normalizedName = (member.consultant.name || '').trim();
  if (normalizedName && normalizedName.toLowerCase() !== 'new user') return normalizedName;
  const localPart = (member.consultant.email || '').split('@')[0] || '';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Rep';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function scoreFromTeamMember(member: TeamMemberStats): number {
  const snapshot = scoreSnapshotFromUserStats(member.consultant);
  if (snapshot) {
    const values = Object.values(snapshot);
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  }

  return Math.round(member.avgScore * 100) / 100;
}

function daysSinceActivity(lastActivity: string | Date | null, now: Date): number {
  if (!lastActivity) return Number.MAX_SAFE_INTEGER;
  const parsed = lastActivity instanceof Date ? lastActivity : new Date(lastActivity);
  if (Number.isNaN(parsed.getTime())) return Number.MAX_SAFE_INTEGER;
  return Math.floor((now.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000));
}

function buildTourLeadershipData(teamActivity: TeamMemberStats[]): DealerGmDashboardResponse {
  const now = new Date();
  const repPerformance = teamActivity
    .filter((member) => !member.pendingInvite)
    .map((member) => ({
      user_id: member.consultant.userId,
      name: resolveTeamMemberName(member),
      missions_completed: member.lessonsCompleted,
      skill_score: scoreFromTeamMember(member),
      last_activity: member.lastInteraction ? member.lastInteraction.toISOString() : null,
    }));

  const jesse = repPerformance.find((rep) => rep.name === 'Jesse Jones');
  const coachingAlerts: string[] = [];
  if (jesse) {
    const daysInactive = daysSinceActivity(jesse.last_activity ?? null, now);
    if (daysInactive === Number.MAX_SAFE_INTEGER) {
      coachingAlerts.push('Jesse Jones has no recorded activity yet');
    } else if (daysInactive >= 1) {
      coachingAlerts.push(`Jesse Jones overdue training for ${daysInactive} ${daysInactive === 1 ? 'day' : 'days'}`);
    } else {
      coachingAlerts.push('Jesse Jones overdue training');
    }
    coachingAlerts.push('Jesse Jones has incomplete training streaks');
  }

  return {
    dealership_name: 'Tour Dealership',
    rep_performance: repPerformance,
    coaching_alerts: coachingAlerts.slice(0, 12),
  };
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
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()}</span>
                <p className="text-muted-foreground">{user.role === 'manager' ? 'Sales Manager' : user.role}</p>
            </div>
             <p className="text-primary text-right font-semibold">Total: {user.xp.toLocaleString()} XP</p>
        </div>
    );
}

export function ManagerDashboard({ user }: ManagerDashboardProps) {
  const { toast } = useToast();
  const { originalUser, isTouring, firebaseUser } = useAuth();
  const pathname = usePathname();
  const [stats, setStats] = useState<{ totalLessons: number; avgScores: Record<CxTrait, number> | null } | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamMemberStats[]>([]);
  const [dealershipActivity, setDealershipActivity] = useState<DealershipActivityEntry[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [managerActivity, setManagerActivity] = useState<LessonLog[]>([]);
  const [managerBadges, setManagerBadges] = useState<Badge[]>([]);
  const [assignedLessons, setAssignedLessons] = useState<Lesson[]>([]);
  const [assignedLessonHistoryIds, setAssignedLessonHistoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManageUsersOpen, setManageUsersOpen] = useState(false);
  const [isMessageDialogOpen, setMessageDialogOpen] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [guidedTourStep, setGuidedTourStep] = useState(0);
  const [pppFeatureEnabled, setPppFeatureEnabled] = useState(false);
  const [saasPppFeatureEnabled, setSaasPppFeatureEnabled] = useState(false);

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealershipsForAdmin, setAllDealershipsForAdmin] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [teamSortField, setTeamSortField] = useState<TeamSortField>('leaderboard');
  const [teamSortDirection, setTeamSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showBaselineAssessment, setShowBaselineAssessment] = useState(false);
  const [needsBaselineAssessment, setNeedsBaselineAssessment] = useState(false);
  const [dailyRecommendedLessonId, setDailyRecommendedLessonId] = useState<string | null>(null);
  const [systemReport, setSystemReport] = useState<SystemReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isRecalculatingDealership, setIsRecalculatingDealership] = useState(false);
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [range, setRange] = useState<CxRange>('today');
  const [dealerLeadershipData, setDealerLeadershipData] = useState<DealerLeadershipResponse | null>(null);
  const [dealerLeadershipLoading, setDealerLeadershipLoading] = useState(false);
  const [dealerLeadershipError, setDealerLeadershipError] = useState<string | null>(null);
  const [commandCenter, setCommandCenter] = useState<FreshUpCommandCenterResult | null>(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(false);
  const router = useRouter();
  const canViewAllStores = ['Admin', 'Developer'].includes(user.role);
  const canViewAssignedStoresAggregate = !canViewAllStores && (user.dealershipIds?.length ?? 0) > 1;
  const dealershipSelectionStorageKey = useMemo(
    () => `managerDashboard:selectedDealershipId:${originalUser?.userId || user.userId}`,
    [originalUser?.userId, user.userId]
  );

  const themePreference = user.themePreference || (user.useProfessionalTheme ? 'executive' : 'vibrant');
  const roleLabels = useMemo(() => getRoleLabels(resolveRoleLabelKeyFromUserRole(user.role)), [user.role]);

  const teamContext = useMemo(() => {
    switch (user.role) {
      case 'manager': return { memberLabel: 'Sales Team Members', description: 'Across your sales team' };
      case 'Service Manager': return { memberLabel: 'Service Writers', description: 'Across your service team' };
      case 'Parts Manager': return { memberLabel: 'Parts Consultants', description: 'Across your parts team' };
      default: return { memberLabel: 'Team Members', description: 'Across your entire team' };
    }
  }, [user.role]);

  const fetchData = useCallback(async (dealershipId: string | null) => {
      if (!dealershipId) return;
      const canUseAllSelection = canViewAllStores || canViewAssignedStoresAggregate;
      const scopedDealershipId = (!canUseAllSelection && dealershipId === 'all')
        ? (user.dealershipIds?.[0] || user.selfDeclaredDealershipId || null)
        : dealershipId;
      if (!scopedDealershipId) {
        setLoading(false);
        return;
      }
      if (scopedDealershipId !== dealershipId) {
        setSelectedDealershipId(scopedDealershipId);
      }
      setLoading(true);
      try {
          const combinedDataPromise = getCombinedTeamData(scopedDealershipId, user);
          const [combinedData, usersToManage, fetchedLessons, fetchedManagerActivity, fetchedBadges, fetchedAssignedLessons, fetchedAssignedHistoryIds, limits, pendingInvitations, pppAccessEnabled, saasPppAccessEnabled] = await Promise.all([
            combinedDataPromise,
            getManageableUsers(user.userId),
            getLessons(user.role as LessonRole, user.userId),
            getConsultantActivity(user.userId),
            getEarnedBadgesByUserId(user.userId),
            getAssignedLessons(user.userId),
            getAllAssignedLessonIds(user.userId),
            getDailyLessonLimits(user.userId),
            getPendingInvitations(scopedDealershipId, user),
            getPppAccessForUser(user, scopedDealershipId).catch(() => false),
            getSaasPppAccessForUser(user, scopedDealershipId).catch(() => false),
          ]);

          const manageableById = new Map<string, User>(
            usersToManage.map((manageableUser) => [manageableUser.userId, manageableUser])
          );

          const hydratedTeamRows: TeamMemberStats[] = combinedData.teamActivity.map((row: TeamMemberStats) => {
            const freshUser = manageableById.get(row.consultant.userId);
            if (!freshUser) return row;

            return {
              ...row,
              consultant: {
                ...row.consultant,
                ...freshUser,
                stats: freshUser.stats ?? row.consultant.stats,
                avatarUrl: freshUser.avatarUrl || row.consultant.avatarUrl,
              },
            };
          });
          
          setStats(combinedData.managerStats);
          setDealershipActivity((combinedData.dealershipActivity || []) as DealershipActivityEntry[]);
          const teamActivityByUserId = new Map<string, TeamMemberStats>(
            hydratedTeamRows.map((row: TeamMemberStats) => [row.consultant.userId, row])
          );

          const visibleActiveUsers = usersToManage.filter((u) => {
            if (scopedDealershipId === 'all') return canUseAllSelection;
            return u.dealershipIds?.includes(scopedDealershipId);
          });

          visibleActiveUsers.forEach((u) => {
            if (!teamActivityByUserId.has(u.userId)) {
              teamActivityByUserId.set(u.userId, {
                consultant: u, lessonsCompleted: 0, totalXp: u.xp, avgScore: 0, topStrength: null, weakestSkill: null, lastInteraction: null,
                lastRecommendedInteraction: null, tookRecommendedToday: false,
              });
            }
          });

          const pendingRows: TeamMemberStats[] = pendingInvitations.map((invite) => ({
            consultant: { userId: `invite-${invite.token}`, name: invite.email.split('@')[0] || invite.email, email: invite.email, role: invite.role, dealershipIds: [invite.dealershipId], avatarUrl: '', xp: 0 },
            lessonsCompleted: 0, totalXp: 0, avgScore: 0, topStrength: null, weakestSkill: null, lastInteraction: null, lastRecommendedInteraction: null, tookRecommendedToday: false, pendingInvite: invite,
          }));

          setTeamActivity([...Array.from(teamActivityByUserId.values()), ...pendingRows]);
          setManageableUsers(usersToManage);
          const baselineEligible = !['Owner', 'Trainer', 'Admin', 'Developer'].includes(user.role);
          let lessonsForSelection = fetchedLessons;
          let resolvedDailyRecommendedLessonId: string | null = null;

          if (baselineEligible && user.role !== 'Owner' && user.role !== 'Admin' && user.role !== 'Trainer' && user.role !== 'Developer') {
            const scoreSnapshot = scoreSnapshotFromUserStats(user) ?? scoreSnapshotFromActivity(fetchedManagerActivity);
            const lowestTrait = lowestTraitFromSnapshot(scoreSnapshot);
            const autoLesson = await ensureDailyRecommendedLesson(user.role as LessonRole, lowestTrait, user.userId);
            if (autoLesson) {
              resolvedDailyRecommendedLessonId = autoLesson.lessonId;
              lessonsForSelection = [
                autoLesson,
                ...fetchedLessons.filter((lesson) => lesson.lessonId !== autoLesson.lessonId),
              ];
            }
          }

          setLessons(lessonsForSelection);
          setDailyRecommendedLessonId(resolvedDailyRecommendedLessonId);
          setManagerActivity(fetchedManagerActivity);
          setManagerBadges(fetchedBadges);
          setAssignedLessons(fetchedAssignedLessons);
          setAssignedLessonHistoryIds(fetchedAssignedHistoryIds);
          setLessonLimits(limits);
          setPppFeatureEnabled(pppAccessEnabled === true);
          setSaasPppFeatureEnabled(saasPppAccessEnabled === true);
          const hasBaselineLog = fetchedManagerActivity.some(log => String(log.lessonId || '').startsWith('baseline-'));
          const baselineRequired = !isTouring && baselineEligible && !hasBaselineLog;
          setNeedsBaselineAssessment(baselineRequired);
          setShowBaselineAssessment(baselineRequired);

          setCommandCenterLoading(true);
          const commandCenterResult = await getFreshUpCommandCenter({
            entityMode: scopedDealershipId === 'all' ? 'platform' : 'dealer',
            entityId: scopedDealershipId === 'all' ? undefined : scopedDealershipId,
            filters: {
              includeSandboxData: false,
              dealerId: scopedDealershipId === 'all' ? undefined : scopedDealershipId,
            },
          });
          setCommandCenter(commandCenterResult);
      } catch (error) {
          console.warn("Dashboard partially failed to load team data:", error);
          setPppFeatureEnabled(false);
          setSaasPppFeatureEnabled(false);
          toast({
              variant: 'destructive',
              title: 'Loading Warning',
              description: 'Some administrative data could not be retrieved at this time.',
          });
      } finally {
          setCommandCenterLoading(false);
          setLoading(false);
      }
  }, [user, isTouring, toast, canViewAllStores, canViewAssignedStoresAggregate]);

  const fetchAdminData = useCallback(async () => {
    try {
        const fetchedDealerships = await getDealerships(user);
        if (['Admin', 'Developer'].includes(user.role)) setAllDealershipsForAdmin(fetchedDealerships);
        setDealerships(fetchedDealerships.filter(d => ['Admin', 'Developer'].includes(user.role) ? true : d.status !== 'deactivated'));
    } catch (e) {
        console.warn("Could not fetch dealerships list.");
    }
  }, [user]);

  useEffect(() => {
    const fetchInitialData = async () => {
        if (!managerialRoles.includes(user.role)) return;
        setLoading(true);
        await fetchAdminData();
        let initialDealerships: Dealership[] = [];
        try {
            initialDealerships = await getDealerships(user);
        } catch (e) {}
        
        let currentSelectedId = selectedDealershipId;
        if (currentSelectedId === null) {
            let persistedSelection: string | null = null;
            if (typeof window !== 'undefined') {
              persistedSelection = localStorage.getItem(dealershipSelectionStorageKey);
            }
            const canUsePersistedAll = persistedSelection === 'all' && (canViewAllStores || canViewAssignedStoresAggregate);
            const canUsePersistedStore = !!persistedSelection && persistedSelection !== 'all'
              && initialDealerships.some((d) => d.id === persistedSelection);

            if (canUsePersistedAll || canUsePersistedStore) currentSelectedId = persistedSelection;
            else if (canViewAllStores) currentSelectedId = 'all';
            else if (canViewAssignedStoresAggregate && initialDealerships.length > 1) currentSelectedId = 'all';
            else if (initialDealerships.length > 0) currentSelectedId = initialDealerships[0].id;
        }
        if (currentSelectedId === 'all' && !canViewAllStores && !canViewAssignedStoresAggregate) {
            currentSelectedId = initialDealerships[0]?.id || user.dealershipIds?.[0] || user.selfDeclaredDealershipId || null;
        }
        if (currentSelectedId) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(dealershipSelectionStorageKey, currentSelectedId);
            }
            if (selectedDealershipId === null) setSelectedDealershipId(currentSelectedId);
            await fetchData(currentSelectedId);
        } else setLoading(false);
    };
    fetchInitialData();
  }, [user, selectedDealershipId, fetchData, fetchAdminData, canViewAllStores, canViewAssignedStoresAggregate, dealershipSelectionStorageKey]);

  useEffect(() => {
    if (user.memberSince) {
      setMemberSince(new Date(user.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }
  }, [user.memberSince]);

  useEffect(() => {
    // Always default Team Activity back to leaderboard ranking for the current dealership.
    setTeamSortField('leaderboard');
    setTeamSortDirection('desc');
  }, [selectedDealershipId, teamActivity.length]);

  useEffect(() => {
    if (isTouring) {
      const hasSeenWelcome = sessionStorage.getItem(`tourWelcomeSeen_${user.role}`);
      if (!hasSeenWelcome) {
        setGuidedTourStep(0);
        setShowGuidedTour(true);
      }
    }
  }, [isTouring, user.role]);

  const closeGuidedTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`tourWelcomeSeen_${user.role}`, 'true');
    }
    setShowGuidedTour(false);
    setGuidedTourStep(0);
  }, [user.role]);

  const handleDealershipChange = (dealershipId: string) => {
    if (dealershipId === 'all' && !canViewAllStores && !canViewAssignedStoresAggregate) return;
    setSelectedDealershipId(dealershipId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(dealershipSelectionStorageKey, dealershipId);
    }
  };

  const formatUserDisplayName = useCallback((name?: string, email?: string) => {
    const normalizedName = (name || '').trim();
    if (normalizedName && normalizedName.toLowerCase() !== 'new user') return normalizedName;
    const localPart = (email || '').split('@')[0] || '';
    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return 'Member';
    return cleaned.split(/\s+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }, []);

  const formatTrait = useCallback((trait: CxTrait | null) => {
    if (!trait) return '-';
    return trait.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }, []);

  const getRecommendedStatus = useCallback((member: TeamMemberStats) => {
    if (isTouring) {
      const displayName = resolveTeamMemberName(member);
      if (displayName === 'Jesse Jones') {
        return {
          label: 'Overdue',
          colorClass: 'bg-red-500',
          detail: 'Jesse Jones is intentionally shown as overdue in the guided tour.',
        };
      }

      return {
        label: 'Up to date',
        colorClass: 'bg-emerald-500',
        detail: 'Guided tour teammates are shown as current.',
      };
    }

    if (member.tookRecommendedToday) {
      return {
        label: 'Today',
        colorClass: 'bg-emerald-500',
        detail: 'Recommended lesson completed today.',
      };
    }

    if (!member.lastRecommendedInteraction) {
      return {
        label: 'Overdue',
        colorClass: 'bg-red-500',
        detail: 'No recommended lesson completed yet.',
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const lastStart = new Date(member.lastRecommendedInteraction);
    lastStart.setHours(0, 0, 0, 0);
    const daysSince = Math.max(0, Math.floor((todayStart.getTime() - lastStart.getTime()) / (24 * 60 * 60 * 1000)));

    if (daysSince > 3) {
      return {
        label: 'Overdue',
        colorClass: 'bg-red-500',
        detail: `${daysSince} days since last recommended lesson.`,
      };
    }

    return {
      label: 'Due Soon',
      colorClass: 'bg-amber-400',
      detail: `${daysSince} day${daysSince === 1 ? '' : 's'} since last recommended lesson.`,
    };
  }, [isTouring]);

  const isMetricsHiddenForViewer = useCallback((member: User) => {
    if (['Admin', 'Developer', 'Trainer'].includes(user.role)) return false;
    if (user.role === 'Owner') return member.isPrivateFromOwner === true;
    return member.isPrivate === true;
  }, [user.role]);

  const sortedTeamActivity = useMemo(() => {
    const list = [...teamActivity];
    list.sort((a, b) => {
      const dir = teamSortDirection === 'asc' ? 1 : -1;
      const aPending = !!a.pendingInvite;
      const bPending = !!b.pendingInvite;
      if (aPending !== bPending) return aPending ? 1 : -1;
      switch (teamSortField) {
        case 'leaderboard': {
          const leaderboardDir = teamSortDirection === 'desc' ? 1 : -1;
          const aLevel = calculateLevel(a.totalXp).level;
          const bLevel = calculateLevel(b.totalXp).level;
          const levelDiff = bLevel - aLevel;
          if (levelDiff !== 0) return levelDiff * leaderboardDir;
          const xpDiff = b.totalXp - a.totalXp;
          if (xpDiff !== 0) return xpDiff * leaderboardDir;
          return formatUserDisplayName(a.consultant.name, a.consultant.email)
            .localeCompare(formatUserDisplayName(b.consultant.name, b.consultant.email))
            * leaderboardDir;
        }
        case 'role': return a.consultant.role.localeCompare(b.consultant.role) * dir;
        case 'lastInteraction': {
          const aTime = a.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
          const bTime = b.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
          return (aTime - bTime) * dir;
        }
        case 'topStrength': return (a.topStrength || '').localeCompare(b.topStrength || '') * dir;
        case 'weakestSkill': return (a.weakestSkill || '').localeCompare(b.weakestSkill || '') * dir;
        case 'name':
        default: return formatUserDisplayName(a.consultant.name, a.consultant.email).localeCompare(formatUserDisplayName(b.consultant.name, b.consultant.email)) * dir;
      }
    });
    return list;
  }, [teamActivity, teamSortDirection, teamSortField, formatUserDisplayName]);

  const leaderboardRankByUserId = useMemo(() => {
    const ranked = teamActivity
      .filter((member) => !member.pendingInvite)
      .slice()
      .sort((a, b) => {
        const aLevel = calculateLevel(a.totalXp).level;
        const bLevel = calculateLevel(b.totalXp).level;
        const levelDiff = bLevel - aLevel;
        if (levelDiff !== 0) return levelDiff;
        const xpDiff = b.totalXp - a.totalXp;
        if (xpDiff !== 0) return xpDiff;
        return formatUserDisplayName(a.consultant.name, a.consultant.email).localeCompare(
          formatUserDisplayName(b.consultant.name, b.consultant.email)
        );
      });

    const rankMap = new Map<string, number>();
    ranked.forEach((member, index) => {
      rankMap.set(member.consultant.userId, index + 1);
    });
    return rankMap;
  }, [teamActivity, formatUserDisplayName]);

  const toggleTeamSort = useCallback((field: TeamSortField) => {
    if (teamSortField === field) {
      setTeamSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setTeamSortField(field);
    setTeamSortDirection(field === 'leaderboard' ? 'desc' : 'asc');
  }, [teamSortField]);

  const managerAverageScores = useMemo(() => {
      if (!managerActivity.length) return { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 };
      const total = managerActivity.reduce((acc, log) => {
        acc.empathy += log.empathy || 0; acc.listening += log.listening || 0; acc.trust += log.trust || 0; acc.followUp += log.followUp || 0; acc.closing += log.closing || 0; acc.relationshipBuilding += log.relationshipBuilding || 0;
        return acc;
      }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });
      const count = managerActivity.length;
      return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Math.round(value / count)])) as any;
  }, [managerActivity]);

  const recommendedLesson = useMemo(() => {
    if (loading || lessons.length === 0 || !managerAverageScores) return null;
    const lowestScoringTrait = Object.entries(managerAverageScores).reduce((lowest, [trait, score]) => (score as number) < lowest.score ? { trait: trait as CxTrait, score: score as number } : lowest, { trait: 'empathy' as CxTrait, score: 101 });
    const assignedLessonIds = new Set(assignedLessonHistoryIds);
    const candidateLessons = lessons.filter(l => !assignedLessonIds.has(l.lessonId));
    if (dailyRecommendedLessonId) {
      const dailyLesson = candidateLessons.find((lesson) => lesson.lessonId === dailyRecommendedLessonId);
      if (dailyLesson) return dailyLesson;
    }
    const roleSpecificLessons = candidateLessons.filter(l => l.role === user.role);
    const globalLessons = candidateLessons.filter(l => l.role === 'global');
    return roleSpecificLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) || roleSpecificLessons[0] || globalLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) || globalLessons[0] || candidateLessons[0] || null;
  }, [loading, lessons, assignedLessonHistoryIds, managerAverageScores, user.role, dailyRecommendedLessonId]);

  const hasAvailableLessons = useMemo(() => {
    return !loading && ((recommendedLesson && !lessonLimits.recommendedTaken) || assignedLessons.length > 0);
  }, [loading, recommendedLesson, lessonLimits.recommendedTaken, assignedLessons.length]);
  const managerTodayDriveLessonHref = useMemo(() => {
    if (!recommendedLesson || lessonLimits.recommendedTaken) return null;
    return `/lesson/${recommendedLesson.lessonId}?recommended=true`;
  }, [lessonLimits.recommendedTaken, recommendedLesson]);
  const managerTodayDriveSkills = useMemo(() => {
    if (!recommendedLesson?.associatedTrait) return [];
    return [formatTrait(recommendedLesson.associatedTrait)];
  }, [formatTrait, recommendedLesson]);
  const dealershipInsights = useMemo(() => {
    if (!stats?.avgScores) return { bestStat: null, watchStat: null };
    const scores = Object.entries(stats.avgScores) as [CxTrait, number][];
    if (scores.length === 0) return { bestStat: null, watchStat: null };
    const bestStat = scores.reduce((max, entry) => entry[1] > max[1] ? entry : max, scores[0]);
    const watchStat = scores.reduce((min, entry) => entry[1] < min[1] ? entry : min, scores[0]);
    return { bestStat: { trait: formatTrait(bestStat[0]), score: bestStat[1] }, watchStat: { trait: formatTrait(watchStat[0]), score: watchStat[1] } };
  }, [stats, formatTrait]);
  
  async function handleUserManaged() { await fetchAdminData(); if (!['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) setManageUsersOpen(false); fetchData(selectedDealershipId); }
  async function handleInviteCreated() { await fetchAdminData(); fetchData(selectedDealershipId); }

  const handleGenerateSystemReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try { const report = await getSystemReport(user); setSystemReport(report); toast({ title: 'System Report Ready', description: `Loaded ${report.users.total} users across ${report.dealerships.total} dealerships.` }); }
    catch (e: any) { toast({ variant: 'destructive', title: 'Report Failed', description: e?.message || 'Could not generate system report.' }); }
    finally { setIsGeneratingReport(false); }
  }, [user, toast]);

  const handleRecalculateDealershipData = useCallback(async () => {
    if (!selectedDealershipId || selectedDealershipId === 'all') {
      toast({ variant: 'destructive', title: 'Select a dealership', description: 'Choose a specific dealership before recalculating data.' });
      return;
    }
    const confirmed = window.confirm('Recalculate all assigned users for this dealership from lesson history? This keeps logs but overwrites computed stats.');
    if (!confirmed) return;

    setIsRecalculatingDealership(true);
    try {
      const result = await recalculateDealershipData(selectedDealershipId);
      await fetchData(selectedDealershipId);
      toast({ title: 'Dealership recalculated', description: `Updated ${result.updatedUsers} assigned user profiles.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Recalculation failed', description: e?.message || 'Could not recalculate dealership data.' });
    } finally {
      setIsRecalculatingDealership(false);
    }
  }, [selectedDealershipId, toast, fetchData]);

  const activeScope = useMemo(() => {
    const baseScope = getDefaultScope(user);
    if (selectedDealershipId && selectedDealershipId !== 'all') return { ...baseScope, storeId: selectedDealershipId };
    return baseScope;
  }, [user, selectedDealershipId]);

  const personalScope = useMemo(() => {
    if (noPersonalDevelopmentRoles.includes(user.role)) return undefined;
    return {
      role: 'consultant' as const,
      orgId: 'autodrive-org',
      storeId: user.dealershipIds?.[0] || user.selfDeclaredDealershipId,
      userId: user.userId,
    };
  }, [user]);

  const isSuperAdmin = ['Admin', 'Developer'].includes(user.role);
  const showInsufficientDataWarning = stats?.totalLessons === -1;
  const canManage = ['Admin', 'Trainer', 'Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager', 'Developer'].includes(user.role);
  const canMessage = ['Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager'].includes(user.role);
  const isOwnerDashboardRole = user.role === 'Owner';
  const isGmDashboardRole = ['General Manager', 'manager', 'Admin', 'Developer'].includes(user.role);
  const autoForgeContext = useMemo(() => {
    const selectedDealershipName =
      selectedDealershipId === 'all'
        ? (canViewAllStores ? 'All Stores' : 'Assigned Stores')
        : (dealerships.find((dealership) => dealership.id === selectedDealershipId)?.name || 'Selected Dealership');

    const selectedScopeLabel =
      selectedDealershipId === 'all'
        ? (canViewAllStores ? 'All dealerships in scope' : 'All assigned dealerships')
        : `Dealership ${selectedDealershipName}`;

    return buildAutoForgeContext({
      department: inferDepartmentLabel(user.role),
      dealershipName: selectedDealershipName,
      dealershipScopeLabel: selectedScopeLabel,
      stats,
      teamActivity,
    });
  }, [canViewAllStores, dealerships, selectedDealershipId, stats, teamActivity, user.role]);

  const managerAutoForgeCard = (
    <Card className="flex flex-col justify-between border border-red-500/80 bg-black p-6 shadow-[0_0_0_1px_rgba(239,68,68,0.45),0_0_28px_rgba(0,0,0,0.35)] dark:border-red-400/80 dark:bg-black">
      <CardHeader className="p-0 pb-4 text-center">
        <div className="flex items-center justify-center">
          <div className="relative h-36 w-72 overflow-hidden rounded-md">
            <Image
              src="/AutoForge logo.png"
              alt="AutoForge"
              fill
              sizes="288px"
              className="object-contain"
            />
          </div>
        </div>
        <CardDescription className="text-center text-sm text-muted-foreground">
          A manager-led growth engine built from your dealership data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <AutoForgeDialog
            user={user}
            autoForgeContext={autoForgeContext}
          />
        )}
      </CardContent>
    </Card>
  );

  const effectiveLeadershipData = useMemo<DealerLeadershipResponse | null>(() => {
    if (isTouring) {
      return buildTourLeadershipData(teamActivity);
    }
    return dealerLeadershipData;
  }, [dealerLeadershipData, isTouring, teamActivity]);

  useEffect(() => {
    let active = true;
    const hasDealershipContext = (user.dealershipIds?.length ?? 0) > 0 || !!user.selfDeclaredDealershipId;
    const endpoint = isOwnerDashboardRole ? '/api/dealer/owner' : isGmDashboardRole ? '/api/dealer/gm' : null;
    const scopedDealershipId = selectedDealershipId && selectedDealershipId !== 'all'
      ? selectedDealershipId
      : null;

    if (!endpoint || !hasDealershipContext || isTouring || !firebaseUser || !scopedDealershipId) {
      setDealerLeadershipData(null);
      setDealerLeadershipError(null);
      setDealerLeadershipLoading(false);
      return () => {
        active = false;
      };
    }
    const authUser = firebaseUser;
    const requestEndpoint = `${endpoint}?dealershipId=${encodeURIComponent(scopedDealershipId)}`;

    async function fetchDealerLeadershipData() {
      setDealerLeadershipLoading(true);
      setDealerLeadershipError(null);

      try {
        const token = await authUser.getIdToken(true);
        const response = await fetch(requestEndpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || 'Unable to load dealer leadership data.');
        }
        if (!active) return;
        setDealerLeadershipData(payload as DealerLeadershipResponse);
      } catch (error) {
        if (!active) return;
        setDealerLeadershipData(null);
        setDealerLeadershipError(error instanceof Error ? error.message : 'Unable to load dealer leadership data.');
      } finally {
        if (active) {
          setDealerLeadershipLoading(false);
        }
      }
    }

    void fetchDealerLeadershipData();
    return () => {
      active = false;
    };
  }, [firebaseUser, isOwnerDashboardRole, isGmDashboardRole, isTouring, selectedDealershipId, user.dealershipIds, user.selfDeclaredDealershipId]);

  const isOwnerLeadershipData = (value: DealerLeadershipResponse | null): value is DealerOwnerDashboardResponse => {
    return !!value && 'snapshot' in value;
  };

  const shouldShowSurfaceToggle = true;
  const trainingSurfaceHref = '/';
  const isToolsActive = Boolean(pathname?.startsWith('/tools') || pathname?.startsWith('/autoshop'));
  const isTrainingActive = !isToolsActive;

  const renderSurfaceToggle = (className?: string) => {
    if (!shouldShowSurfaceToggle) return null;

    return (
      <div
        className={cn(
          'inline-flex items-center rounded-full border p-1 shadow-[0_10px_24px_rgba(0,0,0,0.32)]',
          isTrainingActive
            ? 'border-[#45c7ff]/85 bg-gradient-to-r from-[#0f3d72] via-[#1362b6] to-[#0f4f92]'
            : 'border-[#1a6eb6]/85 bg-gradient-to-r from-[#061d38] via-[#092e55] to-[#072444]',
          className
        )}
      >
        <Link
          href={trainingSurfaceHref}
          className={cn(
            'rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all',
            isTrainingActive
              ? 'bg-gradient-to-r from-[#53d7ff] to-[#2c98ff] text-[#031a34] shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_10px_20px_rgba(18,132,228,0.5)]'
              : 'text-[#b2d9ff] hover:bg-[#2cc3ff]/16'
          )}
          prefetch={false}
        >
          Drive
        </Link>
        <Link
          href="/autoshop"
          className={cn(
            'rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all',
            isToolsActive
              ? 'bg-gradient-to-r from-[#63e36f] to-[#37c86a] text-[#083618] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_8px_16px_rgba(56,183,97,0.35)]'
              : 'text-[#b2d9ff] hover:bg-[#2cc3ff]/16'
          )}
        >
          AutoShop
        </Link>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-8 text-foreground">
      <ManagerGuidedTour
        open={showGuidedTour}
        stepIndex={guidedTourStep}
        onStepChange={setGuidedTourStep}
        onSkip={closeGuidedTour}
        onFinish={closeGuidedTour}
      />
      <BaselineAssessmentDialog user={user} open={showBaselineAssessment} onOpenChange={setShowBaselineAssessment} onCompleted={async () => { setShowBaselineAssessment(false); setNeedsBaselineAssessment(false); await fetchData(selectedDealershipId); }} />
      <header className="relative flex flex-wrap items-center justify-between gap-3">
          <Logo variant="full" width={183} height={61} />
          {renderSurfaceToggle('absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:inline-flex')}
          <div className="flex items-center gap-3">
            {(canViewAllStores || (dealerships && dealerships.length > 1)) && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">Dealership:</span>
                <Select value={selectedDealershipId || ''} onValueChange={handleDealershipChange}>
                  <SelectTrigger className="w-[220px] bg-background h-9 text-xs">
                    <SelectValue placeholder="Select a dealership" />
                  </SelectTrigger>
                  <SelectContent>
                    {(canViewAllStores || canViewAssignedStoresAggregate) && (
                      <SelectItem value="all">{canViewAllStores ? 'All Stores' : 'All Assigned Stores'}</SelectItem>
                    )}
                    {dealerships.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {renderSurfaceToggle('md:hidden')}
            <UserNav user={user} avatarClassName="h-14 w-14" />
          </div>
      </header>

      <section className="space-y-3">
            {loading ? <Skeleton className="h-24 w-full" /> : <div><LevelDisplay user={user} />{memberSince && <p className="text-sm text-muted-foreground mt-2">Member since {memberSince}</p>}</div>}
      </section>

      <section className="space-y-3">
        <TodaysDriveCard
          recommendedLessonHref={managerTodayDriveLessonHref}
          improvementSkills={managerTodayDriveSkills}
        />
      </section>

      {/* Control Bar - Repositioned below Identity */}
      <div className="flex flex-col md:flex-row items-center justify-center bg-card/50 backdrop-blur-sm border rounded-xl p-3 gap-4">
          <div className="flex bg-muted p-1 rounded-lg border">
              <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('team')}
                  className={cn(
                      "h-8 px-4 text-xs font-bold uppercase transition-all duration-300",
                      viewMode === 'team' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"
                  )}
              >
                  Team View
              </Button>
              {!noPersonalDevelopmentRoles.includes(user.role) && (
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('personal')}
                      className={cn(
                          "h-8 px-4 text-xs font-bold uppercase transition-all duration-300",
                          viewMode === 'personal' 
                            ? "bg-background text-foreground shadow-sm" 
                            : (hasAvailableLessons ? "text-[#8DC63F] drop-shadow-[0_0_8px_rgba(141,198,63,0.5)]" : "text-muted-foreground/60")
                      )}
                  >
                      My Development
                  </Button>
              )}
          </div>
      </div>

      <section data-manager-tour="team-scores">
        <CxSoundwaveCard 
          scope={activeScope} 
          personalScope={personalScope}
          data={viewMode === 'team' ? stats?.avgScores : managerAverageScores} 
          memberSince={user.memberSince} 
          themePreference={themePreference} 
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          range={range}
          onRangeChange={setRange}
          actionLabel="Update"
          onActionClick={handleRecalculateDealershipData}
          actionDisabled={isRecalculatingDealership || !selectedDealershipId || selectedDealershipId === 'all'}
          actionLoading={isRecalculatingDealership}
          hideInternalToggle 
        />
      </section>

      <section>
        <Card className={dashboardFeatureCardClass}>
          <CardHeader>
            <CardTitle>CX Command Center</CardTitle>
            <CardDescription>
              Leadership briefing view combining digest, risks, goals, alerts, performance, and coaching priority.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {commandCenterLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !commandCenter ? (
              <p className="text-sm text-muted-foreground">Command Center data is not available yet for this scope.</p>
            ) : (
              <>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold">Weekly Digest Summary</p>
                  <p className="mt-1 text-sm">{commandCenter.weeklyDigestSummary.headline}</p>
                  {commandCenter.weeklyDigestSummary.topInsights.slice(0, 3).map((line, index) => (
                    <p key={`cc-weekly-${index}`} className="mt-1 text-xs text-muted-foreground">• {line}</p>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-semibold">Active Risks</p>
                    <p className="text-xs text-muted-foreground mt-1">{commandCenter.activeRiskRadarSummary.totalActiveRisks} active</p>
                    {commandCenter.activeRiskRadarSummary.topRisks.slice(0, 2).map((risk) => (
                      <p key={risk.riskId} className="mt-1 text-xs text-muted-foreground">• {risk.riskType.replace(/_/g, ' ')} ({risk.riskLevel})</p>
                    ))}
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-semibold">Goals</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Active {commandCenter.goalsAndTargetsSummary.activeGoals} • At Risk {commandCenter.goalsAndTargetsSummary.atRisk}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      On Track {commandCenter.goalsAndTargetsSummary.onTrack} • Stalled {commandCenter.goalsAndTargetsSummary.stalled}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs font-semibold">Alerts</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total {commandCenter.activeAlertsSummary.totalActiveAlerts} • High {commandCenter.activeAlertsSummary.highSeverityAlerts}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Goal {commandCenter.activeAlertsSummary.goalRelatedAlerts} • Version {commandCenter.activeAlertsSummary.versionRelatedAlerts}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold">Coaching Intelligence</p>
                  {commandCenter.coachingIntelligence ? (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">{commandCenter.coachingIntelligence.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Supporting Evidence:</span> {commandCenter.coachingIntelligence.supportingEvidence}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Recommended Practice:</span> {commandCenter.coachingIntelligence.recommendedPractice}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Suggested AutoForge:</span> {commandCenter.coachingIntelligence.suggestedAutoForgeModule}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-muted-foreground">{commandCenter.coachingPrioritySummary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Recommended AutoForge:</span> {commandCenter.autoForgeRecommendationSummary.module}
                      </p>
                    </>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold">{`${roleLabels.interactionLabel} Performance Snapshot`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sessions {commandCenter.freshUpPerformanceSnapshot.totalFreshUpSessions} • {roleLabels.meterLabel} Peak {commandCenter.freshUpPerformanceSnapshot.averageUpMeterPeak} • Trust Shift {commandCenter.freshUpPerformanceSnapshot.averageTrustShift}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Emp {commandCenter.freshUpPerformanceSnapshot.averageEmpathy} • Lis {commandCenter.freshUpPerformanceSnapshot.averageListening} • Trust {commandCenter.freshUpPerformanceSnapshot.averageTrust}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold">Trend + Benchmark Highlights</p>
                  {commandCenter.trendHighlights.slice(0, 3).map((trend, index) => (
                    <p key={`cc-trend-${index}`} className="mt-1 text-xs text-muted-foreground">
                      • {trend.label}: {trend.delta > 0 ? '+' : ''}{trend.delta}
                    </p>
                  ))}
                  {commandCenter.benchmarkSnapshot.highlights.slice(0, 2).map((highlight, index) => (
                    <p key={`cc-bench-${index}`} className="mt-1 text-xs text-muted-foreground">
                      • {highlight.metricName}: {highlight.difference > 0 ? '+' : ''}{highlight.difference}
                    </p>
                  ))}
                </div>
                {commandCenter.narrativeSummary && (
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-xs font-semibold">Leadership Narrative</p>
                    <p className="mt-1 text-sm text-muted-foreground">{commandCenter.narrativeSummary.narrative}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {(pppFeatureEnabled || saasPppFeatureEnabled) && (
          <section>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {pppFeatureEnabled && (
                    <PppDashboardCard user={user} featureEnabled={pppFeatureEnabled} className={dashboardFeatureCardClass} />
                  )}
                  {saasPppFeatureEnabled && (
                    <SaasPppDashboardCard user={user} featureEnabled={saasPppFeatureEnabled} className={dashboardFeatureCardClass} />
                  )}
              </div>
          </section>
      )}

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Dealer AutoForge</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground/95">
            Your dealership execution engine and the supporting tools that keep it moving.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {managerAutoForgeCard}
          <AutoshopCard />
        </div>
      </section>

      {viewMode === 'team' ? (
          <>
            <Card data-manager-tour="team-stats">
              <CardHeader><CardTitle>Team Statistics</CardTitle><CardDescription>{selectedDealershipId === 'all' ? (canViewAllStores ? 'Across all dealerships' : 'Across assigned dealerships') : `Performance overview`}</CardDescription></CardHeader>
              <CardContent>
                  {loading ? <Skeleton className="h-24 w-full" /> : showInsufficientDataWarning ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-6 text-center"><Info className="h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">Insufficient Data</h3><p className="max-w-md text-sm text-muted-foreground">Aggregated stats are only shown for active teams of 3 or more members.</p></div>
                  ) : (
                      <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                          <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4"/>Total Lessons</p><p className="text-2xl font-bold">{stats?.totalLessons.toString() || '0'}</p></div>
                          <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/>{teamContext.memberLabel}</p><p className="text-2xl font-bold">{teamActivity.length.toString()}</p></div>
                          <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="h-4 w-4"/>Total XP</p><p className="text-2xl font-bold">{teamActivity.reduce((sum, member) => sum + member.totalXp, 0).toLocaleString()}</p></div>
                          <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500"/>Top Skill</p><p className="text-2xl font-bold">{dealershipInsights.bestStat?.trait || 'N/A'}</p></div>
                          <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-500"/>Watch Area</p><p className={cn("text-2xl font-bold", dealershipInsights.watchStat && dealershipInsights.watchStat.score < 50 && "text-destructive")}>{dealershipInsights.watchStat?.trait || 'N/A'}</p></div>
                          <div className="space-y-1"><p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4"/>Avg. Empathy</p><p className="text-2xl font-bold">{stats?.avgScores ? `${stats.avgScores.empathy}%` : 'N/A'}</p></div>
                      </div>
                  )}
              </CardContent>
            </Card>

            <Card data-manager-tour="team-activity">
                <CardHeader className="flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div><CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5" />Team Activity</CardTitle></div>
                        <div className="flex flex-wrap gap-2" data-manager-tour="team-actions">
                            {canManage && (
                                <Dialog open={isManageUsersOpen} onOpenChange={setManageUsersOpen}>
                                    <DialogTrigger asChild><Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" />Manage Team</Button></DialogTrigger>
                                    <DialogContent className="sm:max-w-[625px]">
                                        <DialogHeader><DialogTitle>Manage Team</DialogTitle></DialogHeader>
                                        <ScrollArea className="max-h-[70vh] p-1">
                                            <Tabs defaultValue="invite" className="pt-4">
                                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="invite">Invite New</TabsTrigger><TabsTrigger value="assign">Assign Existing</TabsTrigger></TabsList>
                                                <TabsContent value="invite" className="pt-2"><RegisterDealershipForm user={user} dealerships={dealerships} onUserInvited={handleInviteCreated} /></TabsContent>
                                                <TabsContent value="assign" className="pt-2"><AssignUserForm manageableUsers={manageableUsers} dealerships={dealerships} currentUser={user} onUserAssigned={handleUserManaged} /></TabsContent>
                                            </Tabs>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                            )}
                            {canMessage && (
                                <Dialog open={isMessageDialogOpen} onOpenChange={setMessageDialogOpen}>
                                    <DialogTrigger asChild><Button variant="outline" size="sm"><MessageSquare className="mr-2 h-4 w-4" />Message</Button></DialogTrigger>
                                    <DialogContent className="sm:max-w-[625px]">
                                        <DialogHeader><DialogTitle>Send Message</DialogTitle></DialogHeader>
                                        <SendMessageForm user={user} dealerships={dealerships} onMessageSent={() => setMessageDialogOpen(false)} />
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-40 w-full" /> : (
                        <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-center">
                                  <button type="button" className="mx-auto inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleTeamSort('leaderboard')}>
                                    Leaderboard
                                    <ArrowUpDown className={cn("h-3.5 w-3.5", teamSortField === 'leaderboard' ? 'text-foreground' : 'text-muted-foreground')} />
                                  </button>
                                </TableHead>
                                <TableHead>
                                  <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleTeamSort('name')}>
                                    Member
                                    <ArrowUpDown className={cn("h-3.5 w-3.5", teamSortField === 'name' ? 'text-foreground' : 'text-muted-foreground')} />
                                  </button>
                                </TableHead>
                                <TableHead>
                                  <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleTeamSort('role')}>
                                    Role
                                    <ArrowUpDown className={cn("h-3.5 w-3.5", teamSortField === 'role' ? 'text-foreground' : 'text-muted-foreground')} />
                                  </button>
                                </TableHead>
                                <TableHead className="text-center">Recommended</TableHead>
                                <TableHead className="text-center">
                                  <button type="button" className="mx-auto inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleTeamSort('lastInteraction')}>
                                    Last Active
                                    <ArrowUpDown className={cn("h-3.5 w-3.5", teamSortField === 'lastInteraction' ? 'text-foreground' : 'text-muted-foreground')} />
                                  </button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <button type="button" className="mx-auto inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleTeamSort('topStrength')}>
                                    Top Skill
                                    <ArrowUpDown className={cn("h-3.5 w-3.5", teamSortField === 'topStrength' ? 'text-foreground' : 'text-muted-foreground')} />
                                  </button>
                                </TableHead>
                                <TableHead className="text-center">
                                  <button type="button" className="mx-auto inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleTeamSort('weakestSkill')}>
                                    Watch Area
                                    <ArrowUpDown className={cn("h-3.5 w-3.5", teamSortField === 'weakestSkill' ? 'text-foreground' : 'text-muted-foreground')} />
                                  </button>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedTeamActivity.length > 0 ? sortedTeamActivity.map((member) => (
                                    <Dialog key={member.consultant.userId}>
                                        <DialogTrigger asChild>
                                          <TableRow className="cursor-pointer">
                                            <TableCell className="text-center align-middle font-semibold text-muted-foreground">
                                              {member.pendingInvite ? '-' : `${leaderboardRankByUserId.get(member.consultant.userId) ?? '-'}`}
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-4">
                                                {(() => {
                                                  const memberName = formatUserDisplayName(member.consultant.name, member.consultant.email);
                                                  const avatarScores = getUserAvatarScores(member.consultant);
                                                  const hasAvatarActivity =
                                                    !member.pendingInvite
                                                    && !!avatarScores
                                                    && Object.values(avatarScores).some((value) => value > 0);
                                                  const avatarThemePreference = resolveThemePreference(
                                                    member.consultant.themePreference,
                                                    member.consultant.useProfessionalTheme
                                                  );

                                                  return (
                                                    <>
                                                      <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center mr-1">
                                                        <AvatarSoundRing
                                                          scores={avatarScores}
                                                          hasActivity={hasAvatarActivity}
                                                          themePreference={avatarThemePreference}
                                                          className="inset-[-33%] h-[166%] w-[166%]"
                                                        />
                                                        <Avatar className="relative z-10 h-full w-full border-2 border-slate-700">
                                                          <AvatarImage src={member.consultant.avatarUrl} />
                                                          <AvatarFallback>{memberName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                      </div>
                                                      <div className="pl-1">
                                                        <p className="font-medium">{memberName}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                          {!!member.pendingInvite ? 'Pending invitation' : `Level ${calculateLevel(member.consultant.xp).level}`}
                                                        </p>
                                                        {!member.pendingInvite && (
                                                          <p className="text-xs text-muted-foreground">
                                                            {member.totalXp.toLocaleString()} XP
                                                          </p>
                                                        )}
                                                      </div>
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                <UiBadge variant="outline">
                                                  {member.consultant.role === 'manager' ? 'Sales Manager' : member.consultant.role}
                                                </UiBadge>
                                                {!!member.pendingInvite && <UiBadge variant="secondary">Invited</UiBadge>}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                              {!!member.pendingInvite
                                                ? '-'
                                                : isMetricsHiddenForViewer(member.consultant)
                                                  ? 'Private'
                                                  : (() => {
                                                    const status = getRecommendedStatus(member);
                                                    return (
                                                      <div className="inline-flex items-center gap-2" title={status.detail}>
                                                        <span className={cn('h-2.5 w-2.5 rounded-full', status.colorClass)} />
                                                        <span>{status.label}</span>
                                                      </div>
                                                    );
                                                  })()}
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                              {!!member.pendingInvite
                                                ? '-'
                                                : isMetricsHiddenForViewer(member.consultant)
                                                  ? 'Private'
                                                  : member.lastInteraction
                                                    ? new Date(member.lastInteraction).toLocaleDateString()
                                                    : 'New'}
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                              {!!member.pendingInvite
                                                ? '-'
                                                : isMetricsHiddenForViewer(member.consultant)
                                                  ? 'Private'
                                                  : formatTrait(member.topStrength)}
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                              {!!member.pendingInvite
                                                ? '-'
                                                : isMetricsHiddenForViewer(member.consultant)
                                                  ? 'Private'
                                                  : formatTrait(member.weakestSkill)}
                                            </TableCell>
                                          </TableRow>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Performance Snapshot</DialogTitle></DialogHeader><ScrollArea className="max-h-[70vh]"><div className="pr-6"><TeamMemberCard user={member.consultant} currentUser={user} dealerships={dealerships} onAssignmentUpdated={async () => { await fetchData(selectedDealershipId || user.dealershipIds?.[0] || user.selfDeclaredDealershipId || null); }} /></div></ScrollArea></DialogContent>
                                    </Dialog>
                                )) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No team activity found.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Dealership Activity</CardTitle>
                  <CardDescription>
                    Recent lesson completions and XP gains for {selectedDealershipId === 'all' ? 'the current scope' : 'this dealership'}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : dealershipActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No lesson activity found for this selection.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Lesson</TableHead>
                          <TableHead className="text-right">XP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dealershipActivity.map((entry) => (
                          <TableRow key={`${entry.userId}-${entry.lessonId}-${new Date(entry.timestamp).getTime()}`}>
                            <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                            <TableCell>{formatUserDisplayName(entry.memberName)}</TableCell>
                            <TableCell>{entry.memberRole === 'manager' ? 'Sales Manager' : entry.memberRole}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{entry.lessonId}</span>
                                {entry.isRecommended && <UiBadge variant="secondary">Recommended</UiBadge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {entry.xpGained >= 0 ? `+${entry.xpGained}` : entry.xpGained}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </>
      ) : (
          <div className="space-y-8">
              <section><BadgeShowcase badges={managerBadges} /></section>
          </div>
      )}

      {isSuperAdmin && (
          <Card>
              <CardHeader><CardTitle>Admin Operations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleGenerateSystemReport} disabled={isGeneratingReport}>
                      {isGeneratingReport ? 'Generating...' : 'System Report'}
                    </Button>
                  </div>
                  {systemReport && <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border p-3"><div><p className="text-sm text-muted-foreground">Users</p><p className="font-semibold">Total: {systemReport.users.total}</p></div><div><p className="text-sm text-muted-foreground">Dealerships</p><p className="font-semibold">Active: {systemReport.dealerships.active}</p></div><div><p className="text-sm text-muted-foreground">Performance</p><p className="font-semibold">Avg: {systemReport.performance.averageScore}%</p></div></div>}
              </CardContent>
          </Card>
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">*XP is earned based on interaction quality.</p>
    </div>
  );
}
