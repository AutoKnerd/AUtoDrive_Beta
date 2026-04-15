'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'react-qr-code';

function isInvalidAudienceUrl(raw: string) {
  if (!raw) return true;

  try {
    const parsed = new URL(raw);
    const isPrivateHost =
      parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname === '0.0.0.0'
      || parsed.hostname === '::1'
      || /^169\.254\./.test(parsed.hostname)
      || /^192\.168\./.test(parsed.hostname)
      || /^10\./.test(parsed.hostname)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(parsed.hostname);

    return (
      !/^https?:$/.test(parsed.protocol)
      || (isPrivateHost && parsed.port !== '3000')
    );
  } catch {
    return true;
  }
}

function LiveSessionQrPageContent() {
  const searchParams = useSearchParams();
  const initialAudienceUrl = searchParams.get('audience') ?? '';
  const initialCustomUrl = searchParams.get('url') ?? '';
  const title = searchParams.get('title') || (initialCustomUrl ? 'QR Code' : 'Live QR');
  const initialUrl = initialCustomUrl || initialAudienceUrl;
  const [audienceUrl, setAudienceUrl] = useState(isInvalidAudienceUrl(initialUrl) ? '' : initialUrl);
  const [showQr, setShowQr] = useState(true);
  const isEmbed = searchParams.get('embed') === '1';

  useEffect(() => {
    if (initialUrl && !isInvalidAudienceUrl(initialUrl)) {
      setAudienceUrl(initialUrl);
      return;
    }

    let mounted = true;

    if (initialCustomUrl) {
      setAudienceUrl(initialCustomUrl);
      return () => {
        mounted = false;
      };
    }

    fetch('/api/live-session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted) return;
        const resolvedAudienceUrl = typeof payload?.audienceUrl === 'string' ? payload.audienceUrl : '';
        setAudienceUrl(resolvedAudienceUrl || `${window.location.origin}/live-session?audience=1`);
      })
      .catch(() => {
        if (!mounted) return;
        setAudienceUrl(`${window.location.origin}/live-session?audience=1`);
      });

    return () => {
      mounted = false;
    };
  }, [initialCustomUrl, initialUrl]);

  if (isEmbed) {
    return (
      <main className="min-h-full bg-transparent p-0 text-white">
        <div className="relative w-full rounded-[24px] border border-white/10 bg-black/76 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8eff71]">{title}</p>
            <div className="h-2 w-2 rounded-full bg-[#8eff71] shadow-[0_0_14px_rgba(142,255,113,0.75)]" />
          </div>
          <div className="rounded-[18px] bg-white p-3">
            {audienceUrl ? (
              <QRCode
                value={audienceUrl}
                size={228}
                style={{ height: 'auto', width: '100%' }}
                bgColor="#ffffff"
                fgColor="#050505"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-sm font-medium text-black/60">
                Preparing QR…
              </div>
            )}
          </div>
          <p className="mt-3 break-all text-[11px] leading-5 text-white/38">
            {audienceUrl || 'Resolving live session URL…'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(142,255,113,0.12),transparent_28%)]" />

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-between gap-10">
        <section className="max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Audience Access</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Scan To Join</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            Use this screen when you want the room to join the live audience companion. The QR panel can stay visible in the
            corner, or you can hide it until you are ready.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setShowQr((current) => !current)}
              className="rounded-full border border-[#8eff71]/30 bg-[#8eff71]/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8eff71] transition hover:border-[#8eff71]/55 hover:bg-[#8eff71]/16"
            >
              {showQr ? 'Hide QR Code' : 'Show QR Code'}
            </button>
            <p className="text-sm text-white/48">Audience link: {audienceUrl || 'Resolving live session URL…'}</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:max-w-xl">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/42">Presenter Notes</p>
          <p className="mt-4 text-sm leading-7 text-white/70">
            Open this screen before the presentation starts, turn the QR on when you want the room to join, then hide it
            again once everyone is connected.
          </p>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 sm:bottom-8 sm:right-8">
        <button
          type="button"
          onClick={() => setShowQr((current) => !current)}
          className="rounded-full border border-white/12 bg-black/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/78 backdrop-blur-xl transition hover:border-[#8eff71]/45 hover:text-[#8eff71]"
        >
          {showQr ? 'Hide QR' : 'Show QR'}
        </button>

        <div
          className={`w-[220px] rounded-[24px] border border-white/10 bg-black/76 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all duration-200 sm:w-[260px] ${
            showQr ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8eff71]">{title}</p>
            <div className="h-2 w-2 rounded-full bg-[#8eff71] shadow-[0_0_14px_rgba(142,255,113,0.75)]" />
          </div>
          <div className="rounded-[18px] bg-white p-3">
            {audienceUrl ? (
              <QRCode
                value={audienceUrl}
                size={228}
                style={{ height: 'auto', width: '100%' }}
                bgColor="#ffffff"
                fgColor="#050505"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-sm font-medium text-black/60">
                Preparing QR…
              </div>
            )}
          </div>
          <p className="mt-3 break-all text-[11px] leading-5 text-white/38">
            {audienceUrl || 'Resolving live session URL…'}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LiveSessionQrPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050505]" />}>
      <LiveSessionQrPageContent />
    </Suspense>
  );
}
