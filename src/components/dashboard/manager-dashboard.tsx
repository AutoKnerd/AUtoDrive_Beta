
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LessonLog, Lesson, LessonRole, CxTrait, Dealership, Badge, UserRole, PendingInvitation, ThemePreference } from '@/lib/definitions';
import { managerialRoles, noPersonalDevelopmentRoles, allRoles } from '@/lib/definitions';
import { getCombinedTeamData, getLessons, getConsultantActivity, getDealerships, getDealershipById, getManageableUsers, getEarnedBadgesByUserId, getDailyLessonLimits, getPendingInvitations, createInvitationLink, getAssignedLessons, getAllAssignedLessonIds, getSystemReport, getPppAccessForUser, getSaasPppAccessForUser } from '@/lib/data.client';
import type { SystemReport } from '@/lib/data.client';
import { BarChart, BookOpen, CheckCircle, ShieldOff, Smile, Star, Users, PlusCircle, Store, TrendingUp, TrendingDown, Building, MessageSquare, Ear, Handshake, Repeat, Target, Info, Settings, ArrowUpDown, ListChecks, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge as UiBadge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button, buttonVariants } from '../ui/button';
import { CreateLessonForm } from '../lessons/create-lesson-form';
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
import { CreatedLessonsView } from '../lessons/created-lessons-view';
import { CxSoundwaveCard, type CxRange } from '@/components/cx/CxSoundwaveCard';
import { getDefaultScope } from '@/lib/cx/scope';
import { PppDashboardCard } from '@/components/ppp/ppp-dashboard-card';
import { SaasPppDashboardCard } from '@/components/saas-ppp/saas-ppp-dashboard-card';

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
  pendingInvite?: PendingInvitation;
};
type TeamSortField = 'name' | 'role' | 'lastInteraction' | 'topStrength' | 'weakestSkill';

type DealershipInsight = {
    trait: string;
    score: number;
};

const dashboardFeatureCardClass =
  'border border-border bg-card/95 shadow-sm dark:border-cyan-400/30 dark:bg-slate-900/50 dark:backdrop-blur-md dark:shadow-lg dark:shadow-cyan-500/10';
const dashboardDisabledButtonClass =
  'w-full border-border bg-muted/70 text-muted-foreground dark:border-slate-700 dark:bg-slate-800/50';

