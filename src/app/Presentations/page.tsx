import { listPresentationDecks } from '@/lib/presentation-engine';
import { PresentationLibraryClient } from './presentation-library-client';

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

        <PresentationLibraryClient decks={decks} />
      </div>
    </main>
  );
}
