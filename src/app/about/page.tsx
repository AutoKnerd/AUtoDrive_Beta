
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  MessageSquare, 
  ShieldCheck, 
  TrendingUp, 
  Award, 
  Brain, 
  Target, 
  LayoutDashboard, 
  UserCircle, 
  BarChart3, 
  CheckCircle2, 
  LineChart,
  User,
  Shield,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export default function AboutPage() {
  const [isTouring, setIsTouring] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleStartTour = async (role: 'consultant' | 'manager') => {
    setIsTouring(true);
    const email = role === 'consultant' ? 'consultant.demo@autodrive.com' : 'manager.demo@autodrive.com';
    const roleName = role === 'consultant' ? 'Sales Consultant' : 'Sales Manager';
    try {
      await login(email, 'readyplayer1');
      toast({
        title: 'Tour Started!',
        description: `You're now viewing as a ${roleName}.`,
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Tour Failed',
        description: (error as Error).message || 'Could not start the tour. Please try again.',
      });
      setIsTouring(false);
    }
  };

  const TourDialog = ({ children }: { children: React.ReactNode }) => (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] border-white/10 bg-[#121111] text-slate-100 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 bg-gradient-to-br from-[#121111] to-[#0f2223]">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight">Select Your Perspective</DialogTitle>
            <DialogDescription className="text-slate-400 text-base">
              Start as a Sales Consultant, or preview the optional Manager view.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4">
            <Button 
              variant="outline" 
              className="group h-auto p-6 flex items-start gap-4 border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#00f2ff]/50 transition-all text-left whitespace-normal h-full backdrop-blur-md"
              onClick={() => handleStartTour('consultant')}
              disabled={isTouring}
            >
              <div className="mt-1 p-2 rounded-lg bg-[#00f2ff]/10 text-[#00f2ff] group-hover:bg-[#00f2ff] group-hover:text-[#121111] transition-colors">
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-100 mb-1">Sales Consultant</h3>
                <p className="text-sm text-slate-400">Master every customer interaction. Learn how to handle tough objections and build confidence.</p>
                <div className="flex items-center text-sm text-[#00f2ff] font-semibold mt-3">
                  Launch My Sales Tour <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="group h-auto p-6 flex items-start gap-4 border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#00f2ff]/50 transition-all text-left whitespace-normal h-full backdrop-blur-md"
              onClick={() => handleStartTour('manager')}
              disabled={isTouring}
            >
              <div className="mt-1 p-2 rounded-lg bg-[#00f2ff]/10 text-[#00f2ff] group-hover:bg-[#00f2ff] group-hover:text-[#121111] transition-colors">
                <Shield className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-slate-100 mb-1">Manager View (Optional)</h3>
                <p className="text-sm text-slate-400">Gain high-level observability. See how to coach with data-driven precision across your entire operation.</p>
                <div className="flex items-center text-sm text-[#00f2ff] font-semibold mt-3">
                  Launch My Sales Tour <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </div>
            </Button>
          </div>
          <div className="mt-5 pt-5 border-t border-white/10">
            <Button asChild variant="outline" className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#121111] text-slate-100 selection:bg-[#00f2ff] selection:text-[#121111] font-sans">
      {/* We keep the standard Header, but add styling in the main content to match the design */}
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden px-6 pb-24 pt-12">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center w-full">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00f2ff]/30 bg-[#00f2ff]/10 text-[#00f2ff] text-xs font-bold uppercase tracking-widest mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f2ff] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f2ff]"></span>
                </span>
                Built for Sales Consultants first
              </div>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tighter mb-8 text-white">
                Performance is <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#3488ba]">
                  Not an Accident.
                </span>
              </h1>
              <p className="text-slate-400 text-lg md:text-xl max-w-lg mb-10 leading-relaxed font-medium">
                Train the same skills that drive your paycheck. Practice real conversations, sharpen your close, and create customer experiences people remember.
              </p>
              <div className="flex flex-wrap gap-4 items-center">
                <TourDialog>
                  <Button className="bg-[#00f2ff] hover:bg-[#00f2ff]/80 text-[#121111] px-8 py-7 rounded-xl font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all hover:scale-105" disabled={isTouring}>
                    {isTouring ? <Spinner className="text-[#121111]" /> : 'See How It Works'}
                  </Button>
                </TourDialog>
                <Button asChild variant="outline" className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md text-white px-8 py-7 rounded-xl font-black text-lg uppercase tracking-wider border border-[#00f2ff]/35 hover:from-[#00f2ff]/20 hover:to-[#3488ba]/20 hover:text-white transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            </div>

            <div className="relative mt-12 lg:mt-0">
              {/* Complex Glowing Abstract UI */}
              <div className="relative aspect-square w-full bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-4 border border-white/10 overflow-hidden shadow-2xl shadow-[#00f2ff]/10 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#00f2ff]/10 via-transparent to-[#3488ba]/10 group-hover:from-[#00f2ff]/20 transition-all duration-700"></div>
                <div className="h-full w-full bg-[#121111]/70 rounded-[2rem] border border-white/5 p-6 md:p-8 flex flex-col gap-6 relative z-10 backdrop-blur-sm">
                  
                  {/* Mock UI Header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-widest text-[#00f2ff] font-bold">Pipeline Velocity</div>
                      <div className="text-4xl md:text-5xl font-black text-white tracking-tighter">Personal</div>
                    </div>
                    <div className="h-12 w-12 rounded-full border border-[#00f2ff]/30 flex items-center justify-center bg-[#00f2ff]/5">
                      <Activity className="text-[#00f2ff] h-6 w-6" />
                    </div>
                  </div>

                  {/* Mock Graph Component */}
                  <div className="flex-1 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden flex flex-col justify-end p-4">
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#00f2ff]/20 to-transparent"></div>
                    <div className="h-full w-full border-b border-l border-white/10 flex items-end gap-2 px-2 relative z-10">
                      {[30, 45, 60, 80, 100].map((height, i) => (
                        <div key={i} className="flex-1 flex items-end justify-center h-full group/bar relative">
                          <div 
                            className={cn(
                              "w-full rounded-t-sm transition-all duration-1000",
                              i === 4 ? "bg-[#00f2ff]/90 shadow-[0_0_15px_rgba(0,242,255,0.6)]" 
                              : i === 3 ? "bg-[#3488ba]/60"
                              : "bg-[#00f2ff]/40"
                            )}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mock Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Your Close Confidence</div>
                      <div className="text-xl md:text-2xl font-black text-white">High</div>
                    </div>
                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Your Trust Signal</div>
                      <div className="text-xl md:text-2xl font-black text-white">A+</div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Floating Accents */}
              <div className="absolute -top-12 -right-12 h-48 w-48 bg-[#00f2ff]/20 blur-[100px] rounded-full"></div>
              <div className="absolute -bottom-12 -left-12 h-48 w-48 bg-[#3488ba]/30 blur-[100px] rounded-full"></div>
            </div>
          </div>
        </section>

        {/* Skill Fitness Statement */}
        <section className="py-24 px-6 bg-[#0d0e11] border-y border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="rounded-[2rem] border border-[#00f2ff]/20 bg-[#00f2ff]/5 p-8 md:p-12">
              <p className="text-[#00f2ff] uppercase tracking-[0.25em] text-xs font-bold mb-4">A better way to think about training</p>
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-6">
                We have apps for our physical fitness.
                <br />
                Why not one for the skills that fill our bank accounts?
              </h2>
              <p className="text-slate-300 text-lg max-w-3xl leading-relaxed">
                AutoDriveCX gives you the same daily repetition model used in fitness: short sessions, fast feedback, steady improvement, and measurable progress over time.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3 mt-8">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md hover:bg-white/[0.06] hover:-translate-y-2 hover:border-[#00f2ff]/30 transition-all duration-500 group shadow-lg">
                <div className="h-1 w-12 bg-[#00f2ff] rounded-full mb-6 group-hover:w-full transition-all duration-500 shadow-[0_0_10px_rgba(0,242,255,0.8)]"></div>
                <p className="text-xs uppercase tracking-widest text-[#00f2ff] font-bold mb-2">Rep</p>
                <p className="text-white font-semibold mb-2 text-lg">Run one focused scenario</p>
                <p className="text-slate-400 text-sm leading-relaxed">Practice pricing, objection handling, or follow-up in a realistic simulation.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md hover:bg-white/[0.06] hover:-translate-y-2 hover:border-[#3488ba]/30 transition-all duration-500 group shadow-lg">
                <div className="h-1 w-12 bg-[#3488ba] rounded-full mb-6 group-hover:w-full transition-all duration-500 shadow-[0_0_10px_rgba(52,136,186,0.8)]"></div>
                <p className="text-xs uppercase tracking-widest text-[#3488ba] font-bold mb-2">Coach</p>
                <p className="text-white font-semibold mb-2 text-lg">Get immediate correction</p>
                <p className="text-slate-400 text-sm leading-relaxed">See exactly what to improve across trust, listening, empathy, and closing behavior.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md hover:bg-white/[0.06] hover:-translate-y-2 hover:border-[#00f2ff]/30 transition-all duration-500 group shadow-lg">
                <div className="h-1 w-12 bg-[#00f2ff] rounded-full mb-6 group-hover:w-full transition-all duration-500 shadow-[0_0_10px_rgba(0,242,255,0.8)]"></div>
                <p className="text-xs uppercase tracking-widest text-[#00f2ff] font-bold mb-2">Compound</p>
                <p className="text-white font-semibold mb-2 text-lg">Build a stronger earning system</p>
                <p className="text-slate-400 text-sm leading-relaxed">Small daily improvements stack into more consistent performance and better outcomes.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Value Prop Grid */}
        <section className="py-24 px-6 relative bg-gradient-to-b from-[#121111] to-[#0a0a0c]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
              <div>
                <h2 className="text-[#00f2ff] uppercase tracking-[0.3em] font-bold text-sm mb-4">Value Proposition</h2>
                <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight">Built for the Individual Producer.</h3>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed font-medium">
                No committee. No waiting on team rollouts. Just direct daily reps that make you better in live customer conversations.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Better Conversations", icon: MessageSquare, text: "Practice your toughest customer moments before they happen on the floor." },
                { title: "Higher Confidence", icon: ShieldCheck, text: "Walk into every pencil and objection with a repeatable game plan." },
                { title: "Faster Growth", icon: TrendingUp, text: "Improve weekly with focused reps instead of hoping experience alone gets you there." },
                { title: "Elite Experience", icon: Award, text: "A premium training environment designed for serious sales consultants." }
              ].map((card, i) => (
                <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-3xl group hover:border-[#00f2ff]/50 hover:bg-white/[0.05] transition-all duration-300">
                  <div className="h-14 w-14 rounded-2xl bg-[#00f2ff]/10 border border-[#00f2ff]/20 flex items-center justify-center mb-8 group-hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all">
                    <card.icon className="text-[#00f2ff] h-7 w-7" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-4 tracking-tight">{card.title}</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Engine: Horizontal Timeline */}
        <section className="py-32 px-6 bg-white/[0.01] border-y border-white/5 relative overflow-hidden">
          {/* Subtle Background Elements */}
          <div className="absolute top-0 right-1/4 h-96 w-96 bg-[#3488ba]/5 blur-[120px] rounded-full"></div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-24">
              <h2 className="text-[#00f2ff] uppercase tracking-[0.3em] font-bold text-sm mb-4">How it works</h2>
              <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight">The Power Engine</h3>
            </div>
            
            <div className="relative">
              {/* Laser Connecting Line (Visible on lg screens) */}
              <div className="absolute top-[3rem] left-0 w-full h-[1px] hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent opacity-30 shadow-[0_0_10px_rgba(0,242,255,0.5)]"></div>
              </div>
              
              <div className="grid lg:grid-cols-3 gap-16 relative z-10">
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full bg-[#121111] backdrop-blur-xl border-2 border-[#00f2ff]/50 shadow-[0_0_30px_rgba(0,242,255,0.2)] flex items-center justify-center mb-8 z-10">
                    <Brain className="text-[#00f2ff] h-10 w-10" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-4">Realistic AI Practice</h4>
                  <p className="text-slate-400 max-w-xs mb-8 text-sm leading-relaxed">
                    Simulate tough pricing, trade-in, and finance objections in a zero-risk environment before facing a real customer.
                  </p>
                  <div className="w-full h-[190px] bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#00f2ff]/5 via-transparent to-transparent pointer-events-none"></div>
                    <div className="flex gap-2 mb-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500/50"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50"></div>
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500/50"></div>
                    </div>
                    <div className="text-left font-mono text-[11px] text-[#00f2ff]/80 leading-relaxed space-y-2 relative z-10">
                      <div className="flex items-center gap-2">
                        <span>&gt; ANALYZING_TONE</span>
                        <span className="text-[#00f2ff] animate-pulse">...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>&gt; OBJECTION_DETECTED: &quot;Too expensive&quot;</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00f2ff] animate-pulse" style={{ animationDelay: '250ms' }}></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>&gt; SUGGESTING_REBUTTAL_V4</span>
                        <span className="text-[#00f2ff] animate-pulse" style={{ animationDelay: '500ms' }}>...</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full w-2/5 bg-gradient-to-r from-transparent via-[#00f2ff]/80 to-transparent"
                          style={{ animation: 'terminalLoad 1.35s ease-in-out infinite' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center text-center mt-12 lg:mt-0">
                  <div className="h-24 w-24 rounded-full bg-[#121111] backdrop-blur-xl border-2 border-[#00f2ff]/50 shadow-[0_0_30px_rgba(0,242,255,0.2)] flex items-center justify-center mb-8 z-10">
                    <Target className="text-[#00f2ff] h-10 w-10" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-4">Structured Feedback</h4>
                  <p className="text-slate-400 max-w-xs mb-8 text-sm leading-relaxed">
                    Receive exact behavioral corrections on tonality and transparency to fix leaks in your communication.
                  </p>
                  <div className="w-full h-[190px] bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-[#00f2ff]/15 to-transparent blur-sm pointer-events-none"
                      style={{ animation: 'pulse 1.9s ease-in-out infinite' }}
                    ></div>
                    <div className="space-y-4 relative z-10">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400">
                          <span>Tonality</span>
                          <span className="text-[#00f2ff]">75%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00f2ff] w-3/4 shadow-[0_0_10px_rgba(0,242,255,0.8)]"
                            style={{ animation: 'feedbackFillOne 3s ease-in-out infinite' }}
                          ></div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400">
                          <span>Transparency</span>
                          <span className="text-[#3488ba]">50%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3488ba] w-1/2"
                            style={{ animation: 'feedbackFillTwo 3.3s ease-in-out infinite', animationDelay: '220ms' }}
                          ></div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-400">
                          <span>Trust Clarity</span>
                          <span className="text-[#5dd8de]">100%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00f2ff]/50 w-full"
                            style={{ animation: 'feedbackFillThree 2.85s ease-in-out infinite', animationDelay: '420ms' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center text-center mt-12 lg:mt-0">
                  <div className="h-24 w-24 rounded-full bg-[#121111] backdrop-blur-xl border-2 border-[#00f2ff]/50 shadow-[0_0_30px_rgba(0,242,255,0.2)] flex items-center justify-center mb-8 z-10">
                    <LayoutDashboard className="text-[#00f2ff] h-10 w-10" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-4">Performance Visibility</h4>
                  <p className="text-slate-400 max-w-xs mb-8 text-sm leading-relaxed">
                    Track your own mastery clearly and, if you lead others, coach from the same performance signals.
                  </p>
                  <div className="w-full h-[190px] bg-white/[0.03] backdrop-blur-md rounded-2xl p-6 border border-white/5 shadow-xl flex justify-center items-center relative overflow-hidden">
                    <div className="relative h-44 w-44 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border border-[#00f2ff]/10"></div>
                      <div className="absolute inset-0 rounded-full border border-[#00f2ff]/10" style={{ animation: 'radarPulse 2.3s ease-out infinite' }}></div>
                      <div className="absolute inset-[18px] rounded-full border border-[#00f2ff]/20"></div>
                      <div className="absolute inset-[36px] rounded-full border border-[#00f2ff]/30"></div>
                      <div className="absolute left-1/2 top-1/2 h-[1px] w-16 -translate-y-1/2 origin-left bg-gradient-to-r from-[#00f2ff]/90 to-transparent" style={{ animation: 'radarSweep 2.4s linear infinite' }}></div>
                      <div className="absolute h-2.5 w-2.5 rounded-full bg-[#00f2ff] shadow-[0_0_14px_rgba(0,242,255,0.9)] translate-x-10 translate-y-6 animate-pulse"></div>
                      <div className="absolute h-24 w-24 rounded-full border-4 border-[#00f2ff]/15 border-t-[#00f2ff] shadow-[0_0_18px_rgba(0,242,255,0.35)]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How This Works In Practice */}
        <section className="py-24 px-6 bg-[#0f1013] border-y border-white/5">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="max-w-3xl">
              <h2 className="text-[#00f2ff] uppercase tracking-[0.3em] font-bold text-sm mb-4">How this works in practice</h2>
              <h3 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-5">A weekly operating rhythm that compounds results</h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                AutoDriveCX is built for execution, not theory. You practice daily, fix specific behavior gaps, and track your progress with clear score movement.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 relative">
              {/* Fancy joining glow line between them */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[1px] bg-gradient-to-r from-transparent via-[#00f2ff]/20 to-transparent hidden lg:block blur-[2px]"></div>
              
              <div className="rounded-3xl border border-white/10 bg-[#121111]/80 backdrop-blur-xl p-8 relative group hover:border-[#00f2ff]/40 transition-all duration-700 hover:shadow-[0_0_30px_rgba(0,242,255,0.1)] overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f2ff]/5 rounded-bl-full group-hover:bg-[#00f2ff]/10 transition-colors duration-700"></div>
                <h4 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.8)] animate-pulse"></div>
                  Daily Performance Loop
                </h4>
                <ol className="space-y-6 text-slate-300 relative z-10">
                  <li className="flex gap-4 group/item"><span className="text-[#00f2ff] font-mono font-bold bg-[#00f2ff]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#00f2ff] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(0,242,255,0.5)] transition-all">1</span> <span className="pt-1">Run a short AI scenario based on real objections and customer context.</span></li>
                  <li className="flex gap-4 group/item"><span className="text-[#00f2ff] font-mono font-bold bg-[#00f2ff]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#00f2ff] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(0,242,255,0.5)] transition-all">2</span> <span className="pt-1">Get immediate scoring across empathy, listening, trust, follow-up, closing, and relationship-building.</span></li>
                  <li className="flex gap-4 group/item"><span className="text-[#00f2ff] font-mono font-bold bg-[#00f2ff]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#00f2ff] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(0,242,255,0.5)] transition-all">3</span> <span className="pt-1">Receive targeted coaching prompts and the next best practice rep.</span></li>
                  <li className="flex gap-4 group/item"><span className="text-[#00f2ff] font-mono font-bold bg-[#00f2ff]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#00f2ff] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(0,242,255,0.5)] transition-all">4</span> <span className="pt-1">Apply it on the floor the same day and repeat.</span></li>
                </ol>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#121111]/80 backdrop-blur-xl p-8 relative group hover:border-[#3488ba]/40 transition-all duration-700 hover:shadow-[0_0_30px_rgba(52,136,186,0.1)] overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#3488ba]/5 rounded-bl-full group-hover:bg-[#3488ba]/10 transition-colors duration-700"></div>
                <h4 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-[#3488ba] shadow-[0_0_15px_rgba(52,136,186,0.8)] animate-pulse"></div>
                  Weekly Self-Review Loop
                </h4>
                <ol className="space-y-6 text-slate-300 relative z-10">
                  <li className="flex gap-4 group/item"><span className="text-[#3488ba] font-mono font-bold bg-[#3488ba]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#3488ba] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(52,136,186,0.5)] transition-all">1</span> <span className="pt-1">Review your strongest and weakest skills from the week.</span></li>
                  <li className="flex gap-4 group/item"><span className="text-[#3488ba] font-mono font-bold bg-[#3488ba]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#3488ba] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(52,136,186,0.5)] transition-all">2</span> <span className="pt-1">Pick one behavior to tighten that affects conversion or trust.</span></li>
                  <li className="flex gap-4 group/item"><span className="text-[#3488ba] font-mono font-bold bg-[#3488ba]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#3488ba] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(52,136,186,0.5)] transition-all">3</span> <span className="pt-1">Run targeted reps until that behavior becomes automatic.</span></li>
                  <li className="flex gap-4 group/item"><span className="text-[#3488ba] font-mono font-bold bg-[#3488ba]/10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 group-hover/item:scale-110 group-hover/item:bg-[#3488ba] group-hover/item:text-[#121111] group-hover/item:shadow-[0_0_15px_rgba(52,136,186,0.5)] transition-all">4</span> <span className="pt-1">Track consistency and keep compounding into next week.</span></li>
                </ol>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#00f2ff]/20 bg-[#00f2ff]/5 p-6 hover:scale-[1.03] hover:bg-[#00f2ff]/10 hover:shadow-[0_0_25px_rgba(0,242,255,0.15)] transition-all duration-300 cursor-default relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#00f2ff]/20 rounded-bl-full group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-xs uppercase tracking-widest text-[#00f2ff] font-bold mb-3 relative z-10 block">Sales impact</p>
                <p className="text-slate-200 relative z-10 leading-relaxed font-medium">More consistent conversations and stronger close execution from you.</p>
              </div>
              <div className="rounded-2xl border border-[#00f2ff]/20 bg-[#00f2ff]/5 p-6 hover:scale-[1.03] hover:bg-[#00f2ff]/10 hover:shadow-[0_0_25px_rgba(0,242,255,0.15)] transition-all duration-300 cursor-default relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#00f2ff]/20 rounded-bl-full group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-xs uppercase tracking-widest text-[#00f2ff] font-bold mb-3 relative z-10 block">Margin impact</p>
                <p className="text-slate-200 relative z-10 leading-relaxed font-medium">Better objection handling protects your gross and reduces discount drift.</p>
              </div>
              <div className="rounded-2xl border border-[#00f2ff]/20 bg-[#00f2ff]/5 p-6 hover:scale-[1.03] hover:bg-[#00f2ff]/10 hover:shadow-[0_0_25px_rgba(0,242,255,0.15)] transition-all duration-300 cursor-default relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#00f2ff]/20 rounded-bl-full group-hover:scale-150 transition-transform duration-500"></div>
                <p className="text-xs uppercase tracking-widest text-[#00f2ff] font-bold mb-3 relative z-10 block">CX impact</p>
                <p className="text-slate-200 relative z-10 leading-relaxed font-medium">Higher trust, cleaner handoffs, and happier long-term customers.</p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <TourDialog>
                <Button className="h-14 bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-[#121111] px-8 rounded-xl font-black uppercase tracking-wider">
                  Show Me How I Improve Daily
                </Button>
              </TourDialog>
              <Button asChild variant="outline" className="h-14 px-8 rounded-xl font-black uppercase tracking-wider border-[#00f2ff]/35 bg-gradient-to-r from-white/10 to-white/5 text-white hover:from-[#00f2ff]/20 hover:to-[#3488ba]/20 hover:text-white shadow-[0_0_16px_rgba(0,242,255,0.18)]">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Role Split Comparison */}
        <section className="py-24 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-px bg-white/10 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl">
              
              {/* Workforce Block */}
              <div className="bg-[#121111] p-12 lg:p-20 relative group overflow-hidden hover:bg-[#121111]/90 transition-colors">
                <div className="absolute top-[-20%] right-[-10%] opacity-5 group-hover:opacity-10 transition-opacity">
                  <UserCircle className="w-[400px] h-[400px] text-white" />
                </div>
                <h2 className="text-[#00f2ff] font-bold uppercase tracking-widest text-sm mb-6">For Sales Consultants</h2>
                <h3 className="text-4xl md:text-5xl font-black text-white mb-10 tracking-tight">Solo Closers</h3>
                <ul className="space-y-6 mb-16 relative z-10">
                  {[
                    "Daily reps that sharpen your close",
                    "Clear personal score movement over time",
                    "On-demand coaching before real customer conversations"
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <CheckCircle2 className="text-[#00f2ff] h-6 w-6 shrink-0" />
                      <span className="text-slate-300 text-lg">{text}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 relative z-10">
                  <TourDialog>
                    <Button variant="outline" className="h-10 px-4 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white font-bold uppercase tracking-widest text-xs">
                      Show Me My Sales Plan
                    </Button>
                  </TourDialog>
                  <Button asChild variant="outline" className="h-10 px-4 rounded-lg border border-[#00f2ff]/35 bg-gradient-to-r from-white/10 to-white/5 text-white hover:from-[#00f2ff]/20 hover:to-[#3488ba]/20 text-xs font-black uppercase tracking-widest shadow-[0_0_14px_rgba(0,242,255,0.15)]">
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </div>
              </div>

              {/* Executive Block */}
              <div className="bg-[#121111] p-12 lg:p-20 relative group overflow-hidden hover:bg-[#121111]/90 transition-colors">
                <div className="absolute top-[-20%] right-[-10%] opacity-5 group-hover:opacity-10 transition-opacity">
                  <BarChart3 className="w-[400px] h-[400px] text-white" />
                </div>
                <h2 className="text-[#3488ba] font-bold uppercase tracking-widest text-sm mb-6">Optional Manager Lens</h2>
                <h3 className="text-4xl md:text-5xl font-black text-white mb-10 tracking-tight">Coach Mode</h3>
                <ul className="space-y-6 mb-16 relative z-10">
                  {[
                    "Visibility into your own trend patterns",
                    "Optional team view when you lead others",
                    "Clear coaching priorities based on behavior trends"
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <LineChart className="text-[#3488ba] h-6 w-6 shrink-0" />
                      <span className="text-slate-300 text-lg">{text}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 relative z-10">
                  <TourDialog>
                    <Button variant="outline" className="h-10 px-4 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white font-bold uppercase tracking-widest text-xs">
                      Show Me The Coaching View
                    </Button>
                  </TourDialog>
                  <Button asChild variant="outline" className="h-10 px-4 rounded-lg border border-[#00f2ff]/35 bg-gradient-to-r from-white/10 to-white/5 text-white hover:from-[#00f2ff]/20 hover:to-[#3488ba]/20 text-xs font-black uppercase tracking-widest shadow-[0_0_14px_rgba(0,242,255,0.15)]">
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ROI Blocks */}
        <section className="py-24 px-6 border-y border-white/5 relative bg-[#0a0a0c]">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 text-center">
              <div>
                <div className="h-12 w-12 rounded-full border border-[#00f2ff]/30 mx-auto mb-6 flex items-center justify-center bg-[#00f2ff]/5">
                  <CheckCircle2 className="text-[#00f2ff] h-6 w-6" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">More consistent conversations</h4>
                <div className="h-px bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent w-full mx-auto mb-4 opacity-50"></div>
                <p className="text-slate-400 text-sm">Every customer gets the best, most optimized version of your sales process.</p>
              </div>
              <div>
                <div className="h-12 w-12 rounded-full border border-white/30 mx-auto mb-6 flex items-center justify-center bg-white/5">
                  <Award className="text-white h-6 w-6" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Better close confidence</h4>
                <div className="h-px bg-gradient-to-r from-transparent via-[#3488ba] to-transparent w-full mx-auto mb-4 opacity-50"></div>
                <p className="text-slate-400 text-sm">You enter negotiations knowing you have the right strategies loaded.</p>
              </div>
              <div>
                <div className="h-12 w-12 rounded-full border border-[#00f2ff]/30 mx-auto mb-6 flex items-center justify-center bg-[#00f2ff]/5">
                  <ShieldCheck className="text-[#00f2ff] h-6 w-6" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Stronger follow-through & trust</h4>
                <div className="h-px bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent w-full mx-auto mb-4 opacity-50"></div>
                <p className="text-slate-400 text-sm">Earn lifelong customers through transparent and empathetic interactions.</p>
              </div>
              <div>
                <div className="h-12 w-12 rounded-full border border-white/30 mx-auto mb-6 flex items-center justify-center bg-white/5">
                  <TrendingUp className="text-white h-6 w-6" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Faster personal skill ramp</h4>
                <div className="h-px bg-gradient-to-r from-transparent via-[#3488ba] to-transparent w-full mx-auto mb-4 opacity-50"></div>
                <p className="text-slate-400 text-sm">Build confidence and consistency faster without costly trial-and-error.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Conversion */}
        <section className="py-40 px-6 relative overflow-hidden bg-[#121111]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00f2ff]/10 via-transparent to-transparent opacity-80 pointer-events-none"></div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-5xl lg:text-8xl font-black text-white mb-10 tracking-tighter leading-[0.9]">
              More cars sold.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#3488ba]">Better earnings.</span><br/>
              Happier customers.
            </h2>
            <p className="text-slate-400 text-xl md:text-2xl mb-16 max-w-2xl mx-auto font-medium">
              The elite performance platform for sales consultants who refuse to settle for average.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <TourDialog>
                <Button className="bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-[#121111] px-14 py-8 rounded-2xl font-black text-xl lg:text-2xl uppercase tracking-[0.2em] transition-all hover:scale-105 shadow-[0_0_50px_rgba(0,242,255,0.5)] h-auto" disabled={isTouring}>
                   {isTouring ? <Spinner className="text-[#121111]" /> : 'See How It Works'}
                </Button>
              </TourDialog>
              <Button asChild variant="outline" className="px-10 py-8 rounded-2xl font-black text-xl uppercase tracking-[0.12em] border-[#00f2ff]/35 bg-gradient-to-r from-white/10 to-white/5 text-white hover:from-[#00f2ff]/20 hover:to-[#3488ba]/20 hover:text-white h-auto shadow-[0_0_22px_rgba(0,242,255,0.2)]">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <style jsx global>{`
        @keyframes terminalLoad {
          0%, 100% { transform: translateX(-30%); opacity: 0.45; }
          50% { transform: translateX(120%); opacity: 1; }
        }
        @keyframes feedbackFillOne {
          0%, 100% { width: 66%; }
          50% { width: 82%; }
        }
        @keyframes feedbackFillTwo {
          0%, 100% { width: 42%; }
          50% { width: 58%; }
        }
        @keyframes feedbackFillThree {
          0%, 100% { width: 88%; opacity: 0.7; }
          50% { width: 100%; opacity: 1; }
        }
        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes radarPulse {
          0% { transform: scale(0.9); opacity: 0.2; }
          70% { transform: scale(1.05); opacity: 0.45; }
          100% { transform: scale(1.12); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
