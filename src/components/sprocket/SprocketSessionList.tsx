'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type SprocketSessionRow = {
  id: string;
  sessionId: string;
  role_guess?: string;
  lead_status?: string;
  user_email?: string;
  dealership_name?: string;
  started_at?: unknown;
  last_activity?: unknown;
};

type SprocketSessionListProps = {
  sessions: SprocketSessionRow[];
  isLoading: boolean;
  error?: string | null;
  selectedSessionId?: string | null;
  onSelectSession: (sessionDocId: string) => void;
  formatDateTime: (value: unknown) => string;
};

export function SprocketSessionList({
  sessions,
  isLoading,
  error,
  selectedSessionId,
  onSelectSession,
  formatDateTime,
}: SprocketSessionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Conversations</CardTitle>
        <CardDescription>Real-time feed of the latest 50 `sprocket_sessions` by `last_activity`.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading conversations...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conversations found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Role Guess</TableHead>
                <TableHead>Lead Status</TableHead>
                <TableHead>User Email</TableHead>
                <TableHead>Dealership Name</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead>Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="cursor-pointer"
                  data-state={selectedSessionId === session.id ? 'selected' : undefined}
                >
                  <TableCell className="font-medium">{session.sessionId}</TableCell>
                  <TableCell>{session.role_guess || '-'}</TableCell>
                  <TableCell>{session.lead_status || '-'}</TableCell>
                  <TableCell>{session.user_email || '-'}</TableCell>
                  <TableCell>{session.dealership_name || '-'}</TableCell>
                  <TableCell>{formatDateTime(session.started_at)}</TableCell>
                  <TableCell>{formatDateTime(session.last_activity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
