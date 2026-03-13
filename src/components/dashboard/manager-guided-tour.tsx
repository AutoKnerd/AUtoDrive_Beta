'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ASSISTANT_AVATAR_SRC, ASSISTANT_NAME } from '@/lib/assistant';

type TourStep = {
  selector?: string;
  message: string;
};

const tourSteps: TourStep[] = [
  {
    message: `Welcome to the manager dashboard tour.

This guided view is built to feel like the live AutoDrive manager experience, so you can explore how team reporting, coaching, and lesson management work together.`,
  },
  {
    selector: '[data-manager-tour="dealer-focus"]',
    message: `This Dealer Focus area surfaces the coaching view for the current store.

In tour mode, the reporting here now follows the same Team Activity signals used in the live manager dashboard.`,
  },
  {
    selector: '[data-manager-tour="team-stats"]',
    message: `This is your team snapshot.

Use it to scan total lessons, total XP, your strongest team trait, and the area that needs the most attention.`,
  },
  {
    selector: '[data-manager-tour="team-activity"]',
    message: `This Team Activity report mirrors the live manager table.

You can review leaderboard rank, recommended-lesson status, last active date, top skill, and watch area for each teammate.`,
  },
  {
    selector: '[data-manager-tour="team-actions"]',
    message: `These controls are where managers take action.

From here you can manage the team, message people, review created lessons, and launch new training.`,
  },
  {
    message: `That is the quick manager tour.

Switch roles from the Tour Control Panel any time, or stay here and explore the reporting in more detail.`,
  },
];

interface ManagerGuidedTourProps {
  open: boolean;
  stepIndex: number;
  onStepChange: (stepIndex: number) => void;
  onSkip: () => void;
  onFinish: () => void;
}

type RectState = { top: number; left: number; width: number; height: number };
type PanelSize = { width: number; height: number };

export function ManagerGuidedTour({
  open,
  stepIndex,
  onStepChange,
  onSkip,
  onFinish,
}: ManagerGuidedTourProps) {
  const [highlightRect, setHighlightRect] = useState<RectState | null>(null);
  const [panelSize, setPanelSize] = useState<PanelSize>({ width: 380, height: 280 });
  const [viewport, setViewport] = useState({ width: 1200, height: 900 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const step = tourSteps[Math.max(0, Math.min(stepIndex, tourSteps.length - 1))];
  const isFinalStep = stepIndex >= tourSteps.length - 1;
  const isMobile = viewport.width < 768;

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
      setViewport({ width: window.innerWidth, height: window.innerHeight });
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

  useEffect(() => {
    if (!open || !step.selector) return;
    const element = document.querySelector(step.selector);
    if (!element) return;

    if (isMobile) {
      const rect = element.getBoundingClientRect();
      const targetY = Math.max(0, window.scrollY + rect.top - 16);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
      return;
    }

    (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [open, step.selector, isMobile]);

  useEffect(() => {
    if (!open || !panelRef.current) return;

    const measure = () => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      setPanelSize({ width: rect.width, height: rect.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panelRef.current);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, stepIndex]);

  const panelPositionStyle = useMemo(() => {
    if (isMobile) {
      return {
        top: 'auto',
        left: 8,
        right: 8,
        bottom: 8,
      };
    }

    if (!highlightRect) {
      return {
        top: 'auto',
        right: 24,
        bottom: 24,
      };
    }

    const margin = 12;
    const maxLeft = Math.max(8, viewport.width - panelSize.width - 8);
    let left = Math.min(maxLeft, Math.max(8, highlightRect.left));

    let top = highlightRect.top + highlightRect.height + margin;
    const overflowsBottom = top + panelSize.height > viewport.height - 8;
    if (overflowsBottom) {
      top = Math.max(8, highlightRect.top - panelSize.height - margin);
    }

    return { top, left };
  }, [highlightRect, isMobile, panelSize.height, panelSize.width, viewport.height, viewport.width]);

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

      <div className="fixed z-[92] md:w-[min(92vw,440px)]" style={panelPositionStyle}>
        <div
          ref={panelRef}
          className="relative max-h-[48vh] overflow-auto rounded-2xl border border-[#8DC63F]/40 bg-zinc-950/95 p-4 text-white shadow-2xl md:max-h-none md:overflow-visible"
        >
          {!isMobile && highlightRect ? (
            <div className="absolute -top-2 right-10 h-4 w-4 rotate-45 border-l border-t border-[#8DC63F]/40 bg-zinc-950/95" />
          ) : null}

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
              <Button className="flex-1 bg-[#8DC63F] text-black hover:bg-[#7FB735]" onClick={onFinish}>
                Start Exploring
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
