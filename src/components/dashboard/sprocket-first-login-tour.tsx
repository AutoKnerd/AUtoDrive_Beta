'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ASSISTANT_AVATAR_SRC, ASSISTANT_NAME } from '@/lib/assistant';
import { Button } from '@/components/ui/button';

type TourStep = {
  selector?: string;
  message: string;
};

const tourSteps: TourStep[] = [
  {
    message: `Hey there! I'm Sprocket ⚙️
Looks like you just finished your baseline assessment.

Nice work. That gives AutoDrive a starting point for your CX skills.

Let me show you how this dashboard works.`,
  },
  {
    selector: '[data-sprocket-tour="level-xp"]',
    message: `This is your Level and XP.

Every lesson you complete earns XP.

Better conversations with customers increase your level and improve your CX scores.`,
  },
  {
    selector: '[data-sprocket-tour="cx-scores"]',
    message: `These are your CX skill meters.

Your baseline assessment set your starting scores.

As you complete lessons and practice scenarios, these scores improve.`,
  },
  {
    selector: '[data-sprocket-tour="recommended-lesson"]',
    message: `This is your daily lesson.

AutoDrive looks at your lowest CX skills and recommends a lesson to improve them.

Most lessons take less than 3 minutes.`,
  },
  {
    selector: '[data-sprocket-tour="badges"]',
    message: `Badges track important milestones in your learning journey.

They represent real skill development, not just activity.`,
  },
  {
    message: `That's it for the quick tour.

Run your next lesson to start improving your CX skills and earning XP.

I'll be around if you need help.

— Sprocket ⚙️`,
  },
];

interface SprocketFirstLoginTourProps {
  open: boolean;
  stepIndex: number;
  onStepChange: (stepIndex: number) => void;
  onSkip: () => void;
  onFinish: () => void;
  onStartLesson: () => void;
}

type RectState = { top: number; left: number; width: number; height: number };

export function SprocketFirstLoginTour({
  open,
  stepIndex,
  onStepChange,
  onSkip,
  onFinish,
  onStartLesson,
}: SprocketFirstLoginTourProps) {
  const [highlightRect, setHighlightRect] = useState<RectState | null>(null);
  const step = tourSteps[Math.max(0, Math.min(stepIndex, tourSteps.length - 1))];
  const isFinalStep = stepIndex >= tourSteps.length - 1;

  const stepLabel = useMemo(
    () => `Step ${Math.min(stepIndex + 1, tourSteps.length)} of ${tourSteps.length}`,
    [stepIndex]
  );

  useEffect(() => {
    if (!open) {
      setHighlightRect(null);
      return;
    }

    const updateRect = () => {
      if (!step.selector) {
        setHighlightRect(null);
        return;
      }
      const element = document.querySelector(step.selector);
      if (!element) {
        setHighlightRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      setHighlightRect({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, step.selector]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/60" />

      {highlightRect ? (
        <div
          className="pointer-events-none fixed z-[91] rounded-xl border-2 border-[#8DC63F] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      ) : null}

      <div className="fixed bottom-6 right-6 z-[92] w-[min(92vw,420px)]">
        <div className="relative rounded-2xl border border-[#8DC63F]/40 bg-zinc-950/95 p-4 text-white shadow-2xl">
          <div className="absolute -top-2 right-10 h-4 w-4 rotate-45 border-l border-t border-[#8DC63F]/40 bg-zinc-950/95" />

          <div className="mb-3 flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full border border-[#8DC63F]/40 bg-zinc-900">
              <Image src={ASSISTANT_AVATAR_SRC} alt={ASSISTANT_NAME} width={40} height={40} />
            </div>
            <div>
              <p className="text-sm font-semibold">{ASSISTANT_NAME}</p>
              <p className="text-xs text-zinc-300">{stepLabel}</p>
            </div>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-100">{step.message}</p>

          {isFinalStep ? (
            <div className="mt-4 flex gap-2">
              <Button className="flex-1 bg-[#8DC63F] text-black hover:bg-[#7FB735]" onClick={onStartLesson}>
                Start Lesson
              </Button>
              <Button variant="outline" className="flex-1 border-zinc-600 text-zinc-100 hover:bg-zinc-800" onClick={onFinish}>
                Close
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <Button className="flex-1 bg-[#8DC63F] text-black hover:bg-[#7FB735]" onClick={() => onStepChange(stepIndex + 1)}>
                Next
              </Button>
              <Button variant="ghost" className="text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" onClick={onSkip}>
                Skip Tour
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
