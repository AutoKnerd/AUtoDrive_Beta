'use client';

import { useEffect, useState, useCallback, useMemo, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { allRoles, managerialRoles, UserRole, User, Dealership } from '@/lib/definitions';
import { hasDealershipAssignment } from '@/lib/billing/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Home,
  Menu,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { getManageableUsers, getDealerships } from '@/lib/data.client';
import { RegisterDealershipForm } from '@/components/admin/register-dealership-form';
import { RemoveUserForm } from '@/components/admin/remove-user-form';
import { CreateDealershipForm } from '@/components/admin/create-dealership-form';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { AssignDealershipsForm } from '@/components/admin/assign-dealerships-form';
import { ManageDealershipForm } from '@/components/admin/ManageDealershipForm';
import { EditUserForm } from '@/components/admin/edit-user-form';
import { PppProtocolSettings } from '@/components/admin/ppp-protocol-settings';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

type DashboardMode = 'role_based' | 'single_user';
type SectionId = 'overview' | 'access' | 'organizations' | 'features' | 'consultants' | 'operations' | 'sandbox' | 'danger';
type ToolId =
  | 'create_user'
  | 'edit_user'
  | 'assign_dealerships'
  | 'invite'
  | 'remove'
  | 'create_dealership'
  | 'manage_dealerships'
  | 'ppp_global';

type LiveCxTrait = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';
type LiveCxScores = Record<LiveCxTrait, number>;
type ConsultantPickerOption = {
  name: string;
  referral_code?: string;
  referralCode?: string;
};
type AkLeaderboardRow = {
  consultant: string;
  sales: number;
  monthly_revenue: number;
};
type AkPayoutRecord = {
  consultant_id: string;
  amount: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'voided' | 'paid';
  period_start: string;
  created_at: string;
};
type AkPayoutResponse = {
  records: AkPayoutRecord[];
};

const LIVE_CX_TRAITS: Array<{ key: LiveCxTrait; label: string }> = [
  { key: 'empathy', label: 'Empathy' },
  { key: 'listening', label: 'Listening' },
  { key: 'trust', label: 'Trust' },
  { key: 'followUp', label: 'Follow Up' },
  { key: 'closing', label: 'Closing' },
  { key: 'relationship', label: 'Relationship' },
];

const BENCHMARK_PRESET: LiveCxScores = {
  empathy: 75,
  listening: 75,
  trust: 75,
  followUp: 75,
  closing: 75,
  relationship: 75,
};

const SECTION_LABELS: Record<SectionId, string> = {
  overview: 'Overview',
  access: 'Access',
  organizations: 'Organizations',
  features: 'Programs & Features',
  consultants: 'AK Consultants',
  operations: 'Operations',
  sandbox: 'Sandbox',
  danger: 'Danger Zone',
};

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  overview: 'System-level pulse and quick actions.',
  access: 'Manage users, roles, invitations, and assignments.',
  organizations: 'Manage dealerships, groups, and billing settings.',
  features: 'Configure PPP and controlled feature rollouts.',
  consultants: 'Consultant subscription dashboards and Stripe-backed sales endpoints.',
  operations: 'Watchlists, exports, and diagnostics.',
  sandbox: 'Safe preview tools for impersonation and CX simulation.',
  danger: 'High-risk operations with explicit confirmation.',
};

const SECTION_ICONS: Record<SectionId, ComponentType<{ className?: string }>> = {
  overview: Home,
  access: Users,
  organizations: Building2,
  features: Settings2,
  consultants: BarChart3,
  operations: Activity,
  sandbox: FlaskConical,
  danger: AlertTriangle,
};

const TOOLS: Array<{ id: ToolId; label: string; section: SectionId }> = [
  { id: 'create_user', label: 'Create User', section: 'access' },
  { id: 'edit_user', label: 'Edit User', section: 'access' },
  { id: 'assign_dealerships', label: 'Assign Dealerships', section: 'access' },
  { id: 'invite', label: 'Invitations', section: 'access' },
  { id: 'remove', label: 'Remove User', section: 'danger' },
  { id: 'create_dealership', label: 'Create Dealership', section: 'organizations' },
  { id: 'manage_dealerships', label: 'Dealership Settings', section: 'organizations' },
  { id: 'ppp_global', label: 'PPP Global', section: 'features' },
];

