'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type UpgradeModalProps = {
  open: boolean;
  loading?: boolean;
  contextMessage?: string;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => Promise<void>;
};

export function UpgradeModal({ open, loading = false, contextMessage, onOpenChange, onUpgrade }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Your Full Toolbox</DialogTitle>
          <DialogDescription>Don&apos;t lose momentum. Turn every conversation into a system.</DialogDescription>
        </DialogHeader>

        {contextMessage && <p className="text-sm font-medium text-slate-700">{contextMessage}</p>}

        <p className="text-sm text-slate-600">You&apos;ve only unlocked part of the system.</p>

        <ul className="space-y-2 text-sm text-slate-700">
          <li>Access every tool, anytime</li>
          <li>Save your work and build on it</li>
          <li>Turn weekly reps into real results</li>
        </ul>

        <DialogFooter>
          <Button onClick={onUpgrade} disabled={loading}>
            {loading ? 'Upgrading...' : 'Unlock Full Access'}
          </Button>
        </DialogFooter>
        <p className="text-center text-xs text-slate-500">Start now. Pick up where you left off anytime.</p>
      </DialogContent>
    </Dialog>
  );
}
