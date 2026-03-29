'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Check } from 'lucide-react';
import type { UserRole } from '@/lib/definitions';

interface UnlockSectionProps {
  onUnlock: (data: { email: string; role: UserRole }) => void;
  onDismiss: () => void;
}

export function OnboardingSection({ onUnlock, onDismiss }: UnlockSectionProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !role) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    onUnlock({ email, role: role as UserRole });
    setIsSubmitting(false);
  };

  return (
    <section className="relative flex min-h-[85vh] w-full flex-col items-center justify-center overflow-hidden bg-[#05080C] px-4 py-20 pb-16 transition-all duration-700">
      
      {/* Precision Grid Background */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
          backgroundSize: '24px 24px' 
        }} 
      />

      {/* Atmospheric Central Lighting Engine */}
      <div 
        className="pointer-events-none absolute left-1/2 top-[20%] z-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7B2EFF]/20 blur-[150px] md:h-[800px] md:w-[1000px] opacity-70" 
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1000px] flex-col items-center text-center">
        
        {/* 1. Status Eyebrow */}
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#1C2533] bg-[#0A0E14]/80 px-4 py-2 shadow-sm backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full border border-[#5BFF3A]/30 bg-[#5BFF3A] shadow-[0_0_12px_#5BFF3A]"></span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A0AABF]">
            Built for Sales • Service • Management
          </span>
        </div>
        
        {/* 2. The Monolithic Masthead */}
        <h1 className="max-w-[850px] bg-clip-text text-transparent bg-gradient-to-b from-[#FFFFFF] to-[#8B9DBA] text-5xl font-black tracking-tight leading-[1.05] sm:text-6xl md:text-[80px]">
          Stop Winging It.<br />Start Winning It.
        </h1>
        
        <p className="mx-auto mt-8 max-w-[720px] text-lg font-medium leading-relaxed text-[#6C7E96] md:text-xl md:leading-relaxed">
          AutoShopCX gives you a tool for every moment — so you always know what to say, what to do, and how to move the deal forward.
        </p>

        {/* 3. The Command Bar (Email Capture Engine) */}
        <div className="mx-auto mt-14 w-full max-w-[840px] px-2 md:px-0">
          
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-4 gap-2 sm:gap-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#7B2EFF] text-center sm:text-left">
              🔒 System Locked
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#4B5E77] text-center sm:text-right">
              Enter credentials for instant access
            </span>
          </div>

          {/* The High-End Input Module */}
          <form 
            onSubmit={handleSubmit} 
            className="flex flex-col md:flex-row items-center gap-2 rounded-[16px] md:rounded-full border border-[#1C2533] bg-[#0A0E14]/80 p-2 shadow-[0_30px_80px_rgba(0,0,0,0.8)] backdrop-blur-xl relative overflow-hidden"
          >
            {/* Soft inner glow line at the top of the command bar */}
            <div className="absolute inset-x-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-[#FFFFFF]/10 to-transparent" />

            {/* Email Input */}
            <div className="flex h-16 md:h-14 w-full md:flex-1 items-center px-4 relative">
              <Input 
                type="email" 
                placeholder="Work Email..."
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-full w-full border-none bg-transparent text-center md:text-left text-[16px] md:text-[18px] text-[#FFFFFF] shadow-none placeholder:text-[#4B5E77] focus-visible:ring-0 disabled:opacity-50"
              />
            </div>

            {/* Structural Divider (Desktop) */}
            <div className="hidden h-8 w-[1px] bg-[#2A3B52]/50 md:block"></div>
            {/* Structural Divider (Mobile) */}
            <div className="block h-[1px] w-[90%] bg-[#2A3B52]/30 md:hidden"></div>

            {/* Role Selector */}
            <div className="flex h-16 md:h-14 w-full md:w-[260px] shrink-0 items-center justify-center md:px-2 relative">
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger className="h-full w-full border-none bg-transparent text-center md:text-left text-[15px] md:text-[16px] text-[#A0AABF] shadow-none placeholder:text-[#4B5E77] focus-visible:ring-0 focus:ring-0 md:pl-6 focus:bg-transparent">
                  <SelectValue placeholder="Select Your Role..." />
                </SelectTrigger>
                <SelectContent className="border-[#1C2533] bg-[#0A0E14] text-[#FFFFFF]">
                  <SelectItem className="cursor-pointer hover:bg-[#1C2533] py-3 md:py-2" value="Sales Consultant">Sales Consultant</SelectItem>
                  <SelectItem className="cursor-pointer hover:bg-[#1C2533] py-3 md:py-2" value="Service Writer">Service Advisor</SelectItem>
                  <SelectItem className="cursor-pointer hover:bg-[#1C2533] py-3 md:py-2" value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Trigger */}
            <Button 
              type="submit"
              disabled={isSubmitting || !email || !role}
              className="group relative h-16 md:h-14 w-full md:w-[220px] overflow-hidden rounded-[12px] md:rounded-full border border-transparent bg-[#5BFF3A] px-2 text-[14px] font-black uppercase tracking-[0.1em] text-[#05080C] transition-all duration-300 hover:bg-[#6CFF4D] hover:shadow-[0_0_30px_rgba(91,255,58,0.3)] disabled:opacity-50"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting ? 'INITIALIZING...' : 'UNLOCK SYSTEM'}
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </Button>
          </form>
          
          <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-[#4B5E77]">
            Instant access. No training required.
          </p>
        </div>
      </div>

      {/* 4. The Value Matrix (Below The Command Bar) */}
      <div className="relative z-10 mt-20 flex w-full max-w-[1000px] flex-col items-center">
        
        {/* Horizontal Value Strip */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 w-full border-t border-[#1C2533] pt-12 md:pt-16 mb-12">
          
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center p-1 text-[#5BFF3A]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[15px] font-bold text-[#E2E8F0]">More deals.</span>
          </div>

          <div className="hidden h-1 w-1 rounded-full bg-[#2A3B52] md:block" />

          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center p-1 text-[#5BFF3A]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[15px] font-bold text-[#E2E8F0]">Better CSI.</span>
          </div>

          <div className="hidden h-1 w-1 rounded-full bg-[#2A3B52] md:block" />

          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center justify-center p-1 text-[#5BFF3A]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <span className="text-[15px] font-bold text-[#E2E8F0]">More money in your pocket.</span>
          </div>
        </div>

        {/* Feature Summary */}
        <div className="flex max-w-[800px] flex-col items-center text-center px-4">
          <div className="mb-4 inline-flex items-center border border-[#7B2EFF]/30 bg-[#7B2EFF]/10 px-4 py-1.5 rounded-[4px]">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#00F0FF]">
              40+ Tools • Real Situations • Instant Direction
            </span>
          </div>
          <p className="text-xl md:text-3xl font-semibold leading-snug tracking-tight text-[#FFFFFF]">
            From objections to numbers to follow-up, there&apos;s a tool built for exactly what&apos;s happening in front of you.
          </p>
        </div>

      </div>
    </section>
  );
}
