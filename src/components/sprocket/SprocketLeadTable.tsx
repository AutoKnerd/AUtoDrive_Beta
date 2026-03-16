'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { LeadTemperature } from '@/lib/sprocket/lead-scoring';

export type SprocketLeadRow = {
  id: string;
  email?: string;
  name?: string;
  dealership?: string;
  intent?: string;
  score: number;
  source?: string;
  created_at?: unknown;
  temperature: LeadTemperature;
};

type SprocketLeadTableProps = {
  leads: SprocketLeadRow[];
  isLoading: boolean;
  error?: string | null;
  busyLeadIds?: string[];
  onConvertToPipeline: (lead: SprocketLeadRow) => void | Promise<void>;
  onSendFollowUpEmail: (lead: SprocketLeadRow) => void | Promise<void>;
  onMarkQualified: (lead: SprocketLeadRow) => void | Promise<void>;
  formatDateTime: (value: unknown) => string;
};

function badgeClass(temperature: LeadTemperature): string {
  if (temperature === 'HOT') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300';
  if (temperature === 'WARM') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300';
}

export function SprocketLeadTable({
  leads,
  isLoading,
  error,
  busyLeadIds = [],
  onConvertToPipeline,
  onSendFollowUpEmail,
  onMarkQualified,
  formatDateTime,
}: SprocketLeadTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads Captured</CardTitle>
        <CardDescription>Latest 50 records from `sprocket_leads` with lead scoring.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Dealership</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const isBusy = busyLeadIds.includes(lead.id);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.email || '-'}</TableCell>
                    <TableCell>{lead.name || '-'}</TableCell>
                    <TableCell>{lead.dealership || '-'}</TableCell>
                    <TableCell>{lead.intent || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{lead.score}</span>
                        <Badge variant="outline" className={cn(badgeClass(lead.temperature))}>
                          {lead.temperature}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{lead.source || '-'}</TableCell>
                    <TableCell>{formatDateTime(lead.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => onConvertToPipeline(lead)} disabled={isBusy}>
                          Convert to Pipeline
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onSendFollowUpEmail(lead)} disabled={isBusy}>
                          Send Follow-Up Email
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onMarkQualified(lead)} disabled={isBusy}>
                          Mark Qualified
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

