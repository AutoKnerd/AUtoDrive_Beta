'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

type Tab = 'sign-in' | 'join';

export function AutoknerdLoginCard() {
  const [activeTab, setActiveTab] = useState<Tab>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const resolvePostLoginPath = (): string => {
    const requested = searchParams.get('next')?.trim();
    if (!requested) return '/';
    if (!requested.startsWith('/') || requested.startsWith('//')) return '/';
    return requested;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push(resolvePostLoginPath());
    } catch (error) {
      console.error('[AutoknerdLoginCard] login failed:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-[440px] rounded-[32px] border border-white/12 bg-[#111111] px-6 py-6 shadow-[0_28px_90px_rgba(0,0,0,0.65)] backdrop-blur-sm md:px-7 md:py-7">
      <div className="mb-6 flex items-center justify-center">
        <img
          src="/AutoKnerd Logo.png"
          alt="AutoKnerd"
          className="h-auto w-full max-w-[216px] drop-shadow-[0_0_24px_rgba(190,252,0,0.12)]"
        />
      </div>

      <div className="mb-6 flex rounded-full border border-white/10 bg-black/35 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('sign-in')}
          className={cn(
            'flex-1 rounded-full px-4 py-3 text-[11px] font-black uppercase tracking-[0.3em] transition-all',
            activeTab === 'sign-in'
              ? 'bg-[#d9ff00] text-black shadow-[0_0_24px_rgba(217,255,0,0.22)]'
              : 'text-white/60 hover:text-white'
          )}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('join')}
          className={cn(
            'flex-1 rounded-full px-4 py-3 text-[11px] font-black uppercase tracking-[0.3em] transition-all',
            activeTab === 'join'
              ? 'bg-[#d9ff00] text-black shadow-[0_0_24px_rgba(217,255,0,0.22)]'
              : 'text-white/60 hover:text-white'
          )}
        >
          Join
        </button>
      </div>

      {activeTab === 'sign-in' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-3 block text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">
              Email or Staff ID
            </span>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@store.com or user ID"
              className="h-14 rounded-2xl border-white/10 bg-black/30 px-5 text-[15px] text-white placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#d9ff00]/25"
            />
          </label>

          <label className="block">
            <span className="mb-3 block text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">
              Password
            </span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-14 rounded-2xl border-white/10 bg-black/30 px-5 text-[15px] text-white placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#d9ff00]/25"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d9ff00] transition hover:brightness-110"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-16 w-full items-center justify-center rounded-full bg-[#d9ff00] px-6 text-[13px] font-black uppercase tracking-[0.32em] text-black shadow-[0_0_28px_rgba(217,255,0,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Spinner size="sm" /> : 'Continue'}
          </button>

          <div className="flex items-center justify-between pt-1 text-[11px] uppercase tracking-[0.28em] text-white/45">
            <span>Sign in to continue</span>
            <button type="button" onClick={() => setActiveTab('join')} className="font-black text-[#d9ff00]">
              Admin Login
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 pt-1">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/70">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d9ff00]">Join</p>
            <p className="mt-3 leading-6">
              This is the join panel placeholder for the native shell. Use the Pro plan signup below for the main conversion path.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('sign-in')}
            className="inline-flex h-14 w-full items-center justify-center rounded-full bg-[#d9ff00] px-6 text-[13px] font-black uppercase tracking-[0.32em] text-black shadow-[0_0_28px_rgba(217,255,0,0.18)] transition hover:brightness-110"
          >
            Back to Sign In
          </button>
        </div>
      )}
    </section>
  );
}
