'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

export default function LiveSessionQrPage() {
  const [audienceUrl, setAudienceUrl] = useState('');

  useEffect(() => {
    setAudienceUrl(`${window.location.origin}/live-session`);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 py-10 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/8 bg-white/[0.03] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Audience Access</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Scan To Join</h1>
        <p className="mt-4 text-sm leading-6 text-white/68">
          This QR code opens the live audience companion page and stays synced as the presenter advances.
        </p>

        <div className="mx-auto mt-8 w-full max-w-[260px] rounded-[24px] bg-white p-4">
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

        <p className="mt-6 break-all text-xs text-white/42">{audienceUrl || 'Resolving live session URL…'}</p>
      </div>
    </main>
  );
}
