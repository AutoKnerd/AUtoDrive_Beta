'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { SprocketLeadTable, type SprocketLeadRow } from '@/components/sprocket/SprocketLeadTable';
import { SprocketSessionList, type SprocketSessionRow } from '@/components/sprocket/SprocketSessionList';
import { SprocketTranscriptViewer, type SprocketTranscriptMessage } from '@/components/sprocket/SprocketTranscriptViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { calculateSprocketLeadScore, getLeadTemperature } from '@/lib/sprocket/lead-scoring';
import { convertSprocketLeadToPipeline } from '@/lib/sprocket/pipeline';

type RawLead = {
  id: string;
  email?: string;
  name?: string;
  dealership?: string;
  intent?: string;
  source?: string;
  created_at?: unknown;
  score?: number;
};

type TimestampLike = { toDate: () => Date };

function hasToDate(value: unknown): value is TimestampLike {
  return typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function';
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (hasToDate(value)) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDateTime(value: unknown): string {
  const parsed = toDate(value);
  return parsed ? parsed.toLocaleString() : '-';
}

function normalizeMessageRole(value: unknown): 'user' | 'assistant' | null {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'user') return 'user';
  if (role === 'assistant' || role === 'bot' || role === 'ai') return 'assistant';
  return null;
}

