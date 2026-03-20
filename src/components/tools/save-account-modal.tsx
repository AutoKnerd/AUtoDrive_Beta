'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SaveAccountModalProps = {
  open: boolean;
  email: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => Promise<void>;
};

export function SaveAccountModal({ open, email, loading = false, onOpenChange, onSubmit }: SaveAccountModalProps) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(password);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save your work</DialogTitle>
          <DialogDescription>Create your free account to save this session and reopen your recent work.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">{email}</div>

          <div className="space-y-2">
            <Label htmlFor="toolbox-password">Password</Label>
            <Input
              id="toolbox-password"
              type="password"
              minLength={8}
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || password.length < 8}>
              {loading ? 'Creating...' : 'Create Free Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
