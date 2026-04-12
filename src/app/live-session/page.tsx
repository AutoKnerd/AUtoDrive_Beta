'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LIVE_SESSION_DEFAULT_STATE, type LiveSessionPayload } from '@/lib/live-session';

function fallbackPayload(): LiveSessionPayload {
  return {
    state: LIVE_SESSION_DEFAULT_STATE,
    deckTitle: 'AutoKnerd',
    audienceEnabled: true,
    qrOverlayEnabled: true,
    content: {
      eyebrow: 'Live Session',
      title: 'Connecting…',
      body: 'Waiting for presentation state.',
      prompt: 'Keep this page open. It updates as the presentation advances.',
    },
  };
}

export default function LiveSessionPage() {
  const [payload, setPayload] = useState<LiveSessionPayload>(fallbackPayload);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  useEffect(() => {
    let mounted = true;

    fetch('/api/live-session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        setPayload(data as LiveSessionPayload);
      })
      .catch((error) => {
        console.error('Unable to fetch initial live session state.', error);
      });

    const eventSource = new EventSource('/api/live-session/stream');

    eventSource.onopen = () => {
      if (!mounted) return;
      setStatus('live');
    };

    eventSource.onmessage = (event) => {
      if (!mounted) return;
      try {
        const nextPayload = JSON.parse(event.data) as LiveSessionPayload;
        setPayload(nextPayload);
        setStatus('live');
      } catch (error) {
        console.error('Unable to parse live session payload.', error);
      }
    };

    eventSource.onerror = () => {
      if (!mounted) return;
      setStatus('offline');
    };

    return () => {
      mounted = false;
      eventSource.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-12 pt-10">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Live Session</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
              status === 'live'
                ? 'border-[#8eff71]/40 bg-[#8eff71]/10 text-[#8eff71]'
                : status === 'connecting'
                  ? 'border-white/15 bg-white/5 text-white/65'
                  : 'border-[#ff8f78]/40 bg-[#ff8f78]/10 text-[#ff8f78]'
            }`}
          >
            {status === 'live' ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Reconnecting'}
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(142,255,113,0.12),transparent_34%)]" />
          <p className="relative text-[10px] uppercase tracking-[0.3em] text-[#8eff71]">{payload.content.eyebrow}</p>
          <h2 className="relative mt-5 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white">
            {payload.content.title}
          </h2>
          <p className="relative mt-6 text-base leading-7 text-white/76">{payload.content.body}</p>
          {payload.content.prompt ? (
            <p className="relative mt-6 text-sm leading-6 text-white/52">{payload.content.prompt}</p>
          ) : null}
        </section>

        <section className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.02] p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Current Step</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-white">{payload.state.currentStep.toUpperCase()}</p>
              <p className="mt-1 text-sm text-white/48">{payload.state.currentSlide}</p>
            </div>
            <div className="h-3 w-3 rounded-full bg-[#8eff71] shadow-[0_0_18px_rgba(142,255,113,0.75)]" />
          </div>
        </section>

        <div className="mt-auto pt-10 text-center">
          {payload.qrOverlayEnabled ? (
            <Link
              href="/live-session/qr"
              className="inline-flex items-center justify-center rounded-full border border-[#8eff71]/25 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8eff71] transition hover:border-[#8eff71]/55 hover:bg-[#8eff71]/8"
            >
              Open QR Screen
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
