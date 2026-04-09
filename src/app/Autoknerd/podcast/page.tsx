'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AutoknerdFooter } from '@/components/autoknerd/autoknerd-footer';
import { AutoknerdShell } from '@/components/autoknerd/autoknerd-shell';

const RSS_URL = 'https://feed.podbean.com/btedesign/feed.xml';
const FALLBACK_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ5F1sJksEbg_u7OxRRsuFxpWZ3Q9Ep7Oqf548l5oyQrIdRNBf20pXVHzhFl7i4NwNaJ5MxeyXeqVfSD0pSQSxHDPExc18GfI6sOgkqwbRrWgcDHSAl2hdTo_MvL4NqXe2DXFYWNijK2wlKOGxDxddgTZJBQdT62wiHGA-DDJjjUAuen7r4pUujGWa8sd-XV6TQA1xD_uCS0kJT7sEy6EOaHilwe44VvF2mS7SbP1k64MUmHktwzD_MMDjRHmGPOBdFPyunWGptns';
const INITIAL_ARCHIVE_COUNT = 6;
const ARCHIVE_BATCH_SIZE = 6;

type Episode = {
  title: string;
  description: string;
  audioUrl: string;
  pubDate: string;
  duration: string;
  image: string;
};

const fallbackEpisodes: Episode[] = [
  {
    title: 'Why Inconsistency Costs the Deal Before Pricing Ever Does',
    description: 'A field breakdown of how uneven handoffs, trust gaps, and vague next steps quietly kill momentum.',
    audioUrl: '#',
    pubDate: 'Latest Release',
    duration: '32:10',
    image: FALLBACK_IMAGE,
  },
  {
    title: 'How Managers Accidentally Train Drift Into the Team',
    description: 'The coaching habits that create variation, and how to set a visible behavior standard instead.',
    audioUrl: '#',
    pubDate: 'Archive',
    duration: '27:44',
    image: FALLBACK_IMAGE,
  },
  {
    title: 'Follow-Up Is Not a Task List. It Is a Confidence System.',
    description: 'What customers actually hear in the silence between touches and how to rebuild momentum.',
    audioUrl: '#',
    pubDate: 'Archive',
    duration: '24:18',
    image: FALLBACK_IMAGE,
  },
];

