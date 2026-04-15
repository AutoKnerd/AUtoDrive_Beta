'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LIVE_SESSION_DEFAULT_STATE,
  getLiveSessionStateUpdatedAtEpoch,
  type LiveSessionAudienceResponseRecord,
  type LiveSessionPayload,
} from '@/lib/live-session';

type NotesClientStatus = 'connecting' | 'live' | 'offline';

function fallbackPayload(): LiveSessionPayload {
  return {
    state: LIVE_SESSION_DEFAULT_STATE,
    deckTitle: 'AutoKnerd',
    audienceEnabled: true,
    qrOverlayEnabled: true,
    content: {
      eyebrow: 'Presenter Notes',
      title: 'Connecting…',
      body: 'Waiting for presentation state.',
      prompt: 'Keep this page open. It updates as the presentation advances.',
      speakerNotes: [],
    },
  };
}

function formatNotes(lines: string[]) {
  return lines.filter((line) => typeof line === 'string' && line.trim().length > 0);
}

type PresenterNotesClientProps = {
  initialPayload?: LiveSessionPayload;
  slideFiles?: string[];
};

type ContactInfoSelection = {
  email?: string;
  name?: string;
  dealership?: string;
};

type ResponseSnapshot = {
  respondentCount: number;
  responseCount: number;
  fillPercent: number;
  latestAt: string | null;
  records: LiveSessionAudienceResponseRecord[];
};

function inferStepFromSlideFile(slideFile: string, fallbackIndex: number) {
  const match = String(slideFile || '').match(/^(\d+)/);
  const number = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(number) && number > 0 ? `slide${number}` : `slide${fallbackIndex + 1}`;
}

function inferSlideNumberFromFile(slideFile: string, fallbackIndex: number) {
  const match = String(slideFile || '').match(/^(\d+)/);
  const number = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(number) && number > 0 ? number : fallbackIndex + 1;
}

