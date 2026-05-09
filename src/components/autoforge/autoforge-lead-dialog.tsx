'use client';

import { useState, type FormEvent } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { GOOGLE_BOOKING_URL } from '@/lib/calendar';

type LeadFormState = {
  name: string;
  email: string;
  dealershipName: string;
  role: string;
};

const initialLeadForm: LeadFormState = {
  name: '',
  email: '',
  dealershipName: '',
  role: '',
};

type AutoforgeLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  titleContent?: React.ReactNode;
  submitButtonClassName?: string;
};

export function AutoforgeLeadDialog({
  open,
  onOpenChange,
  title = 'Deploy AutoForge in Your Dealership',
  description = 'Tell us a bit about your store and we&apos;ll show you exactly how this works for you.',
  titleContent,
  submitButtonClassName,
}: AutoforgeLeadDialogProps) {
  const { toast } = useToast();
  const [modalStep, setModalStep] = useState<'form' | 'schedule'>('form');
  const [leadForm, setLeadForm] = useState<LeadFormState>(initialLeadForm);
  const [submittedLead, setSubmittedLead] = useState<LeadFormState | null>(null);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setModalStep('form');
      setSubmittedLead(null);
      setLeadForm(initialLeadForm);
    }
  };

  const handleLeadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.dealershipName || !leadForm.role || isSubmittingLead) {
      return;
    }

    const payload = { ...leadForm };
    setIsSubmittingLead(true);

    try {
      const response = await fetch('/api/autoforge/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to save your AutoForge request.');
      }

      setSubmittedLead(payload);
      window.sessionStorage.setItem('autoforgeLead', JSON.stringify(payload));
      setModalStep('schedule');
    } catch (error) {
      toast({
        title: 'Lead capture failed',
        description: error instanceof Error ? error.message : 'Unable to save your AutoForge request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingLead(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className={[
          'max-h-[90vh] overflow-y-auto border-white/10 bg-[#101010] p-0 text-white',
          modalStep === 'schedule' ? 'sm:max-w-[920px]' : 'sm:max-w-[540px]',
        ].join(' ')}
      >
        {modalStep === 'form' ? (
          <div className="p-6 sm:p-8">
            <DialogHeader className="text-left">
              <DialogTitle className="font-[family-name:var(--font-heading)] text-3xl font-black uppercase tracking-[-0.03em] text-white">
                {titleContent ?? title}
              </DialogTitle>
              <DialogDescription className="mt-3 text-base leading-7 text-white/70">
                {description}
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 grid gap-4" onSubmit={handleLeadSubmit}>
              <div className="grid gap-2">
                <label htmlFor="autoforge-name" className="text-sm font-semibold text-white/80">
                  Name
                </label>
                <Input
                  id="autoforge-name"
                  type="text"
                  required
                  value={leadForm.name}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="autoforge-email" className="text-sm font-semibold text-white/80">
                  Email
                </label>
                <Input
                  id="autoforge-email"
                  type="email"
                  required
                  value={leadForm.email}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="autoforge-dealership" className="text-sm font-semibold text-white/80">
                  Dealership Name
                </label>
                <Input
                  id="autoforge-dealership"
                  type="text"
                  required
                  value={leadForm.dealershipName}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      dealershipName: event.target.value,
                    }))
                  }
                  className="h-12 border-white/10 bg-[#181818] text-white placeholder:text-white/35"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-white/80">Role</label>
                <Select
                  value={leadForm.role}
                  onValueChange={(value) =>
                    setLeadForm((current) => ({
                      ...current,
                      role: value,
                    }))
                  }
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

              <Button
                type="submit"
                disabled={isSubmittingLead}
                className={[
                  'mt-2 h-12 font-[family-name:var(--font-heading)] text-sm font-black uppercase tracking-[0.14em] text-black',
                  submitButtonClassName ?? 'bg-[#00ff66] hover:bg-[#00ff66]/90',
                ].join(' ')}
              >
                {isSubmittingLead ? 'Saving...' : 'Continue'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f0f] shadow-[0_0_40px_rgba(0,255,102,0.08)]">
              <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(0,255,102,0.12),rgba(16,16,16,0.92)_38%,rgba(16,16,16,1)_100%)] px-6 py-6">
                <DialogHeader className="text-left">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#00ff66]/80">
                    AutoForge Scheduling
                  </p>
                  <DialogTitle className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-black uppercase tracking-[-0.03em] text-white">
                    Book Your AutoForge Walkthrough
                  </DialogTitle>
                  <DialogDescription className="mt-3 max-w-2xl text-base leading-7 text-white/70">
                    Choose a time that works for your dealership. We&apos;ll use the details you submitted to tailor the walkthrough to your store, team structure, and rollout needs.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-5 flex flex-wrap gap-3 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white/60">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Live Store Walkthrough
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Tailored to Your Dealership
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    1:1 Scheduling
                  </span>
                </div>
              </div>

              {submittedLead && (
                <div className="border-b border-white/10 bg-[#0f1211] px-6 py-4">
                  <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#00ff66]/80">
                    Captured Lead
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-white">Name:</span> {submittedLead.name}
                    </p>
                    <p>
                      <span className="font-semibold text-white">Email:</span> {submittedLead.email}
                    </p>
                    <p>
                      <span className="font-semibold text-white">Dealership:</span> {submittedLead.dealershipName}
                    </p>
                    <p>
                      <span className="font-semibold text-white">Role:</span> {submittedLead.role}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-b border-white/10 bg-[#111313] px-6 py-4">
                <p className="text-sm leading-6 text-white/60">
                  If the embedded calendar doesn&apos;t load cleanly on your device, you can open the scheduler directly in Google.
                  {' '}
                  <a
                    href={GOOGLE_BOOKING_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#00ff66] transition-colors hover:text-[#7dffb0]"
                  >
                    Open in new tab
                  </a>
                </p>
              </div>

              <div className="bg-[#181818] p-3 sm:p-4">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#121212]">
                  <iframe
                    src={GOOGLE_BOOKING_URL}
                    style={{ border: 0 }}
                    width="100%"
                    height="640"
                    frameBorder="0"
                    title="Book an AutoForge walkthrough"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
