'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type SprocketSession = {
  sessionId: string;
  role_guess?: string;
  lead_status?: string;
  user_email?: string;
  started_at?: unknown;
  last_activity?: unknown;
};

type SprocketMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: unknown;
};

type SprocketLead = {
  id: string;
  email?: string;
  name?: string;
  dealership?: string;
  intent?: string;
  created_at?: unknown;
  source?: string;
};

type FirestoreTimestampLike = {
  toDate: () => Date;
};

function hasToDate(value: unknown): value is FirestoreTimestampLike {
  return typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function';
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (hasToDate(value)) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDateTime(value: unknown): string {
  const parsed = asDate(value);
  return parsed ? parsed.toLocaleString() : '-';
}

function readMessageRole(data: Record<string, unknown>): 'user' | 'assistant' | null {
  const raw = String(data.role || data.sender || data.author || '').trim().toLowerCase();
  if (raw === 'user') return 'user';
  if (raw === 'assistant' || raw === 'bot' || raw === 'ai') return 'assistant';
  return null;
}

function readMessageContent(data: Record<string, unknown>): string {
  const raw = data.content ?? data.message ?? data.text ?? data.body;
  return typeof raw === 'string' ? raw.trim() : '';
}

export function SprocketActivityPanel() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<SprocketSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SprocketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [leads, setLeads] = useState<SprocketLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);

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
        const nextSessions = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            sessionId: String(data.sessionId || docSnap.id),
            role_guess: typeof data.role_guess === 'string' ? data.role_guess : undefined,
            lead_status: typeof data.lead_status === 'string' ? data.lead_status : undefined,
            user_email: typeof data.user_email === 'string' ? data.user_email : undefined,
            started_at: data.started_at,
            last_activity: data.last_activity,
          };
        });
        setSessions(nextSessions);
        setSessionsLoading(false);
        setSelectedSessionId((current) => current || nextSessions[0]?.sessionId || null);
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
        const nextMessages = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const role = readMessageRole(data);
            const content = readMessageContent(data);
            if (!role || !content) return null;
            return {
              id: docSnap.id,
              role,
              content,
              timestamp: data.timestamp,
            } as SprocketMessage;
          })
          .filter((item): item is SprocketMessage => item !== null)
          .sort((a, b) => {
            const aTime = asDate(a.timestamp)?.getTime() || 0;
            const bTime = asDate(b.timestamp)?.getTime() || 0;
            return aTime - bTime;
          });

        setMessages(nextMessages);
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
        const nextLeads = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          return {
            id: docSnap.id,
            email: typeof data.email === 'string' ? data.email : undefined,
            name: typeof data.name === 'string' ? data.name : undefined,
            dealership: typeof data.dealership === 'string' ? data.dealership : undefined,
            intent: typeof data.intent === 'string' ? data.intent : undefined,
            created_at: data.created_at,
            source: typeof data.source === 'string' ? data.source : undefined,
          };
        });
        setLeads(nextLeads);
        setLeadsLoading(false);
      },
      (error) => {
        setLeadsError(error.message || 'Unable to load leads.');
        setLeadsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [firestore]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const triggerPlaceholderAction = (actionLabel: string) => {
    toast({
      title: 'Action queued',
      description: `${actionLabel} placeholder triggered${selectedSessionId ? ` for session ${selectedSessionId}` : ''}.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
          <CardDescription>Latest 50 `sprocket_sessions` by last activity.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsError && <p className="mb-3 text-sm text-destructive">{sessionsError}</p>}
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>sessionId</TableHead>
                  <TableHead>role_guess</TableHead>
                  <TableHead>lead_status</TableHead>
                  <TableHead>user_email</TableHead>
                  <TableHead>started_at</TableHead>
                  <TableHead>last_activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.sessionId}
                    onClick={() => setSelectedSessionId(session.sessionId)}
                    className="cursor-pointer"
                    data-state={session.sessionId === selectedSessionId ? 'selected' : undefined}
                  >
                    <TableCell className="font-medium">{session.sessionId}</TableCell>
                    <TableCell>{session.role_guess || '-'}</TableCell>
                    <TableCell>{session.lead_status || '-'}</TableCell>
                    <TableCell>{session.user_email || '-'}</TableCell>
                    <TableCell>{formatDateTime(session.started_at)}</TableCell>
                    <TableCell>{formatDateTime(session.last_activity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript Viewer</CardTitle>
          <CardDescription>
            {selectedSession
              ? `Session: ${selectedSession.sessionId}`
              : 'Select a conversation above to load sprocket_sessions/{sessionId}/messages.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messagesError && <p className="mb-3 text-sm text-destructive">{messagesError}</p>}
          {!selectedSessionId ? (
            <p className="text-sm text-muted-foreground">No session selected.</p>
          ) : messagesLoading ? (
            <p className="text-sm text-muted-foreground">Loading transcript...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript messages found.</p>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border bg-muted/30 text-foreground'
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-wide opacity-70">{message.role}</p>
                    <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                    <p className="mt-1 text-[11px] opacity-70">{formatDateTime(message.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads Captured</CardTitle>
          <CardDescription>Latest 50 docs from `sprocket_leads`.</CardDescription>
        </CardHeader>
        <CardContent>
          {leadsError && <p className="mb-3 text-sm text-destructive">{leadsError}</p>}
          {leadsLoading ? (
            <p className="text-sm text-muted-foreground">Loading leads...</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>email</TableHead>
                  <TableHead>name</TableHead>
                  <TableHead>dealership</TableHead>
                  <TableHead>intent</TableHead>
                  <TableHead>created_at</TableHead>
                  <TableHead>source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.email || '-'}</TableCell>
                    <TableCell>{lead.name || '-'}</TableCell>
                    <TableCell>{lead.dealership || '-'}</TableCell>
                    <TableCell>{lead.intent || '-'}</TableCell>
                    <TableCell>{formatDateTime(lead.created_at)}</TableCell>
                    <TableCell>{lead.source || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Developer placeholders wired for future integrations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => triggerPlaceholderAction('Send follow-up email')}>
            Send follow-up email
          </Button>
          <Button variant="outline" onClick={() => triggerPlaceholderAction('Convert to pipeline lead')}>
            Convert to pipeline lead
          </Button>
          <Button variant="outline" onClick={() => triggerPlaceholderAction('Assign to consultant')}>
            Assign to consultant
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