export function PresenterNotesClient({ initialPayload, slideFiles = [] }: PresenterNotesClientProps) {
  const seededPayload = initialPayload ?? fallbackPayload();
  const [payload, setPayload] = useState<LiveSessionPayload>(seededPayload);
  const [status, setStatus] = useState<NotesClientStatus>(initialPayload ? 'live' : 'connecting');
  const [fontScale, setFontScale] = useState(1);
  const [snapshot, setSnapshot] = useState<ResponseSnapshot | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('loading');
  const lastPayloadUpdatedAtRef = useRef(getLiveSessionStateUpdatedAtEpoch(seededPayload.state));
  const lastSessionTokenRef = useRef(seededPayload.state.sessionToken);
  const pendingLocalSlideFileRef = useRef<string | null>(null);
  const ignoreLiveSessionUntilRef = useRef(0);

  const commitPayload = (nextPayload: LiveSessionPayload) => {
    if (nextPayload.state.sessionToken !== lastSessionTokenRef.current) {
      lastSessionTokenRef.current = nextPayload.state.sessionToken;
      pendingLocalSlideFileRef.current = null;
      ignoreLiveSessionUntilRef.current = 0;
    }

    const nextUpdatedAt = getLiveSessionStateUpdatedAtEpoch(nextPayload.state);
    if (nextUpdatedAt === 0) {
      if (lastPayloadUpdatedAtRef.current > 0) {
        return false;
      }
    } else if (nextUpdatedAt < lastPayloadUpdatedAtRef.current) {
      return false;
    }

    if (nextUpdatedAt > 0) {
      lastPayloadUpdatedAtRef.current = nextUpdatedAt;
    }

    setPayload(nextPayload);
    setStatus('live');
    return true;
  };

  const commitLiveSessionPayload = (nextPayload: LiveSessionPayload) => {
    const nextSlideFile = typeof nextPayload?.state?.currentSlide === 'string' ? nextPayload.state.currentSlide.trim() : '';
    const now = Date.now();

    if (
      now < ignoreLiveSessionUntilRef.current &&
      pendingLocalSlideFileRef.current &&
      nextSlideFile !== pendingLocalSlideFileRef.current
    ) {
      return false;
    }

    if (nextSlideFile && nextSlideFile === pendingLocalSlideFileRef.current) {
      pendingLocalSlideFileRef.current = null;
      ignoreLiveSessionUntilRef.current = 0;
    }

    return commitPayload(nextPayload);
  };

  useEffect(() => {
    let mounted = true;

    fetch('/api/live-session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        commitLiveSessionPayload(data as LiveSessionPayload);
      })
      .catch((error) => {
        console.error('Unable to fetch initial live session state for notes.', error);
      });

    const eventSource = new EventSource('/api/live-session/stream');
    eventSource.onopen = () => {
      if (!mounted) return;
      setStatus('live');
    };
    eventSource.onmessage = (event) => {
      if (!mounted) return;
      try {
        commitLiveSessionPayload(JSON.parse(event.data) as LiveSessionPayload);
      } catch (error) {
        console.error('Unable to parse live session payload for notes.', error);
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

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof window.setInterval> | null = null;

    const loadSnapshot = async () => {
      const sessionToken = payload.state.sessionToken?.trim();
      if (!sessionToken) return;

      if (mounted) {
        setSnapshotStatus('loading');
      }

      try {
        const url = new URL('/api/live-session/responses', window.location.origin);
        url.searchParams.set('deckId', payload.state.deckId);
        url.searchParams.set('sessionToken', sessionToken);
        url.searchParams.set('includeDetails', '1');

        const response = await fetch(url.toString(), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Snapshot request failed with ${response.status}`);
        }

        const data = await response.json() as Partial<ResponseSnapshot>;
        if (!mounted) return;

        setSnapshot({
          respondentCount: typeof data.respondentCount === 'number' ? data.respondentCount : 0,
          responseCount: typeof data.responseCount === 'number' ? data.responseCount : 0,
          fillPercent: typeof data.fillPercent === 'number' ? data.fillPercent : 0,
          latestAt: typeof data.latestAt === 'string' && data.latestAt.trim().length > 0 ? data.latestAt : null,
          records: Array.isArray(data.records) ? (data.records as LiveSessionAudienceResponseRecord[]) : [],
        });
        setSnapshotStatus('live');
      } catch (error) {
        console.error('Unable to load live snapshot summary for presenter notes.', error);
        if (mounted) {
          setSnapshotStatus('error');
        }
      }
    };

    void loadSnapshot();
    intervalId = window.setInterval(() => {
      void loadSnapshot();
    }, 2500);

    return () => {
      mounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [payload.state.deckId, payload.state.sessionToken]);

  const notes = useMemo(
    () => formatNotes(payload.content.speakerNotes ?? []),
    [payload.content.speakerNotes],
  );

  const contactInfoRecord = useMemo(() => {
    return snapshot?.records.find((record) => {
      return record.responseKey === 'contact_info' && record.selectedValue && typeof record.selectedValue === 'object' && !Array.isArray(record.selectedValue);
    }) ?? null;
  }, [snapshot?.records]);

  const contactInfo = contactInfoRecord?.selectedValue && typeof contactInfoRecord.selectedValue === 'object' && !Array.isArray(contactInfoRecord.selectedValue)
    ? (contactInfoRecord.selectedValue as ContactInfoSelection)
    : null;

  const contactStatus = contactInfo?.email
    ? 'Captured'
    : snapshot?.records.some((record) => record.responseKey === 'contact_info_skip')
      ? 'Skipped'
      : 'Waiting';

  const recentRecords = useMemo(() => {
    if (!snapshot?.records?.length) return [];
    return [...snapshot.records]
      .sort((left, right) => {
        const leftValue = Date.parse(left.timestamp || left.createdAt || '');
        const rightValue = Date.parse(right.timestamp || right.createdAt || '');
        return rightValue - leftValue;
      })
      .slice(0, 5);
  }, [snapshot?.records]);

  const currentSlideIndex = useMemo(() => {
    if (!slideFiles.length) return -1;
    const currentIndex = slideFiles.indexOf(payload.state.currentSlide);
    if (currentIndex >= 0) return currentIndex;

    const inferred = Number.parseInt(payload.state.currentStep.replace(/^slide/, ''), 10);
    if (Number.isFinite(inferred) && inferred > 0) {
      const zeroBased = inferred - 1;
      return zeroBased < slideFiles.length ? zeroBased : -1;
    }

    return -1;
  }, [payload.state.currentSlide, payload.state.currentStep, slideFiles]);

  const goToSlide = async (offset: number) => {
    if (!slideFiles.length || currentSlideIndex < 0) return;

    const nextIndex = currentSlideIndex + offset;
    if (nextIndex < 0 || nextIndex >= slideFiles.length) return;

    const currentSlideFile = slideFiles[nextIndex];
    const currentStep = inferStepFromSlideFile(currentSlideFile, nextIndex);
    pendingLocalSlideFileRef.current = currentSlideFile;
    ignoreLiveSessionUntilRef.current = Date.now() + 2200;

    try {
      const response = await fetch('/api/live-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deckId: payload.state.deckId,
          currentStep,
          currentSlide: currentSlideFile,
          audienceStep: null,
          sessionToken: payload.state.sessionToken,
        }),
        keepalive: true,
      });

      if (!response.ok) return;

      const updated = await response.json();
      commitLiveSessionPayload(updated as LiveSessionPayload);
    } catch (error) {
      console.error('Unable to advance live session from presenter notes.', error);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-10 pt-8 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Presenter Notes</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
            <p className="mt-2 text-sm text-white/45">
              {payload.state.currentStep.toUpperCase()} · {payload.state.currentSlide}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFontScale((current) => Math.max(0.8, Math.round((current - 0.1) * 10) / 10))}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-[#8eff71]/45 hover:text-[#8eff71]"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontScale(1)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-[#8eff71]/45 hover:text-[#8eff71]"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontScale((current) => Math.min(1.6, Math.round((current + 0.1) * 10) / 10))}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-[#8eff71]/45 hover:text-[#8eff71]"
            >
              A+
            </button>
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
        </header>

        <section className="mt-8 flex-1 overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">Current Cue</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void goToSlide(-1)}
                  disabled={currentSlideIndex <= 0}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-[#8eff71]/45 hover:text-[#8eff71] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => void goToSlide(1)}
                  disabled={currentSlideIndex < 0 || currentSlideIndex >= slideFiles.length - 1}
                  className="rounded-full border border-[#8eff71]/25 bg-[#8eff71]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8eff71] transition hover:border-[#8eff71]/55 hover:bg-[#8eff71]/16 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6" style={{ fontSize: `${fontScale}rem` }}>
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                {notes.length > 0 ? (
                  <section className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Presenter Cue</p>
                        <h2 className="mt-2 text-[1.4rem] font-black tracking-[-0.04em] text-white">Speaker Notes</h2>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
                        {notes.length} cues
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-3">
                      {notes.map((line, index) => {
                      if (line === '---') {
                        return <div key={`divider-${index}`} className="my-2 h-px w-full bg-white/10" />;
                      }

                      if (line === '(pause)') {
                        return (
                          <p key={`pause-${index}`} className="text-center text-[0.82em] italic text-[#8eff71]/60">
                            (pause)
                          </p>
                        );
                      }

                      if (line.startsWith('[PHONE]')) {
                        return (
                          <p
                            key={`phone-${index}`}
                            className="rounded-2xl border border-[#8eff71]/18 bg-[#8eff71]/8 px-4 py-3 text-[0.92em] font-semibold text-[#c9ffb7]"
                          >
                            {line.replace(/^\[PHONE\]\s*/, '')}
                          </p>
                        );
                      }

                      return (
                        <p
                          key={`${index}-${line}`}
                          className="text-[1.04em] font-medium leading-[1.5] tracking-[-0.015em] text-white"
                        >
                          {line}
                        </p>
                      );
                    })}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">Quick controls</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void goToSlide(-1)}
                          disabled={currentSlideIndex <= 0}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 transition hover:border-[#8eff71]/45 hover:text-[#8eff71] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => void goToSlide(1)}
                          disabled={currentSlideIndex < 0 || currentSlideIndex >= slideFiles.length - 1}
                          className="rounded-full border border-[#8eff71]/25 bg-[#8eff71]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8eff71] transition hover:border-[#8eff71]/55 hover:bg-[#8eff71]/16 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </section>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-white/40">
                    No speaker notes found for this slide.
                  </div>
                )}

                <section className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Live Snapshot</p>
                      <h2 className="mt-2 text-[1.4rem] font-black tracking-[-0.04em] text-white">Captured audience data</h2>
                    </div>
                    <div className="rounded-full border border-[#8eff71]/18 bg-[#8eff71]/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8eff71]">
                      {snapshotStatus === 'live' ? 'Synced' : snapshotStatus === 'loading' ? 'Loading' : 'Unavailable'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">Responses</p>
                      <p className="mt-3 text-[1.6rem] font-black tracking-[-0.04em] text-white">
                        {snapshot?.responseCount ?? 0}
                      </p>
                      <p className="mt-2 text-xs text-white/48">
                        {snapshot?.respondentCount ?? 0} respondents
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">Contact</p>
                      <p className={`mt-3 text-[1rem] font-semibold tracking-[-0.02em] ${contactInfo?.email ? 'text-[#8eff71]' : 'text-white/70'}`}>
                        {contactStatus}
                      </p>
                      <p className="mt-2 text-xs text-white/48">
                        {contactInfo?.email ? contactInfo.email : 'No email captured yet'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">Latest</p>
                      <p className="mt-3 text-[1rem] font-semibold tracking-[-0.02em] text-white/82">
                        {snapshot?.latestAt ? new Date(snapshot.latestAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Waiting'}
                      </p>
                      <p className="mt-2 text-xs text-white/48">
                        {snapshot?.fillPercent ? `${snapshot.fillPercent}% fill` : 'No responses yet'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">Contact Info</p>
                      {contactInfo?.email ? (
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-white/40">Email</p>
                            <p className="mt-1 text-sm font-semibold text-white">{contactInfo.email}</p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-white/40">Name</p>
                              <p className="mt-1 text-sm font-semibold text-white">{contactInfo.name?.trim() || 'Not provided'}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-white/40">Dealership</p>
                              <p className="mt-1 text-sm font-semibold text-white">{contactInfo.dealership?.trim() || 'Not provided'}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm leading-6 text-white/55">
                          The email capture has not been submitted yet.
                        </p>
                      )}
                    </div>

                    <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">Recent Responses</p>
                      <div className="mt-4 space-y-3">
                        {recentRecords.length > 0 ? (
                          recentRecords.map((record, index) => {
                            const value = Array.isArray(record.selectedValue)
                              ? record.selectedValue.join(', ')
                              : typeof record.selectedValue === 'object' && record.selectedValue !== null
                                ? JSON.stringify(record.selectedValue)
                                : String(record.answer || record.answerLabel || '—');

                            return (
                              <div key={`${record.responseKey || record.slideId}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                                    {record.slideId || 'Unknown slide'}
                                  </p>
                                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#8eff71]/80">
                                    {record.responseKey || record.screenId || 'response'}
                                  </p>
                                </div>
                                <p className="mt-2 text-sm font-semibold leading-6 text-white/85">
                                  {value}
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm leading-6 text-white/55">
                            No audience responses captured yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-6 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-white/28">
          <span>AutoKnerd Presenter Notes</span>
          <span>
            {payload.state.currentStep}
            {currentSlideIndex >= 0 ? ` · ${currentSlideIndex + 1}/${slideFiles.length}` : ''}
          </span>
        </footer>
      </div>
    </main>
  );
}
