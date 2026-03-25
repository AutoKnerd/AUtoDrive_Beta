import { getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { getDealerAccountByDealerId } from '@/lib/dealer-accounts';

type TeamMemberSummary = {
  user_id: string;
  name: string;
  role: string;
  training_completion: number;
  missions_completed: number;
  last_activity: string | null;
  skill_score: number;
};

type OwnerDashboardData = {
  dealership_id: string;
  dealership_name: string;
  snapshot: {
    team_training_completion: number;
    team_engagement_rate: number;
    average_skill_score: number;
    active_users: number;
    salespeople: number;
  };
  team_overview: TeamMemberSummary[];
  training_progress: {
    discovery_skills: number;
    trust_building: number;
    closing_skills: number;
  };
  billing: {
    current_plan: string;
    active_seats: number;
    monthly_cost: number;
    next_billing_date: string;
  };
};

type GmDashboardData = {
  dealership_id: string;
  dealership_name: string;
  rep_performance: TeamMemberSummary[];
  coaching_alerts: string[];
  completion_tracking: Array<{
    user_id: string;
    name: string;
    missions_completed: number;
  }>;
};

type SalespersonDashboardData = {
  dealership_id: string;
  dealership_name: string;
  today_mission: {
    title: string;
    description: string;
  };
  training_streak: number;
  skill_score: number;
  recent_missions: Array<{
    completed_at: string;
    lesson_id: string;
    xp_gained: number;
  }>;
};

function scoreFromStats(stats: User['stats'] | undefined): number {
  if (!stats) return 0;
  const values = [
    Number(stats.empathy?.score || 0),
    Number(stats.listening?.score || 0),
    Number(stats.trust?.score || 0),
    Number(stats.followUp?.score || 0),
    Number(stats.closing?.score || 0),
    Number(stats.relationship?.score || 0),
  ];
  const nonZero = values.filter((value) => Number.isFinite(value) && value > 0);
  if (nonZero.length === 0) return 0;
  return Math.round((nonZero.reduce((sum, value) => sum + value, 0) / nonZero.length) * 100) / 100;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function daysBetween(fromIso: string | null, to: Date): number {
  if (!fromIso) return Number.MAX_SAFE_INTEGER;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return Number.MAX_SAFE_INTEGER;
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

async function fetchTeamMembers(dealershipId: string): Promise<User[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection('users').where('dealershipIds', 'array-contains', dealershipId).limit(500).get();
  return snapshot.docs.map((doc) => doc.data() as User);
}

async function fetchLessonLogsByUserIds(userIds: string[]) {
  if (userIds.length === 0) return [];
  const adminDb = getAdminDb();
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    chunks.push(userIds.slice(i, i + 30));
  }

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      adminDb.collection('lessonLogs').where('userId', 'in', chunk).limit(2000).get()
    )
  );

  return snapshots.flatMap((snap) =>
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
  );
}

function summarizeTeamMembers(users: User[], logs: Array<Record<string, unknown>>): TeamMemberSummary[] {
  const logsByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const log of logs) {
    const userId = String(log.userId || '');
    if (!userId) continue;
    const bucket = logsByUser.get(userId) || [];
    bucket.push(log);
    logsByUser.set(userId, bucket);
  }

  return users.map((user) => {
    const userLogs = logsByUser.get(user.userId) || [];
    const missionsCompleted = userLogs.length;
    const sortedDates = userLogs
      .map((log) => toIso(log.timestamp))
      .filter((value): value is string => !!value)
      .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0));
    const lastActivity = sortedDates[0] || null;
    const trainingCompletion = Math.min(100, Math.round((missionsCompleted / 20) * 100));

    return {
      user_id: user.userId,
      name: user.name,
      role: user.role,
      training_completion: trainingCompletion,
      missions_completed: missionsCompleted,
      last_activity: lastActivity,
      skill_score: scoreFromStats(user.stats),
    };
  });
}

function estimateMonthlyCost(plan: string, seatCount: number): number {
  const normalizedPlan = plan.trim().toLowerCase();
  if (normalizedPlan === 'pro') return seatCount * 25;
  if (normalizedPlan === 'enterprise') return seatCount * 40;
  return seatCount * 15;
}

