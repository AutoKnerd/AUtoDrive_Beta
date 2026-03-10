'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Consultant = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  firebaseUid: string;
  createdAt: string;
};

export default function AdminConsultantsPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [firebaseUid, setFirebaseUid] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editReferralCode, setEditReferralCode] = useState('');
  const [editFirebaseUid, setEditFirebaseUid] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'http://localhost:3002';
    }

    return window.location.origin;
  }, []);

  async function loadConsultants() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/consultants');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load consultants.');
      }

      setConsultants(payload.consultants || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load consultants.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConsultants();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/consultants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          referralCode,
          firebaseUid,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create consultant.');
      }

      setName('');
      setEmail('');
      setReferralCode('');
      setFirebaseUid('');
      await loadConsultants();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to create consultant.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(consultant: Consultant) {
    setEditingId(consultant.id);
    setEditName(consultant.name);
    setEditEmail(consultant.email);
    setEditReferralCode(consultant.referralCode);
    setEditFirebaseUid(consultant.firebaseUid || '');
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditReferralCode('');
    setEditFirebaseUid('');
  }

  async function handleUpdateConsultant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/consultants/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          referralCode: editReferralCode,
          firebaseUid: editFirebaseUid,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update consultant.');
      }

      cancelEditing();
      await loadConsultants();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Failed to update consultant.';
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Consultant Management</CardTitle>
          <CardDescription>Create and manage consultants for referral + dashboard links.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="consultant-name">Name</Label>
              <Input
                id="consultant-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Lee Johnson"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consultant-email">Email</Label>
              <Input
                id="consultant-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="lee@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consultant-code">Referral Code</Label>
              <Input
                id="consultant-code"
                value={referralCode}
                onChange={(event) => setReferralCode(event.target.value)}
                placeholder="lee"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consultant-firebase-uid">Firebase UID</Label>
              <Input
                id="consultant-firebase-uid"
                value={firebaseUid}
                onChange={(event) => setFirebaseUid(event.target.value)}
                placeholder="firebase uid"
              />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Consultant'}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consultants</CardTitle>
          <CardDescription>Referral and dashboard links for each consultant.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading consultants...</p>
          ) : consultants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consultants created yet.</p>
          ) : (
            <div className="space-y-4">
              {consultants.map((consultant) => {
                const referralLink = `${baseUrl}/signup?consultant=${encodeURIComponent(consultant.referralCode)}`;
                const dashboardLink = `${baseUrl}/consultant/${encodeURIComponent(consultant.referralCode)}`;
                const isEditing = editingId === consultant.id;

                return (
                  <div key={consultant.id} className="rounded-md border p-4">
                    {isEditing ? (
                      <form className="space-y-3" onSubmit={handleUpdateConsultant}>
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="space-y-1">
                            <Label htmlFor={`consultant-edit-name-${consultant.id}`}>Name</Label>
                            <Input
                              id={`consultant-edit-name-${consultant.id}`}
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`consultant-edit-email-${consultant.id}`}>Email</Label>
                            <Input
                              id={`consultant-edit-email-${consultant.id}`}
                              type="email"
                              value={editEmail}
                              onChange={(event) => setEditEmail(event.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`consultant-edit-code-${consultant.id}`}>Referral Code</Label>
                            <Input
                              id={`consultant-edit-code-${consultant.id}`}
                              value={editReferralCode}
                              onChange={(event) => setEditReferralCode(event.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`consultant-edit-firebase-uid-${consultant.id}`}>Firebase UID</Label>
                            <Input
                              id={`consultant-edit-firebase-uid-${consultant.id}`}
                              value={editFirebaseUid}
                              onChange={(event) => setEditFirebaseUid(event.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={isUpdating}>
                            {isUpdating ? 'Saving...' : 'Save'}
                          </Button>
                          <Button type="button" variant="outline" onClick={cancelEditing} disabled={isUpdating}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-base font-semibold">{consultant.name}</p>
                        <p className="text-sm text-muted-foreground">{consultant.email}</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <p>
                            Referral link:{' '}
                            <Link href={referralLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                              {referralLink}
                            </Link>
                          </p>
                          <p>
                            Dashboard:{' '}
                            <Link href={dashboardLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                              {dashboardLink}
                            </Link>
                          </p>
                        </div>
                        <div className="mt-3">
                          <Button type="button" variant="outline" onClick={() => startEditing(consultant)}>
                            Edit
                          </Button>
                        </div>
                      </>
                    )}
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-xs text-muted-foreground">Created: {new Date(consultant.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
