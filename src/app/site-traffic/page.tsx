'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Minus, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'stable';

type SiteTrafficResponse = {
  generatedAt: string;
  siteTraffic: {
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
      geoCenter: { latitude: number; longitude: number; sampleSize: number } | null;
    };
    fromPages: Array<{ label: string; count: number }>;
    topNextSteps: Array<{ from: string; to: string; count: number }>;
    deviceBreakdown: Array<{ label: string; count: number }>;
    surfaceBreakdown: Array<{ label: string; count: number }>;
    timeline: Array<{ date: string; pageViews: number; uniqueVisitors: number }>;
  };
};

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
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'Admin' && user.role !== 'Developer' && user.hasSiteTrafficAccess !== true) {
      router.push('/');
    }
  }, [loading, router, user]);

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
      const response = await fetch('/api/site-traffic', {
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
  }, [user?.userId, user?.role, user?.hasSiteTrafficAccess]);

  const generatedAtText = useMemo(() => {
    if (!data?.generatedAt) return null;
    const parsed = new Date(data.generatedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
  }, [data?.generatedAt]);

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
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
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
          <Collapsible open={isSectionOpen} onOpenChange={setIsSectionOpen}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Traffic Overview</CardTitle>
                  <CardDescription>Interpretable traffic metrics, flow, and approximate geography.</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isSectionOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    {[
                      { label: 'Raw Pageviews (7d)', value: data.siteTraffic.windows.last7Days.pageViews, trend: data.siteTraffic.windows.last7Days.trend },
                      { label: 'Raw Pageviews (30d)', value: data.siteTraffic.windows.last30Days.pageViews, trend: data.siteTraffic.windows.last30Days.trend },
                      { label: 'Unique Page Sessions (30d)', value: data.siteTraffic.windows.last30Days.uniquePageSessions, trend: 'stable' as TrendDirection },
                      { label: 'Visitors (30d)', value: data.siteTraffic.windows.last30Days.uniqueVisitors, trend: 'stable' as TrendDirection },
                      { label: 'Sessions (30d)', value: data.siteTraffic.windows.last30Days.uniqueSessions, trend: 'stable' as TrendDirection },
                      { label: 'Raw Pageviews (90d)', value: data.siteTraffic.windows.last90Days.pageViews, trend: data.siteTraffic.windows.last90Days.trend },
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
                    <Card>
                      <CardHeader>
                        <CardTitle>14-Day Traffic Timeline</CardTitle>
                        <CardDescription>Recent pageviews and unique visitors by day.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {data.siteTraffic.timeline.map((row) => (
                          <div key={row.date} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{new Date(`${row.date}T00:00:00`).toLocaleDateString()}</span>
                              <span className="text-muted-foreground">{row.pageViews} views • {row.uniqueVisitors} visitors</span>
                            </div>
                            <Progress value={Math.min(100, Math.round((row.pageViews / Math.max(1, data.siteTraffic.windows.last30Days.pageViews)) * 100))} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Where They Went Next</CardTitle>
                        <CardDescription>Most common page-to-page transitions inside a session.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {data.siteTraffic.topNextSteps.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No transition-flow data yet.</p>
                        ) : (
                          data.siteTraffic.topNextSteps.map((row) => (
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

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Pages and Landing Pages</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Top Pages</p>
                          {data.siteTraffic.topPages.map((row) => (
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
                          {data.siteTraffic.landingPages.map((row) => (
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
                          {data.siteTraffic.topReferrers.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate font-medium">{row.label}</span>
                              <Badge variant="outline">{row.count}</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Campaigns</p>
                          {data.siteTraffic.topCampaigns.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate font-medium">{row.label}</span>
                              <Badge variant="outline">{row.count}</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Came From</p>
                          {data.siteTraffic.fromPages.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate font-medium">{row.label}</span>
                              <Badge variant="outline">{row.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Device and Surface Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Devices</p>
                          {data.siteTraffic.deviceBreakdown.map((row) => (
                            <div key={row.label} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium capitalize">{row.label}</span>
                                <span className="text-muted-foreground">{row.count}</span>
                              </div>
                              <Progress value={Math.min(100, Math.round((row.count / Math.max(1, data.siteTraffic.windows.last30Days.pageViews)) * 100))} />
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Surfaces</p>
                          {data.siteTraffic.surfaceBreakdown.map((row) => (
                            <div key={row.label} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{row.label}</span>
                                <span className="text-muted-foreground">{row.count}</span>
                              </div>
                              <Progress value={Math.min(100, Math.round((row.count / Math.max(1, data.siteTraffic.windows.last30Days.pageViews)) * 100))} />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Approximate Location from IP</CardTitle>
                        <CardDescription>Coarse geolocation only.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Countries</p>
                          {data.siteTraffic.geo.topCountries.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate font-medium">{row.label}</span>
                              <Badge variant="outline">{row.count}</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Regions</p>
                          {data.siteTraffic.geo.topRegions.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate font-medium">{row.label}</span>
                              <Badge variant="outline">{row.count}</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-medium">Cities</p>
                          {data.siteTraffic.geo.topCities.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                              <span className="truncate font-medium">{row.label}</span>
                              <Badge variant="outline">{row.count}</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="md:col-span-3 rounded-lg border p-3 text-sm">
                          <p className="font-medium">Geographic Center</p>
                          {data.siteTraffic.geo.geoCenter ? (
                            <p className="mt-1 text-muted-foreground">
                              Approximate center at {data.siteTraffic.geo.geoCenter.latitude}, {data.siteTraffic.geo.geoCenter.longitude} from {data.siteTraffic.geo.geoCenter.sampleSize} geo-tagged visits.
                            </p>
                          ) : (
                            <p className="mt-1 text-muted-foreground">No latitude/longitude data captured yet.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ) : null}
      </main>
    </div>
  );
}
