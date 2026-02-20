'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getDefaultScope, mapUserRoleToCxRole, CxScope } from '@/lib/cx/scope';
import { CxSoundwaveCard } from '@/components/cx/CxSoundwaveCard';
import { Header } from '@/components/layout/header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { managerialRoles } from '@/lib/definitions';
import { Spinner } from '@/components/ui/spinner';
import { ChevronRight, BarChart3, Users, Store } from 'lucide-react';

export default function CxTrendsPage() {
  const { user, loading } = useAuth();
  const [drillScope, setDrillScope] = useState<CxScope | null>(null);

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }

  const baseScope = getDefaultScope(user);
  const activeScope = drillScope || baseScope;
  const cxRole = mapUserRoleToCxRole(user.role);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto p-4 md:p-8 space-y-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
              CX Velocity Hub
            </h1>
            <nav className="flex items-center gap-2 text-xs font-bold text-white/30 tracking-widest uppercase mt-1">
              <span>AutoDrive</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white/60">Trends</span>
              {drillScope && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-cyan-400">Drilldown</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {cxRole === 'owner' && (
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-white/40" />
                <Select onValueChange={(val) => setDrillScope(val === 'base' ? null : { ...baseScope, storeId: val })}>
                  <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-xs">
                    <SelectValue placeholder="All Stores" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="base">All Stores</SelectItem>
                    {user.dealershipIds?.map(id => (
                      <SelectItem key={id} value={id}>Store {id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {cxRole === 'manager' && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white/40" />
                <Select onValueChange={(val) => setDrillScope(val === 'base' ? null : { ...baseScope, userId: val })}>
                  <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-xs">
                    <SelectValue placeholder="Team Average" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="base">Team Average</SelectItem>
                    <SelectItem value="consultant-1">Consultant 1</SelectItem>
                    <SelectItem value="consultant-2">Consultant 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <CxSoundwaveCard scope={activeScope} className="h-[500px]" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">High Velocity Skill</p>
            <h3 className="text-2xl font-bold">Relationship</h3>
            <p className="text-sm text-white/40">Showing +12.4% growth in the last 30 days vs group baseline.</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">At-Risk Skill</p>
            <h3 className="text-2xl font-bold">Trust</h3>
            <p className="text-sm text-white/40">Dropped below store baseline by 4.2%. Recommend trust-based roleplay.</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Engagement</p>
            <h3 className="text-2xl font-bold">84%</h3>
            <p className="text-sm text-white/40">Team interaction frequency is up 15% this week.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
