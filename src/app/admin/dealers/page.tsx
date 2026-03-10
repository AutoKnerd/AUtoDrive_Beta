'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

type DealerRegistration = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant_id: string;
  stage: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const STAGE_FILTERS = ['all', 'lead', 'contacted', 'demo', 'trial', 'closed_won', 'closed_lost'] as const;

function stageLabel(stage: string): string {
  if (stage === 'closed_won') return 'Closed Won';
  if (stage === 'closed_lost') return 'Closed Lost';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export default function AdminDealersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();

  const [rows, setRows] = useState<DealerRegistration[]>([]);
  const [filterStage, setFilterStage] = useState<(typeof STAGE_FILTERS)[number]>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editDealerName, setEditDealerName] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editConsultantId, setEditConsultantId] = useState('');
  const [editStage, setEditStage] = useState<'lead' | 'contacted' | 'demo' | 'trial' | 'closed_won' | 'closed_lost'>('lead');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user && user.role !== 'Admin') {
      router.push('/');
    }
  }, [loading, user, router]);

  async function getAuthHeader() {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) {
      throw new Error('Authentication required. Please sign in again.');
    }

    const token = await fbUser.getIdToken(true);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async function loadRows() {
    if (!user || user.role !== 'Admin') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/admin/dealers', { headers });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load dealer pipeline.');
      }

      setRows(payload.pipeline || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load dealer pipeline.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, [user?.userId, user?.role]);

  const filteredRows = useMemo(() => {
    if (filterStage === 'all') {
      return rows;
    }
    return rows.filter((row) => row.stage === filterStage);
  }, [rows, filterStage]);

  const metrics = useMemo(() => {
    return {
      totalLeads: rows.length,
      demosScheduled: rows.filter((row) => row.stage === 'demo').length,
      trialsStarted: rows.filter((row) => row.stage === 'trial').length,
      convertedDealers: rows.filter((row) => row.stage === 'closed_won').length,
    };
  }, [rows]);

  function startEditing(row: DealerRegistration) {
    setEditingId(row.id);
    setEditDealerName(row.dealer_name);
    setEditContactName(row.contact_name);
    setEditContactEmail(row.contact_email);
    setEditContactPhone(row.contact_phone);
    setEditCity(row.city);
    setEditState(row.state);
    setEditConsultantId(row.consultant_id);
    setEditStage((['lead', 'contacted', 'demo', 'trial', 'closed_won', 'closed_lost'].find((stage) => stage === row.stage) || 'lead') as typeof editStage);
    setEditNotes(row.notes);
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDealerName('');
    setEditContactName('');
    setEditContactEmail('');
    setEditContactPhone('');
    setEditCity('');
    setEditState('');
    setEditConsultantId('');
    setEditStage('lead');
    setEditNotes('');
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setIsUpdating(true);
    setError(null);

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`/api/admin/dealers/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          dealer_name: editDealerName,
          contact_name: editContactName,
          contact_email: editContactEmail,
          contact_phone: editContactPhone,
          city: editCity,
          state: editState,
          consultant_id: editConsultantId,
          stage: editStage,
          notes: editNotes,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to update dealer registration.');
      }

      cancelEditing();
      await loadRows();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Failed to update dealer registration.';
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }

  if (loading || !user || user.role !== 'Admin') {
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
        <Card className="border-cyan-400/30 bg-slate-950/70 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
          <CardHeader>
            <CardTitle className="text-2xl text-cyan-200">Admin Dealer Pipeline</CardTitle>
            <CardDescription className="text-slate-300">Manage all consultant-submitted dealer leads.</CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-3xl">{metrics.totalLeads}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Demos Scheduled</CardDescription>
              <CardTitle className="text-3xl">{metrics.demosScheduled}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Trials Started</CardDescription>
              <CardTitle className="text-3xl">{metrics.trialsStarted}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Converted Dealers</CardDescription>
              <CardTitle className="text-3xl">{metrics.convertedDealers}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Dealer Leads</CardTitle>
            <CardDescription>Filter and manage the pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {STAGE_FILTERS.map((stage) => (
                <Button
                  key={stage}
                  variant={filterStage === stage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStage(stage)}
                >
                  {stageLabel(stage)}
                </Button>
              ))}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading dealer pipeline...</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dealer leads found for this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealer Name</TableHead>
                    <TableHead>Contact Name</TableHead>
                    <TableHead>Consultant</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.dealer_name}</TableCell>
                      <TableCell>{row.contact_name}</TableCell>
                      <TableCell>{row.consultant_id}</TableCell>
                      <TableCell>{row.city || '-'}</TableCell>
                      <TableCell>{stageLabel(row.stage)}</TableCell>
                      <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        <Button type="button" size="sm" variant="outline" onClick={() => startEditing(row)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {editingId && (
              <form className="mt-2 grid gap-4 rounded-lg border p-4 md:grid-cols-2" onSubmit={handleUpdate}>
                <div className="space-y-2">
                  <Label htmlFor="edit-dealer-name">Dealer Name</Label>
                  <Input id="edit-dealer-name" value={editDealerName} onChange={(event) => setEditDealerName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-name">Contact Name</Label>
                  <Input id="edit-contact-name" value={editContactName} onChange={(event) => setEditContactName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-email">Contact Email</Label>
                  <Input id="edit-contact-email" type="email" value={editContactEmail} onChange={(event) => setEditContactEmail(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact-phone">Contact Phone</Label>
                  <Input id="edit-contact-phone" value={editContactPhone} onChange={(event) => setEditContactPhone(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input id="edit-city" value={editCity} onChange={(event) => setEditCity(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Input id="edit-state" value={editState} onChange={(event) => setEditState(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-consultant-id">Consultant ID</Label>
                  <Input id="edit-consultant-id" value={editConsultantId} onChange={(event) => setEditConsultantId(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={editStage} onValueChange={(value) => setEditStage(value as typeof editStage)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_FILTERS.filter((stage) => stage !== 'all').map((stage) => (
                        <SelectItem key={stage} value={stage}>{stageLabel(stage)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea id="edit-notes" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <Button type="submit" disabled={isUpdating}>{isUpdating ? 'Saving...' : 'Save Changes'}</Button>
                  <Button type="button" variant="outline" onClick={cancelEditing} disabled={isUpdating}>Cancel</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