export async function getOwnerDashboardData(dealershipId: string): Promise<OwnerDashboardData> {
  const now = new Date();
  const users = await fetchTeamMembers(dealershipId);
  const userIds = users.map((user) => user.userId).filter(Boolean);
  const logs = await fetchLessonLogsByUserIds(userIds);
  const teamRows = summarizeTeamMembers(users, logs);
  const salespeople = teamRows.filter((row) => row.role === 'Sales Consultant').length;
  const activeUsers = teamRows.filter((row) => daysBetween(row.last_activity, now) <= 7).length;
  const completionAvg = teamRows.length > 0
    ? teamRows.reduce((sum, row) => sum + row.training_completion, 0) / teamRows.length
    : 0;
  const skillAvg = teamRows.length > 0
    ? teamRows.reduce((sum, row) => sum + row.skill_score, 0) / teamRows.length
    : 0;
  const engagementRate = teamRows.length > 0 ? (activeUsers / teamRows.length) * 100 : 0;
  const discoveryAverage = teamRows.length > 0
    ? teamRows.reduce((sum, row) => sum + row.skill_score, 0) / teamRows.length
    : 0;
  const trustAverage = teamRows.length > 0
    ? teamRows.reduce((sum, row) => sum + row.skill_score * 0.95, 0) / teamRows.length
    : 0;
  const closingAverage = teamRows.length > 0
    ? teamRows.reduce((sum, row) => sum + row.skill_score * 0.9, 0) / teamRows.length
    : 0;

  const account = await getDealerAccountByDealerId(dealershipId);
  const seatCount = account?.seat_count || Math.max(10, users.length);
  const plan = account?.plan || 'starter';
  const monthlyCost = estimateMonthlyCost(plan, seatCount);
  const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return {
    dealership_id: dealershipId,
    dealership_name: account?.dealer_name || 'Dealership',
    snapshot: {
      team_training_completion: Math.round(completionAvg * 100) / 100,
      team_engagement_rate: Math.round(engagementRate * 100) / 100,
      average_skill_score: Math.round(skillAvg * 100) / 100,
      active_users: activeUsers,
      salespeople,
    },
    team_overview: teamRows.sort((a, b) => (Date.parse(b.last_activity || '') || 0) - (Date.parse(a.last_activity || '') || 0)),
    training_progress: {
      discovery_skills: Math.round(discoveryAverage * 100) / 100,
      trust_building: Math.round(trustAverage * 100) / 100,
      closing_skills: Math.round(closingAverage * 100) / 100,
    },
    billing: {
      current_plan: plan,
      active_seats: seatCount,
      monthly_cost: monthlyCost,
      next_billing_date: nextBillingDate,
    },
  };
}

export async function getGmDashboardData(dealershipId: string): Promise<GmDashboardData> {
  const now = new Date();
  const users = await fetchTeamMembers(dealershipId);
  const reps = users.filter((user) => user.role === 'Sales Consultant' || user.role === 'BDC');
  const repIds = reps.map((rep) => rep.userId).filter(Boolean);
  const logs = await fetchLessonLogsByUserIds(repIds);
  const repRows = summarizeTeamMembers(reps, logs);
  const alerts: string[] = [];

  for (const rep of repRows) {
    const daysInactive = daysBetween(rep.last_activity, now);
    if (daysInactive === Number.MAX_SAFE_INTEGER) {
      alerts.push(`${rep.name} has no recorded activity yet`);
    } else if (daysInactive >= 5) {
      const dayLabel = daysInactive === 1 ? 'day' : 'days';
      alerts.push(`${rep.name} inactive for ${daysInactive} ${dayLabel}`);
    }
    if (rep.skill_score >= 85 && rep.missions_completed >= 10) {
      alerts.push(`${rep.name} showing rapid skill improvement`);
    }
    if (rep.training_completion < 40) {
      alerts.push(`${rep.name} has incomplete training streaks`);
    }
  }

  const account = await getDealerAccountByDealerId(dealershipId);
  return {
    dealership_id: dealershipId,
    dealership_name: account?.dealer_name || 'Dealership',
    rep_performance: repRows,
    coaching_alerts: alerts.slice(0, 12),
    completion_tracking: repRows.map((row) => ({
      user_id: row.user_id,
      name: row.name,
      missions_completed: row.missions_completed,
    })),
  };
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const daySet = new Set(
    dates.map((value) => {
      const date = new Date(value);
      return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    })
  );
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}-${cursor.getUTCDate()}`;
    if (!daySet.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getSalespersonDashboardData(user: User): Promise<SalespersonDashboardData> {
  const dealershipId = user.dealershipIds?.[0] || '';
  if (!dealershipId) {
    throw new Error('No dealership assigned.');
  }

  const logs = await fetchLessonLogsByUserIds([user.userId]);
  const sorted = logs
    .map((log) => ({
      completed_at: toIso(log.timestamp) || '',
      lesson_id: String(log.lessonId || ''),
      xp_gained: Number(log.xpGained || 0),
    }))
    .filter((log) => !!log.completed_at)
    .sort((a, b) => (Date.parse(b.completed_at) || 0) - (Date.parse(a.completed_at) || 0));

  const streak = calculateStreak(sorted.map((log) => log.completed_at));
  const skillScore = scoreFromStats(user.stats);
  const account = await getDealerAccountByDealerId(dealershipId);
  const missionTitle = skillScore < 70 ? 'Trust Building Booster' : 'Closing Confidence Drill';

  return {
    dealership_id: dealershipId,
    dealership_name: account?.dealer_name || 'Dealership',
    today_mission: {
      title: missionTitle,
      description: `Complete one focused ${missionTitle.toLowerCase()} to improve consistency in customer conversations.`,
    },
    training_streak: streak,
    skill_score: Math.round(skillScore * 100) / 100,
    recent_missions: sorted.slice(0, 8),
  };
}

export async function markSalespersonMissionComplete(user: User): Promise<void> {
  const adminDb = getAdminDb();
  await adminDb.collection('dealer_mission_completions').add({
    user_id: user.userId,
    dealership_id: user.dealershipIds?.[0] || '',
    completed_at: new Date().toISOString(),
  });
}