const BOTTOM_NAV_SECTIONS: SectionId[] = ['overview', 'access', 'organizations', 'consultants'];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildLiveCxScoresFromUser(user: User): LiveCxScores {
  return {
    empathy: clampScore(user.stats?.empathy?.score ?? 60),
    listening: clampScore(user.stats?.listening?.score ?? 60),
    trust: clampScore(user.stats?.trust?.score ?? 60),
    followUp: clampScore(user.stats?.followUp?.score ?? 60),
    closing: clampScore(user.stats?.closing?.score ?? 60),
    relationship: clampScore(user.stats?.relationship?.score ?? 60),
  };
}

function buildDefaultLiveCxScores(): LiveCxScores {
  return {
    empathy: 60,
    listening: 60,
    trust: 60,
    followUp: 60,
    closing: 60,
    relationship: 60,
  };
}

function buildUserStatsFromLiveScores(scores: LiveCxScores): User['stats'] {
  const now = new Date();
  return {
    empathy: { score: scores.empathy, lastUpdated: now },
    listening: { score: scores.listening, lastUpdated: now },
    trust: { score: scores.trust, lastUpdated: now },
    followUp: { score: scores.followUp, lastUpdated: now },
    closing: { score: scores.closing, lastUpdated: now },
    relationship: { score: scores.relationship, lastUpdated: now },
  };
}