export default function AdminSprocketPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, loading } = useAuth();

  const [sessions, setSessions] = useState<SprocketSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<SprocketTranscriptMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [rawLeads, setRawLeads] = useState<RawLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [busyLeadIds, setBusyLeadIds] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user && user.role !== 'Admin' && user.role !== 'Developer') {
      router.push('/');
    }
  }, [loading, user, router]);

  useEffect(() => {
    const sessionsQuery = query(
      collection(firestore, 'sprocket_sessions'),
      orderBy('last_activity', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        setSessionsError(null);
        const rows = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            sessionId: String(data.sessionId || docSnap.id),
            role_guess: typeof data.role_guess === 'string' ? data.role_guess : undefined,
            lead_status: typeof data.lead_status === 'string' ? data.lead_status : undefined,
            user_email: typeof data.user_email === 'string' ? data.user_email : undefined,
            dealership_name: typeof data.dealership_name === 'string' ? data.dealership_name : undefined,
            started_at: data.started_at,
            last_activity: data.last_activity,
          } as SprocketSessionRow;
        });
        setSessions(rows);
        setSessionsLoading(false);
        setSelectedSessionId((current) => current || rows[0]?.id || null);
      },
      (error) => {
        setSessionsError(error.message || 'Unable to load sessions.');
        setSessionsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [firestore]);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);

    const messagesQuery = query(
      collection(firestore, 'sprocket_sessions', selectedSessionId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const role = normalizeMessageRole(data.role);
            if (!role) return null;

            const messageValue = data.message ?? data.content;
            const message = typeof messageValue === 'string' ? messageValue.trim() : '';
            if (!message) return null;

            return {
              id: docSnap.id,
              role,
              message,
              timestamp: data.timestamp,
            } as SprocketTranscriptMessage;
          })
          .filter((item): item is SprocketTranscriptMessage => item !== null)
          .sort((a, b) => (toDate(a.timestamp)?.getTime() || 0) - (toDate(b.timestamp)?.getTime() || 0));

        setMessages(rows);
        setMessagesLoading(false);
      },
      (error) => {
        setMessagesError(error.message || 'Unable to load transcript.');
        setMessagesLoading(false);
      },
    );

    return () => unsubscribe();
  }, [firestore, selectedSessionId]);

  useEffect(() => {
    const leadsQuery = query(
      collection(firestore, 'sprocket_leads'),
      orderBy('created_at', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        setLeadsError(null);
        const rows = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const score = typeof data.score === 'number' ? data.score : undefined;

          return {
            id: docSnap.id,
            email: typeof data.email === 'string' ? data.email : undefined,
            name: typeof data.name === 'string' ? data.name : undefined,
            dealership: typeof data.dealership === 'string' ? data.dealership : undefined,
            intent: typeof data.intent === 'string' ? data.intent : undefined,
            source: typeof data.source === 'string' ? data.source : undefined,
            created_at: data.created_at,
            score,
          } as RawLead;
        });

        setRawLeads(rows);
        setLeadsLoading(false);
      },
      (error) => {
        setLeadsError(error.message || 'Unable to load leads.');
        setLeadsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [firestore]);

  useEffect(() => {
    if (!rawLeads.length) return;

    const updates = rawLeads
      .map((lead) => {
        const computed = calculateSprocketLeadScore({
          intent: lead.intent,
          email: lead.email,
          dealership: lead.dealership,
        });

        if (lead.score === computed) return null;
        return updateDoc(doc(firestore, 'sprocket_leads', lead.id), { score: computed });
      })
      .filter((promise): promise is Promise<void> => promise !== null);

    if (!updates.length) return;
    void Promise.allSettled(updates);
  }, [firestore, rawLeads]);

  const leads = useMemo<SprocketLeadRow[]>(
    () =>
      rawLeads.map((lead) => {
        const computed = calculateSprocketLeadScore({
          intent: lead.intent,
          email: lead.email,
          dealership: lead.dealership,
        });
        return {
          id: lead.id,
          email: lead.email,
          name: lead.name,
          dealership: lead.dealership,
          intent: lead.intent,
          source: lead.source,
          created_at: lead.created_at,
          score: typeof lead.score === 'number' ? lead.score : computed,
          temperature: getLeadTemperature(typeof lead.score === 'number' ? lead.score : computed),
        };
      }),
    [rawLeads],
  );

  const leadTemperatureCounts = useMemo(() => {
    return leads.reduce(
      (acc, lead) => {
        if (lead.temperature === 'HOT') acc.hot += 1;
        else if (lead.temperature === 'WARM') acc.warm += 1;
        else acc.cold += 1;
        return acc;
      },
      { hot: 0, warm: 0, cold: 0 },
    );
  }, [leads]);

  const selectedSessionLabel = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId)?.sessionId || selectedSessionId,
    [sessions, selectedSessionId],
  );

  const setLeadBusy = useCallback((leadId: string, busy: boolean) => {
    setBusyLeadIds((current) => (busy ? Array.from(new Set([...current, leadId])) : current.filter((id) => id !== leadId)));
  }, []);

  const handleConvertToPipeline = useCallback(async (lead: SprocketLeadRow) => {
    try {
      setLeadBusy(lead.id, true);
      const pipelineId = await convertSprocketLeadToPipeline(firestore, lead);
      toast({
        title: 'Converted to pipeline',
        description: `Created dealer_pipeline/${pipelineId} from sprocket lead.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Conversion failed',
        description: error instanceof Error ? error.message : 'Unable to convert lead to pipeline.',
      });
    } finally {
      setLeadBusy(lead.id, false);
    }
  }, [firestore, setLeadBusy, toast]);

  const handleSendFollowUpEmail = useCallback((lead: SprocketLeadRow) => {
    toast({
      title: 'Follow-up placeholder',
      description: `Send Follow-Up Email clicked for ${lead.email || lead.id}.`,
    });
  }, [toast]);

  const handleMarkQualified = useCallback((lead: SprocketLeadRow) => {
    toast({
      title: 'Qualified placeholder',
      description: `Mark Qualified clicked for ${lead.email || lead.id}.`,
    });
  }, [toast]);

  if (loading || !user || (user.role !== 'Admin' && user.role !== 'Developer')) {
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
        <section className="rounded-lg border border-cyan-400/30 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
          <h1 className="text-2xl font-semibold text-cyan-200">Sprocket Chat Monitor</h1>
          <p className="mt-1 text-sm text-slate-300">
            Monitor live chatbot conversations, transcripts, captured leads, and intent scoring.
          </p>
        </section>

        <SprocketSessionList
          sessions={sessions}
          isLoading={sessionsLoading}
          error={sessionsError}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          formatDateTime={formatDateTime}
        />

        <SprocketTranscriptViewer
          sessionId={selectedSessionLabel}
          messages={messages}
          isLoading={messagesLoading}
          error={messagesError}
          formatDateTime={formatDateTime}
        />

        <SprocketLeadTable
          leads={leads}
          isLoading={leadsLoading}
          error={leadsError}
          busyLeadIds={busyLeadIds}
          onConvertToPipeline={handleConvertToPipeline}
          onSendFollowUpEmail={handleSendFollowUpEmail}
          onMarkQualified={handleMarkQualified}
          formatDateTime={formatDateTime}
        />

        <Card>
          <CardHeader>
            <CardTitle>Lead Scoring</CardTitle>
            <CardDescription>Scores are auto-calculated and stored back to `sprocket_leads.score`.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>+3 asked about installation, +3 asked about pricing, +5 requested demo, +5 email captured, +2 dealership mentioned.</p>
            <div className="flex flex-wrap gap-3">
              <span className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">HOT: {leadTemperatureCounts.hot}</span>
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">WARM: {leadTemperatureCounts.warm}</span>
              <span className="rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-slate-700 dark:text-slate-300">COLD: {leadTemperatureCounts.cold}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
