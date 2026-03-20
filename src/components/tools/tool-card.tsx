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
  Free: 'bg-[#3c4962]/30 text-[#abb9d6]',
  Recent: 'bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20',
  Premium: 'bg-[#27354c] text-[#e4e2e4]',
};

export function ToolCard({ tool, badgeLabel, ctaLabel, locked, onAction }: ToolCardProps) {
  return (
    <Card className={cn(
      'group relative flex h-full flex-col overflow-hidden transition-all duration-200 rounded-2xl border shadow-xl',
      locked 
        ? 'border-white/[0.04] bg-[#09172d]/50' 
        : 'border-white/5 bg-gradient-to-b from-[#112036] to-[#09172d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-1 hover:border-[#00f2ff]/30 hover:shadow-[0_15px_30px_-10px_rgba(0,242,255,0.15)]'
    )}>
      <div className={cn('flex flex-1 flex-col p-6', locked && 'opacity-40 blur-sm pointer-events-none transition-all')}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#27354c] text-[#00f2ff] shadow-inner shadow-white/5 border border-white/5">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className={cn('rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', badgeClassByLabel[badgeLabel])}>
            {badgeLabel}
          </span>
        </div>
        
        <div className="flex-1">
          <h3 className="font-['Manrope'] mb-3 line-clamp-2 text-xl font-bold tracking-tight text-[#e1fdff]">
            {tool.name}
          </h3>
          <p className="font-['Inter'] text-sm leading-relaxed text-[#b9cacb] line-clamp-3">
            {tool.description}
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5">
          <button 
            className="w-full rounded-lg bg-[#27354c]/50 border border-white/5 py-3.5 text-xs font-bold uppercase tracking-widest text-[#e1fdff] transition-all duration-200 hover:bg-[#00f2ff] hover:text-[#00363a] hover:border-transparent active:scale-[0.98]"
            onClick={onAction}
            tabIndex={locked ? -1 : 0}
          >
            {locked ? 'Locked' : ctaLabel}
          </button>
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl p-8 text-center transition-all duration-300" style={{ background: 'rgba(4, 19, 41, 0.4)', backdropFilter: 'blur(16px)' }}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#00f2ff]/10 border border-[#00f2ff]/20 shadow-[0_4px_20px_rgba(0,242,255,0.2)]">
            <Lock className="h-6 w-6 text-[#00f2ff]" />
          </div>
          <h4 className="font-['Manrope'] mb-2 text-lg font-bold tracking-tight text-[#e1fdff]">Premium System</h4>
          <p className="text-xs text-[#b9cacb] mb-6 max-w-[200px] leading-relaxed">Unlock to deploy this framework to your CX strategy.</p>
          <button onClick={onAction} className="w-full rounded-md bg-gradient-to-r from-[#00dbe7] to-[#00f2ff] px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-[#00363a] transition-all duration-200 hover:scale-[1.02] shadow-[0_4px_14px_rgba(0,242,255,0.2)] active:scale-95">
            Upgrade to unlock
          </button>
        </div>
      )}
    </Card>
  );
}
