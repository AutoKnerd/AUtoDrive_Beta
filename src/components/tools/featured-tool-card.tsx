'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolConfig } from '@/lib/tools/toolbox';

type FeaturedToolCardProps = {
  tool: ToolConfig;
  ctaLabel: string;
  onPrimaryAction: () => void;
};

export function FeaturedToolCard({ tool, ctaLabel, onPrimaryAction }: FeaturedToolCardProps) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border border-[#2A2A38] bg-[#12121A] shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition-all duration-500 hover:border-[#7B2EFF]/50 hover:shadow-[0_20px_40px_rgba(123,46,255,0.14)]">
      {/* Light Reflection Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
      
      {/* Background accents */}
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#7B2EFF]/14 blur-[100px] pointer-events-none transition-all duration-700 group-hover:bg-[#7B2EFF]/20 group-hover:scale-110" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#7B2EFF]/10 blur-[90px] pointer-events-none" />
      
      <div className="relative z-10 p-6 md:p-10 lg:p-14">
        <CardHeader className="space-y-5 pb-0 md:space-y-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#7B2EFF]/30 bg-[#7B2EFF]/12 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#7B2EFF] shadow-sm backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            This Week&apos;s Featured Tool
          </div>
          <CardTitle className="font-['Manrope'] text-4xl font-extrabold tracking-tighter text-[#FFFFFF] md:text-5xl lg:text-6xl">
            {tool.name}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-8 pt-6">
          <p className="max-w-2xl font-['Inter'] text-lg leading-relaxed text-[#B8B8C5] md:text-xl">
            {tool.description}
          </p>
          <button 
            className="flex h-14 w-fit items-center justify-center rounded-md bg-[#9DEE75] px-10 text-sm font-bold uppercase tracking-widest text-[#000000] shadow-[0_4px_20px_rgba(91,255,58,0.15)] transition-all duration-200 hover:scale-[1.02] hover:bg-[#ABF28A] hover:shadow-[0_8px_24px_rgba(91,255,58,0.2)] active:scale-95"
            onClick={onPrimaryAction}
          >
            {ctaLabel}
          </button>
        </CardContent>
      </div>
    </Card>
  );
}
