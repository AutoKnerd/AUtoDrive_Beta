'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  created_at?: string | null;
};

type LeadFormState = {
  name: string;
  email: string;
  dealershipName: string;
  role: string;
  status: string;
};

const initialLeadForm: LeadFormState = {
  name: '',
  email: '',
  dealershipName: '',
  role: '',
  status: 'captured',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

function formatExportDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
}

function leadToForm(lead: AutoForgeLead): LeadFormState {
  return {
    name: lead.name || '',
    email: lead.email || '',
    dealershipName: lead.dealership_name || '',
    role: lead.role || '',
    status: lead.status || 'captured',
  };
}

function exportLeadRows(leads: AutoForgeLead[]): Array<Record<string, string>> {
  return leads.map((lead) => ({
    'Lead ID': lead.id,
    Name: lead.name || '',
    Email: lead.email || '',
    Dealership: lead.dealership_name || '',
    Role: lead.role || '',
    Status: lead.status || '',
    Source: lead.source || '',
    Created: formatExportDateTime(lead.created_at),
  }));
}

export function AutoForgeLeadsPanel() {
  const firebaseAuth = useFirebaseAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<AutoForgeLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingLead, setEditingLead] = useState<AutoForgeLead | null>(null);
  const [editForm, setEditForm] = useState<LeadFormState>(initialLeadForm);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to view AutoForge leads.');
      }

      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/autoforge/leads', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load AutoForge leads.');
      }

      setLeads(Array.isArray(payload?.leads) ? payload.leads : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load AutoForge leads.');
    } finally {
      setLoading(false);
    }
  }, [firebaseAuth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        setLeads([]);
        setLoading(false);
        setError('Authentication required to view AutoForge leads.');
        return;
      }

      void loadLeads();
    });

    return () => unsubscribe();
  }, [firebaseAuth, loadLeads]);

  const handleExportSpreadsheet = useCallback(async () => {
    try {
      setIsExporting(true);

      if (leads.length === 0) {
        throw new Error('No AutoForge leads to export.');
      }

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(exportLeadRows(leads));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'AutoForge Leads');
      XLSX.writeFile(workbook, `autoforge-leads-${new Date().toISOString().slice(0, 10)}.xlsx`);

      toast({
        title: 'Export complete',
        description: 'Your AutoForge leads spreadsheet has been downloaded.',
      });
    } catch (nextError) {
      toast({
        title: 'Export failed',
        description: nextError instanceof Error ? nextError.message : 'Failed to export AutoForge leads.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [leads, toast]);

  const openEditDialog = useCallback((lead: AutoForgeLead) => {
    setEditingLead(lead);
    setEditForm(leadToForm(lead));
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditingLead(null);
    setEditForm(initialLeadForm);
  }, []);

  const handleSaveLead = useCallback(async () => {
    if (!editingLead) return;

    if (!editForm.name || !editForm.email || !editForm.dealershipName || !editForm.role || !editForm.status) {
      toast({
        title: 'Missing fields',
        description: 'All lead fields are required before saving.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSavingLead(true);
      setError(null);

      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to edit AutoForge leads.');
      }

      const token = await fbUser.getIdToken(true);
      const response = await fetch(`/api/autoforge/leads/${encodeURIComponent(editingLead.id)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update AutoForge lead.');
      }

      toast({
        title: 'Lead updated',
        description: `${editForm.name} has been saved.`,
      });
      closeEditDialog();
      await loadLeads();
    } catch (nextError) {
      toast({
        title: 'Update failed',
        description: nextError instanceof Error ? nextError.message : 'Unable to update AutoForge lead.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingLead(false);
    }
  }, [closeEditDialog, editForm, editingLead, firebaseAuth, loadLeads, toast]);

  const handleDeleteLead = useCallback(
    async (lead: AutoForgeLead) => {
      const shouldDelete = window.confirm(`Delete ${lead.name || lead.email || 'this lead'}? This cannot be undone.`);
      if (!shouldDelete) return;

      try {
        setDeletingLeadId(lead.id);
        setError(null);

        const fbUser = firebaseAuth.currentUser;
        if (!fbUser) {
          throw new Error('Authentication required to delete AutoForge leads.');
        }

        const token = await fbUser.getIdToken(true);
        const response = await fetch(`/api/autoforge/leads/${encodeURIComponent(lead.id)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to delete AutoForge lead.');
        }

        toast({
          title: 'Lead deleted',
          description: `${lead.name || lead.email || 'The selected lead'} was removed.`,
        });
        await loadLeads();
      } catch (nextError) {
        toast({
          title: 'Delete failed',
          description: nextError instanceof Error ? nextError.message : 'Unable to delete AutoForge lead.',
          variant: 'destructive',
        });
      } finally {
        setDeletingLeadId(null);
      }
    },
    [firebaseAuth, loadLeads, toast],
  );

  useEffect(() => {
    if (loading || error) return;

    const interval = window.setInterval(() => {
      void loadLeads();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [error, loadLeads, loading]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>AutoForge Leads</CardTitle>
            <CardDescription>Latest 50 docs from `autoforge_leads`.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void loadLeads()} disabled={loading}>
              Refresh leads
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExportSpreadsheet()} disabled={isExporting || leads.length === 0}>
              {isExporting ? 'Exporting...' : 'Export spreadsheet'}
            </Button>
          </div>
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
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(lead)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void handleDeleteLead(lead)}
                          disabled={deletingLeadId === lead.id}
                        >
                          {deletingLeadId === lead.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingLead)} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
        <DialogContent className="border-white/10 bg-[#101010] text-white sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl font-black uppercase tracking-[-0.03em]">
              Edit AutoForge Lead
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Update the lead details or mark the record with a new status.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="autoforge-edit-name" className="text-sm font-semibold text-white/80">
                Name
              </label>
              <Input
                id="autoforge-edit-name"
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="autoforge-edit-email" className="text-sm font-semibold text-white/80">
                Email
              </label>
              <Input
                id="autoforge-edit-email"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="autoforge-edit-dealership" className="text-sm font-semibold text-white/80">
                Dealership Name
              </label>
              <Input
                id="autoforge-edit-dealership"
                value={editForm.dealershipName}
                onChange={(event) => setEditForm((current) => ({ ...current, dealershipName: event.target.value }))}
                className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-semibold text-white/80">Role</label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm((current) => ({ ...current, role: value }))}
              >
                <SelectTrigger className="h-12 border-white/10 bg-[#181818] text-white">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#181818] text-white">
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Fixed Ops">Fixed Ops</SelectItem>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label htmlFor="autoforge-edit-status" className="text-sm font-semibold text-white/80">
                Status
              </label>
              <Input
                id="autoforge-edit-status"
                value={editForm.status}
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" onClick={() => void handleSaveLead()} disabled={isSavingLead}>
                {isSavingLead ? 'Saving...' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
