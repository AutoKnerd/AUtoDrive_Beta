'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { GOOGLE_BOOKING_URL } from '@/lib/calendar';

type SubscriberFormState = {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
};

const initialFormState: SubscriberFormState = {
  email: '',
  firstName: '',
  lastName: '',
  company: '',
  role: 'Owner',
};

const roleOptions = ['Owner', 'General Manager', 'Manager', 'Fixed Ops', 'Other'] as const;

type BeehiivSubscriberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  source?: string;
  className?: string;
};

type SubmissionState = 'form' | 'schedule';

export function BeehiivSubscriberDialog({
  open,
  onOpenChange,
  title = 'Schedule a Call',
  description = 'Built for dealerships that want clearer communication, stronger customer trust, and more consistent experiences.',
  source = 'autoknerd-popup',
  className,
}: BeehiivSubscriberDialogProps) {
  const [submissionState, setSubmissionState] = useState<SubmissionState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<SubscriberFormState>(initialFormState);

  const displayName = useMemo(() => {
    const parts = [form.firstName.trim(), form.lastName.trim()].filter(Boolean);
    return parts.join(' ') || 'there';
  }, [form.firstName, form.lastName]);
  const isUntouchedForm =
    submissionState === 'form' &&
    !form.firstName.trim() &&
    !form.lastName.trim() &&
    !form.email.trim() &&
    !form.company.trim();

  useEffect(() => {
    if (!open) {
      setSubmissionState('form');
      setIsSubmitting(false);
      setErrorMessage(null);
      setForm(initialFormState);
      return;
    }

    setSubmissionState('form');
    setErrorMessage(null);
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const payload = {
      email: form.email.trim().toLowerCase(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      company: form.company.trim(),
      role: form.role.trim(),
      source,
    };

    if (!payload.email || !payload.firstName || !payload.lastName || !payload.company || !payload.role) {
      setErrorMessage('Please complete every field before subscribing.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/beehiiv/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to complete the subscription request.');
      }

      setSubmissionState('schedule');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete the subscription request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(event) => {
            if (window.matchMedia('(max-width: 767px)').matches) {
              event.preventDefault();
            }
          }}
          className="!left-0 !top-0 !h-[100svh] !w-[100vw] !max-w-none !translate-x-0 !translate-y-0 !rounded-none overflow-y-auto overscroll-contain border border-[#bdfc00]/15 bg-[#101313] p-0 text-[#f4f3f3] shadow-[0_30px_100px_rgba(0,0,0,0.55)] max-h-[100svh] sm:!left-[50%] sm:!top-[50%] sm:!h-auto sm:!w-[calc(100vw-1rem)] sm:!max-w-[760px] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!rounded-[28px] sm:max-h-[92vh]"
        >
          <div className="grid pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] lg:h-full lg:min-h-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative order-1 overflow-hidden border-b border-[#232626] bg-[linear-gradient(180deg,rgba(189,252,0,0.12),rgba(16,19,19,0.96)_35%,rgba(16,19,19,1)_100%)] p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(189,252,0,0.14),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(230,234,90,0.08),transparent_32%)]" />
              <div className="relative z-10">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#bdfc00]/20 bg-[#bdfc00]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#eaffb8] sm:mb-5">
                  <span className="h-2 w-2 rounded-full bg-[#bdfc00] shadow-[0_0_12px_rgba(189,252,0,0.85)]" />
                  Dealership performance system
                </div>
                <DialogHeader className="text-left">
                  <DialogTitle className="max-w-[12ch] text-2xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-3xl md:text-4xl">
                    {submissionState === 'schedule' ? 'You’re on the list.' : title}
                  </DialogTitle>
                  <DialogDescription className="mt-3 max-w-[31ch] text-sm leading-7 text-[#aaabab] sm:mt-4 sm:text-base sm:leading-8">
                    {submissionState === 'schedule'
                      ? `Thanks, ${displayName}. We have your inquiry and you can pick a time below.`
                      : description}
                  </DialogDescription>
                </DialogHeader>

                {submissionState === 'form' ? (
                  <div className="mt-7 space-y-5 sm:mt-10 sm:space-y-7">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-sm font-semibold text-[#f4f3f3]">What Happens During the Call</p>
                      <ul className="mt-4 space-y-3 text-sm leading-6 text-[#aaabab] sm:space-y-4 sm:leading-7">
                        <li className="flex gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#bdfc00]" />
                          We identify the biggest friction points affecting customer trust.
                        </li>
                        <li className="flex gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#bdfc00]" />
                          We show how AutoKnerd helps managers reinforce clear, consistent communication.
                        </li>
                        <li className="flex gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#bdfc00]" />
                          Then you choose a calendar time and we map the next step together.
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-[#bdfc00]/8 bg-white/[0.02] p-3 opacity-78 sm:p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#eaffb8]">WHY IT WORKS</p>
                      <p className="mt-2 max-w-[29ch] text-sm leading-6 text-[#aaabab]">
                        Clear communication builds customer trust.
                      </p>
                      <p className="mt-2 max-w-[29ch] text-sm leading-6 text-[#aaabab]">
                        AutoKnerd helps managers reinforce those behaviors every week.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-7 space-y-5 sm:mt-10 sm:space-y-7">
                    <div className="rounded-2xl border border-[#bdfc00]/15 bg-[#0d0f0f] p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#bdfc00]/12 text-[#bdfc00]">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Inquiry saved</p>
                          <p className="text-sm text-[#aaabab]">We captured the dealership info and you can book the call right here.</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm leading-6 text-[#aaabab]">
                      <p className="font-semibold text-[#f4f3f3]">Meeting prep notes</p>
                      <p className="mt-2">Email: {form.email.trim().toLowerCase()}</p>
                      <p>Name: {displayName}</p>
                      <p>Company: {form.company.trim()}</p>
                      <p>Role: {form.role}</p>
                    </div>
                    <div className="rounded-2xl border border-[#bdfc00]/10 bg-[#101313] p-4">
                      <p className="text-sm font-semibold text-[#eaffb8]">Open calendar</p>
                      <p className="mt-2 text-sm leading-7 text-[#aaabab]">
                        Pick a time below. If the embed is finicky on your device, you can still open it directly in Google.
                      </p>
                      <a
                        href={GOOGLE_BOOKING_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-[#bdfc00] transition-colors hover:text-[#d8ff66]"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative order-2 p-4 sm:p-5 lg:p-6">
              {submissionState === 'form' ? (
                <form className="space-y-3 pt-2 sm:pt-4" onSubmit={handleSubmit}>
                  <div className="grid gap-3">
                    <div
                      className={[
                        'space-y-1.5 rounded-2xl transition-all',
                        isUntouchedForm
                          ? 'bg-[#bdfc00]/5 px-3 py-3 ring-1 ring-[#bdfc00]/35 shadow-[0_0_0_1px_rgba(189,252,0,0.08),0_0_24px_rgba(189,252,0,0.14)]'
                          : '',
                      ].join(' ')}
                    >
                      <Label htmlFor="beehiiv-first-name" className="text-sm font-semibold text-[#f4f3f3]">
                        First name
                        {isUntouchedForm ? (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bdfc00]">
                            Start here
                          </span>
                        ) : null}
                      </Label>
                      <Input
                        id="beehiiv-first-name"
                        autoComplete="given-name"
                        required
                        value={form.firstName}
                        onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                        className="h-12 border-white/10 bg-[#181a1a] text-white placeholder:text-white/30"
                        placeholder="Jordan"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="beehiiv-last-name" className="text-sm font-semibold text-[#f4f3f3]">
                        Last name
                      </Label>
                      <Input
                        id="beehiiv-last-name"
                        autoComplete="family-name"
                        required
                        value={form.lastName}
                        onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                        className="h-12 border-white/10 bg-[#181a1a] text-white placeholder:text-white/30"
                        placeholder="Smith"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="beehiiv-email" className="text-sm font-semibold text-[#f4f3f3]">
                      Email
                    </Label>
                    <Input
                      id="beehiiv-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="h-12 border-white/10 bg-[#181a1a] text-white placeholder:text-white/30"
                      placeholder="name@dealership.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="beehiiv-company" className="text-sm font-semibold text-[#f4f3f3]">
                      Company / dealership
                    </Label>
                    <Input
                      id="beehiiv-company"
                      autoComplete="organization"
                      required
                      value={form.company}
                      onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                      className="h-12 border-white/10 bg-[#181a1a] text-white placeholder:text-white/30"
                      placeholder="Northside Toyota"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="beehiiv-role" className="text-sm font-semibold text-[#f4f3f3]">
                      Role
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-2">
                      {roleOptions.map((option) => {
                        const selected = form.role === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, role: option }))}
                            className={cn(
                              'rounded-xl border px-3 py-3 text-left text-sm transition-all',
                              selected
                                ? 'border-[#bdfc00]/50 bg-[#bdfc00]/10 text-[#eaffb8]'
                                : 'border-white/10 bg-white/[0.03] text-[#aaabab] hover:border-white/20 hover:bg-white/[0.05] hover:text-[#f4f3f3]'
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="pt-1">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-12 w-full bg-[#bdfc00] text-[#445d00] hover:brightness-110 disabled:opacity-80"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner size="sm" />
                          Subscribing...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Continue to Calendar
                        </>
                      )}
                    </Button>
                    <p className="mt-2 text-center text-xs leading-5 text-[#747675]">
                      After you submit, available calendar times will appear right here in the popup.
                    </p>
                  </div>
                </form>
              ) : (
                <div className="flex h-full flex-col pt-4">
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f0f] shadow-[0_0_40px_rgba(0,255,102,0.08)]">
                      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(189,252,0,0.12),rgba(16,19,19,0.96)_38%,rgba(16,19,19,1)_100%)] px-6 py-4">
                        <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#eaffb8]">Weekly auto-intelligence</p>
                        <p className="mt-2 text-sm leading-6 text-[#aaabab]">
                          The call calendar is ready, and the details above give you the context you asked for before the meeting.
                        </p>
                      </div>
                      <div className="border-b border-white/10 bg-[#111313] px-6 py-3">
                        <p className="text-sm leading-6 text-white/65">
                          We use the submitted lead details to prep the call, then the calendar below handles the actual booking.
                        </p>
                      </div>
                      <div className="bg-[#181818] p-3 sm:p-3.5">
                        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#121212]">
                          <iframe
                            src={GOOGLE_BOOKING_URL}
                            style={{ border: 0 }}
                            width="100%"
                            height="590"
                            frameBorder="0"
                            title="Schedule a call"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="pt-1">
                      <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="h-12 w-full border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
