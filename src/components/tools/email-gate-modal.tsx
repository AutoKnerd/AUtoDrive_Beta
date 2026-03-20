'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type EmailGateModalProps = {
  open: boolean;
  loading?: boolean;
  defaultEmail?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (email: string) => Promise<void>;
};

export function EmailGateModal({ open, loading = false, defaultEmail = '', onOpenChange, onSubmit }: EmailGateModalProps) {
  const [email, setEmail] = useState(defaultEmail);

  useEffect(() => {
    if (open) setEmail(defaultEmail);
  }, [defaultEmail, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(email.trim().toLowerCase());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock this week's tool</DialogTitle>
          <DialogDescription>Enter your email to start immediately. No password required yet.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="toolbox-email">Email</Label>
            <Input
              id="toolbox-email"
              type="email"
              required
              placeholder="you@dealership.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Starting...' : 'Start'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