function resolveThemePreference(value: unknown, useProfessionalTheme?: boolean): ThemePreference {
  const raw = String(value || '').trim().toLowerCase();

  if (raw === 'vibrant' || raw.includes('vibrant neon')) return 'vibrant';
  if (raw === 'executive' || raw.includes('elite executive')) return 'executive';
  if (raw === 'steel' || raw.includes('professional steel')) return 'steel';

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
  const { originalUser, isTouring } = useAuth();
  const [stats, setStats] = useState<{ totalLessons: number; avgScores: Record<CxTrait, number> | null } | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamMemberStats[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [managerActivity, setManagerActivity] = useState<LessonLog[]>([]);
  const [managerBadges, setManagerBadges] = useState<Badge[]>([]);
  const [assignedLessons, setAssignedLessons] = useState<Lesson[]>([]);
  const [assignedLessonHistoryIds, setAssignedLessonHistoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateLessonOpen, setCreateLessonOpen] = useState(false);
  const [isCreatedLessonsOpen, setCreatedLessonsOpen] = useState(false);
  const [createdLessonsRefreshKey, setCreatedLessonsRefreshKey] = useState(0);
  const [isManageUsersOpen, setManageUsersOpen] = useState(false);
  const [isMessageDialogOpen, setMessageDialogOpen] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [lessonLimits, setLessonLimits] = useState({ recommendedTaken: false, otherTaken: false });
  const [showTourWelcome, setShowTourWelcome] = useState(false);
  const [pppFeatureEnabled, setPppFeatureEnabled] = useState(false);
  const [saasPppFeatureEnabled, setSaasPppFeatureEnabled] = useState(false);

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealershipsForAdmin, setAllDealershipsForAdmin] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [teamSortField, setTeamSortField] = useState<TeamSortField>('name');
  const [teamSortDirection, setTeamSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showBaselineAssessment, setShowBaselineAssessment] = useState(false);
  const [needsBaselineAssessment, setNeedsBaselineAssessment] = useState(false);
  const [systemReport, setSystemReport] = useState<SystemReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [range, setRange] = useState<CxRange>('today');
  const router = useRouter();

  const themePreference = user.themePreference || (user.useProfessionalTheme ? 'executive' : 'vibrant');

  const teamContext = useMemo(() => {
    switch (user.role) {
      case 'manager': return { memberLabel: 'Sales Consultants', description: 'Across your sales team' };
      case 'Service Manager': return { memberLabel: 'Service Writers', description: 'Across your service team' };
      case 'Parts Manager': return { memberLabel: 'Parts Consultants', description: 'Across your parts team' };
      default: return { memberLabel: 'Team Members', description: 'Across your entire team' };
    }
  }, [user.role]);

  const fetchData = useCallback(async (dealershipId: string | null) => {
      if (!dealershipId) return;
      setLoading(true);
      try {
          const combinedDataPromise = getCombinedTeamData(dealershipId, user);
          const [combinedData, usersToManage, fetchedLessons, fetchedManagerActivity, fetchedBadges, fetchedAssignedLessons, fetchedAssignedHistoryIds, limits, pendingInvitations, pppAccessEnabled, saasPppAccessEnabled] = await Promise.all([
            combinedDataPromise,
            getManageableUsers(user.userId),
            getLessons(user.role as LessonRole, user.userId),
            getConsultantActivity(user.userId),
            getEarnedBadgesByUserId(user.userId),
            getAssignedLessons(user.userId),
            getAllAssignedLessonIds(user.userId),
            getDailyLessonLimits(user.userId),
            getPendingInvitations(dealershipId, user),
            getPppAccessForUser(user, dealershipId).catch(() => false),
            getSaasPppAccessForUser(user, dealershipId).catch(() => false),
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
          const teamActivityByUserId = new Map<string, TeamMemberStats>(
            hydratedTeamRows.map((row: TeamMemberStats) => [row.consultant.userId, row])
          );

          const visibleActiveUsers = usersToManage.filter((u) => {
            if (dealershipId === 'all') return ['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role);
            return u.dealershipIds?.includes(dealershipId);
          });

          visibleActiveUsers.forEach((u) => {
            if (!teamActivityByUserId.has(u.userId)) {
              teamActivityByUserId.set(u.userId, {
                consultant: u, lessonsCompleted: 0, totalXp: u.xp, avgScore: 0, topStrength: null, weakestSkill: null, lastInteraction: null,
              });
            }
          });

          const pendingRows: TeamMemberStats[] = pendingInvitations.map((invite) => ({
            consultant: { userId: `invite-${invite.token}`, name: invite.email.split('@')[0] || invite.email, email: invite.email, role: invite.role, dealershipIds: [invite.dealershipId], avatarUrl: '', xp: 0 },
            lessonsCompleted: 0, totalXp: 0, avgScore: 0, topStrength: null, weakestSkill: null, lastInteraction: null, pendingInvite: invite,
          }));

          setTeamActivity([...Array.from(teamActivityByUserId.values()), ...pendingRows]);
          setManageableUsers(usersToManage);
          setLessons(fetchedLessons);
          setManagerActivity(fetchedManagerActivity);
          setManagerBadges(fetchedBadges);
          setAssignedLessons(fetchedAssignedLessons);
          setAssignedLessonHistoryIds(fetchedAssignedHistoryIds);
          setLessonLimits(limits);
          setPppFeatureEnabled(pppAccessEnabled === true);
          setSaasPppFeatureEnabled(saasPppAccessEnabled === true);
          const baselineEligible = !['Owner', 'Trainer', 'Admin', 'Developer'].includes(user.role);
          const hasBaselineLog = fetchedManagerActivity.some(log => String(log.lessonId || '').startsWith('baseline-'));
          const baselineRequired = !isTouring && baselineEligible && !hasBaselineLog;
          setNeedsBaselineAssessment(baselineRequired);
          setShowBaselineAssessment(baselineRequired);
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
          setLoading(false);
      }
  }, [user, isTouring, toast]);

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
            if (['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) currentSelectedId = 'all';
            else if (initialDealerships.length > 0) currentSelectedId = initialDealerships[0].id;
        }
        if (currentSelectedId) {
            if (selectedDealershipId === null) setSelectedDealershipId(currentSelectedId);
            await fetchData(currentSelectedId);
        } else setLoading(false);
    };
    fetchInitialData();
  }, [user, selectedDealershipId, fetchData, fetchAdminData]);

  useEffect(() => {
    if (user.memberSince) {
      setMemberSince(new Date(user.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }
  }, [user.memberSince]);

  useEffect(() => {
    if (isTouring) {
      const hasSeenWelcome = sessionStorage.getItem(`tourWelcomeSeen_${user.role}`);
      if (!hasSeenWelcome) setShowTourWelcome(true);
    }
  }, [isTouring, user.role]);
  
  const handleWelcomeDialogChange = (open: boolean) => {
    if (!open) sessionStorage.setItem(`tourWelcomeSeen_${user.role}`, 'true');
    setShowTourWelcome(open);
  }

  const handleLessonCreated = () => {
    setCreateLessonOpen(false);
    setCreatedLessonsRefreshKey((current) => current + 1);
  };

  const handleDealershipChange = (dealershipId: string) => setSelectedDealershipId(dealershipId);

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
    const roleSpecificLessons = candidateLessons.filter(l => l.role === user.role);
    const globalLessons = candidateLessons.filter(l => l.role === 'global');
    return roleSpecificLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) || roleSpecificLessons[0] || globalLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) || globalLessons[0] || candidateLessons[0] || null;
  }, [loading, lessons, assignedLessonHistoryIds, managerAverageScores, user.role]);

  const hasAvailableLessons = useMemo(() => {
    return !loading && ((recommendedLesson && !lessonLimits.recommendedTaken) || assignedLessons.length > 0);
  }, [loading, recommendedLesson, lessonLimits.recommendedTaken, assignedLessons.length]);

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

  const activeScope = useMemo(() => {
    const baseScope = getDefaultScope(user);
    if (selectedDealershipId && selectedDealershipId !== 'all') return { ...baseScope, storeId: selectedDealershipId };
    return baseScope;
  }, [user, selectedDealershipId]);

  const personalScope = useMemo(() => {
    if (noPersonalDevelopmentRoles.includes(user.role)) return undefined;
    return { role: 'consultant' as const, orgId: 'autodrive-org', storeId: user.dealershipIds?.[0], userId: user.userId };
  }, [user]);

  const isSuperAdmin = ['Admin', 'Developer'].includes(user.role);
  const showInsufficientDataWarning = stats?.totalLessons === -1;
  const canManage = ['Admin', 'Trainer', 'Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager', 'Developer'].includes(user.role);
  const canMessage = ['Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager'].includes(user.role);

  return (
    <div className="space-y-8 pb-8 text-foreground">
      <BaselineAssessmentDialog user={user} open={showBaselineAssessment} onOpenChange={setShowBaselineAssessment} onCompleted={async () => { setShowBaselineAssessment(false); setNeedsBaselineAssessment(false); await fetchData(selectedDealershipId); }} />
      <Dialog open={showTourWelcome} onOpenChange={handleWelcomeDialogChange}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle className="text-2xl">Welcome, {user.role === 'manager' ? 'Sales Manager' : user.role}!</DialogTitle>
                  <DialogDescription className="pt-2">This is your command center. From here, you can monitor team-wide statistics, track individual member activity, and create custom training lessons.</DialogDescription>
              </DialogHeader>
          </DialogContent>
      </Dialog>
      <header className="flex items-center justify-between">
          <Logo variant="full" width={183} height={61} />
          <UserNav user={user} avatarClassName="h-14 w-14" />
      </header>

      <section className="space-y-3">
            {loading ? <Skeleton className="h-24 w-full" /> : <div><LevelDisplay user={user} />{memberSince && <p className="text-sm text-muted-foreground mt-2">Member since {memberSince}</p>}</div>}
      </section>

      {/* Control Bar - Repositioned below Identity */}
      <div className="flex flex-col md:flex-row items-center justify-center bg-card/50 backdrop-blur-sm border rounded-xl p-3 gap-4">
          {(['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role) || (dealerships && dealerships.length > 1)) && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">Dealership:</span>
                  <Select value={selectedDealershipId || ''} onValueChange={handleDealershipChange}>
                      <SelectTrigger className="w-full md:w-[240px] bg-background h-9 text-xs">
                          <SelectValue placeholder="Select a dealership" />
                      </SelectTrigger>
                      <SelectContent>
                          {['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role) && <SelectItem value="all">All Stores</SelectItem>}
                          {dealerships.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
          )}
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

      <section>
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
          hideInternalToggle 
        />
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

      {viewMode === 'team' ? (
          <>
            <Card>
              <CardHeader><CardTitle>Team Statistics</CardTitle><CardDescription>{selectedDealershipId === 'all' ? 'Across all dealerships' : `Performance overview`}</CardDescription></CardHeader>
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

            <Card>
                <CardHeader className="flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div><CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5" />Team Activity</CardTitle></div>
                        <div className="flex flex-wrap gap-2">
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
                            <Dialog open={isCreatedLessonsOpen} onOpenChange={setCreatedLessonsOpen}>
                                <DialogTrigger asChild><Button variant="outline" size="sm"><ListChecks className="mr-2 h-4 w-4" />Created Lessons</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-[820px]">
                                    <DialogHeader><DialogTitle>Created Lessons</DialogTitle></DialogHeader>
                                    <ScrollArea className="max-h-[70vh] pr-6"><CreatedLessonsView user={user} refreshKey={createdLessonsRefreshKey} /></ScrollArea>
                                </DialogContent>
                            </Dialog>
                            <Dialog open={isCreateLessonOpen} onOpenChange={setCreateLessonOpen}>
                                <DialogTrigger asChild><Button size="sm"><PlusCircle className="mr-2 h-4 w-4" />Create Lesson</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-[625px]">
                                    <DialogHeader><DialogTitle>Create New Lesson</DialogTitle></DialogHeader>
                                    <CreateLessonForm user={user} onLessonCreated={handleLessonCreated} />
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-40 w-full" /> : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead className="text-center">Last Active</TableHead><TableHead className="text-center">Top Skill</TableHead><TableHead className="text-center">Watch Area</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {sortedTeamActivity.length > 0 ? sortedTeamActivity.map(member => (
                                    <Dialog key={member.consultant.userId}>
                                        <DialogTrigger asChild>
                                          <TableRow className="cursor-pointer">
                                            <TableCell>
                                              <div className="flex items-center gap-3">
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
                                                      <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center">
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
                                                      <div>
                                                        <p className="font-medium">{memberName}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                          {!!member.pendingInvite ? 'Pending invitation' : `Level ${calculateLevel(member.consultant.xp).level}`}
                                                        </p>
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
                                        <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Performance Snapshot</DialogTitle></DialogHeader><ScrollArea className="max-h-[70vh]"><div className="pr-6"><TeamMemberCard user={member.consultant} currentUser={user} dealerships={dealerships} onAssignmentUpdated={() => fetchData(selectedDealershipId)} /></div></ScrollArea></DialogContent>
                                    </Dialog>
                                )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No team activity found.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
          </>
      ) : (
          <div className="space-y-8">
              <section className="space-y-4">
                  <h2 className="text-xl font-bold text-foreground">My Development</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className={`flex flex-col justify-between p-6 ${dashboardFeatureCardClass}`}>
                          <div><div className="flex items-center gap-3 mb-2"><BookOpen className="h-8 w-8 text-primary dark:text-cyan-400" /><h3 className="text-2xl font-bold text-foreground">Recommended</h3></div><p className="text-sm text-muted-foreground mb-4">A daily lesson focused on your area for improvement.</p></div>
                          {loading ? <Skeleton className="h-10 w-full" /> : needsBaselineAssessment ? (
                              <div className="grid grid-cols-2 gap-2"><Button className="w-full font-bold bg-[#8DC63F] text-black" onClick={() => setShowBaselineAssessment(true)}>Baseline Assessment</Button></div>
                          ) : recommendedLesson && !lessonLimits.recommendedTaken ? (
                              <Link href={`/lesson/${recommendedLesson.lessonId}?recommended=true`} className={cn("w-full", buttonVariants({ className: "w-full font-bold" }))}>{recommendedLesson.title}</Link>
                          ) : <Button variant="outline" disabled className={dashboardDisabledButtonClass}>{recommendedLesson ? <><CheckCircle className="mr-2 h-4 w-4" /> Complete</> : "No lesson available"}</Button>}
                      </Card>
                      <Card className={`flex flex-col justify-between p-6 ${dashboardFeatureCardClass}`}>
                          <div><div className="flex items-center gap-3 mb-2"><BookOpen className="h-8 w-8 text-primary dark:text-cyan-400" /><h3 className="text-2xl font-bold text-foreground">Assigned</h3></div><p className="text-sm text-muted-foreground mb-4">Training assigned specifically to you.</p></div>
                          {loading ? <Skeleton className="h-10 w-full" /> : assignedLessons.length > 0 ? (
                              <Link href={`/lesson/${assignedLessons[0].lessonId}`} className={cn("w-full text-black", buttonVariants({ className: "w-full font-bold bg-[#8DC63F]" }))}>{assignedLessons[0].title}</Link>
                          ) : <Button variant="outline" disabled className={dashboardDisabledButtonClass}>No assignments</Button>}
                      </Card>
                  </div>
              </section>
              <section><BadgeShowcase badges={managerBadges} /></section>
          </div>
      )}

      {isSuperAdmin && (
          <Card>
              <CardHeader><CardTitle>Admin Operations</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex gap-2"><Button onClick={handleGenerateSystemReport} disabled={isGeneratingReport}>{isGeneratingReport ? 'Generating...' : 'System Report'}</Button></div>
                  {systemReport && <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border p-3"><div><p className="text-sm text-muted-foreground">Users</p><p className="font-semibold">Total: {systemReport.users.total}</p></div><div><p className="text-sm text-muted-foreground">Dealerships</p><p className="font-semibold">Active: {systemReport.dealerships.active}</p></div><div><p className="text-sm text-muted-foreground">Performance</p><p className="font-semibold">Avg: {systemReport.performance.averageScore}%</p></div></div>}
              </CardContent>
          </Card>
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">*XP is earned based on interaction quality.</p>
    </div>
  );
}
