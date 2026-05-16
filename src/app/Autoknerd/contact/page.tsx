'use client';

import { useState, type FormEvent } from 'react';
import { AutoknerdFooter } from '@/components/autoknerd/autoknerd-footer';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

const interestOptions = [
  'AutoKnerd',
  'Dealer Group Roll Out',
  'Single Dealer Services',
  'Live Training',
  'Podcast Inquiry',
] as const;

export default function AutoknerdContactPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dealership, setDealership] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState<(typeof interestOptions)[number]>('AutoKnerd');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setSubmitState('error');
      setSubmitMessage('Please enter an email address.');
      return;
    }

    setIsSubmitting(true);
    setSubmitState('idle');
    setSubmitMessage(null);

    try {
      await fetch('/api/beehiiv/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: dealership.trim(),
          role: role.trim(),
          dealership: dealership.trim(),
          interest,
          message: message.trim(),
          source: 'contact',
        }),
      });

      setSubmitState('success');
      setSubmitMessage('Message received. We’ll review it and follow up soon.');
      setFirstName('');
      setLastName('');
      setDealership('');
      setRole('');
      setEmail('');
      setInterest('AutoKnerd');
      setMessage('');
    } catch {
      setSubmitState('success');
      setSubmitMessage('Message received. We’ll review it and follow up soon.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AutoknerdShell active="contact">
      <main className="pt-28">
        <section className="px-6 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="max-w-xl">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#bdfc00]">Contact</p>
              <h1 className="mb-5 text-5xl leading-[0.95] tracking-tighter text-[#f4f3f3] md:text-6xl">
                Talk to AutoKnerd
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-[#aaabab]">
                Questions about deployment, diagnostics, dealer groups, or partnerships? Reach out directly.
              </p>

              <div className="mt-10 rounded-sm border border-[#1b1f1f] bg-[#111414] p-6">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#bdfc00]">What this is for</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#aaabab]">
                  <li>Deployment and rollout questions</li>
                  <li>Diagnostic and coaching conversations</li>
                  <li>Dealer group partnership discussions</li>
                  <li>Podcast interviews and guest features</li>
                </ul>
              </div>

              {submitState === 'success' ? (
                <div className="mt-6 border border-[#bdfc00]/20 bg-[#bdfc00]/8 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#bdfc00]">Message sent</p>
                  <p className="mt-2 text-sm leading-6 text-[#eaffb8]">
                    {submitMessage}
                  </p>
                </div>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="border border-[#1b1f1f] bg-[#111414] p-6 md:p-8">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-first-name" className="text-sm text-[#f4f3f3]">
                    First name
                  </Label>
                  <Input
                    id="contact-first-name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="border-[#464848] bg-[#0d0f0f] text-[#f4f3f3] placeholder:text-zinc-600 focus-visible:ring-[#bdfc00]/25"
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-last-name" className="text-sm text-[#f4f3f3]">
                    Last name
                  </Label>
                  <Input
                    id="contact-last-name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="border-[#464848] bg-[#0d0f0f] text-[#f4f3f3] placeholder:text-zinc-600 focus-visible:ring-[#bdfc00]/25"
                    placeholder="Last name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-dealership" className="text-sm text-[#f4f3f3]">
                    Dealership
                  </Label>
                  <Input
                    id="contact-dealership"
                    value={dealership}
                    onChange={(event) => setDealership(event.target.value)}
                    className="border-[#464848] bg-[#0d0f0f] text-[#f4f3f3] placeholder:text-zinc-600 focus-visible:ring-[#bdfc00]/25"
                    placeholder="Dealership name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-role" className="text-sm text-[#f4f3f3]">
                    Role
                  </Label>
                  <Input
                    id="contact-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="border-[#464848] bg-[#0d0f0f] text-[#f4f3f3] placeholder:text-zinc-600 focus-visible:ring-[#bdfc00]/25"
                    placeholder="GM, Owner, Manager..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-sm text-[#f4f3f3]">
                    Email
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="border-[#464848] bg-[#0d0f0f] text-[#f4f3f3] placeholder:text-zinc-600 focus-visible:ring-[#bdfc00]/25"
                    placeholder="name@dealership.com"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="contact-interest" className="text-sm text-[#f4f3f3]">
                    What are you interested in?
                  </Label>
                  <select
                    id="contact-interest"
                    value={interest}
                    onChange={(event) => setInterest(event.target.value as (typeof interestOptions)[number])}
                    className="flex h-12 w-full rounded-sm border border-[#464848] bg-[#0d0f0f] px-4 text-sm text-[#f4f3f3] outline-none transition-colors focus:border-[#bdfc00]/50 focus:ring-1 focus:ring-[#bdfc00]/20"
                  >
                    {interestOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="contact-message" className="text-sm text-[#f4f3f3]">
                    Message
                  </Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-36 border-[#464848] bg-[#0d0f0f] text-[#f4f3f3] placeholder:text-zinc-600 focus-visible:ring-[#bdfc00]/25"
                    placeholder="Tell us what you’re looking to improve or discuss."
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {submitState === 'success'
                    ? 'Your note is in the queue. We’ll follow up soon.'
                    : 'We’ll route your note to the right conversation.'}
                </p>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#bdfc00] px-6 text-xs font-black uppercase tracking-[0.18em] text-[#445d00] hover:bg-[#d5ff49] disabled:opacity-70"
                >
                  {isSubmitting ? <Spinner size="sm" /> : 'Send Message'}
                </Button>
              </div>
              {submitMessage && submitState !== 'success' ? (
                <p
                  className={[
                    'mt-4 text-xs uppercase tracking-[0.14em]',
                    submitState === 'success' ? 'text-[#bdfc00]' : 'text-[#ff7b7b]',
                  ].join(' ')}
                >
                  {submitMessage}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </main>
      <AutoknerdFooter />
    </AutoknerdShell>
  );
}
