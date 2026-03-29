'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allRoles, type UserRole } from '@/lib/definitions';

type EmailGateModalProps = {
  open: boolean;
  loading?: boolean;
  defaultEmail?: string;
  defaultRole?: UserRole;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { email: string; role: UserRole }) => Promise<void>;
};

export function EmailGateModal({
  open,
  loading = false,
  defaultEmail = '',
  defaultRole = 'Sales Consultant',
  onOpenChange,
  onSubmit,
}: EmailGateModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [role, setRole] = useState<UserRole>(defaultRole);

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setRole(defaultRole);
  }, [defaultEmail, defaultRole, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ email: email.trim().toLowerCase(), role });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="space-y-3">
          <DialogTitle>Unlock Your AutoShopCX Experience</DialogTitle>
          <DialogDescription>Save your progress. Personalize your tools. Get more out of every deal.</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Pick up where you left off</li>
          <li>Tools tailored to your role</li>
          <li>Consistent, repeatable workflow</li>
        </ul>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <p className="text-sm font-medium text-foreground">
            You&apos;re one step away from unlocking the full system.
          </p>

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

          <div className="space-y-2">
            <Label htmlFor="toolbox-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="toolbox-role">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                {allRoles.map((roleOption) => (
                  <SelectItem key={roleOption} value={roleOption}>
                    {roleOption === 'manager' ? 'Sales Manager' : roleOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="h-11 min-w-[190px] bg-[#5BFF3A] text-[#000000] hover:bg-[#4be92b]"
            >
              {loading ? 'Redirecting...' : 'Set Up My Account'}
            </Button>
          </DialogFooter>
          <p className="text-center text-xs text-muted-foreground">
            We&apos;ll send you a secure login link — no password needed.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
