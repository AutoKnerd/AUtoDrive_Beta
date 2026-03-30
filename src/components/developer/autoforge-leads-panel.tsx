'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type AutoForgeLead = {
  id: string;
  name?: string;
  email?: string;
  dealership_name?: string;
  role?: string;
  source?: string;
  status?: string;
  created_at?: unknown;
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

export function AutoForgeLeadsPanel() {
  const firestore = useFirestore();
  const [leads, setLeads] = useState<AutoForgeLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const leadsQuery = query(
      collection(firestore, 'autoforge_leads'),
      orderBy('created_at', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        setError(null);
        setLeads(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            return {
              id: docSnap.id,
              name: typeof data.name === 'string' ? data.name : undefined,
              email: typeof data.email === 'string' ? data.email : undefined,
              dealership_name: typeof data.dealership_name === 'string' ? data.dealership_name : undefined,
              role: typeof data.role === 'string' ? data.role : undefined,
              source: typeof data.source === 'string' ? data.source : undefined,
              status: typeof data.status === 'string' ? data.status : undefined,
              created_at: data.created_at,
            };
          }),
        );
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message || 'Unable to load AutoForge leads.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [firestore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AutoForge Leads</CardTitle>
        <CardDescription>Latest 50 docs from `autoforge_leads`.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading AutoForge leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No AutoForge leads captured yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Dealership</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>{lead.name || '-'}</TableCell>
                  <TableCell className="font-medium">{lead.email || '-'}</TableCell>
                  <TableCell>{lead.dealership_name || '-'}</TableCell>
                  <TableCell>{lead.role || '-'}</TableCell>
                  <TableCell>{lead.status || '-'}</TableCell>
                  <TableCell>{formatDateTime(lead.created_at)}</TableCell>
                  <TableCell>{lead.source || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
