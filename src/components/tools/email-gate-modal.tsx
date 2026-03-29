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
  onSubmit: (input: { email: string; password: string; role: UserRole }) => Promise<void>;
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
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(defaultRole);

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setPassword('');
    setRole(defaultRole);
  }, [defaultEmail, defaultRole, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ email: email.trim().toLowerCase(), password, role });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader className="space-y-3">
          <DialogTitle>Unlock the Full System</DialogTitle>
          <DialogDescription>
            You&apos;ve started using the tools, now lock in your progress and start getting better results every day.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Save your conversations and come back to them</li>
          <li>Get tools tailored to how you sell and serve</li>
          <li>Track your progress and build real skill</li>
        </ul>

        <p className="text-sm font-semibold text-foreground">
          Start closing more deals. Improving CSI. Making more money.
        </p>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <p className="text-sm font-medium text-foreground">
            You&apos;re one step away.
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

          <div className="space-y-2">
            <Label htmlFor="toolbox-password">Password</Label>
            <Input
              id="toolbox-password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <DialogFooter className="sm:justify-end">
            <div className="space-y-2 text-right">
              <p className="text-xs font-medium text-muted-foreground">Start earning XP and tracking your growth</p>
              <Button
                type="submit"
                disabled={loading || !email.trim() || password.trim().length < 8}
                className="h-11 min-w-[190px] bg-[#9DEE75] text-[#000000] shadow-[0_0_0_1px_rgba(157,238,117,0.45),0_10px_24px_rgba(107,188,67,0.28)] hover:bg-[#ABF28A] disabled:bg-[#9DEE75] disabled:text-[#000000] disabled:opacity-100 disabled:shadow-[0_0_0_1px_rgba(157,238,117,0.3),0_6px_14px_rgba(107,188,67,0.18)]"
              >
                {loading ? 'Creating account...' : 'Unlock My Account'}
              </Button>
            </div>
          </DialogFooter>
          <p className="text-center text-xs text-muted-foreground">
            Free account. No tool paywalls. Intelligence upgrades are optional.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
