import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { hasAdminIntelligenceAccess } from '@/lib/admin/access';
import { buildAutoforgeTriggerRows, buildConsultantTrendRows, buildDealerSummaryRows, buildManagerCoachingReport, buildMarketingInsightReport, buildRawSessionRows } from '@/lib/fresh-up-export/builders';
import { buildExportBundle } from '@/lib/fresh-up-export/formatters';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import type { FreshUpExportFilters, FreshUpExportFormat, FreshUpExportType } from '@/lib/fresh-up-export/types';
import { runFreshUpBenchmark } from '@/lib/fresh-up-benchmark/engine';
import type { FreshUpBenchmarkRequest } from '@/lib/fresh-up-benchmark/types';
import { generateFreshUpNarrative } from '@/lib/fresh-up-narrative/engine';
import type { FreshUpNarrativeLength, FreshUpNarrativeType } from '@/lib/fresh-up-narrative/types';
import { generateWeeklyDigest } from '@/lib/fresh-up-digest/engine';
import type { FreshUpWeeklyDigestRequest, FreshUpWeeklyDigestType } from '@/lib/fresh-up-digest/types';
import type { FreshUpRiskRadarFilterInput } from '@/lib/fresh-up-risk-radar/types';
import { loadActiveRiskHighlights } from '@/lib/fresh-up-risk-radar/engine';
import { buildFreshUpCommandCenter } from '@/lib/fresh-up-command-center/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExportRequestBody = {
  exportType: FreshUpExportType;
  format: FreshUpExportFormat;
  filters?: FreshUpExportFilters;
  includeBenchmarks?: boolean;
  includeNarratives?: boolean;
  benchmarkRequest?: Omit<FreshUpBenchmarkRequest, 'filters'>;
  narrativeRequest?: {
    narrativeType?: FreshUpNarrativeType;
    lengthMode?: FreshUpNarrativeLength;
  };
  digestRequest?: {
    digestType?: FreshUpWeeklyDigestType;
    lengthMode?: FreshUpWeeklyDigestRequest['lengthMode'];
    entityId?: string;
    comparisonEntityId?: string;
  };
};

