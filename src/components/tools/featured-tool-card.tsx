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
    <Card className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#112036] to-[#041329] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-500 hover:shadow-[0_35px_60px_-15px_rgba(0,242,255,0.15)] hover:border-white/20">
      {/* Light Reflection Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
      
      {/* Background accents */}
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#00f2ff]/20 blur-[100px] pointer-events-none transition-all duration-700 group-hover:bg-[#00f2ff]/30 group-hover:scale-110" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#00dbe7]/15 blur-[90px] pointer-events-none" />
      
      <div className="relative z-10 p-6 md:p-10 lg:p-14">
        <CardHeader className="space-y-5 pb-0 md:space-y-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#00f2ff]/20 bg-[#00f2ff]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#00f2ff] shadow-sm backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            This Week's Drop
          </div>
          <CardTitle className="font-['Manrope'] text-4xl font-extrabold tracking-tighter text-[#e1fdff] md:text-5xl lg:text-6xl">
            {tool.name}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-8 pt-6">
          <p className="max-w-2xl font-['Inter'] text-lg leading-relaxed text-[#b9cacb] md:text-xl">
            {tool.description}
          </p>
          <button 
            className="flex h-14 w-fit items-center justify-center rounded-md bg-gradient-to-r from-[#00dbe7] to-[#00f2ff] px-10 text-sm font-bold uppercase tracking-widest text-[#00363a] shadow-[0_4px_20px_rgba(0,242,255,0.25)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,242,255,0.4)] active:scale-95"
            onClick={onPrimaryAction}
          >
            {ctaLabel}
          </button>
        </CardContent>
      </div>
    </Card>
  );
}
