'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type SprocketTranscriptMessage = {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  timestamp?: unknown;
};

type SprocketTranscriptViewerProps = {
  sessionId?: string | null;
  messages: SprocketTranscriptMessage[];
  isLoading: boolean;
  error?: string | null;
  formatDateTime: (value: unknown) => string;
};

export function SprocketTranscriptViewer({
  sessionId,
  messages,
  isLoading,
  error,
  formatDateTime,
}: SprocketTranscriptViewerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript Viewer</CardTitle>
        <CardDescription>
          {sessionId ? `Live transcript for ${sessionId}` : 'Select a conversation to view messages.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {!sessionId ? (
          <p className="text-sm text-muted-foreground">No session selected.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading transcript...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages in this transcript yet.</p>
        ) : (
          <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {messages.map((entry) => (
              <div key={entry.id} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${
                    entry.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-muted/30 text-foreground'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wide opacity-70">{entry.role}</p>
                  <p className="mt-1 whitespace-pre-wrap">{entry.message}</p>
                  <p className="mt-1 text-[11px] opacity-70">{formatDateTime(entry.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