async function requireAdminOrDeveloper(req: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  const user = userDoc.data() as User;
  if (!hasAdminIntelligenceAccess(user)) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;

    const body = await req.json() as ExportRequestBody;
    if (!body?.exportType || !body?.format) {
      return NextResponse.json({ message: 'Missing required exportType or format.' }, { status: 400 });
    }

    const filters: FreshUpExportFilters = {
      includeSandboxData: false,
      ...(body.filters ?? {}),
    };
    const adminDb = getAdminDb();
    const sessions = await loadFreshUpSessionsForExport({
      adminDb,
      filters,
    });
    const { dealerNameById, userNameById } = await loadNamesById({
      adminDb,
      sessions,
    });

    const context = { sessions, dealerNameById, userNameById, filters };
    const benchmarkData = body.includeBenchmarks
      ? runFreshUpBenchmark({
        request: {
          benchmarkType: body.benchmarkRequest?.benchmarkType || 'dealer_vs_platform',
          metricName: body.benchmarkRequest?.metricName || 'all',
          entityId: body.benchmarkRequest?.entityId || filters.dealerId || '',
          comparisonEntityId: body.benchmarkRequest?.comparisonEntityId,
          segmentKey: body.benchmarkRequest?.segmentKey,
          segmentValue: body.benchmarkRequest?.segmentValue,
          filters,
        },
        context: {
          sessions,
          filters,
          dealerNameById,
          userNameById,
        },
      })
      : null;
    const narrativeTypeByExport: Partial<Record<FreshUpExportType, FreshUpNarrativeType>> = {
      dealer_summary: 'dealer_performance',
      consultant_trends: 'consultant_trend',
      manager_coaching: 'manager_coaching',
      marketing_insights: 'marketing_insight',
      benchmarks: 'version_comparison',
      autoforge_triggers: 'manager_coaching',
    };
    const shouldIncludeNarratives = body.includeNarratives !== false;
    const narrativeData = shouldIncludeNarratives
      ? generateFreshUpNarrative({
        narrativeType: body.narrativeRequest?.narrativeType || narrativeTypeByExport[body.exportType] || 'platform_insight',
        lengthMode: body.narrativeRequest?.lengthMode || (body.exportType === 'marketing_insights' ? 'extended' : 'standard'),
        context: {
          sessions,
          filters,
          dealerNameById,
          userNameById,
          entityId: body.benchmarkRequest?.entityId || filters.dealerId || filters.userId || undefined,
          comparisonEntityId: body.benchmarkRequest?.comparisonEntityId,
          benchmarkResult: benchmarkData,
        },
      })
      : null;
    const shouldIncludeDigest = body.exportType === 'weekly_digest' || body.includeNarratives !== false;
    const digestData = shouldIncludeDigest
      ? generateWeeklyDigest({
        request: {
          digestType: body.digestRequest?.digestType || 'platform_weekly',
          lengthMode: body.digestRequest?.lengthMode || 'standard',
          entityId: body.digestRequest?.entityId || body.benchmarkRequest?.entityId || filters.dealerId || filters.userId || undefined,
          comparisonEntityId: body.digestRequest?.comparisonEntityId || body.benchmarkRequest?.comparisonEntityId,
          filters,
        },
        context: {
          sessions,
          filters,
          dealerNameById,
          userNameById,
          entityId: body.digestRequest?.entityId || body.benchmarkRequest?.entityId,
          comparisonEntityId: body.digestRequest?.comparisonEntityId || body.benchmarkRequest?.comparisonEntityId,
        },
      })
      : null;
    const riskHighlights = await loadActiveRiskHighlights({
      db: adminDb,
      environment: filters.includeSandboxData === true ? 'sandbox' : 'production',
      entityType: body.benchmarkRequest?.entityId ? 'dealer' : 'platform',
      entityId: body.benchmarkRequest?.entityId || filters.dealerId || undefined,
      limit: 3,
    });
    let bundle;

    if (body.exportType === 'raw_sessions') {
      const rows = buildRawSessionRows(context);
      const rowsWithNarrative = narrativeData && body.format === 'csv'
        ? rows.map((row) => ({ ...row, insightNarrative: narrativeData.narrative, weeklyDigestHeadline: digestData?.headlineSummary || '' }))
        : rows;
      bundle = buildExportBundle({ exportType: body.exportType, format: body.format, rows: rowsWithNarrative });
    } else if (body.exportType === 'dealer_summary') {
      const rows = buildDealerSummaryRows(context);
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : rows,
        data: body.format === 'structured'
          ? {
            summary: {
              rows: rows.length,
              totalSessions: sessions.length,
              versionCoverage: Array.from(new Set(sessions.map((row) => row.freshUpVersionName || row.freshUpVersionId).filter(Boolean))),
            },
            dealers: rows,
            ...(riskHighlights.length > 0 ? { riskHighlights } : {}),
            ...(benchmarkData ? { benchmarks: benchmarkData } : {}),
            ...(narrativeData ? { narrative: narrativeData } : {}),
            ...(digestData ? { weeklyDigest: digestData } : {}),
          }
          : undefined,
      });
    } else if (body.exportType === 'consultant_trends') {
      const rows = buildConsultantTrendRows(context);
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : rows,
        data: body.format === 'structured'
          ? {
            summary: {
              consultants: rows.length,
              totalSessions: sessions.length,
            },
            consultantTrends: rows,
            ...(riskHighlights.length > 0 ? { riskHighlights } : {}),
            ...(benchmarkData ? { benchmarks: benchmarkData } : {}),
            ...(narrativeData ? { narrative: narrativeData } : {}),
            ...(digestData ? { weeklyDigest: digestData } : {}),
          }
          : undefined,
      });
    } else if (body.exportType === 'manager_coaching') {
      const report = buildManagerCoachingReport(context);
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        data: benchmarkData ? { ...report, benchmarks: benchmarkData, ...(riskHighlights.length > 0 ? { riskHighlights } : {}), ...(narrativeData ? { narrative: narrativeData } : {}), ...(digestData ? { weeklyDigest: digestData } : {}) } : ({ ...report, ...(riskHighlights.length > 0 ? { riskHighlights } : {}), ...(narrativeData ? { narrative: narrativeData } : {}), ...(digestData ? { weeklyDigest: digestData } : {}) }),
        rows: body.format === 'csv' ? [{ ...report, narrative: narrativeData?.narrative || '', weeklyDigestHeadline: digestData?.headlineSummary || '' }] : undefined,
      });
    } else if (body.exportType === 'autoforge_triggers') {
      const rows = buildAutoforgeTriggerRows(context);
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : rows,
        data: body.format === 'structured'
          ? {
            timeRange: `${filters.dateFrom || 'all'} to ${filters.dateTo || 'today'}`,
            triggers: rows,
            ...(riskHighlights.length > 0 ? { riskHighlights } : {}),
            ...(benchmarkData ? { benchmarks: benchmarkData } : {}),
            ...(narrativeData ? { narrative: narrativeData } : {}),
            ...(digestData ? { weeklyDigest: digestData } : {}),
          }
          : undefined,
      });
    } else if (body.exportType === 'benchmarks') {
      const result = runFreshUpBenchmark({
        request: {
          benchmarkType: body.benchmarkRequest?.benchmarkType || 'dealer_vs_platform',
          metricName: body.benchmarkRequest?.metricName || 'all',
          entityId: body.benchmarkRequest?.entityId || '',
          comparisonEntityId: body.benchmarkRequest?.comparisonEntityId,
          segmentKey: body.benchmarkRequest?.segmentKey,
          segmentValue: body.benchmarkRequest?.segmentValue,
          filters,
        },
        context: {
          sessions,
          filters,
          dealerNameById,
          userNameById,
        },
      });
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : result.rows.map((row) => ({ ...row, narrative: narrativeData?.narrative || '' })),
        data: body.format === 'structured'
          ? {
            ...(result as unknown as Record<string, unknown>),
            ...(riskHighlights.length > 0 ? { riskHighlights } : {}),
            ...(narrativeData ? { narrative: narrativeData } : {}),
            ...(digestData ? { weeklyDigest: digestData } : {}),
          }
          : undefined,
      });
    } else if (body.exportType === 'weekly_digest') {
      const digest = digestData || generateWeeklyDigest({
        request: {
          digestType: body.digestRequest?.digestType || 'platform_weekly',
          lengthMode: body.digestRequest?.lengthMode || 'standard',
          entityId: body.digestRequest?.entityId,
          comparisonEntityId: body.digestRequest?.comparisonEntityId,
          filters,
        },
        context: {
          sessions,
          filters,
          dealerNameById,
          userNameById,
        },
      });
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : digest.keyInsights.map((line, idx) => ({
          index: idx + 1,
          weekRange: digest.weekRange,
          headlineSummary: digest.headlineSummary,
          keyInsight: line,
          recommendedAction: digest.recommendedAction,
        })),
        data: body.format === 'structured'
          ? { ...(digest as unknown as Record<string, unknown>), ...(riskHighlights.length > 0 ? { riskHighlights } : {}) }
          : undefined,
      });
    } else if (body.exportType === 'risk_radar') {
      const riskFilters: FreshUpRiskRadarFilterInput = {
        environment: filters.includeSandboxData === true ? 'sandbox' : 'production',
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        dealerId: filters.dealerId,
        consultantId: filters.userId,
      };
      let riskQuery = adminDb.collection('freshUpRiskRadar')
        .where('environment', '==', riskFilters.environment || 'production')
        .where('createdAt', '>=', riskFilters.dateFrom
          ? new Date(`${riskFilters.dateFrom}T00:00:00`)
          : new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)));
      const riskSnap = await riskQuery.get();
      const riskRows = riskSnap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          riskId: String(data.riskId || docSnap.id),
          riskType: String(data.riskType || ''),
          entityType: String(data.entityType || ''),
          entityId: String(data.entityId || ''),
          entityName: String(data.entityName || ''),
          riskLevel: String(data.riskLevel || 'low'),
          confidenceLevel: String(data.confidenceLevel || 'low'),
          message: String(data.message || ''),
          recommendedAction: String(data.recommendedAction || ''),
          isActive: data.isActive !== false,
          createdAt: data.createdAt && typeof (data.createdAt as { toDate?: unknown }).toDate === 'function'
            ? ((data.createdAt as { toDate: () => Date }).toDate().toISOString())
            : '',
          environment: String(data.environment || 'production'),
          supportingMetrics: JSON.stringify((data.supportingMetrics as Record<string, unknown> | undefined) || {}),
        };
      }).filter((row) => riskFilters.dealerId ? row.entityId === riskFilters.dealerId || row.entityType === 'dealer' : true)
        .filter((row) => riskFilters.consultantId ? row.entityId === riskFilters.consultantId || row.entityType === 'consultant' : true);
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : riskRows,
        data: body.format === 'structured' ? {
          summary: {
            risks: riskRows.length,
            activeRisks: riskRows.filter((row) => row.isActive).length,
            criticalRisks: riskRows.filter((row) => row.riskLevel === 'critical').length,
          },
          risks: riskRows,
        } : undefined,
      });
    } else if (body.exportType === 'command_center') {
      const commandCenter = await buildFreshUpCommandCenter({
        db: adminDb,
        request: {
          entityMode: (body.digestRequest?.digestType === 'dealer_weekly'
            ? 'dealer'
            : body.digestRequest?.digestType === 'consultant_weekly'
              ? 'consultant'
              : body.digestRequest?.digestType === 'version_monitoring_weekly'
                ? 'version'
                : 'platform'),
          entityId: body.digestRequest?.entityId || filters.dealerId || filters.userId || filters.freshUpVersionId || undefined,
          comparisonEntityId: body.digestRequest?.comparisonEntityId || body.benchmarkRequest?.comparisonEntityId,
          filters,
        },
      });
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        rows: body.format === 'structured' ? undefined : [
          {
            entityMode: commandCenter.entityMode,
            entityName: commandCenter.entityName,
            generatedAt: commandCenter.generatedAt,
            weeklyHeadline: commandCenter.weeklyDigestSummary.headline,
            coachingPriority: commandCenter.coachingPrioritySummary,
            autoForgeModule: commandCenter.autoForgeRecommendationSummary.module,
            activeRisks: commandCenter.activeRiskRadarSummary.totalActiveRisks,
            activeAlerts: commandCenter.activeAlertsSummary.totalActiveAlerts,
            activeGoals: commandCenter.goalsAndTargetsSummary.activeGoals,
          },
        ],
        data: body.format === 'structured'
          ? {
            ...commandCenter,
            ...(riskHighlights.length > 0 ? { riskHighlights } : {}),
          }
          : undefined,
      });
    } else {
      const report = buildMarketingInsightReport(context);
      bundle = buildExportBundle({
        exportType: body.exportType,
        format: body.format,
        data: benchmarkData ? { ...report, benchmarks: benchmarkData, ...(riskHighlights.length > 0 ? { riskHighlights } : {}), ...(narrativeData ? { narrative: narrativeData } : {}), ...(digestData ? { weeklyDigest: digestData } : {}) } : ({ ...report, ...(riskHighlights.length > 0 ? { riskHighlights } : {}), ...(narrativeData ? { narrative: narrativeData } : {}), ...(digestData ? { weeklyDigest: digestData } : {}) }),
        rows: body.format === 'csv' ? [{ ...report, narrative: narrativeData?.narrative || '', weeklyDigestHeadline: digestData?.headlineSummary || '' }] : undefined,
      });
    }

    return NextResponse.json({
      ...bundle,
      generatedAt: new Date().toISOString(),
      filtersApplied: filters,
      sandboxIncluded: filters.includeSandboxData === true,
      versionCoverage: Array.from(new Set(sessions.map((row) => row.freshUpVersionName || row.freshUpVersionId).filter(Boolean))),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Fresh Up export.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
