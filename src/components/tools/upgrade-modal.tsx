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
          <DialogTitle>Unlock AutoDriveCX Intelligence</DialogTitle>
          <DialogDescription>Get guided coaching and smarter decision support inside your workflow.</DialogDescription>
        </DialogHeader>

        {contextMessage && <p className="text-sm font-medium text-slate-700">{contextMessage}</p>}

        <p className="text-sm text-slate-600">Tool access stays open. Upgrade adds intelligence layers.</p>

        <ul className="space-y-2 text-sm text-slate-700">
          <li>Guided coaching in live scenarios</li>
          <li>Smarter next-move recommendations</li>
          <li>Pattern recognition to improve performance</li>
        </ul>

        <DialogFooter>
          <Button onClick={onUpgrade} disabled={loading}>
            {loading ? 'Upgrading...' : 'Unlock Intelligence'}
          </Button>
        </DialogFooter>
        <p className="text-center text-xs text-slate-500">Coach better, decide faster, and improve outcomes.</p>
      </DialogContent>
    </Dialog>
  );
}
