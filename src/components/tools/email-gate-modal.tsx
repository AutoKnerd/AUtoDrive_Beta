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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Your Free Tool Shop Account</DialogTitle>
          <DialogDescription>Add your email and role to keep going after 3 tools.</DialogDescription>
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

          <DialogFooter>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Saving...' : 'Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
