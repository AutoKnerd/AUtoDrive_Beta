'use client';

import { useState, type FormEvent } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type NewsletterFormProps = {
  className?: string;
  source: string;
  compact?: boolean;
  fieldIdSuffix?: string;
};

export function AutoknerdNewsletterForm({ className, source, compact = false, fieldIdSuffix }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus('error');
      setMessage('Please enter an email address.');
      return;
    }

    setIsSubmitting(true);
    setStatus('idle');
    setMessage(null);

    try {
      const response = await fetch('/api/beehiiv/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          source,
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to subscribe right now.');
      }

      setEmail('');
      setStatus('success');
      setMessage('Subscribed. Watch for next week’s dispatch.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to subscribe right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={cn('space-y-3', className)} onSubmit={handleSubmit}>
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row',
          compact ? 'sm:items-stretch' : 'sm:items-end'
        )}
      >
        <label className="sr-only" htmlFor={`autoknerd-newsletter-${fieldIdSuffix ?? source}`}>
          Email address
        </label>
        <input
          id={`autoknerd-newsletter-${fieldIdSuffix ?? source}`}
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== 'idle') {
              setStatus('idle');
              setMessage(null);
            }
          }}
          className={cn(
            'min-h-12 flex-1 rounded-sm border border-[#464848] bg-[#0d0f0f] px-4 text-sm text-[#f4f3f3] outline-none transition-colors placeholder:text-zinc-600 focus:border-[#bdfc00]/50 focus:ring-1 focus:ring-[#bdfc00]/20',
            compact ? 'sm:min-w-0' : 'sm:min-w-[280px]'
          )}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'inline-flex min-h-12 items-center justify-center rounded-sm bg-[#bdfc00] px-6 text-xs font-black uppercase tracking-[0.18em] text-[#445d00] transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70',
            compact ? 'sm:px-5' : 'sm:px-7'
          )}
        >
          {isSubmitting ? <Spinner size="sm" /> : 'Subscribe'}
        </button>
      </div>
      {message ? (
        <p
          className={cn(
            'text-xs uppercase tracking-[0.14em]',
            status === 'success' ? 'text-[#bdfc00]' : 'text-[#ff7b7b]'
          )}
        >
          {message}
        </p>
      ) : (
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Weekly CX insights. No clutter.
        </p>
      )}
    </form>
  );
}