function decodeHtml(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(input: string) {
  return decodeHtml(input).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

function parseAttr(block: string, tag: string, attr: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*${attr}="([^"]+)"[^>]*>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

export default function AutoknerdPodcastPage() {
  const [episodes, setEpisodes] = useState<Episode[]>(fallbackEpisodes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activePlayerTarget, setActivePlayerTarget] = useState<{ section: 'hero' | 'featured' | 'archive'; index: number } | null>(null);
  const [visibleArchiveCount, setVisibleArchiveCount] = useState(INITIAL_ARCHIVE_COUNT);

  useEffect(() => {
    let cancelled = false;

    async function fetchPodcastFeed() {
      try {
        const response = await fetch(RSS_URL);
        const text = await response.text();
        const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

        if (!items.length) {
          throw new Error('No podcast items found.');
        }

        const parsed = items.map((match) => {
          const block = match[1];
          const title = stripTags(parseTag(block, 'title'));
          const description = stripTags(parseTag(block, 'description'));
          const audioUrl = parseAttr(block, 'enclosure', 'url');
          const rawDate = stripTags(parseTag(block, 'pubDate'));
          const pubDate = rawDate ? new Date(rawDate).toLocaleDateString() : 'Latest Release';
          const duration = stripTags(parseTag(block, 'itunes:duration')) || '--:--';
          const image = parseAttr(block, 'itunes:image', 'href') || parseAttr(block, 'image', 'href') || FALLBACK_IMAGE;

          return {
            title: title || 'Untitled Episode',
            description: description || 'No description available.',
            audioUrl: audioUrl || '#',
            pubDate,
            duration,
            image,
          } satisfies Episode;
        });

        if (!cancelled) {
          setEpisodes(parsed);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setEpisodes(fallbackEpisodes);
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchPodcastFeed();

    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(() => episodes[0] ?? fallbackEpisodes[0], [episodes]);
  const archive = useMemo(() => episodes.slice(1), [episodes]);
  const visibleArchive = useMemo(() => archive.slice(0, visibleArchiveCount), [archive, visibleArchiveCount]);

  useEffect(() => {
    setVisibleArchiveCount(Math.min(INITIAL_ARCHIVE_COUNT, Math.max(0, archive.length)));
  }, [archive.length]);

  function openInlinePlayer(section: 'hero' | 'featured' | 'archive', index: number) {
    const episode = episodes[index] ?? fallbackEpisodes[index];
    if (!episode || !episode.audioUrl || episode.audioUrl === '#') return;
    setActivePlayerTarget({ section, index });
  }

  function renderInlinePlayer(episode: Episode, target: { section: 'hero' | 'featured' | 'archive'; index: number }) {
    if (!activePlayerTarget || activePlayerTarget.section !== target.section || activePlayerTarget.index !== target.index) return null;
    const nextEpisode = episodes[target.index + 1] ?? null;

    return (
      <div className="mt-6 max-w-2xl border border-[#464848]/20 bg-[#0d0f0f]/70 p-4">
        <div className="mb-3 flex items-center gap-3">
          <img alt={episode.title} className="h-14 w-14 object-cover" src={episode.image} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#bdfc00]">Now Playing</p>
            <p className="text-sm font-semibold text-[#f4f3f3]">{episode.title}</p>
          </div>
        </div>
        <audio
          autoPlay
          controls
          className="w-full"
          onEnded={() => {
            if (target.section !== 'archive') {
              setActivePlayerTarget(null);
              return;
            }

            if (nextEpisode?.audioUrl && nextEpisode.audioUrl !== '#') {
              setActivePlayerTarget({ section: 'archive', index: target.index + 1 });
            } else {
              setActivePlayerTarget(null);
            }
          }}
          playsInline
          src={episode.audioUrl}
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return (
    <AutoknerdShell active="podcast">
      <header className="grid-bg relative flex min-h-[819px] flex-col justify-center border-b border-[#464848]/10 px-8 pb-20 pt-32">
        <div className="relative z-10 mx-auto w-full max-w-screen-xl">
          <div className="mb-6 inline-flex items-center space-x-2 border-l-2 border-[#bdfc00] bg-[#232626] px-3 py-1">
            <span className="material-symbols-outlined text-sm text-[#bdfc00]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
              sensors
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#aaabab]">Live Broadcast Feed</span>
          </div>
          <h1 className="mb-8 max-w-4xl text-6xl font-black uppercase leading-[0.9] tracking-tighter md:text-8xl">
            The <span className="text-[#bdfc00]">AutoKnerd</span>
            <br />
            Podcast
          </h1>
          <p className="max-w-2xl text-xl font-light leading-relaxed text-[#aaabab] md:text-2xl">
            Real dealership behavior. Real customer experience. <span className="font-medium text-[#f4f3f3] underline decoration-[#bdfc00]/40 underline-offset-4">No fluff.</span>
          </p>
          <p className="mt-8 mb-12 max-w-xl border-l border-[#bdfc00]/30 pl-4 text-lg font-light italic text-[#aaabab]/80">
            If your team sounds different from one customer to the next, start here.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
              <button
                className="flex items-center justify-center gap-3 bg-[#bdfc00] px-10 py-5 text-sm font-black uppercase tracking-tighter text-[#445d00] transition-all hover:shadow-[0px_0px_20px_rgba(189,252,0,0.3)]"
                onClick={() => {
                  openInlinePlayer('hero', 0);
                }}
                type="button"
              >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                play_arrow
              </span>
              Listen to Latest Episode
            </button>
              <Link href="/autoshop" className="border border-[#464848]/30 px-10 py-5 text-center text-sm font-black uppercase tracking-tighter text-[#f4f3f3] transition-all hover:bg-[#1d2020]">
              Get This Week&apos;s Tool
            </Link>
          </div>
          {renderInlinePlayer(featured, { section: 'hero', index: 0 })}
        </div>
        <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 opacity-20 lg:block">
          <div className="flex h-[600px] w-[600px] items-center justify-center rounded-full border border-[#bdfc00]/30">
            <div className="flex h-[450px] w-[450px] items-center justify-center rounded-full border border-[#bdfc00]/20">
              <div className="h-[300px] w-[300px] rounded-full border border-[#bdfc00]/10" />
            </div>
          </div>
        </div>
      </header>

      <section className="overflow-hidden bg-[#121414] px-8 py-24">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-col items-start gap-16 lg:flex-row">
            <div className="lg:w-1/3">
              <h2 className="mb-6 text-4xl font-bold uppercase leading-none tracking-tighter md:text-5xl">
                This isn&apos;t content.
                <br />
                <span className="text-[#aaabab]/50">It&apos;s execution.</span>
              </h2>
              <div className="h-1 w-20 bg-[#bdfc00]" />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:w-2/3">
              {[
                ['01', 'Behavior Change', 'Replace outdated habits with modern performance standards.'],
                ['02', 'CX Strategy', 'Kill friction points in the modern car buying journey.'],
                ['03', 'Practical Tools', 'Concrete tactical resources deployed instantly.'],
                ['04', 'Coaching', 'Align management and sales through data-driven metrics.'],
              ].map(([number, title, copy]) => (
                <div key={number} className="border border-[#464848]/10 bg-[#0d0f0f]/40 p-8">
                  <span className="mb-4 block text-2xl font-black text-[#bdfc00]">{number}</span>
                  <h3 className="mb-2 text-lg font-bold uppercase tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-[#aaabab]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 py-24" id="featured-section">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-[#bdfc00]">Current Focus</h4>
              <h2 className="text-4xl font-black uppercase tracking-tighter">Featured Episode</h2>
            </div>
          </div>
          <div className="glass-card border border-[#464848]/20 p-1 md:p-2">
            {loading ? (
              <div className="flex animate-pulse flex-col lg:flex-row">
                <div className="aspect-square bg-[#232626] lg:h-auto lg:w-2/5" />
                <div className="space-y-4 p-8 md:p-12 lg:w-3/5">
                  <div className="h-4 w-24 bg-[#232626]" />
                  <div className="h-10 w-3/4 bg-[#232626]" />
                  <div className="h-20 w-full bg-[#232626]" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row">
                <div className="aspect-square h-96 overflow-hidden lg:h-auto lg:w-2/5 lg:aspect-auto">
                  <img alt={featured.title} className="h-full w-full object-cover" src={featured.image} />
                </div>
                <div className="flex flex-col justify-center p-8 md:p-12 lg:w-3/5">
                  <div className="mb-6 flex items-center gap-4">
                    <span className="bg-[#bdfc00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-[#445d00]">Latest Release</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-[#aaabab]">Date: {featured.pubDate}</span>
                  </div>
                  <h3 className="mb-4 text-3xl font-bold uppercase leading-tight tracking-tighter md:text-4xl">{featured.title}</h3>
                  <p className="mb-10 max-w-xl text-lg font-light text-[#aaabab]">{featured.description}</p>
                  <div className="flex flex-wrap gap-4">
                    <button
                      className="flex items-center gap-3 bg-[#f4f3f3] px-8 py-4 text-sm font-black uppercase tracking-tighter text-[#0d0f0f] transition-colors hover:bg-[#bdfc00]"
                      onClick={() => {
                        openInlinePlayer('featured', 0);
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                        play_circle
                      </span>
                      Play Episode
                    </button>
                    <Link href="/autoshop" className="border border-[#464848] px-8 py-4 text-sm font-black uppercase tracking-tighter text-[#f4f3f3] transition-colors hover:border-[#bdfc00]">
                      Get the tool from this episode
                    </Link>
                  </div>
                  {renderInlinePlayer(featured, { section: 'featured', index: 0 })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-8 py-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-col items-center justify-between gap-8 bg-[#2a2d2d] p-8 md:flex-row md:p-12">
            <div className="max-w-2xl">
              <h2 className="mb-2 text-3xl font-bold uppercase tracking-tighter">Pick a problem. Fix it this week.</h2>
              <p className="text-[#aaabab]">
                Download the <strong>&quot;CRM Leak Auditor&quot;</strong> template mentioned in the latest show. Stop the bleeding in under 15 minutes of auditing.
              </p>
            </div>
            <Link href="/autoshop" className="flex w-full shrink-0 items-center justify-center gap-3 bg-[#bdfc00] px-10 py-5 text-sm font-black uppercase tracking-tighter text-[#445d00] md:w-auto">
              <span className="material-symbols-outlined">download</span>
              Download Tool
            </Link>
          </div>
        </div>
      </section>

      <section className="px-8 py-24">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-12">
            <h2 className="text-4xl font-black uppercase tracking-tighter">Transmission Archive</h2>
            <p className="mt-2 text-[#aaabab]">Every episode includes a practical tool.</p>
          </div>
          <div className="flex flex-col gap-2">
            {loading ? (
              <>
                <div className="loading-shimmer h-24 w-full" />
                <div className="loading-shimmer h-24 w-full opacity-50" />
                <div className="loading-shimmer h-24 w-full opacity-25" />
              </>
            ) : error ? (
              <div className="border border-[#ff7351]/20 bg-[#b92902]/5 p-12 text-center italic text-[#aaabab]">
                Failed to sync with broadcast signal. Showing cached intelligence instead.
              </div>
            ) : null}
            {!loading &&
              visibleArchive.map((episode, index) => {
                const episodeIndex = index + 1;
                return (
                <div key={`${episode.title}-${index}`}>
                  <div className="group flex flex-col gap-6 border-b border-[#464848]/10 bg-[#181a1a] p-6 transition-colors hover:bg-[#1d2020] md:flex-row md:items-center">
                    <div className="flex min-w-[100px] items-center gap-4">
                    <button
                      className="flex h-12 w-12 items-center justify-center bg-[#232626] transition-colors group-hover:bg-[#bdfc00] group-hover:text-[#445d00]"
                      onClick={() => {
                          openInlinePlayer('archive', episodeIndex);
                      }}
                      type="button"
                    >
                        <span className="material-symbols-outlined">play_arrow</span>
                      </button>
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-lg font-bold uppercase tracking-tight">{episode.title}</h4>
                      <p className="mt-1 hidden text-xs font-light text-[#aaabab] md:block">
                        {episode.description.length > 100 ? `${episode.description.slice(0, 100)}...` : episode.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-xs text-[#aaabab]/60">{episode.duration}</span>
                      <Link className="whitespace-nowrap border-b border-[#bdfc00]/20 pb-1 text-xs font-bold uppercase tracking-widest text-[#bdfc00] transition-all hover:border-[#bdfc00]" href="/autoshop">
                        Get Tool
                      </Link>
                    </div>
                  </div>
                  {renderInlinePlayer(episode, { section: 'archive', index: episodeIndex })}
                </div>
              );
              })}
          </div>
          <div className="mt-12 text-center">
            {visibleArchiveCount < archive.length ? (
              <button
                className="mx-auto flex items-center gap-2 text-[#aaabab] transition-colors hover:text-[#bdfc00]"
                onClick={() => {
                  setVisibleArchiveCount((current) => Math.min(current + ARCHIVE_BATCH_SIZE, archive.length));
                }}
                type="button"
              >
                Load More Intelligence <span className="material-symbols-outlined">keyboard_double_arrow_down</span>
              </button>
            ) : (
              <p className="text-sm text-[#aaabab]/70">You&apos;re caught up.</p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-black px-8 py-24">
        <div className="mx-auto max-w-screen-xl">
          <h2 className="mb-12 text-center text-3xl font-bold uppercase tracking-tighter md:text-4xl">Turn what you learn into performance</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              ['inventory_2', 'Performance Tooling', 'AutoShop', 'The tactical arm of the system. Access every calculator, script, and sheet mentioned in our episodes.', 'Apply it this week', '/autoshop', 'Launch AutoShop'],
              ['hub', 'Core Platform', 'AutoDriveCX', 'A unified platform for monitoring behavior change and customer experience metrics in real-time.', 'Train your team', '/login', 'Explore Platform'],
              ['precision_manufacturing', 'Diagnostics', 'AutoForge', 'Custom dealership performance architecture. We forge high-efficiency sales teams from the ground up.', 'Fix it across the dealership', '/autoforge', 'Start Diagnostic'],
            ].map(([icon, eyebrow, title, copy, kicker, href, cta]) => (
              <div key={title} className="group flex flex-col gap-6 border border-[#464848]/20 bg-[#0d0f0f] p-8 transition-all duration-500 hover:border-[#bdfc00]">
                <div className="flex items-start justify-between">
                  <span className="material-symbols-outlined text-4xl text-[#bdfc00]">{icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#aaabab]/50">{eyebrow}</span>
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-bold uppercase">{title}</h3>
                  <p className="mb-4 text-sm font-light leading-relaxed text-[#aaabab]">{copy}</p>
                  <p className="text-xs font-bold uppercase tracking-tighter text-[#bdfc00]">{kicker}</p>
                </div>
                <Link className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-tighter transition-colors group-hover:text-[#bdfc00]" href={href}>
                  {cta} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-bg relative overflow-hidden px-8 py-32">
        <div className="relative z-10 mx-auto max-w-screen-xl text-center">
          <h2 className="mx-auto mb-8 max-w-4xl text-5xl font-black uppercase leading-none tracking-tighter md:text-7xl">
            Listening is step one.
            <br />
            <span className="text-[#bdfc00]">Execution is what changes results.</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-sm text-[#aaabab]/70">Execution is the only differentiator. Choose your pathway to performance.</p>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
            <Link href="/autoshop" className="bg-[#f4f3f3] py-6 text-center text-sm font-black uppercase tracking-tighter text-[#0d0f0f] transition-transform hover:scale-[1.02] active:scale-[0.98]">
              Get This Week&apos;s Tool
            </Link>
            <Link href="/signup" className="bg-[#bdfc00] py-6 text-center text-sm font-black uppercase tracking-tighter text-[#445d00] transition-transform hover:scale-[1.02] active:scale-[0.98]">
              Ready to Level Up?
            </Link>
            <Link href="/autoforge" className="border border-[#464848] py-6 text-center text-sm font-black uppercase tracking-tighter text-[#f4f3f3] transition-transform hover:scale-[1.02] hover:bg-[#1d2020] active:scale-[0.98]">
              Book AutoForge Diagnostic
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-5">
          <span className="text-[20rem] font-black uppercase tracking-tighter">PERFORM</span>
        </div>
      </section>

      <AutoknerdFooter />
    </AutoknerdShell>
  );
}
