'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@/lib/definitions';
import { autoForgeLesson, type AutoForgeLessonInput } from '@/ai/flows/autoforge-lesson-flow';
import { personalAutoForgeLesson, type PersonalAutoForgeLessonInput } from '@/ai/flows/personal-autoforge-lesson-flow';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Download, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type AutoForgeMode = 'manager' | 'personal';

export type AutoForgeContext = {
  department?: string | null;
  dealershipName?: string | null;
  dealershipScopeLabel?: string | null;
  departmentPerformanceSummary?: string | null;
  memberSignals?: string[];
  personalPerformanceSummary?: string | null;
  personalSignals?: string[];
};

type AutoForgeDialogProps = {
  user: User;
  autoForgeContext: AutoForgeContext;
  mode?: AutoForgeMode;
};

type AutoForgeHistoryItem = {
  id: string;
  createdAt: string;
  department: string;
  dealershipName: string;
  report: string;
  theme: string;
};

const REPORT_TITLE_PATTERN = /^\*\*Primary Theme:\*\*\s*(.+)$/m;
const HISTORY_STORAGE_KEY = 'autoforge:history';
const PERSONAL_HISTORY_STORAGE_KEY_PREFIX = 'autoforge:personal:history';
const MAX_HISTORY_ITEMS = 20;

function extractPrimaryTheme(report: string): string {
  return REPORT_TITLE_PATTERN.exec(report)?.[1]?.trim() || 'Consistency';
}

function makeHistoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `autoforge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function getReportFilename(report: string, dealershipName: string): string {
  const theme = extractPrimaryTheme(report);
  const segments = ['autoforge', dealershipName, theme, new Date().toISOString().slice(0, 10)]
    .map((part) => safeFilename(part || 'report'))
    .filter(Boolean);
  return `${segments.join('-') || 'autoforge-report'}.pdf`;
}

function getPersonalReportFilename(report: string, userName: string): string {
  const theme = extractPrimaryTheme(report);
  const segments = ['personal-autoforge', userName, theme, new Date().toISOString().slice(0, 10)]
    .map((part) => safeFilename(part || 'report'))
    .filter(Boolean);
  return `${segments.join('-') || 'personal-autoforge-report'}.pdf`;
}

async function downloadReportPdf(input: {
  report: string;
  dealershipName: string;
  department: string;
}, options?: {
  personal?: boolean;
}) {
  const response = await fetch('/api/autoforge/export-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await response.arrayBuffer();
  if (!response.ok) {
    const message = new TextDecoder().decode(payload) || 'Could not export AutoForge PDF.';
    throw new Error(message);
  }

  const blob = new Blob([payload], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options?.personal
    ? getPersonalReportFilename(input.report, input.dealershipName)
    : getReportFilename(input.report, input.dealershipName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AutoForgeDialog({ user, autoForgeContext, mode = 'manager' }: AutoForgeDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [report, setReport] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [history, setHistory] = useState<AutoForgeHistoryItem[]>([]);

  const isPersonalMode = mode === 'personal';
  const department = isPersonalMode ? 'Personal Development' : (autoForgeContext.department || 'Storewide');
  const dealershipName = isPersonalMode ? user.name : (autoForgeContext.dealershipName || 'Current dealership');
  const dealershipScopeLabel = isPersonalMode ? 'Personal scope' : (autoForgeContext.dealershipScopeLabel || 'Current scope');
  const memberSignals = isPersonalMode ? (autoForgeContext.personalSignals || []) : (autoForgeContext.memberSignals || []);
  const storageKey = isPersonalMode
    ? `${PERSONAL_HISTORY_STORAGE_KEY_PREFIX}:${user.userId}`
    : HISTORY_STORAGE_KEY;
  const dialogTitle = isPersonalMode ? 'Personal AutoForge Weekly CX Forge' : 'AutoForge Weekly CX Forge';
  const dialogDescription = isPersonalMode
    ? `Generated from your personal performance data for ${user.name}.`
    : `Generated from ${department} performance data for ${dealershipName}.`;
  const historyDescription = isPersonalMode
    ? `Reopen or redownload prior Personal AutoForge meetings for ${user.name}.`
    : `Reopen or redownload prior AutoForge meetings for ${dealershipName}.`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setHistory(parsed.filter((item): item is AutoForgeHistoryItem => {
        return !!item
          && typeof item === 'object'
          && typeof (item as AutoForgeHistoryItem).id === 'string'
          && typeof (item as AutoForgeHistoryItem).createdAt === 'string'
          && typeof (item as AutoForgeHistoryItem).report === 'string';
      }));
    } catch {
      setHistory([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
  }, [history, storageKey]);

  const managerPromptInput = useMemo<AutoForgeLessonInput>(() => ({
    mode: 'manager',
    department,
    managerRole: user.role,
    dealershipName,
    dealershipScopeLabel,
    departmentPerformanceSummary: autoForgeContext.departmentPerformanceSummary || '',
    memberSignals,
    selectedRolePreference: autoForgeContext.department || undefined,
  }), [autoForgeContext.department, autoForgeContext.departmentPerformanceSummary, dealershipName, dealershipScopeLabel, department, memberSignals, user.role]);

  const personalPromptInput = useMemo<PersonalAutoForgeLessonInput>(() => ({
    mode: 'personal',
    userName: user.name,
    userRole: user.role,
    personalPerformanceSummary: autoForgeContext.personalPerformanceSummary || '',
    personalSignals: autoForgeContext.personalSignals || [],
  }), [autoForgeContext.personalPerformanceSummary, autoForgeContext.personalSignals, user.name, user.role]);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const nextReport = isPersonalMode
        ? await personalAutoForgeLesson(personalPromptInput)
        : await autoForgeLesson(managerPromptInput);
      setReport(nextReport);
      setHistory((current) => {
        const nextItem: AutoForgeHistoryItem = {
          id: makeHistoryId(),
          createdAt: new Date().toISOString(),
          department,
          dealershipName,
          report: nextReport,
          theme: extractPrimaryTheme(nextReport),
        };
        const deduped = [nextItem, ...current.filter((item) => item.report !== nextReport)];
        return deduped.slice(0, MAX_HISTORY_ITEMS);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate AutoForge content.';
      setGenerationError(message);
      setReport('');
      toast({
        title: 'AutoForge failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [dealershipName, department, isPersonalMode, managerPromptInput, personalPromptInput, toast]);

  const handleExportPdf = useCallback(async () => {
    if (!report) {
      toast({
        title: 'Nothing to export',
        description: 'Generate the AutoForge report first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await downloadReportPdf({ report, dealershipName, department }, { personal: isPersonalMode });

      toast({
        title: 'PDF exported',
        description: 'Your AutoForge meeting pack has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export AutoForge as PDF.',
        variant: 'destructive',
      });
    }
  }, [dealershipName, department, report, toast]);

  const handleDownloadHistoryItem = useCallback(async (item: AutoForgeHistoryItem) => {
    try {
      await downloadReportPdf({
        report: item.report,
        dealershipName: item.dealershipName,
        department: item.department,
      }, { personal: isPersonalMode });
      toast({
        title: 'PDF exported',
        description: 'Previous AutoForge output has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to export AutoForge as PDF.',
        variant: 'destructive',
      });
    }
  }, [isPersonalMode, toast]);

  const triggerContent = isPersonalMode ? (
    <Button
      type="button"
      aria-label="Open Personal AutoForge"
      className="relative flex h-16 w-full items-center justify-center overflow-hidden border border-[#7CC242]/25 bg-[#7CC242] px-4 font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(124,194,66,0.35)] hover:bg-[#8ED24F] hover:text-slate-950"
    >
      <span className="text-sm font-semibold tracking-wide">Activate Forge</span>
    </Button>
  ) : (
    <Button
      type="button"
      aria-label="Open AutoForge"
      className="relative flex h-16 w-full items-center justify-center overflow-hidden border border-[#7CC242]/25 bg-[#7CC242] px-4 font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(124,194,66,0.35)] hover:bg-[#8ED24F] hover:text-slate-950"
    >
      <span className="text-sm font-semibold tracking-wide">Activate Forge</span>
    </Button>
  );

  useEffect(() => {
    if (!open) return;
    if (report || isGenerating) return;
    void generateReport();
    // Intentionally generate on open so the window feels like a dedicated tool.
  }, [generateReport, isGenerating, open, report]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerContent}
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {isGenerating ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Spinner size="sm" />
                {isPersonalMode ? 'Creating your personal AutoForge...' : 'Building the weekly AutoForge meeting...'}
              </div>
            </div>
          ) : generationError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {generationError}
            </div>
          ) : (
            <div className="min-h-0 flex-1 rounded-lg border border-border bg-background/60">
              <ScrollArea className="h-[60vh]">
                <pre className="whitespace-pre-wrap break-words p-4 text-sm leading-6 text-foreground">
                  {report || 'Open AutoForge to generate the weekly CX Forge.'}
                </pre>
              </ScrollArea>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={generateReport} disabled={isGenerating}>
                Regenerate
              </Button>
              <Button type="button" variant="outline" onClick={handleExportPdf} disabled={!report || isGenerating}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowHistory(true)}>
                <History className="mr-2 h-4 w-4" />
                Previous Forges
              </Button>
            </div>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Previous Forges</DialogTitle>
            <DialogDescription>{historyDescription}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3 pr-4">
                {history.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No previous AutoForge reports yet.
                  </div>
                ) : history.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{item.theme}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.department} | {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadHistoryItem(item)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                    </div>
                    <div className="mt-3 max-h-40 overflow-hidden rounded-md border border-border bg-muted/10 p-3">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                        {item.report}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setShowHistory(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
