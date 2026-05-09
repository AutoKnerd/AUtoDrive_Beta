
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Footer } from '@/components/layout/footer';
import { AutoknerdFooter } from '@/components/autoknerd/autoknerd-footer';
import { TourFooter } from '@/components/layout/tour-footer';
import { usePathname, useSearchParams } from 'next/navigation';
import { parseConsultantFromURL, setAttribution } from '@/lib/consultant-referral';
import { Home, Wrench, User } from 'lucide-react';

export function MainLayout({ children }: { children: React.ReactNode }) {
    const { isTouring, loading } = useAuth();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const showTourFooter = isTouring && pathname !== '/login' && pathname !== '/register';
    const isAutoknerdSurface = Boolean(pathname?.startsWith('/Autoknerd'));
    const isAutoShopSurface = Boolean(pathname?.startsWith('/autoshop') || pathname?.startsWith('/tools'));
    const isLiveSessionSurface = Boolean(pathname?.startsWith('/live-session'));

    const isEmbedToolsSurface = Boolean((pathname?.startsWith('/autoshop') || pathname?.startsWith('/tools')) && searchParams.get('embed') === '1');

    useEffect(() => {
        const resolved = parseConsultantFromURL(`${pathname}${window.location.search}`);
        if (!resolved) return;
        setAttribution({
            consultant_id: resolved,
            engagement_type: 'weak',
            engagement_event: 'page_visit',
            timestamp: Date.now(),
        });
    }, [pathname]);

    return (
        <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            {!loading && !isAutoknerdSurface && !isLiveSessionSurface && (
              isEmbedToolsSurface ? (
                <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-neutral-950/80 text-[#e2e4cf] backdrop-blur-xl md:hidden">
                  <div className="mx-auto grid max-w-7xl grid-cols-3 gap-1 px-2 py-2">
                    <a
                      href="http://localhost:5173/"
                      className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-neutral-500 transition active:scale-95 hover:text-white"
                    >
                      <Home className="h-5 w-5" />
                      <span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em]">Home</span>
                    </a>
                    <a
                      href="http://localhost:5173/?view=tools"
                      className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[#CCFF00] transition active:scale-95 drop-shadow-[0_0_8px_rgba(204,255,0,0.3)]"
                    >
                      <Wrench className="h-5 w-5" />
                      <span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em]">Tools</span>
                    </a>
                    <a
                      href="http://localhost:5173/?view=profile"
                      className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-neutral-500 transition active:scale-95 hover:text-white"
                    >
                      <User className="h-5 w-5" />
                      <span className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.18em]">Profile</span>
                    </a>
                  </div>
                </footer>
              ) : (
                showTourFooter ? <TourFooter /> : isAutoShopSurface ? <AutoknerdFooter /> : <Footer />
              )
            )}
        </div>
    );
}
