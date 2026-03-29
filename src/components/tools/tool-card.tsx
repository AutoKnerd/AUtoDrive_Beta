'use client';

import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ToolConfig } from '@/lib/tools/toolbox';

type ToolCardProps = {
  tool: ToolConfig;
  badgeLabel: 'Free' | 'Recent' | 'Premium';
  ctaLabel: string;
  locked: boolean;
  onAction: () => void;
};

const badgeClassByLabel: Record<ToolCardProps['badgeLabel'], string> = {
  Free: 'bg-[#1a1a24] text-[#b8b8c5] border border-[#2A2A38]',
  Recent: 'bg-[#7B2EFF]/12 text-[#7B2EFF] border border-[#7B2EFF]/35',
  Premium: 'bg-[#1a1a24] text-[#FFFFFF] border border-[#2A2A38]',
};

export function ToolCard({ tool, badgeLabel, ctaLabel, locked, onAction }: ToolCardProps) {
  return (
    <Card className={cn(
      'group relative flex h-full flex-col overflow-hidden transition-all duration-200 rounded-xl border shadow-[0_8px_22px_rgba(0,0,0,0.2)]',
      locked 
        ? 'border-[#2A2A38] bg-[#12121A]' 
        : 'border-[#2A2A38] bg-[#12121A] hover:-translate-y-[2px] hover:border-[#7B2EFF]/50 hover:shadow-[0_10px_24px_rgba(123,46,255,0.12)]'
    )}>
      <div className={cn('flex flex-1 flex-col p-6', locked && 'opacity-40 blur-sm pointer-events-none transition-all')}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1A24] text-[#7B2EFF] shadow-inner shadow-black/30 border border-[#2A2A38]">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className={cn('rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', badgeClassByLabel[badgeLabel])}>
            {badgeLabel}
          </span>
        </div>
        
        <div className="flex-1">
          <h3 className="font-['Manrope'] mb-3 line-clamp-2 text-xl font-bold tracking-tight text-[#FFFFFF]">
            {tool.name}
          </h3>
          <p className="font-['Inter'] text-sm leading-relaxed text-[#B8B8C5] line-clamp-3">
            {tool.description}
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2A2A38]">
          <button 
            className="w-full rounded-lg bg-transparent border border-[#2A2A38] py-3.5 text-xs font-bold uppercase tracking-widest text-[#FFFFFF] transition-all duration-200 hover:border-[#7B2EFF] hover:bg-[#7B2EFF]/8 active:scale-[0.98]"
            onClick={onAction}
            tabIndex={locked ? -1 : 0}
          >
            {locked ? 'Locked' : ctaLabel}
          </button>
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl p-8 text-center transition-all duration-300" style={{ background: 'rgba(10, 10, 15, 0.6)', backdropFilter: 'blur(16px)' }}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#7B2EFF]/14 border border-[#7B2EFF]/28 shadow-[0_4px_20px_rgba(123,46,255,0.15)]">
            <Lock className="h-6 w-6 text-[#7B2EFF]" />
          </div>
          <h4 className="font-['Manrope'] mb-2 text-lg font-bold tracking-tight text-[#FFFFFF]">Premium System</h4>
          <p className="text-xs text-[#B8B8C5] mb-6 max-w-[200px] leading-relaxed">Unlock to deploy this framework to your CX strategy.</p>
          <button onClick={onAction} className="w-full rounded-md bg-[#9DEE75] px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-[#000000] transition-all duration-200 hover:bg-[#ABF28A] shadow-[0_4px_14px_rgba(91,255,58,0.15)] active:scale-95">
            Upgrade to unlock
          </button>
        </div>
      )}
    </Card>
  );
}
