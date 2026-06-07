'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PresentationDeckSummary } from '@/lib/presentation-engine';

type PresentationLibraryClientProps = {
  decks: PresentationDeckSummary[];
};

export function PresentationLibraryClient({ decks }: PresentationLibraryClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deckToDelete, setDeckToDelete] = useState<PresentationDeckSummary | null>(null);
  const [deleteBusyDeckId, setDeleteBusyDeckId] = useState<string | null>(null);

  async function handleDeleteDeck() {
    if (!deckToDelete) return;

    setDeleteBusyDeckId(deckToDelete.deckId);

    try {
      const response = await fetch(`/api/presentations/${encodeURIComponent(deckToDelete.deckId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json() as { error?: string; title?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to delete deck.');
      }

      toast({
        title: 'Deck deleted',
        description: `${payload.title || deckToDelete.title} was removed from the library.`,
      });
      setDeckToDelete(null);
      router.refresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unable to delete deck.',
      });
    } finally {
      setDeleteBusyDeckId(null);
    }
  }

  return (
    <>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck) => {
          const isDeleting = deleteBusyDeckId === deck.deckId;

          return (
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
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  onClick={() => router.push(`/developer?section=presentations&deck=${encodeURIComponent(deck.deckId)}`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  disabled={Boolean(deleteBusyDeckId)}
                  onClick={() => setDeckToDelete(deck)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeleting ? 'Deleting...' : 'Delete Deck'}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <AlertDialog open={!!deckToDelete} onOpenChange={(open) => !open && setDeckToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deck?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{deckToDelete?.title || 'this deck'}</span> and its local presentation files from `/Presentations`.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deleteBusyDeckId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={Boolean(deleteBusyDeckId)}
              onClick={handleDeleteDeck}
            >
              {deleteBusyDeckId ? 'Deleting...' : 'Delete Deck'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
