import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { listPresentationDecks } from '@/lib/presentation-engine';

export default async function PresentationsIndexPage() {
  const decks = await listPresentationDecks();

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8eff71]">Presentation Engine</p>
          <h1 className="mt-5 text-5xl font-black tracking-[-0.05em] text-white sm:text-6xl">Deck Library</h1>
          <p className="mt-5 text-lg leading-8 text-white/66">
            Every folder in <code className="rounded bg-white/6 px-2 py-1 text-sm text-white/82">/Presentations</code> with a
            valid manifest becomes a launchable deck here.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <article
              key={deck.deckId}
              className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#8eff71]">{deck.deckId}</p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-white">{deck.title}</h2>
              <p className="mt-4 text-sm leading-6 text-white/56">
                {deck.description || 'Reusable presentation deck package with shared presenter controls.'}
              </p>
              <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/40">
                <span>{deck.slideCount} Slides</span>
                <span>{deck.audience?.enabled === false ? 'Audience Off' : 'Audience Ready'}</span>
                <span>{deck.companion?.enabled ? 'Companion Ready' : 'Companion Off'}</span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={deck.href}
                  className="inline-flex items-center rounded-full border border-[#8eff71]/28 bg-[#8eff71]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8eff71] transition hover:border-[#8eff71]/55 hover:bg-[#8eff71]/16"
                >
                  Open Deck
                </Link>
                <Link
                  href={`${deck.href}/index.html`}
                  className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/78 transition hover:border-white/24 hover:bg-white/6"
                >
                  View Index
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