export default function DeveloperPage() {
  const { user, loading, setUser, originalUser } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const { toast } = useToast();
  const router = useRouter();
  const originalUserIsAssigned = !!originalUser && hasDealershipAssignment(originalUser);

  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [activeTool, setActiveTool] = useState<ToolId>('create_user');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('role_based');
  const [sandboxDealershipId, setSandboxDealershipId] = useState<string>('all');
  const [sprocketTourPreviewNonce, setSprocketTourPreviewNonce] = useState(0);
  const [singleUserScores, setSingleUserScores] = useState<LiveCxScores>(() => (
    user ? buildLiveCxScoresFromUser(user) : buildDefaultLiveCxScores()
  ));
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [consultantLookupId, setConsultantLookupId] = useState('lee');
  const [consultantOptions, setConsultantOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [consultantLeaderboard, setConsultantLeaderboard] = useState<AkLeaderboardRow[]>([]);
  const [consultantMonthlyGross, setConsultantMonthlyGross] = useState(0);
  const [consultantYearlyGross, setConsultantYearlyGross] = useState(0);
  const [consultantMonthlyPayout, setConsultantMonthlyPayout] = useState(0);
  const [consultantMetricsLoading, setConsultantMetricsLoading] = useState(false);
  const [consultantMetricsError, setConsultantMetricsError] = useState<string | null>(null);
  const [consultantMetricsLastRefreshedAt, setConsultantMetricsLastRefreshedAt] = useState<Date | null>(null);
  const [consultantCommissionDueById, setConsultantCommissionDueById] = useState<Record<string, number>>({});
  const sandboxDealershipStorageKey = useMemo(
    () => `managerDashboard:selectedDealershipId:${originalUser?.userId || user?.userId || 'sandbox'}`,
    [originalUser?.userId, user?.userId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = localStorage.getItem(sandboxDealershipStorageKey);
    if (persisted && persisted.trim().length > 0) {
      setSandboxDealershipId(persisted);
    }
  }, [sandboxDealershipStorageKey]);

  const handleSandboxDealershipChange = useCallback((value: string) => {
    setSandboxDealershipId(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(sandboxDealershipStorageKey, value);
    }
  }, [sandboxDealershipStorageKey]);

  const refreshData = useCallback(async () => {
    if (!originalUser) return;
    setDataLoading(true);
    const [users, dealerships] = await Promise.all([
      getManageableUsers(originalUser.userId),
      getDealerships(),
    ]);
    setManageableUsers(users);
    setAllDealerships(dealerships);
    setLastRefreshedAt(new Date());
    setDataLoading(false);
  }, [originalUser]);

  useEffect(() => {
    if (!loading && originalUser) {
      void refreshData();
    }
  }, [loading, originalUser, refreshData]);

  useEffect(() => {
    if (!originalUser) return;
    const timer = setInterval(() => {
      void refreshData();
    }, 60_000);
    return () => clearInterval(timer);
  }, [originalUser, refreshData]);

  useEffect(() => {
    let cancelled = false;

    async function loadConsultants() {
      try {
        const response = await fetch('/api/admin/consultants');
        if (!response.ok) return;
        const payload = await response.json() as { consultants?: ConsultantPickerOption[] };
        const options = (payload.consultants || [])
          .map((row) => {
            const code = String(row.referral_code || row.referralCode || '').trim().toLowerCase();
            const name = String(row.name || '').trim();
            return { code, name };
          })
          .filter((row) => row.code.length > 0);
        if (cancelled) return;
        setConsultantOptions(options);

        if (options.length > 0) {
          const normalizedCurrent = consultantLookupId.trim().toLowerCase();
          const hasCurrent = options.some((row) => row.code === normalizedCurrent);
          if (!hasCurrent) {
            setConsultantLookupId(options[0].code);
          }
        }
      } catch {
        // Best-effort picker population.
      }
    }

    if (!loading && originalUser) {
      void loadConsultants();
    }

    return () => {
      cancelled = true;
    };
  }, [loading, originalUser]);

  const loadConsultantMetrics = useCallback(async () => {
    if (!originalUser || (originalUser.role !== 'Admin' && originalUser.role !== 'Developer')) {
      return;
    }

    setConsultantMetricsLoading(true);
    setConsultantMetricsError(null);

    try {
      const leaderboardResponse = await fetch('/api/leaderboard');
      const leaderboardPayload = await leaderboardResponse.json();
      if (!leaderboardResponse.ok) {
        throw new Error(leaderboardPayload?.error || 'Failed to load consultant leaderboard.');
      }

      const leaderboardRows = (leaderboardPayload as AkLeaderboardRow[]) || [];
      const monthlyGross = leaderboardRows.reduce((sum, row) => sum + Number(row.monthly_revenue || 0), 0);

      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required for payout metrics.');
      }
      const token = await fbUser.getIdToken(true);
      const payoutsResponse = await fetch('/api/admin/payouts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payoutsPayload = await payoutsResponse.json() as AkPayoutResponse & { message?: string };
      if (!payoutsResponse.ok) {
        throw new Error(payoutsPayload?.message || 'Failed to load payout metrics.');
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const records = payoutsPayload.records || [];

      const yearlyGross = records.reduce((sum, row) => {
        if (row.status === 'voided') return sum;
        const iso = row.period_start || row.created_at;
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) return sum;
        return sum + Number(row.amount || 0);
      }, 0);

      const monthlyPayout = records.reduce((sum, row) => {
        if (row.status === 'voided') return sum;
        const iso = row.period_start || row.created_at;
        const date = new Date(iso);
        if (
          Number.isNaN(date.getTime())
          || date.getFullYear() !== currentYear
          || date.getMonth() !== currentMonth
        ) return sum;
        return sum + Number(row.commission_amount || 0);
      }, 0);

      const commissionDueByConsultant = records.reduce((acc, row) => {
        if (row.status !== 'pending' && row.status !== 'approved') {
          return acc;
        }
        const consultantId = String(row.consultant_id || '').trim().toLowerCase();
        if (!consultantId) {
          return acc;
        }
        acc[consultantId] = (acc[consultantId] || 0) + Number(row.commission_amount || 0);
        return acc;
      }, {} as Record<string, number>);

      setConsultantLeaderboard(leaderboardRows);
      setConsultantMonthlyGross(Math.round(monthlyGross * 100) / 100);
      setConsultantYearlyGross(Math.round(yearlyGross * 100) / 100);
      setConsultantMonthlyPayout(Math.round(monthlyPayout * 100) / 100);
      setConsultantCommissionDueById(
        Object.fromEntries(
          Object.entries(commissionDueByConsultant).map(([key, value]) => [key, Math.round(value * 100) / 100])
        )
      );
      setConsultantMetricsLastRefreshedAt(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load consultant metrics.';
      setConsultantMetricsError(message);
    } finally {
      setConsultantMetricsLoading(false);
    }
  }, [originalUser, firebaseAuth]);

  useEffect(() => {
    if (activeSection === 'consultants') {
      void loadConsultantMetrics();
    }
  }, [activeSection, loadConsultantMetrics]);

  useEffect(() => {
    if (!loading && (!user || (originalUser?.role !== 'Developer' && originalUser?.role !== 'Admin'))) {
      router.push('/login');
      return;
    }

    if (!loading && originalUser && !originalUserIsAssigned) {
      router.push('/');
    }
  }, [user, loading, router, originalUser, originalUserIsAssigned]);

  useEffect(() => {
    if (!originalUser) return;
    if (dashboardMode !== 'single_user') return;
    setSingleUserScores(buildLiveCxScoresFromUser(originalUser));
  }, [dashboardMode, originalUser]);

  useEffect(() => {
    const tool = TOOLS.find((entry) => entry.id === activeTool);
    if (!tool || tool.section === activeSection) return;
    const fallback = TOOLS.find((entry) => entry.section === activeSection);
    if (fallback) setActiveTool(fallback.id);
  }, [activeSection, activeTool]);

  const handleSwitchRole = (newRole: UserRole) => {
    if (originalUser) setUser({ ...originalUser, role: newRole });
  };

  const updateSingleUserScore = useCallback((trait: LiveCxTrait, value: number) => {
    const clamped = clampScore(value);
    setSingleUserScores((previous) => ({ ...previous, [trait]: clamped }));
  }, []);

  const setAllSingleUserScores = useCallback((value: number) => {
    const clamped = clampScore(value);
    setSingleUserScores({
      empathy: clamped,
      listening: clamped,
      trust: clamped,
      followUp: clamped,
      closing: clamped,
      relationship: clamped,
    });
  }, []);

  const applyBenchmarkPreset = useCallback(() => {
    setSingleUserScores(BENCHMARK_PRESET);
  }, []);

  const resetSingleUserScores = useCallback(() => {
    if (!originalUser) return;
    setSingleUserScores(buildLiveCxScoresFromUser(originalUser));
  }, [originalUser]);

  const dashboardUser: User = useMemo(() => {
    if (!user) {
      return {
        userId: '',
        name: '',
        email: '',
        role: 'Sales Consultant',
        dealershipIds: [],
        avatarUrl: '',
        xp: 0,
      };
    }
    if (dashboardMode === 'single_user') {
      return {
        ...user,
        role: 'Sales Consultant',
        dealershipIds: [],
        selfDeclaredDealershipId: undefined,
        stats: buildUserStatsFromLiveScores(singleUserScores),
      };
    }

    if (sandboxDealershipId && sandboxDealershipId !== 'all') {
      const sourceIds = Array.from(new Set([
        ...(user.dealershipIds || []),
        ...(user.selfDeclaredDealershipId ? [user.selfDeclaredDealershipId] : []),
      ]));
      const isPrivilegedViewer = originalUser?.role === 'Admin' || originalUser?.role === 'Developer';
      const canScopeToSelected = isPrivilegedViewer || sourceIds.includes(sandboxDealershipId);

      if (canScopeToSelected) {
        return {
          ...user,
          dealershipIds: [sandboxDealershipId],
          selfDeclaredDealershipId: sandboxDealershipId,
        };
      }
    }

    return user;
  }, [dashboardMode, singleUserScores, user, sandboxDealershipId, originalUser?.role]);

  const isViewingAsManager = managerialRoles.includes(dashboardUser.role);
  const canSeeDeveloperCxTuner = originalUser?.role === 'Developer';
  const showDeveloperCxTuner = canSeeDeveloperCxTuner && dashboardMode === 'single_user';

  const dealershipNameById = useMemo(() => (
    new Map(allDealerships.map((dealership) => [dealership.id, dealership.name]))
  ), [allDealerships]);

  const newestUsers = useMemo(() => {
    const safeDate = (value?: string) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [...manageableUsers]
      .sort((a, b) => safeDate(b.memberSince) - safeDate(a.memberSince))
      .slice(0, 100);
  }, [manageableUsers]);

  const filteredNewestUsers = useMemo(() => {
    const startTs = exportStartDate ? new Date(`${exportStartDate}T00:00:00`).getTime() : null;
    const endTs = exportEndDate ? new Date(`${exportEndDate}T23:59:59.999`).getTime() : null;

    return newestUsers.filter((candidate) => {
      if (!candidate.memberSince) return !startTs && !endTs;
      const joinedTs = new Date(candidate.memberSince).getTime();
      if (Number.isNaN(joinedTs)) return !startTs && !endTs;
      if (startTs !== null && joinedTs < startTs) return false;
      if (endTs !== null && joinedTs > endTs) return false;
      return true;
    });
  }, [newestUsers, exportStartDate, exportEndDate]);

  const pausedDealershipCount = useMemo(() => (
    allDealerships.filter((dealership) => dealership.status === 'paused').length
  ), [allDealerships]);
  const tempProSignupUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/signup';
    return new URL('/signup', window.location.origin).toString();
  }, []);

  const getAffiliationLabel = useCallback((candidate: User) => {
    const ids = Array.isArray(candidate.dealershipIds) ? candidate.dealershipIds : [];
    const names = ids
      .map((id) => dealershipNameById.get(id))
      .filter((name): name is string => typeof name === 'string' && name.length > 0);

    if (names.length > 0) return names.join(', ');
    if (candidate.selfDeclaredDealershipId) {
      return dealershipNameById.get(candidate.selfDeclaredDealershipId) || candidate.selfDeclaredDealershipId;
    }
    return 'No dealership assigned';
  }, [dealershipNameById]);

  const getWatchlistRoleLabel = useCallback((candidate: User) => {
    const role = candidate.signupRoleInterest || candidate.role;
    if (!role) return '';
    if (role === 'manager') return 'Sales Manager';
    if (role === 'Service Writer') return 'Service Advisor';
    if (role === 'BDC') return 'BDC Professional';
    if (role === 'Finance Manager') return 'F&I Director';
    return role;
  }, []);

  const handleExportNewUsers = useCallback(async () => {
    try {
      setIsExportingUsers(true);

      const rows = filteredNewestUsers.map((candidate) => ({
        Joined: candidate.memberSince ? new Date(candidate.memberSince).toLocaleDateString() : '',
        Name: candidate.name || 'New User',
        Email: candidate.email || '',
        Role: getWatchlistRoleLabel(candidate),
        DealerAffiliation: getAffiliationLabel(candidate),
      }));

      if (rows.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No users to export',
          description: 'Adjust the date range to include at least one user.',
        });
        return;
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'New Users');

      const rangeSuffix = exportStartDate || exportEndDate
        ? `_${exportStartDate || 'start'}_to_${exportEndDate || 'end'}`
        : '';
      XLSX.writeFile(workbook, `new-users-watchlist${rangeSuffix}.xlsx`);
    } catch (error) {
      console.error('Failed to export new users watchlist:', error);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Could not generate the Excel file.',
      });
    } finally {
      setIsExportingUsers(false);
    }
  }, [filteredNewestUsers, getWatchlistRoleLabel, getAffiliationLabel, exportStartDate, exportEndDate, toast]);

  const handleCopyTempProSignupLink = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      await navigator.clipboard.writeText(tempProSignupUrl);
      toast({
        title: 'Link copied',
        description: 'Signup test URL copied to clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy signup test URL:', error);
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy the link. You can copy it from the field below.',
      });
    }
  }, [tempProSignupUrl, toast]);

  if (
    loading ||
    !user ||
    !originalUser ||
    !originalUserIsAssigned ||
    (originalUser.role !== 'Developer' && originalUser.role !== 'Admin')
  ) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Spinner size="lg" /></div>;
  }

  const goToSection = (section: SectionId, toolId?: ToolId) => {
    setActiveSection(section);
    if (toolId) setActiveTool(toolId);
    setMobileNavOpen(false);
  };

  const renderWatchlistCard = () => (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>New Users Watchlist</CardTitle>
        <CardDescription>
          Live list of newest users for welcome email follow-up.
          {lastRefreshedAt ? ` Last refreshed ${lastRefreshedAt.toLocaleTimeString()}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dataLoading ? (
          <Spinner />
        ) : filteredNewestUsers.length === 0 && newestUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-users-start-date">Start Date</Label>
                <Input
                  id="new-users-start-date"
                  type="date"
                  value={exportStartDate}
                  onChange={(event) => setExportStartDate(event.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-users-end-date">End Date</Label>
                <Input
                  id="new-users-end-date"
                  type="date"
                  value={exportEndDate}
                  onChange={(event) => setExportEndDate(event.target.value)}
                  className="w-[180px]"
                />
              </div>
              <Button variant="outline" onClick={() => { setExportStartDate(''); setExportEndDate(''); }}>
                Clear Range
              </Button>
              <Button onClick={handleExportNewUsers} disabled={isExportingUsers || filteredNewestUsers.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                {isExportingUsers ? 'Exporting...' : 'Export Excel'}
              </Button>
            </div>

            {filteredNewestUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found in this date range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Joined</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Dealer Affiliation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNewestUsers.map((candidate) => (
                    <TableRow key={candidate.userId}>
                      <TableCell>{candidate.memberSince ? new Date(candidate.memberSince).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="font-medium">{candidate.name || 'New User'}</TableCell>
                      <TableCell>{candidate.email}</TableCell>
                      <TableCell>{getWatchlistRoleLabel(candidate) || '-'}</TableCell>
                      <TableCell>{getAffiliationLabel(candidate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSandbox = () => (
    <Card>
      <CardHeader>
        <CardTitle>Impersonation Sandbox</CardTitle>
        <CardDescription>
          Use role-based impersonation or jump directly into a single-user dashboard with no dealership assignment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Mode:</span>
          <Select onValueChange={(mode) => setDashboardMode(mode as DashboardMode)} value={dashboardMode}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role_based">Role-Based</SelectItem>
              <SelectItem value="single_user">Single User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Dealership:</span>
          <Select onValueChange={handleSandboxDealershipChange} value={sandboxDealershipId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {allDealerships.map((dealership) => (
                <SelectItem key={dealership.id} value={dealership.id}>
                  {dealership.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Impersonating:</span>
          <Select onValueChange={(role) => handleSwitchRole(role as UserRole)} value={user.role}>
            <SelectTrigger className="w-[240px]" disabled={dashboardMode === 'single_user'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allRoles.map((role) => (
                <SelectItem key={role} value={role}>{role === 'manager' ? 'Sales Manager' : role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dashboardMode === 'single_user' && (
            <span className="text-xs text-muted-foreground">
              Single User mode uses `Sales Consultant` with no dealership.
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSprocketTourPreviewNonce((prev) => prev + 1)}
            disabled={isViewingAsManager}
          >
            Launch Sprocket Tour Preview
          </Button>
          {isViewingAsManager ? (
            <span className="text-xs text-muted-foreground">Switch to a consultant role (or Single User mode) to preview this tour.</span>
          ) : (
            <span className="text-xs text-muted-foreground">Sandbox only. Opens the Sprocket First Login Tour without baseline submission.</span>
          )}
        </div>
        {canSeeDeveloperCxTuner && !showDeveloperCxTuner && (
          <Card className="mt-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Developer CX Live Tuner</CardTitle>
              <CardDescription>
                This control set appears in Single User mode so you can preview CX score behavior in real time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={() => setDashboardMode('single_user')}>
                Switch to Single User
              </Button>
            </CardContent>
          </Card>
        )}
        {showDeveloperCxTuner && (
          <Card className="mt-6 border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Developer CX Live Tuner</CardTitle>
              <CardDescription>
                Developer-only preview controls. Updates the Single User CX chart in real time without writing to Firestore.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {LIVE_CX_TRAITS.map((trait) => (
                <div key={trait.key} className="grid gap-2 md:grid-cols-[140px_1fr_90px] md:items-center">
                  <Label className="text-sm font-medium">{trait.label}</Label>
                  <Slider
                    value={[singleUserScores[trait.key]]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(values) => updateSingleUserScore(trait.key, values[0] ?? 0)}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={singleUserScores[trait.key]}
                    onChange={(event) => updateSingleUserScore(trait.key, Number(event.target.value))}
                    className="h-8"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetSingleUserScores}>
                  Reset to Profile
                </Button>
                <Button type="button" variant="outline" onClick={applyBenchmarkPreset}>
                  Apply Benchmarks
                </Button>
                <Button type="button" variant="outline" onClick={() => setAllSingleUserScores(60)}>
                  Set All 60
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="mt-6 border-t pt-8">
          {isViewingAsManager ? (
            <ManagerDashboard key={`sandbox-manager-${sandboxDealershipId}-${dashboardUser.role}`} user={dashboardUser} />
          ) : (
            <ConsultantDashboard
              user={dashboardUser}
              sprocketTourPreviewNonce={sprocketTourPreviewNonce}
              isSprocketTourSandboxPreview
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderToolPanel = () => {
    if (activeTool === 'ppp_global') {
      return <PppProtocolSettings />;
    }
    if (activeTool === 'create_user') {
      return <CreateUserForm onUserCreated={refreshData} dealerships={allDealerships} />;
    }
    if (activeTool === 'edit_user') {
      return <EditUserForm manageableUsers={manageableUsers} dealerships={allDealerships} onUserUpdated={refreshData} />;
    }
    if (activeTool === 'assign_dealerships') {
      return (
        <AssignDealershipsForm
          manageableUsers={manageableUsers}
          dealerships={allDealerships}
          currentUser={originalUser}
          onDealershipsAssigned={refreshData}
        />
      );
    }
    if (activeTool === 'invite') {
      return <RegisterDealershipForm user={originalUser} dealerships={allDealerships} onUserInvited={refreshData} />;
    }
    if (activeTool === 'remove') {
      return <RemoveUserForm manageableUsers={manageableUsers} onUserRemoved={refreshData} />;
    }
    if (activeTool === 'create_dealership') {
      return <CreateDealershipForm user={originalUser} onDealershipCreated={refreshData} />;
    }
    return <ManageDealershipForm dealerships={allDealerships} onDealershipManaged={refreshData} />;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Manageable Users</CardDescription>
            <CardTitle>{manageableUsers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dealerships</CardDescription>
            <CardTitle>{allDealerships.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New Users (Range)</CardDescription>
            <CardTitle>{filteredNewestUsers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paused Dealerships</CardDescription>
            <CardTitle>{pausedDealershipCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump directly to high-frequency workflows.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => goToSection('access', 'create_user')}>Create User</Button>
          <Button variant="outline" onClick={() => goToSection('access', 'invite')}>Send Invitation</Button>
          <Button variant="outline" onClick={() => goToSection('organizations', 'create_dealership')}>Create Dealership</Button>
          <Button variant="outline" onClick={() => goToSection('features', 'ppp_global')}>PPP Global Setting</Button>
          <Button variant="outline" onClick={() => goToSection('sandbox')}>Open Sandbox</Button>
        </CardContent>
      </Card>
      {renderWatchlistCard()}
    </div>
  );

  const renderConsultants = () => {
    const normalizedConsultantId = consultantLookupId.trim().toLowerCase() || 'lee';
    const quickAccessConsultantId = consultantLookupId.trim().toLowerCase();
    const dashboardHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}`;
    const salesReportHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}/sales-report`;
    const dealerPipelineHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}/dealer-pipeline`;
    const customersHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}/customers`;

    const openConsultantDashboard = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}`);
    };

    const openConsultantSalesReport = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}/sales-report`);
    };

    const openConsultantDealerPipeline = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}/dealer-pipeline`);
    };

    const openConsultantCustomers = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}/customers`);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>AK Consultants</CardTitle>
          <CardDescription>
            Open consultant performance dashboards and Stripe-powered API outputs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1">
            <Label htmlFor="ak-consultant-id">Consultant ID</Label>
            <Select value={consultantLookupId} onValueChange={setConsultantLookupId}>
              <SelectTrigger id="ak-consultant-id">
                <SelectValue placeholder="Select consultant" />
              </SelectTrigger>
              <SelectContent>
                {consultantOptions.length === 0 ? (
                  <SelectItem value="lee">Lee</SelectItem>
                ) : (
                  consultantOptions.map((consultant) => (
                    <SelectItem key={consultant.code} value={consultant.code}>
                      {consultant.name} ({consultant.code})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Uses Stripe subscription metadata key: <code>consultant</code>
            </p>
          </div>
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">Consultant Dashboard Quick Access</p>
            <p className="text-xs text-muted-foreground">
              Jump directly to consultant routes using the referral code.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openConsultantDashboard}>
                Open Consultant Dashboard
              </Button>
              <Button variant="outline" onClick={openConsultantSalesReport}>
                Open Sales Report
              </Button>
              <Button variant="outline" onClick={openConsultantDealerPipeline}>
                Open Dealer Pipeline
              </Button>
              <Button variant="outline" onClick={openConsultantCustomers}>
                Open Customers
              </Button>
            </div>
          </div>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-4 flex items-center justify-between rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                Last refreshed:{' '}
                {consultantMetricsLastRefreshedAt
                  ? consultantMetricsLastRefreshedAt.toLocaleString()
                  : 'Not refreshed yet'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadConsultantMetrics()}
                disabled={consultantMetricsLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Metrics
              </Button>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Gross Sales (Monthly)</CardDescription>
                <CardTitle>${consultantMonthlyGross.toLocaleString('en-US')}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Gross Sales (Yearly)</CardDescription>
                <CardTitle>${consultantYearlyGross.toLocaleString('en-US')}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Payout This Month</CardDescription>
                <CardTitle>${consultantMonthlyPayout.toLocaleString('en-US')}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Consultants</CardDescription>
                <CardTitle>{consultantLeaderboard.length}</CardTitle>
              </CardHeader>
            </Card>
          </section>
          <Card>
            <CardHeader>
              <CardTitle>AK Consultant Leaderboard</CardTitle>
              <CardDescription>Ranked by active subscriber count and monthly gross revenue.</CardDescription>
            </CardHeader>
            <CardContent>
              {consultantMetricsLoading ? (
                <p className="text-sm text-muted-foreground">Loading consultant metrics...</p>
              ) : consultantMetricsError ? (
                <p className="text-sm text-red-500">{consultantMetricsError}</p>
              ) : consultantLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consultant leaderboard data found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Consultant</TableHead>
                      <TableHead>Subscribers</TableHead>
                      <TableHead>Monthly Gross</TableHead>
                      <TableHead>Commissions To Be Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultantLeaderboard.map((row, index) => (
                      <TableRow key={row.consultant}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.consultant}</TableCell>
                        <TableCell>{row.sales}</TableCell>
                        <TableCell>${Number(row.monthly_revenue || 0).toLocaleString('en-US')}</TableCell>
                        <TableCell>
                          ${(consultantCommissionDueById[String(row.consultant || '').toLowerCase()] || 0).toLocaleString('en-US')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <p className="text-sm font-medium">Admin Tools</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/consultants">Open Consultant Manager</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/dealers">Open Admin Dealer Pipeline</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p><span className="font-medium">Consultant Manager:</span> /admin/consultants</p>
            <p><span className="font-medium">Admin Dealer Pipeline:</span> /admin/dealers</p>
            <p><span className="font-medium">Dashboard:</span> {dashboardHref}</p>
            <p><span className="font-medium">Sales Report:</span> {salesReportHref}</p>
            <p><span className="font-medium">Dealer Pipeline:</span> {dealerPipelineHref}</p>
            <p><span className="font-medium">Customers:</span> {customersHref}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderMainSection = () => {
    if (activeSection === 'overview') return renderOverview();
    if (activeSection === 'consultants') return renderConsultants();
    if (activeSection === 'sandbox') return renderSandbox();

    const sectionTools = TOOLS.filter((tool) => tool.section === activeSection || (activeSection === 'danger' && tool.id === 'remove'));

    return (
      <div className="space-y-6">
        {(activeSection === 'operations') && renderWatchlistCard()}
        {activeSection !== 'operations' && (
          <Card>
            <CardHeader>
              <CardTitle>{SECTION_LABELS[activeSection]} Tools</CardTitle>
              <CardDescription>Select a workflow to open the corresponding management panel.</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSection === 'access' && (
                <div className="mb-6 rounded-md border p-3">
                  <p className="text-sm font-medium">Testing Link: Signup Page</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Open or copy the signup flow to test Stripe checkout.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCopyTempProSignupLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </Button>
                    <Button type="button" variant="outline" onClick={() => window.open(tempProSignupUrl, '_blank', 'noopener,noreferrer')}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </div>
                  <div className="mt-3 rounded bg-muted px-3 py-2 text-xs break-all">
                    {tempProSignupUrl}
                  </div>
                </div>
              )}
              <div className="mb-6 flex flex-wrap gap-2">
                {sectionTools.map((tool) => (
                  <Button
                    key={tool.id}
                    variant={activeTool === tool.id ? 'default' : 'outline'}
                    onClick={() => setActiveTool(tool.id)}
                  >
                    {tool.label}
                  </Button>
                ))}
              </div>
              {dataLoading ? <Spinner /> : renderToolPanel()}
            </CardContent>
          </Card>
        )}

        {activeSection === 'operations' && (
          <Card>
            <CardHeader>
              <CardTitle>System Diagnostics</CardTitle>
              <CardDescription>Operational checks and health endpoints.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Admin health endpoints and deeper diagnostics can be linked here as this surface expands.
              </p>
            </CardContent>
          </Card>
        )}

        {activeSection === 'danger' && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Danger Zone Guidelines</CardTitle>
              <CardDescription>
                These actions can revoke access or remove critical assignments. Always validate scope before saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Typed confirmation required</Badge>
                <Badge variant="secondary">Immediate effect</Badge>
                <Badge variant="secondary">No rollback flow</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
        <Card className="border-[#8DC63F]/60 bg-[#8DC63F]/10 shadow-[0_0_24px_rgba(141,198,63,0.18)]">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <SlidersHorizontal className="h-10 w-10 text-[#8DC63F] drop-shadow-[0_0_10px_rgba(141,198,63,0.5)]" />
              <div>
                <CardTitle className="text-2xl text-[#8DC63F]">Developer Console</CardTitle>
                <CardDescription className="text-[#8DC63F]/80">
                  Structured admin controls across access, organizations, features, operations, and sandboxing.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
              <Menu className="mr-2 h-4 w-4" /> Sections
            </Button>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <CardDescription>Navigate by workflow intent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(SECTION_LABELS) as SectionId[]).map((section) => {
                const Icon = SECTION_ICONS[section];
                return (
                  <Button
                    key={section}
                    variant={activeSection === section ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => goToSection(section)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {SECTION_LABELS[section]}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{SECTION_LABELS[activeSection]}</CardTitle>
                <CardDescription>{SECTION_DESCRIPTIONS[activeSection]}</CardDescription>
              </CardHeader>
            </Card>
            {renderMainSection()}
          </div>
        </div>
      </main>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Developer Sections</SheetTitle>
            <SheetDescription>Choose where you want to work.</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 p-4">
            {(Object.keys(SECTION_LABELS) as SectionId[]).map((section) => {
              const Icon = SECTION_ICONS[section];
              return (
                <Button
                  key={section}
                  variant={activeSection === section ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => goToSection(section)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {SECTION_LABELS[section]}
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-2">
          {BOTTOM_NAV_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section];
            return (
              <Button
                key={section}
                variant={activeSection === section ? 'default' : 'outline'}
                size="sm"
                className="h-10"
                onClick={() => goToSection(section)}
              >
                <Icon className="mr-1 h-4 w-4" />
                <span className="truncate text-xs">{SECTION_LABELS[section]}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
