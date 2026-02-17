

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LessonLog, Lesson, LessonRole, CxTrait, Dealership, Badge, UserRole, PendingInvitation } from '@/lib/definitions';
import { managerialRoles, noPersonalDevelopmentRoles, allRoles } from '@/lib/definitions';
import { getCombinedTeamData, getLessons, getConsultantActivity, getDealerships, getDealershipById, getManageableUsers, getEarnedBadgesByUserId, getDailyLessonLimits, getPendingInvitations, createInvitationLink, getAssignedLessons, getAllAssignedLessonIds, getSystemReport } from '@/lib/data.client';
import type { SystemReport } from '@/lib/data.client';
import { BarChart, BookOpen, CheckCircle, ShieldOff, Smile, Star, Users, PlusCircle, Store, TrendingUp, TrendingDown, Building, MessageSquare, Ear, Handshake, Repeat, Target, Info, Settings, ArrowUpDown, ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge as UiBadge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

const metricIcons: Record<CxTrait, React.ElementType> = {
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
                <span className="text-muted-foreground">{levelXp.toLocaleString()} / {nextLevelXp.toLocaleString()}</span>
                <p className="text-muted-foreground">{user.role === 'manager' ? 'Sales Manager' : user.role}</p>
            </div>
             <p className="text-cyan-400 text-right font-semibold">Total: {user.xp.toLocaleString()} XP</p>
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


  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealershipsForAdmin, setAllDealershipsForAdmin] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [allDealershipStats, setAllDealershipStats] = useState<Record<string, { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null }>>({});
  const [pendingInviteLinksByKey, setPendingInviteLinksByKey] = useState<Record<string, string>>({});
  const [isResendingInvite, setIsResendingInvite] = useState<string | null>(null);
  const [teamSortField, setTeamSortField] = useState<TeamSortField>('name');
  const [teamSortDirection, setTeamSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showBaselineAssessment, setShowBaselineAssessment] = useState(false);
  const [needsBaselineAssessment, setNeedsBaselineAssessment] = useState(false);
  const [systemReport, setSystemReport] = useState<SystemReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const router = useRouter();


  const teamContext = useMemo(() => {
    switch (user.role) {
      case 'manager':
        return { memberLabel: 'Sales Consultants', description: 'Across your sales team' };
      case 'Service Manager':
        return { memberLabel: 'Service Writers', description: 'Across your service team' };
      case 'Parts Manager':
        return { memberLabel: 'Parts Consultants', description: 'Across your parts team' };
      default:
        return { memberLabel: 'Team Members', description: 'Across your entire team' };
    }
  }, [user.role]);

  const fetchData = useCallback(async (dealershipId: string | null) => {
      if (!dealershipId) return;

      setLoading(true);
      
      const combinedDataPromise = getCombinedTeamData(dealershipId, user);

      const [combinedData, usersToManage, fetchedLessons, fetchedManagerActivity, fetchedBadges, fetchedAssignedLessons, fetchedAssignedHistoryIds, limits, pendingInvitations] = await Promise.all([
        combinedDataPromise,
        getManageableUsers(user.userId),
        getLessons(user.role as LessonRole, user.userId),
        getConsultantActivity(user.userId),
        getEarnedBadgesByUserId(user.userId),
        getAssignedLessons(user.userId),
        getAllAssignedLessonIds(user.userId),
        getDailyLessonLimits(user.userId),
        getPendingInvitations(dealershipId, user),
      ]);
      
      setStats(combinedData.managerStats);
      const teamActivityByUserId = new Map<string, TeamMemberStats>(
        combinedData.teamActivity.map((row) => [row.consultant.userId, row])
      );

      const visibleActiveUsers = usersToManage.filter((u) => {
        if (dealershipId === 'all') {
          return ['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role);
        }
        return u.dealershipIds?.includes(dealershipId);
      });

      visibleActiveUsers.forEach((u) => {
        if (!teamActivityByUserId.has(u.userId)) {
          teamActivityByUserId.set(u.userId, {
            consultant: u,
            lessonsCompleted: 0,
            totalXp: u.xp,
            avgScore: 0,
            topStrength: null,
            weakestSkill: null,
            lastInteraction: null,
          });
        }
      });

      const pendingRows: TeamMemberStats[] = pendingInvitations.map((invite) => ({
        consultant: {
          userId: `invite-${invite.token}`,
          name: invite.email.split('@')[0] || invite.email,
          email: invite.email,
          role: invite.role,
          dealershipIds: [invite.dealershipId],
          avatarUrl: '',
          xp: 0,
        },
        lessonsCompleted: 0,
        totalXp: 0,
        avgScore: 0,
        topStrength: null,
        weakestSkill: null,
        lastInteraction: null,
        pendingInvite: invite,
      }));

      const mergedRoster = [...Array.from(teamActivityByUserId.values()), ...pendingRows].sort((a, b) =>
        a.consultant.name.localeCompare(b.consultant.name)
      );

      setTeamActivity(mergedRoster);
      setManageableUsers(usersToManage);
      setLessons(fetchedLessons);
      setManagerActivity(fetchedManagerActivity);
      setManagerBadges(fetchedBadges);
      setAssignedLessons(fetchedAssignedLessons);
      setAssignedLessonHistoryIds(fetchedAssignedHistoryIds);
      setLessonLimits(limits);
      const baselineEligible = !['Owner', 'Trainer', 'Admin', 'Developer'].includes(user.role);
      const hasBaselineLog = fetchedManagerActivity.some(log => String(log.lessonId || '').startsWith('baseline-'));
      const baselineRequired = !isTouring && baselineEligible && !hasBaselineLog;
      setNeedsBaselineAssessment(baselineRequired);
      setShowBaselineAssessment(baselineRequired);
      setLoading(false);
  }, [user, isTouring]);

  const fetchAdminData = useCallback(async () => {
    const fetchedDealerships = await getDealerships(user);
    if (['Admin', 'Developer'].includes(user.role)) {
      setAllDealershipsForAdmin(fetchedDealerships);
    }
    setDealerships(fetchedDealerships.filter(d => ['Admin', 'Developer'].includes(user.role) ? true : d.status !== 'deactivated'));
  }, [user]);

  useEffect(() => {
    const fetchInitialData = async () => {
        if (!managerialRoles.includes(user.role)) {
            return;
        }
        setLoading(true);

        await fetchAdminData();
        let initialDealerships: Dealership[] = await getDealerships(user);
        
        let currentSelectedId = selectedDealershipId;

        if (currentSelectedId === null) {
            if (['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
                currentSelectedId = 'all';
            } else if (initialDealerships.length > 0) {
                currentSelectedId = initialDealerships[0].id;
            }
        }
       
        if (currentSelectedId === 'all' && ['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
            const statsPromises = initialDealerships.map(d => getCombinedTeamData(d.id, user).then(data => data.managerStats));
            const results = await Promise.all(statsPromises);
            
            const newAllDealershipStats: Record<string, { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null }> = {};
            
            results.forEach((result, index) => {
                const dealershipId = initialDealerships[index].id;
                let insights: { bestStat: DealershipInsight | null, watchStat: DealershipInsight | null } = { bestStat: null, watchStat: null };

                if (result && result.avgScores) {
                    const scores = Object.entries(result.avgScores) as [CxTrait, number][];
                    if (scores.length > 0) {
                         const bestStatEntry = scores.reduce((max, entry) => entry[1] > max[1] ? entry : max, scores[0]);
                         const watchStatEntry = scores.reduce((min, entry) => entry[1] < min[1] ? entry : min, scores[0]);
                         const formatTrait = (trait: CxTrait) => trait.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                         insights = {
                            bestStat: { trait: formatTrait(bestStatEntry[0]), score: bestStatEntry[1] },
                            watchStat: { trait: formatTrait(watchStatEntry[0]), score: watchStatEntry[1] }
                         };
                    }
                }
                newAllDealershipStats[dealershipId] = insights;
            });
            setAllDealershipStats(newAllDealershipStats);
        }

        if (currentSelectedId) {
            if (selectedDealershipId === null) { // Set initial ID if not set
                setSelectedDealershipId(currentSelectedId);
            }
            await fetchData(currentSelectedId);
        } else {
            setLoading(false);
        }
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

  const handleLessonCreated = () => {
    setCreateLessonOpen(false);
    setCreatedLessonsRefreshKey((current) => current + 1);
  };

  const handleDealershipChange = (dealershipId: string) => {
    setSelectedDealershipId(dealershipId);
  };

  const formatUserDisplayName = useCallback((name?: string, email?: string) => {
    const normalizedName = (name || '').trim();
    if (normalizedName && normalizedName.toLowerCase() !== 'new user') {
      return normalizedName;
    }
    const localPart = (email || '').split('@')[0] || '';
    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return 'Member';
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, []);

  const formatTrait = useCallback((trait: CxTrait) => {
    return trait.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }, []);

  const isMetricsHiddenForViewer = useCallback((member: User) => {
    if (['Admin', 'Developer', 'Trainer'].includes(user.role)) return false;
    if (user.role === 'Owner') return member.isPrivateFromOwner === true;
    return member.isPrivate === true;
  }, [user.role]);

  const isCriticalOnlyForViewer = useCallback((member: User) => {
    if (!managerialRoles.includes(user.role)) return false;
    if (member.userId === user.userId) return false;
    if (isMetricsHiddenForViewer(member)) return false;
    return member.showDealerCriticalOnly === true;
  }, [user.role, user.userId, isMetricsHiddenForViewer]);

  const handleTeamSort = useCallback((field: TeamSortField) => {
    if (teamSortField === field) {
      setTeamSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setTeamSortField(field);
    setTeamSortDirection('asc');
  }, [teamSortField]);

  const sortedTeamActivity = useMemo(() => {
    const list = [...teamActivity];
    list.sort((a, b) => {
      const dir = teamSortDirection === 'asc' ? 1 : -1;
      const aPending = !!a.pendingInvite;
      const bPending = !!b.pendingInvite;
      if (aPending !== bPending) return aPending ? 1 : -1;

      switch (teamSortField) {
        case 'role':
          return a.consultant.role.localeCompare(b.consultant.role) * dir;
        case 'lastInteraction': {
          const aTime = a.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
          const bTime = b.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
          return (aTime - bTime) * dir;
        }
        case 'topStrength':
          return (a.topStrength || '').localeCompare(b.topStrength || '') * dir;
        case 'weakestSkill':
          return (a.weakestSkill || '').localeCompare(b.weakestSkill || '') * dir;
        case 'name':
        default:
          return formatUserDisplayName(a.consultant.name, a.consultant.email).localeCompare(
            formatUserDisplayName(b.consultant.name, b.consultant.email)
          ) * dir;
      }
    });
    return list;
  }, [teamActivity, teamSortDirection, teamSortField, formatUserDisplayName]);

  const managerAverageScores = useMemo(() => {
      if (!managerActivity.length) {
        return {
            empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0
        };
      }

      const total = managerActivity.reduce((acc, log) => {
        acc.empathy += log.empathy || 0;
        acc.listening += log.listening || 0;
        acc.trust += log.trust || 0;
        acc.followUp += log.followUp || 0;
        acc.closing += log.closing || 0;
        acc.relationshipBuilding += log.relationshipBuilding || 0;
        return acc;
      }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

      const count = managerActivity.length;
      
      return Object.fromEntries(
          Object.entries(total).map(([key, value]) => [key, Math.round(value / count)])
      ) as typeof total;
  }, [managerActivity]);

  const getPendingInviteKey = useCallback((invite: PendingInvitation) => {
    return `${invite.email.toLowerCase()}::${invite.dealershipId}::${invite.role}`;
  }, []);

  const getPendingInviteUrl = useCallback(
    (invite: PendingInvitation) => {
      const key = getPendingInviteKey(invite);
      const linkFromState = pendingInviteLinksByKey[key];
      if (linkFromState) return linkFromState;
      if (typeof window !== 'undefined') return `${window.location.origin}/register?token=${invite.token}`;
      return `/register?token=${invite.token}`;
    },
    [getPendingInviteKey, pendingInviteLinksByKey]
  );

  const copyPendingInviteLink = useCallback(
    async (invite: PendingInvitation) => {
      try {
        await navigator.clipboard.writeText(getPendingInviteUrl(invite));
        toast({ title: 'Link Copied', description: `Copied invite link for ${invite.email}.` });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Copy Failed',
          description: 'Could not copy invite link on this device.',
        });
      }
    },
    [getPendingInviteUrl, toast]
  );

  const regeneratePendingInviteLink = useCallback(
    async (invite: PendingInvitation) => {
      const key = getPendingInviteKey(invite);
      setIsResendingInvite(key);
      try {
        const { url } = await createInvitationLink(invite.dealershipId, invite.email, invite.role, user.userId);
        setPendingInviteLinksByKey((prev) => ({ ...prev, [key]: url }));
        await navigator.clipboard.writeText(url).catch(() => {});
        toast({
          title: 'New Invite Link Generated',
          description: `A fresh link for ${invite.email} is ready${typeof navigator !== 'undefined' ? ' and copied.' : '.'}`,
        });
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Resend Failed',
          description: e?.message || 'Could not generate a new invite link.',
        });
      } finally {
        setIsResendingInvite(null);
      }
    },
    [getPendingInviteKey, toast, user.userId]
  );

  const recommendedLesson = useMemo(() => {
    if (loading || lessons.length === 0 || !managerAverageScores) return null;

    const lowestScoringTrait = Object.entries(managerAverageScores).reduce((lowest, [trait, score]) => {
        if (score < lowest.score) {
            return { trait: trait as CxTrait, score };
        }
        return lowest;
    }, { trait: 'empathy' as CxTrait, score: 101 });

    const assignedLessonIds = new Set(assignedLessonHistoryIds);
    const candidateLessons = lessons.filter(l => !assignedLessonIds.has(l.lessonId));
    const roleSpecificLessons = candidateLessons.filter(l => l.role === user.role);
    const globalLessons = candidateLessons.filter(l => l.role === 'global');

    return (
      roleSpecificLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) ||
      roleSpecificLessons[0] ||
      globalLessons.find(l => l.associatedTrait === lowestScoringTrait.trait) ||
      globalLessons[0] ||
      candidateLessons[0] ||
      null
    );
  }, [loading, lessons, assignedLessonHistoryIds, managerAverageScores, user.role]);

  const statDescription = useMemo(() => {
    if (['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
      const dealershipName = dealerships.find(d => d.id === selectedDealershipId)?.name;
      return selectedDealershipId === 'all' ? 'Across all dealerships' : `For ${dealershipName}`;
    }
    return teamContext.description;
  }, [user.role, selectedDealershipId, dealerships, teamContext.description]);

  const dealershipInsights = useMemo(() => {
    if (!stats?.avgScores) {
        return { bestStat: null, watchStat: null };
    }

    const scores = Object.entries(stats.avgScores) as [CxTrait, number][];
    
    if (scores.length === 0) {
        return { bestStat: null, watchStat: null };
    }

    const bestStat = scores.reduce((max, entry) => entry[1] > max[1] ? entry : max, scores[0]);
    const watchStat = scores.reduce((min, entry) => entry[1] < min[1] ? entry : min, scores[0]);

    const formatTrait = (trait: CxTrait) => trait.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    return {
        bestStat: { trait: formatTrait(bestStat[0]), score: bestStat[1] },
        watchStat: { trait: formatTrait(watchStat[0]), score: watchStat[1] }
    };
  }, [stats]);
  
  async function handleUserManaged() {
    await fetchAdminData();
    if (!['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role)) {
        setManageUsersOpen(false);
    }
    fetchData(selectedDealershipId);
  }

  async function handleInviteCreated() {
    await fetchAdminData();
    fetchData(selectedDealershipId);
  }

  const getStatusBadge = (status: Dealership['status']) => {
      switch(status) {
          case 'active':
              return <UiBadge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Active</UiBadge>;
          case 'paused':
              return <UiBadge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/30">Paused</UiBadge>;
          case 'deactivated':
              return <UiBadge variant="destructive">Deactivated</UiBadge>;
      }
  }

  const isDeveloperViewing = originalUser?.role === 'Developer';
  const showPersonalDevelopment = !noPersonalDevelopmentRoles.includes(user.role) && !isDeveloperViewing;
  const isSoloManager = teamActivity.length === 0 && selectedDealershipId !== 'all' && !loading;
  const canManage = ['Admin', 'Trainer', 'Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager', 'Developer'].includes(user.role);
  const canMessage = ['Owner', 'General Manager', 'manager', 'Service Manager', 'Parts Manager'].includes(user.role);
  const isSuperAdmin = ['Admin', 'Developer'].includes(user.role);
  const showInsufficientDataWarning = stats?.totalLessons === -1;
  
  const handleGenerateSystemReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const report = await getSystemReport(user);
      setSystemReport(report);
      toast({
        title: 'System Report Ready',
        description: `Loaded ${report.users.total} users across ${report.dealerships.total} dealerships.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Report Failed',
        description: e?.message || 'Could not generate system report.',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [user, toast]);

  const downloadSystemReportCsv = useCallback(() => {
    if (!systemReport) return;
    const headers = [
      'userId',
      'name',
      'email',
      'role',
      'dealerships',
      'subscriptionStatus',
      'lessonsCompleted',
      'totalXp',
      'avgScore',
      'lastInteraction',
      'isActive30d',
    ];

    const escapeCsv = (value: unknown) => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = systemReport.rows.map((row) => [
      row.userId,
      row.name,
      row.email,
      row.role,
      row.dealershipNames.join('|'),
      row.subscriptionStatus || '',
      row.lessonsCompleted,
      row.totalXp,
      row.avgScore ?? '',
      row.lastInteraction ? new Date(row.lastInteraction).toISOString() : '',
      row.isActive30d ? 'yes' : 'no',
    ]);

    const lines = [
      `Generated At,${new Date(systemReport.generatedAt).toISOString()}`,
      `Total Users,${systemReport.users.total}`,
      `Active Users (30d),${systemReport.users.active30d}`,
      `Owners Total,${systemReport.users.ownersTotal}`,
      `Owners Active (30d),${systemReport.users.ownersActive30d}`,
      `Dealerships Total,${systemReport.dealerships.total}`,
      `Dealerships Active,${systemReport.dealerships.active}`,
      `Dealerships Paused,${systemReport.dealerships.paused}`,
      `Dealerships Deactivated,${systemReport.dealerships.deactivated}`,
      `Total Lessons Completed,${systemReport.performance.totalLessonsCompleted}`,
      `Average Score,${systemReport.performance.averageScore ?? ''}`,
      `Total XP,${systemReport.performance.totalXp}`,
      '',
      headers.join(','),
      ...rows.map((r) => r.map(escapeCsv).join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `autodrive-system-report-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [systemReport]);

  const managerialTitle =
    user.role === 'Owner' || user.role === 'General Manager'
      ? 'Dealership Leader'
      : user.role === 'manager'
      ? 'Sales Manager'
      : user.role;

  return (
    <div className="space-y-8 pb-8">
      <BaselineAssessmentDialog
        user={user}
        open={showBaselineAssessment}
        onOpenChange={setShowBaselineAssessment}
        onCompleted={async () => {
          setShowBaselineAssessment(false);
          setNeedsBaselineAssessment(false);
          await fetchData(selectedDealershipId);
        }}
      />
        <Dialog open={showTourWelcome} onOpenChange={handleWelcomeDialogChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-2xl">Welcome, {managerialTitle}!</DialogTitle>
                    <DialogDescription className="pt-2">
                    This is your command center. From here, you can monitor team-wide statistics, track individual member activity, and create custom training lessons.
                    <br /><br />
                    <strong>To begin, try creating a new lesson for your team or select a dealership to view detailed performance insights.</strong>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
      </Dialog>
      <header className="flex items-center justify-between">
          <Logo variant="full" width={183} height={61} />
          <UserNav user={user} avatarClassName="h-14 w-14 border-2 border-cyan-400/50" withBlur />
      </header>
    
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
            {loading ? (
            <Skeleton className="h-40 w-full" />
            ) : (
            <BadgeShowcase badges={managerBadges} />
            )}
        </section>

        {isSuperAdmin && (
             <Tabs defaultValue="dealership" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dealership">Create Dealership</TabsTrigger>
                    <TabsTrigger value="invite">Invite User</TabsTrigger>
                </TabsList>
                <TabsContent value="dealership">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Dealership</CardTitle>
                            <CardDescription>Add a new dealership to the system. This must be done before you can invite users to it.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CreateDealershipForm user={user} onDealershipCreated={handleUserManaged} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="invite">
                    <Card>
                        <CardHeader>
                            <CardTitle>Invite New User</CardTitle>
                            <CardDescription>Send an email invitation for a new user to join a dealership.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RegisterDealershipForm
                                user={user}
                                dealerships={allDealershipsForAdmin}
                                onUserInvited={handleInviteCreated}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        )}

        {isSuperAdmin && (
            <Card>
                <CardHeader>
                    <CardTitle>System Report</CardTitle>
                    <CardDescription>Run a complete report for active owners, dealerships, users, and performance stats.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleGenerateSystemReport} disabled={isGeneratingReport}>
                            {isGeneratingReport ? 'Generating...' : 'Generate Report'}
                        </Button>
                        <Button variant="outline" onClick={downloadSystemReportCsv} disabled={!systemReport}>
                            Download CSV
                        </Button>
                    </div>
                    {systemReport && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="rounded-md border p-3">
                                <p className="text-sm text-muted-foreground">Users</p>
                                <p className="font-semibold">Total: {systemReport.users.total}</p>
                                <p className="font-semibold">Active (30d): {systemReport.users.active30d}</p>
                                <p className="font-semibold">Owners Active: {systemReport.users.ownersActive30d}/{systemReport.users.ownersTotal}</p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="text-sm text-muted-foreground">Dealerships</p>
                                <p className="font-semibold">Total: {systemReport.dealerships.total}</p>
                                <p className="font-semibold">Active: {systemReport.dealerships.active}</p>
                                <p className="font-semibold">Paused/Deactivated: {systemReport.dealerships.paused}/{systemReport.dealerships.deactivated}</p>
                            </div>
                            <div className="rounded-md border p-3">
                                <p className="text-sm text-muted-foreground">Performance</p>
                                <p className="font-semibold">Lessons: {systemReport.performance.totalLessonsCompleted}</p>
                                <p className="font-semibold">Avg Score: {systemReport.performance.averageScore ?? 'N/A'}%</p>
                                <p className="font-semibold">Total XP: {systemReport.performance.totalXp.toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

        {showPersonalDevelopment && (
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">My Development</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="flex flex-col justify-between p-6 bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 shadow-lg shadow-cyan-500/10">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <BookOpen className="h-8 w-8 text-cyan-400" />
                                <h3 className="text-2xl font-bold text-white">Recommended Lesson</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">A daily lesson focused on your area for greatest improvement as a leader.</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : needsBaselineAssessment ? (
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
                    <Card className="flex flex-col justify-between p-6 bg-slate-900/50 backdrop-blur-md border border-cyan-400/30 shadow-lg shadow-cyan-500/10">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <BookOpen className="h-8 w-8 text-cyan-400" />
                                <h3 className="text-2xl font-bold text-white">Assigned Lesson</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">Manager-assigned training you can complete in addition to your recommended lesson.</p>
                        </div>
                        {loading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : assignedLessons.length > 0 ? (
                            <Link
                              href={`/lesson/${assignedLessons[0].lessonId}`}
                              className={cn(
                                "w-full text-black hover:text-black",
                                buttonVariants({
                                  className: "w-full font-bold bg-[#8DC63F] hover:bg-[#7FB735] shadow-[0_0_20px_rgba(141,198,63,0.35)]",
                                })
                              )}
                            >
                                Start: {assignedLessons[0].title}
                            </Link>
                        ) : (
                            <Button variant="outline" disabled className="w-full bg-slate-800/50 border-slate-700">
                                No assigned lessons
                            </Button>
                        )}
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>My Personal CX Scores</CardTitle>
                            <CardDescription>Your performance across completed lessons.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-x-8 gap-y-4">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                        ) : managerAverageScores ? (
                            Object.entries(managerAverageScores).map(([key, value]) => {
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
                </div>
            </section>
        )}

      {(['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role) || (dealerships && dealerships.length > 1)) && (
        <Card>
            <CardHeader>
                <CardTitle>Dealership Overview</CardTitle>
                <CardDescription>Select a dealership to view its performance statistics.</CardDescription>
            </CardHeader>
            <CardContent>
                <Select value={selectedDealershipId || ''} onValueChange={handleDealershipChange}>
                    <SelectTrigger className="w-full md:w-1/3">
                        <SelectValue placeholder="Select a dealership" />
                    </SelectTrigger>
                    <SelectContent>
                        {['Owner', 'Admin', 'Trainer', 'General Manager', 'Developer'].includes(user.role) && <SelectItem value="all">All Dealerships</SelectItem>}
                        {dealerships.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      )}
      
      {isSoloManager ? (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, Manager!</CardTitle>
                    <CardDescription>Your dashboard is ready. Onboard your team to unlock powerful analytics and coaching tools.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6 text-center">
                        <div className="rounded-full border bg-background p-3">
                            <Users className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold">Ready to build a winning team?</h3>
                        <p className="max-w-md text-muted-foreground">Add your dealership and invite your team members to start tracking progress and assigning custom training.</p>
                         <Dialog open={isManageUsersOpen} onOpenChange={setManageUsersOpen}>
                            <DialogTrigger asChild>
                                <Button size="lg">
                                    <PlusCircle className="mr-2 h-5 w-5" />
                                    Onboard Your Team
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="sm:max-w-[625px]">
                                <DialogHeader>
                                    <DialogTitle>Manage Team</DialogTitle>
                                    <DialogDescription>
                                        Invite new team members and manage their dealership assignments.
                                    </DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="max-h-[70vh] p-1">
                                    <Tabs defaultValue="invite" className="pt-4">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="invite">Invite New</TabsTrigger>
                                            <TabsTrigger value="assign">Assign Existing</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="invite" className="pt-2">
                                             <RegisterDealershipForm
                                                user={user}
                                                dealerships={dealerships}
                                                onUserInvited={handleInviteCreated}
                                            />
                                        </TabsContent>
                                        <TabsContent value="assign" className="pt-2">
                                            <AssignUserForm 
                                                manageableUsers={manageableUsers}
                                                dealerships={dealerships}
                                                currentUser={user}
                                                onUserAssigned={handleUserManaged} 
                                            />
                                        </TabsContent>
                                    </Tabs>
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

        </>
      ) : (
        <>
            <Card>
              <CardHeader>
                <CardTitle>Team Statistics</CardTitle>
                <CardDescription>{statDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                  {loading ? (
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                      </div>
                  ) : showInsufficientDataWarning ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-6 text-center">
                        <Info className="h-8 w-8 text-muted-foreground" />
                        <h3 className="font-semibold">Insufficient Data for Reporting</h3>
                        <p className="max-w-md text-sm text-muted-foreground">To protect individual privacy, aggregated performance statistics are only shown for active teams of 3 or more members.</p>
                    </div>
                  ) : (
                      <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4"/>Total Lessons</p>
                              <p className="text-2xl font-bold">{stats?.totalLessons.toString() || '0'}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4"/>{teamContext.memberLabel}</p>
                              <p className="text-2xl font-bold">{teamActivity.length.toString()}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="h-4 w-4"/>Total XP</p>
                              <p className="text-2xl font-bold">{teamActivity.reduce((sum, member) => sum + member.totalXp, 0).toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500"/>Top Skill</p>
                              <p className="text-2xl font-bold">{dealershipInsights.bestStat?.trait || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-500"/>Watch Area</p>
                              <p className={cn("text-2xl font-bold", dealershipInsights.watchStat && dealershipInsights.watchStat.score < 50 && "text-destructive")}>
                                  {dealershipInsights.watchStat?.trait || 'N/A'}
                              </p>
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4"/>Avg. Empathy</p>
                              <p className="text-2xl font-bold">{stats?.avgScores ? `${stats.avgScores.empathy}%` : 'N/A'}</p>
                          </div>
                      </div>
                  )}
              </CardContent>
            </Card>
      
            {user.role !== 'Finance Manager' && !isSuperAdmin && (
              <Card>
                  <CardHeader className="flex-col gap-4">
                      <div>
                          <CardTitle className="flex items-center gap-2">
                              <BarChart className="h-5 w-5" />
                              Team Activity
                          </CardTitle>
                          <CardDescription>
                              {selectedDealershipId === 'all'
                                  ? 'Select a dealership to view its team activity.'
                                  : `Activity overview for ${dealerships.find(d => d.id === selectedDealershipId)?.name}.`}
                          </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {canManage && (
                              <Dialog open={isManageUsersOpen} onOpenChange={setManageUsersOpen}>
                                  <DialogTrigger asChild>
                                      <Button variant="outline">
                                          {isDeveloperViewing ? <Settings className="mr-2 h-4 w-4" /> : <Users className="mr-2 h-4 w-4" />}
                                          {isDeveloperViewing ? 'Admin Panel' : 'Manage Team'}
                                      </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[625px]">
                                      <DialogHeader>
                                          <DialogTitle>{isDeveloperViewing ? 'Admin Panel' : 'Manage Team'}</DialogTitle>
                                          <DialogDescription>
                                            {isDeveloperViewing ? 'Invite new users, manage assignments, dealerships, and remove users across the platform.' : 'Invite new team members and manage their dealership assignments.'}
                                          </DialogDescription>
                                      </DialogHeader>
                                      <ScrollArea className="max-h-[70vh] p-1">
                                          <Tabs defaultValue="invite" className="pt-4">
                                              <TabsList className={`grid w-full ${isDeveloperViewing || isSuperAdmin ? 'grid-cols-4' : 'grid-cols-2'}`}>
                                                  <TabsTrigger value="invite">Invite New</TabsTrigger>
                                                  <TabsTrigger value="assign">Assign Existing</TabsTrigger>
                                                  {(isDeveloperViewing || isSuperAdmin) && <TabsTrigger value="remove" className="text-destructive">Remove User</TabsTrigger>}
                                                  {(isDeveloperViewing || isSuperAdmin) && <TabsTrigger value="dealerships">Dealerships</TabsTrigger>}
                                              </TabsList>
                                              <TabsContent value="invite" className="pt-2">
                                                  <RegisterDealershipForm
                                                      user={user}
                                                      dealerships={dealerships}
                                                      onUserInvited={handleInviteCreated}
                                                  />
                                              </TabsContent>
                                              <TabsContent value="assign" className="pt-2">
                                                  <AssignUserForm 
                                                      manageableUsers={manageableUsers}
                                                      dealerships={dealerships}
                                                      currentUser={user}
                                                      onUserAssigned={handleUserManaged} 
                                                  />
                                              </TabsContent>
                                              {(isDeveloperViewing || isSuperAdmin) && (
                                                  <TabsContent value="remove" className="pt-2">
                                                      <RemoveUserForm 
                                                          manageableUsers={manageableUsers}
                                                          onUserRemoved={handleUserManaged} 
                                                      />
                                                  </TabsContent>
                                              )}
                                              {(isDeveloperViewing || isSuperAdmin) && (
                                                  <TabsContent value="dealerships" className="pt-2">
                                                      <ManageDealershipForm 
                                                          dealerships={allDealershipsForAdmin}
                                                          onDealershipManaged={handleUserManaged} 
                                                      />
                                                  </TabsContent>
                                              )}
                                          </Tabs>
                                      </ScrollArea>
                                  </DialogContent>
                              </Dialog>
                          )}
                          {canMessage && (
                              <Dialog open={isMessageDialogOpen} onOpenChange={setMessageDialogOpen}>
                                  <DialogTrigger asChild>
                                      <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4" /> Send Message</Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[625px]">
                                      <DialogHeader>
                                      <DialogTitle>Send a new message</DialogTitle>
                                      <DialogDescription>
                                          Broadcast a message to your team, a dealership, or the entire organization.
                                      </DialogDescription>
                                      </DialogHeader>
                                      <SendMessageForm user={user} dealerships={dealerships} onMessageSent={() => setMessageDialogOpen(false)} />
                                  </DialogContent>
                              </Dialog>
                          )}
                          <Dialog open={isCreatedLessonsOpen} onOpenChange={setCreatedLessonsOpen}>
                              <DialogTrigger asChild>
                                  <Button variant="outline">
                                      <ListChecks className="mr-2 h-4 w-4" />
                                      View Created Lessons
                                  </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[820px]">
                                  <DialogHeader>
                                      <DialogTitle>Created Lessons</DialogTitle>
                                      <DialogDescription>
                                          Track which custom lessons have been assigned and taken by your team.
                                      </DialogDescription>
                                  </DialogHeader>
                                  <CreatedLessonsView user={user} refreshKey={createdLessonsRefreshKey} />
                              </DialogContent>
                          </Dialog>
                          <Dialog open={isCreateLessonOpen} onOpenChange={setCreateLessonOpen}>
                              <DialogTrigger asChild>
                                  <Button>
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      Create Lesson
                                  </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[625px]">
                                  <DialogHeader>
                                      <DialogTitle>Create New Training Lesson</DialogTitle>
                                      <DialogDescription>
                                          Design a new lesson for your team. Use AI to suggest a scenario based on your team's performance.
                                      </DialogDescription>
                                  </DialogHeader>
                                  <CreateLessonForm user={user} onLessonCreated={handleLessonCreated} />
                                  </DialogContent>
                          </Dialog>
                      </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : selectedDealershipId && selectedDealershipId !== 'all' ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleTeamSort('name')}>
                                Team Member <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleTeamSort('role')}>
                                Role <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">
                              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleTeamSort('lastInteraction')}>
                                Last Interaction <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">
                              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleTeamSort('topStrength')}>
                                Top Strength <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead className="text-center">
                              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => handleTeamSort('weakestSkill')}>
                                Area for Improvement <ArrowUpDown className="ml-1 h-3 w-3" />
                              </Button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedTeamActivity.length > 0 ? sortedTeamActivity.map(member => {
                            const isPendingInvite = !!member.pendingInvite;
                            return (
                              <Dialog key={member.consultant.userId}>
                                <DialogTrigger asChild>
                                    <TableRow className="cursor-pointer">
                                        <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                            <AvatarImage src={member.consultant.avatarUrl} data-ai-hint="person portrait" />
                                            <AvatarFallback>{formatUserDisplayName(member.consultant.name, member.consultant.email).charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                            <p className="font-medium">{formatUserDisplayName(member.consultant.name, member.consultant.email)}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {isPendingInvite
                                                ? 'Pending invitation'
                                                : `Level ${calculateLevel(member.consultant.xp).level} • ${member.consultant.xp.toLocaleString()} XP`}
                                            </p>
                                            </div>
                                        </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                              <UiBadge variant="outline">{member.consultant.role === 'manager' ? 'Sales Manager' : member.consultant.role}</UiBadge>
                                              {isPendingInvite && <UiBadge variant="secondary">Pending Invite</UiBadge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-medium">
                                          {isPendingInvite
                                            ? '-'
                                            : isMetricsHiddenForViewer(member.consultant)
                                              ? 'Private'
                                              : isCriticalOnlyForViewer(member.consultant)
                                                ? 'Critical only'
                                                : member.lastInteraction
                                                  ? new Date(member.lastInteraction).toLocaleDateString()
                                                  : 'No interactions yet'}
                                        </TableCell>
                                        <TableCell className="text-center font-medium">
                                          {isPendingInvite
                                            ? '-'
                                            : isMetricsHiddenForViewer(member.consultant)
                                              ? 'Private'
                                            : member.topStrength
                                              ? formatTrait(member.topStrength)
                                              : 'Not enough data'}
                                        </TableCell>
                                        <TableCell className="text-center font-medium">
                                          {isPendingInvite
                                            ? '-'
                                            : isMetricsHiddenForViewer(member.consultant)
                                              ? 'Private'
                                            : member.weakestSkill
                                              ? formatTrait(member.weakestSkill)
                                              : 'Not enough data'}
                                        </TableCell>
                                    </TableRow>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl">
                                    {member.pendingInvite ? (
                                      <>
                                        <DialogHeader>
                                          <DialogTitle>Pending Invitation</DialogTitle>
                                          <DialogDescription>
                                            {member.pendingInvite.email} has not completed account setup yet. You can share or regenerate their link.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-3">
                                          <Input readOnly value={getPendingInviteUrl(member.pendingInvite)} />
                                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <Button variant="outline" onClick={() => copyPendingInviteLink(member.pendingInvite!)}>
                                              Copy Invite Link
                                            </Button>
                                            <Button
                                              onClick={() => regeneratePendingInviteLink(member.pendingInvite!)}
                                              disabled={isResendingInvite === getPendingInviteKey(member.pendingInvite)}
                                            >
                                              {isResendingInvite === getPendingInviteKey(member.pendingInvite) ? 'Generating...' : 'Generate New Link'}
                                            </Button>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <DialogHeader>
                                            <DialogTitle>Performance Snapshot</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="max-h-[70vh]">
                                            <div className="pr-6">
                                                <TeamMemberCard user={member.consultant} currentUser={user} dealerships={dealerships} onAssignmentUpdated={() => fetchData(selectedDealershipId)} />
                                            </div>
                                        </ScrollArea>
                                      </>
                                    )}
                                </DialogContent>
                              </Dialog>
                            );
                          }) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                No team activity found for this dealership.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {dealerships.map(dealership => {
                              const insights = allDealershipStats[dealership.id];
                              return (
                                  <Card 
                                  key={dealership.id} 
                                  className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-1"
                                  onClick={() => handleDealershipChange(dealership.id)}
                                  >
                                  <CardHeader>
                                      <CardTitle className="flex items-center justify-between">
                                      {dealership.name}
                                      <Store className="h-5 w-5 text-muted-foreground" />
                                      </CardTitle>
                                      {dealership.status !== 'active' && (
                                          <CardDescription>
                                              Status: {getStatusBadge(dealership.status)}
                                          </CardDescription>
                                      )}
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                      {dealership.status === 'paused' ? (
                                          <p className="text-sm text-muted-foreground">This dealership's activity is currently paused.</p>
                                      ) : (!insights || (!insights.bestStat && !insights.watchStat)) ? (
                                          <p className="text-sm text-muted-foreground">Click to view team performance.</p>
                                      ) : (
                                          <>
                                              {insights.bestStat && (
                                                  <div className="flex items-center gap-2 text-sm">
                                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                                      <span className="font-medium text-muted-foreground">Top Skill:</span>
                                                      <span className="font-semibold">{insights.bestStat.trait}</span>
                                                  </div>
                                              )}
                                              {insights.watchStat && (
                                                  <div className="flex items-center gap-2 text-sm">
                                                      <TrendingDown className="h-4 w-4 text-amber-500" />
                                                      <span className="font-medium text-muted-foreground">Watch Area:</span>
                                                      <span className="font-semibold">{insights.watchStat.trait}</span>
                                                  </div>
                                              )}
                                          </>
                                      )}
                                  </CardContent>
                                  </Card>
                              );
                          })}
                      </div>
                    )}
                  </CardContent>
              </Card>
            )}
        </>
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">
        *XP is earned based on the quality of the interaction during lessons.
      </p>
    </div>
  );
}
