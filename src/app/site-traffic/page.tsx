'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, Minus, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type TrendDirection = 'up' | 'down' | 'stable';
type TrafficMetricKey = 'pageViews' | 'uniqueVisitors' | 'authenticatedVisitors' | 'toolOpens' | 'marketingEvents' | 'referralClicks' | 'autoforgeLeads';

type TrafficMetricConfig = {
  key: TrafficMetricKey;
  label: string;
  color: string;
  dash?: string;
  source: keyof SiteTrafficResponse['siteTraffic']['timeline'][number];
};

type TrafficRangeSummary = {
  label: string;
  start: string;
  end: string;
  pageViews: number;
  uniqueVisitors: number;
  uniqueSessions: number;
  uniquePageSessions: number;
  trend: TrendDirection;
  topPages: Array<{ label: string; count: number; uniqueSessions: number }>;
  landingPages: Array<{ label: string; count: number }>;
  topReferrers: Array<{ label: string; count: number }>;
  topCampaigns: Array<{ label: string; count: number }>;
  geo: {
    topCountries: Array<{ label: string; count: number }>;
    topRegions: Array<{ label: string; count: number }>;
    topCities: Array<{ label: string; count: number }>;
    cityDetails: Array<{
      label: string;
      count: number;
      uniqueVisitors: number;
      uniqueSessions: number;
      topPages: Array<{ label: string; count: number }>;
      topReferrers: Array<{ label: string; count: number }>;
      landingPages: Array<{ label: string; count: number }>;
      campaigns: Array<{ label: string; count: number }>;
      deviceBreakdown: Array<{ label: string; count: number }>;
      lastSeen: string | null;
    }>;
    geoCenter: { latitude: number; longitude: number; sampleSize: number } | null;
  };
  fromPages: Array<{ label: string; count: number }>;
  topNextSteps: Array<{ from: string; to: string; count: number }>;
  deviceBreakdown: Array<{ label: string; count: number }>;
  surfaceBreakdown: Array<{ label: string; count: number }>;
  timeline: Array<{
    date: string;
    pageViews: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
    toolOpens: number;
    marketingEvents: number;
    referralClicks: number;
    autoforgeLeads: number;
  }>;
  conversions: {
    pageViews: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
    toolOpens: number;
    autoforgeLeads: number;
    marketingEvents: number;
    sprocketSessions: number;
    referralCodes: Array<{
      label: string;
      totalEvents: number;
      referralClicks: number;
      signupEvents: number;
      demoVisits: number;
      demoConversions: number;
    }>;
  };
};

type SiteTrafficResponse = {
  generatedAt: string;
  siteTraffic: {
    selectedRange: TrafficRangeSummary;
    windows: {
      last7Days: { pageViews: number; uniqueVisitors: number; uniquePageSessions: number; trend: TrendDirection };
      last30Days: { pageViews: number; uniqueVisitors: number; uniqueSessions: number; uniquePageSessions: number; trend: TrendDirection };
      last90Days: { pageViews: number; uniqueVisitors: number; uniquePageSessions: number; trend: TrendDirection };
    };
    topPages: Array<{ label: string; count: number; uniqueSessions: number }>;
    landingPages: Array<{ label: string; count: number }>;
    topReferrers: Array<{ label: string; count: number }>;
    topCampaigns: Array<{ label: string; count: number }>;
    geo: {
      topCountries: Array<{ label: string; count: number }>;
      topRegions: Array<{ label: string; count: number }>;
      topCities: Array<{ label: string; count: number }>;
      cityDetails: Array<{
        label: string;
        count: number;
        uniqueVisitors: number;
        uniqueSessions: number;
        topPages: Array<{ label: string; count: number }>;
        topReferrers: Array<{ label: string; count: number }>;
        landingPages: Array<{ label: string; count: number }>;
        campaigns: Array<{ label: string; count: number }>;
        deviceBreakdown: Array<{ label: string; count: number }>;
        lastSeen: string | null;
      }>;
      geoCenter: { latitude: number; longitude: number; sampleSize: number } | null;
    };
    fromPages: Array<{ label: string; count: number }>;
    topNextSteps: Array<{ from: string; to: string; count: number }>;
    deviceBreakdown: Array<{ label: string; count: number }>;
    surfaceBreakdown: Array<{ label: string; count: number }>;
    timeline: Array<{
      date: string;
      pageViews: number;
      uniqueVisitors: number;
      authenticatedVisitors: number;
      toolOpens: number;
      marketingEvents: number;
      referralClicks: number;
      autoforgeLeads: number;
    }>;
    conversions30Days: {
      pageViews: number;
      uniqueVisitors: number;
      authenticatedVisitors: number;
      toolOpens: number;
      autoforgeLeads: number;
      sprocketSessions: number;
      marketingEvents: number;
      referralCodes: Array<{
        label: string;
        totalEvents: number;
        referralClicks: number;
        signupEvents: number;
        demoVisits: number;
        demoConversions: number;
      }>;
    };
  };
};

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function startOfLocalDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addLocalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);
}

type RangePreset = '7d' | '30d' | 'month' | 'year' | 'custom';

function buildSeriesPath(values: number[], width: number, height: number, maxValueOverride?: number) {
  const safeValues = values.length > 0 ? values : [0];
  const maxValue = Math.max(1, maxValueOverride || 0, ...safeValues);
  const topPadding = 18;
  const bottomPadding = 22;
  const chartHeight = Math.max(1, height - topPadding - bottomPadding);
  const step = safeValues.length > 1 ? width / (safeValues.length - 1) : width;
  const points = safeValues.map((value, index) => {
    const x = safeValues.length > 1 ? index * step : width / 2;
    const ratio = value / maxValue;
    const y = topPadding + ((1 - ratio) * chartHeight);
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height - bottomPadding} L 0 ${height - bottomPadding} Z`;
  return { linePath, areaPath, points, maxValue };
}

const TRAFFIC_METRIC_OPTIONS: TrafficMetricConfig[] = [
  { key: 'pageViews', label: 'Pageviews', color: '#3b82f6', source: 'pageViews' },
  { key: 'uniqueVisitors', label: 'Unique Visitors', color: '#22d3ee', source: 'uniqueVisitors' },
  { key: 'authenticatedVisitors', label: 'Authed Visitors', color: '#a78bfa', dash: '7 4', source: 'authenticatedVisitors' },
  { key: 'toolOpens', label: 'Tool Opens', color: '#f59e0b', dash: '5 5', source: 'toolOpens' },
  { key: 'marketingEvents', label: 'Marketing Events', color: '#f97316', dash: '3 4', source: 'marketingEvents' },
  { key: 'referralClicks', label: 'Referral Clicks', color: '#ec4899', dash: '9 4', source: 'referralClicks' },
  { key: 'autoforgeLeads', label: 'AutoForge Leads', color: '#10b981', dash: '2 4', source: 'autoforgeLeads' },
];

function TrendIcon({ trend }: { trend: TrendDirection }) {
  if (trend === 'up') return <ArrowUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  if (trend === 'down') return <ArrowDown className="h-4 w-4 text-red-600" aria-hidden="true" />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

export default function SiteTrafficPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SiteTrafficResponse | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedTrafficMetrics, setSelectedTrafficMetrics] = useState<TrafficMetricKey[]>(['pageViews', 'uniqueVisitors']);
  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [customStart, setCustomStart] = useState(() => formatDateInput(startOfLocalDay(new Date(Date.now() - (29 * 24 * 60 * 60 * 1000)))));
  const [customEnd, setCustomEnd] = useState(() => formatDateInput(startOfLocalDay(new Date())));

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'Admin' && user.role !== 'Developer' && user.hasSiteTrafficAccess !== true) {
      router.push('/');
    }
  }, [loading, router, user]);

  const selectedDateRange = useMemo(() => {
    const now = startOfLocalDay(new Date());
    let start = now;
    let end = now;
    let label = 'Last 30 Days';

    if (rangePreset === '7d') {
      start = startOfLocalDay(addLocalDays(now, -6));
      label = 'Last 7 Days';
    } else if (rangePreset === '30d') {
      start = startOfLocalDay(addLocalDays(now, -29));
      label = 'Last 30 Days';
    } else if (rangePreset === 'month') {
      start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 1));
      label = 'Month to Date';
    } else if (rangePreset === 'year') {
      start = startOfLocalDay(new Date(now.getFullYear(), 0, 1));
      label = 'Year to Date';
    } else {
      const parsedStart = parseDateInput(customStart);
      const parsedEnd = parseDateInput(customEnd);
      if (parsedStart) start = parsedStart;
      if (parsedEnd) end = parsedEnd;
      if (end < start) end = start;
      label = 'Custom Range';
    }

    return {
      label,
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
  }, [customEnd, customStart, rangePreset]);

  async function loadSiteTraffic() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer' && user.hasSiteTrafficAccess !== true)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) throw new Error('Authentication required. Please sign in again.');
      const token = await fbUser.getIdToken(true);
      const params = new URLSearchParams({
        range: rangePreset,
        start: selectedDateRange.start,
        end: selectedDateRange.end,
      });
      const response = await fetch(`/api/site-traffic?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Failed to load site traffic.');
      setData(payload as SiteTrafficResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load site traffic.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSiteTraffic();
  }, [user?.userId, user?.role, user?.hasSiteTrafficAccess, rangePreset, selectedDateRange.start, selectedDateRange.end]);

  const generatedAtText = useMemo(() => {
    if (!data?.generatedAt) return null;
    const parsed = new Date(data.generatedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
  }, [data?.generatedAt]);

  const selectedRange = data?.siteTraffic.selectedRange || null;
  const siteTrafficTimeline = useMemo(() => [...(selectedRange?.timeline || [])], [selectedRange]);
  const trafficChart = useMemo(() => {
    const selectedConfigs = TRAFFIC_METRIC_OPTIONS.filter((option) => selectedTrafficMetrics.includes(option.key));
    const valuesByMetric = new Map<TrafficMetricKey, number[]>();
    selectedConfigs.forEach((config) => {
      valuesByMetric.set(config.key, siteTrafficTimeline.map((row) => row[config.source] as number));
    });
    const sharedMax = Math.max(1, ...selectedConfigs.flatMap((config) => valuesByMetric.get(config.key) || []));
    return {
      sharedMax,
      series: selectedConfigs.map((config) => ({
        ...config,
        ...buildSeriesPath(valuesByMetric.get(config.key) || [], 640, 240, sharedMax),
      })),
    };
  }, [selectedTrafficMetrics, siteTrafficTimeline]);
  const selectedCityDetail = useMemo(
    () => selectedRange?.geo.cityDetails.find((city) => city.label === selectedCity) || selectedRange?.geo.cityDetails[0] || null,
    [selectedCity, selectedRange],
  );
  const deviceSplit = useMemo(() => {
    const rows = selectedRange?.deviceBreakdown || [];
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }));
  }, [selectedRange]);
  const surfaceTopRows = useMemo(() => (selectedRange?.surfaceBreakdown || []).slice(0, 4), [selectedRange]);

  useEffect(() => {
    const cityList = selectedRange?.geo.cityDetails || [];
    if (cityList.length === 0) {
      if (selectedCity) setSelectedCity('');
      return;
    }
    if (!selectedCity || !cityList.some((city) => city.label === selectedCity)) {
      setSelectedCity(cityList[0].label);
    }
  }, [selectedCity, selectedRange]);

  if (loading || !user || (user.role !== 'Admin' && user.role !== 'Developer' && user.hasSiteTrafficAccess !== true)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-none flex-1 flex-col gap-6 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 xl:px-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Site Traffic</CardTitle>
            <CardDescription>Traffic, origin, navigation flow, and approximate IP-based location.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {generatedAtText ? `Last refreshed: ${generatedAtText}` : 'Fresh data snapshot'}
            </div>
            <Button type="button" variant="outline" onClick={() => void loadSiteTraffic()}>
              Refresh
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-400/15 bg-slate-950/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-cyan-100">Date Range</CardTitle>
            <CardDescription>Switch between preset windows or choose a custom start and end date.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: '7d' as RangePreset, label: '7 Days' },
                { key: '30d' as RangePreset, label: '30 Days' },
                { key: 'month' as RangePreset, label: 'Month' },
                { key: 'year' as RangePreset, label: 'Year' },
                { key: 'custom' as RangePreset, label: 'Custom' },
              ].map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant={rangePreset === preset.key ? 'default' : 'outline'}
                  className={rangePreset === preset.key ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'border-cyan-400/20 bg-slate-950/60 text-cyan-100 hover:bg-slate-900'}
                  onClick={() => setRangePreset(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,16rem))_auto] md:items-end">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Start date</span>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(event) => {
                    setCustomStart(event.target.value);
                    setRangePreset('custom');
                  }}
                  className="border-cyan-400/20 bg-slate-950/70 text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">End date</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(event) => {
                    setCustomEnd(event.target.value);
                    setRangePreset('custom');
                  }}
                  className="border-cyan-400/20 bg-slate-950/70 text-slate-100"
                />
              </label>
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Selected range</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{selectedDateRange.label}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedDateRange.start} → {selectedDateRange.end}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <Card className="border-red-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                Site traffic unavailable
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : data ? (
          <div className="space-y-6">
            <Card className="overflow-hidden border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950/90 to-cyan-950/20 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <CardHeader className="flex flex-col gap-4 border-b border-cyan-400/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl text-cyan-100">Audience Reach</CardTitle>
                  <CardDescription className="max-w-3xl">
                    Compare pageviews, clicks, and conversion signals across the selected date range. Use the metric menu to layer multiple lines and spot where traffic and engagement diverge.
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15">
                      Metrics
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Chart Metrics</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {TRAFFIC_METRIC_OPTIONS.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.key}
                        checked={selectedTrafficMetrics.includes(option.key)}
                        onCheckedChange={(checked) => {
                          setSelectedTrafficMetrics((current) => {
                            if (checked) {
                              return current.includes(option.key) ? current : [...current, option.key];
                            }
                            const next = current.filter((item) => item !== option.key);
                            return next.length > 0 ? next : ['pageViews'];
                          });
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                          {option.label}
                        </span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                  {siteTrafficTimeline.length === 0 ? (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-700/80">
                      <p className="text-sm text-muted-foreground">No site traffic captured yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
                        <div className="relative h-64">
                          {[0, 1, 2, 3].map((index) => {
                            const value = trafficChart.sharedMax - ((trafficChart.sharedMax / 3) * index);
                            return (
                              <div
                                key={index}
                                className="absolute left-0 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400"
                                style={{ top: `${(index / 3) * 100}%` }}
                              >
                                {index === 3 ? '0' : formatCompactNumber(Math.round(value))}
                              </div>
                            );
                          })}
                          <div className="absolute bottom-0 left-0 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Y
                          </div>
                        </div>
                        <div className="space-y-3">
                          <svg className="relative z-10 h-64 w-full" viewBox="0 0 640 240" preserveAspectRatio="none" aria-hidden="true">
                            <defs>
                              {trafficChart.series.map((series) => (
                                <linearGradient key={`${series.key}-fill`} id={`traffic-${series.key}-fill`} x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="0%" stopColor={series.color} stopOpacity="0.24" />
                                  <stop offset="100%" stopColor={series.color} stopOpacity="0" />
                                </linearGradient>
                              ))}
                            </defs>
                            {[0, 1, 2, 3].map((index) => (
                              <line key={index} x1="0" x2="640" y1={24 + (index * 60)} y2={24 + (index * 60)} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 6" strokeWidth="1" />
                            ))}
                            {trafficChart.series.map((series, index) => (
                              <g key={series.key}>
                                {index === 0 ? <path d={series.areaPath} fill={`url(#traffic-${series.key}-fill)`} opacity="0.9" /> : null}
                                <path
                                  d={series.linePath}
                                  fill="none"
                                  stroke={series.color}
                                  strokeWidth={index === 0 ? 3.2 : 2.4}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeDasharray={series.dash}
                                />
                                {series.points.map((point, pointIndex) => (
                                  <circle key={`${series.key}-${pointIndex}`} cx={point.x} cy={point.y} r={index === 0 ? '3' : '2.4'} fill={series.color} opacity={index === 0 ? 0.72 : 0.82} />
                                ))}
                              </g>
                            ))}
                          </svg>
                          <div className="flex flex-wrap gap-2">
                            {trafficChart.series.map((series) => (
                              <div key={series.key} className="flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
                                <span>{series.label}</span>
                                {series.dash ? <span className="opacity-70">pattern</span> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <div className="text-right">X</div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            siteTrafficTimeline[0]?.date,
                            siteTrafficTimeline[Math.floor((siteTrafficTimeline.length - 1) / 2)]?.date,
                            siteTrafficTimeline[siteTrafficTimeline.length - 1]?.date,
                          ].map((date, index) => (
                            <span key={`${date || 'date'}-${index}`} className={index === 1 ? 'text-center' : index === 2 ? 'text-right' : 'text-left'}>
                              {date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{selectedRange?.label || 'Selected'} Pageviews</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-50">{formatCompactNumber(selectedRange?.pageViews || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{selectedRange?.label || 'Selected'} Unique Visitors</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-50">{formatCompactNumber(selectedRange?.uniqueVisitors || 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{selectedRange?.label || 'Selected'} Authed Visitors</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-50">{formatCompactNumber(selectedRange?.conversions.authenticatedVisitors || 0)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {[
                { label: 'Selected Pageviews', value: selectedRange?.pageViews || 0, trend: selectedRange?.trend || ('stable' as TrendDirection) },
                { label: 'Unique Page Sessions', value: selectedRange?.uniquePageSessions || 0, trend: 'stable' as TrendDirection },
                { label: 'Visitors', value: selectedRange?.uniqueVisitors || 0, trend: 'stable' as TrendDirection },
                { label: 'Sessions', value: selectedRange?.uniqueSessions || 0, trend: 'stable' as TrendDirection },
                { label: 'Authed Visitors', value: selectedRange?.conversions.authenticatedVisitors || 0, trend: 'stable' as TrendDirection },
                { label: 'Tool Opens', value: selectedRange?.conversions.toolOpens || 0, trend: 'stable' as TrendDirection },
              ].map((item) => (
                <Card key={item.label}>
                  <CardHeader className="pb-2">
                    <CardDescription>{item.label}</CardDescription>
                    <CardTitle className="text-3xl">{item.value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendIcon trend={item.trend} />
                      <span>{item.trend === 'stable' ? 'Stable' : item.trend === 'up' ? 'Increasing' : 'Decreasing'}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Audience Split</CardTitle>
                  <CardDescription>Device mix across captured site traffic.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-5">
                  <div className="relative flex h-44 w-44 items-center justify-center">
                    <svg className="-rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                      <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="hsl(var(--muted))" strokeWidth="4" />
                      {(selectedRange?.deviceBreakdown || []).length === 0 ? null : (
                        (() => {
                          const colors = ['#3b82f6', '#22d3ee', '#cbd5e1'];
                          let offset = 0;
                          return (selectedRange?.deviceBreakdown || []).map((row, index) => {
                            const total = (selectedRange?.deviceBreakdown || []).reduce((sum, item) => sum + item.count, 0);
                            const percent = total > 0 ? (row.count / total) * 100 : 0;
                            const circle = (
                              <circle key={row.label} cx="18" cy="18" r="15.9" fill="transparent" stroke={colors[index] || '#3b82f6'} strokeWidth="4" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-offset} strokeLinecap="round" />
                            );
                            offset += percent;
                            return circle;
                          });
                        })()
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-3xl font-extrabold text-slate-50">{formatCompactNumber(selectedRange?.uniqueVisitors || 0)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Unique Visitors</p>
                    </div>
                  </div>
                  <div className="grid w-full gap-2 sm:grid-cols-3">
                    {(selectedRange?.deviceBreakdown || []).map((row) => (
                      <div key={row.label} className="rounded-xl border bg-background/30 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{row.label}</p>
                        <p className="mt-1 text-lg font-semibold">{row.count}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Traffic to Conversion Signals</CardTitle>
                  <CardDescription>What traffic is turning into product activity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Raw Pageviews', value: selectedRange?.conversions.pageViews || 0 },
                    { label: 'Unique Page Sessions', value: selectedRange?.uniquePageSessions || 0 },
                    { label: 'Unique Visitors', value: selectedRange?.conversions.uniqueVisitors || 0 },
                    { label: 'Authed Visitors', value: selectedRange?.conversions.authenticatedVisitors || 0 },
                    { label: 'Tool Opens', value: selectedRange?.conversions.toolOpens || 0 },
                    { label: 'Marketing Events', value: selectedRange?.conversions.marketingEvents || 0 },
                    { label: 'Sprocket Sessions', value: selectedRange?.conversions.sprocketSessions || 0 },
                    { label: 'AutoForge Leads', value: selectedRange?.conversions.autoforgeLeads || 0 },
                  ].map((row) => {
                    const base = Math.max(1, selectedRange?.uniquePageSessions || 1);
                    const progress = Math.min(100, Math.round((row.value / base) * 100));
                    return (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{row.label}</span>
                          <span className="text-muted-foreground">{row.value}</span>
                        </div>
                        <Progress value={progress} />
                      </div>
                    );
                  })}

                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <p className="text-sm font-medium">AK Consultant Referral Codes</p>
                      <p className="text-xs text-muted-foreground">
                        Top codes seen in the last 30 days across referral clicks, demo visits, and signups.
                      </p>
                    </div>
                    {(selectedRange?.conversions.referralCodes || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No referral-code activity captured yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedRange?.conversions.referralCodes || []).map((row) => (
                          <div key={row.label} className="rounded-lg border border-slate-700/70 bg-slate-950/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium uppercase tracking-wide">{row.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {row.referralClicks} clicks · {row.signupEvents} signups · {row.demoVisits} demo visits · {row.demoConversions} demo conversions
                                </p>
                              </div>
                              <Badge variant="outline" className="border-cyan-400/30 text-cyan-100">
                                {row.totalEvents}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages and Origins</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Top Pages</p>
                    {(selectedRange?.topPages || []).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.label}</p>
                          <p className="text-muted-foreground">{row.uniqueSessions} sessions</p>
                        </div>
                        <Badge variant="secondary">{row.count} views</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Landing Pages</p>
                    {(selectedRange?.landingPages || []).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <span className="truncate font-medium">{row.label}</span>
                        <Badge variant="secondary">{row.count} landings</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Origins</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Referrers</p>
                    {(selectedRange?.topReferrers || []).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <span className="truncate font-medium">{row.label}</span>
                        <Badge variant="outline">{row.count}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Campaigns</p>
                    {(selectedRange?.topCampaigns || []).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <span className="truncate font-medium">{row.label}</span>
                        <Badge variant="outline">{row.count}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Came From</p>
                    {(selectedRange?.fromPages || []).map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <span className="truncate font-medium">{row.label}</span>
                        <Badge variant="outline">{row.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Device and Surface Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Devices</p>
                    {(selectedRange?.deviceBreakdown || []).map((row) => (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{row.label}</span>
                          <span className="text-muted-foreground">{row.count}</span>
                        </div>
                        <Progress value={Math.min(100, Math.round((row.count / Math.max(1, selectedRange?.pageViews || 1)) * 100))} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Surfaces</p>
                    {(selectedRange?.surfaceBreakdown || []).map((row) => (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{row.label}</span>
                          <span className="text-muted-foreground">{row.count}</span>
                        </div>
                        <Progress value={Math.min(100, Math.round((row.count / Math.max(1, selectedRange?.pageViews || 1)) * 100))} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Approximate Location from IP</CardTitle>
                  <CardDescription>Coarse geolocation based on request IP headers. Good for region-level patterns, not exact physical location.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-xl border p-4">
                      <p className="text-sm font-medium">Countries</p>
                      {(selectedRange?.geo.topCountries || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No country data yet.</p>
                      ) : (
                        (selectedRange?.geo.topCountries || []).map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border bg-background/30 p-3 text-sm">
                            <span className="truncate font-medium">{row.label}</span>
                            <Badge variant="outline">{row.count}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="space-y-3 rounded-xl border p-4">
                      <p className="text-sm font-medium">Regions</p>
                      {(selectedRange?.geo.topRegions || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No region data yet.</p>
                      ) : (
                        (selectedRange?.geo.topRegions || []).map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border bg-background/30 p-3 text-sm">
                            <span className="truncate font-medium">{row.label}</span>
                            <Badge variant="outline">{row.count}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div className="space-y-3">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Cities</p>
                          <p className="text-xs text-muted-foreground">Scroll and select a city to inspect its traffic mix.</p>
                        </div>
                        <Badge variant="outline">{selectedRange?.geo.cityDetails.length || 0} cities</Badge>
                      </div>
                      <div className="max-h-[24rem] space-y-2 overflow-y-auto rounded-xl border p-2">
                        {(selectedRange?.geo.cityDetails || []).length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">No city data yet.</p>
                        ) : (
                          (selectedRange?.geo.cityDetails || []).map((row) => {
                            const isActive = selectedCityDetail?.label === row.label;
                            return (
                              <button
                                key={row.label}
                                type="button"
                                onClick={() => setSelectedCity(row.label)}
                                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                                  isActive
                                    ? 'border-primary/60 bg-primary/10 shadow-sm'
                                    : 'border-transparent bg-transparent hover:border-border hover:bg-muted/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{row.label}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {row.uniqueVisitors} visitors · {row.uniqueSessions} sessions
                                      {row.lastSeen ? ` · last seen ${new Date(row.lastSeen).toLocaleString()}` : ''}
                                    </p>
                                  </div>
                                  <Badge variant={isActive ? 'default' : 'outline'} className="shrink-0">
                                    {row.count}
                                  </Badge>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border p-4">
                      {!selectedCityDetail ? (
                        <p className="text-sm text-muted-foreground">Select a city to drill into its pageviews, referrers, and device mix.</p>
                      ) : (
                        <div className="space-y-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Selected City</p>
                              <h3 className="text-lg font-semibold">{selectedCityDetail.label}</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {selectedCityDetail.uniqueVisitors} visitors, {selectedCityDetail.uniqueSessions} sessions, {selectedCityDetail.count} pageviews
                              </p>
                            </div>
                            <Badge variant="outline">Live drill-down</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg border bg-background/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pageviews</p>
                              <p className="mt-1 text-lg font-semibold">{selectedCityDetail.count}</p>
                            </div>
                            <div className="rounded-lg border bg-background/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Visitors</p>
                              <p className="mt-1 text-lg font-semibold">{selectedCityDetail.uniqueVisitors}</p>
                            </div>
                            <div className="rounded-lg border bg-background/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessions</p>
                              <p className="mt-1 text-lg font-semibold">{selectedCityDetail.uniqueSessions}</p>
                            </div>
                            <div className="rounded-lg border bg-background/30 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Seen</p>
                              <p className="mt-1 text-sm font-semibold leading-tight">
                                {selectedCityDetail.lastSeen ? new Date(selectedCityDetail.lastSeen).toLocaleString() : 'Unknown'}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Top Pages</p>
                              {selectedCityDetail.topPages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No page data yet.</p>
                              ) : (
                                selectedCityDetail.topPages.map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                    <span className="truncate font-medium">{row.label}</span>
                                    <Badge variant="outline">{row.count}</Badge>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Top Referrers</p>
                              {selectedCityDetail.topReferrers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No referrer data yet.</p>
                              ) : (
                                selectedCityDetail.topReferrers.map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                    <span className="truncate font-medium">{row.label}</span>
                                    <Badge variant="outline">{row.count}</Badge>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Landing Pages</p>
                              {selectedCityDetail.landingPages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No landing page data yet.</p>
                              ) : (
                                selectedCityDetail.landingPages.map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                    <span className="truncate font-medium">{row.label}</span>
                                    <Badge variant="outline">{row.count}</Badge>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Campaigns</p>
                              {selectedCityDetail.campaigns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No campaign data yet.</p>
                              ) : (
                                selectedCityDetail.campaigns.map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                    <span className="truncate font-medium">{row.label}</span>
                                    <Badge variant="outline">{row.count}</Badge>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-sm font-medium">Device Mix</p>
                            {selectedCityDetail.deviceBreakdown.map((row) => (
                              <div key={row.label} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium capitalize">{row.label}</span>
                                  <span className="text-muted-foreground">{row.count}</span>
                                </div>
                                <Progress value={Math.min(100, Math.round((row.count / Math.max(1, selectedCityDetail.count)) * 100))} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">Geographic Center</p>
                    {selectedRange?.geo.geoCenter ? (
                      <p className="mt-1 text-muted-foreground">
                        Approximate center at {selectedRange.geo.geoCenter.latitude}, {selectedRange.geo.geoCenter.longitude} from {selectedRange.geo.geoCenter.sampleSize} geo-tagged visits.
                      </p>
                    ) : (
                      <p className="mt-1 text-muted-foreground">No latitude/longitude data captured yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Where They Went Next</CardTitle>
                  <CardDescription>Most common page-to-page transitions inside a session.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(selectedRange?.topNextSteps || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transition-flow data yet.</p>
                  ) : (
                    (selectedRange?.topNextSteps || []).map((row) => (
                      <div key={`${row.from}-${row.to}`} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{row.from}</p>
                        <p className="text-muted-foreground">to {row.to}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.count} transitions</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
