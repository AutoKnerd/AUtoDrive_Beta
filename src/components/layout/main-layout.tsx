
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Footer } from '@/components/layout/footer';
import { TourFooter } from '@/components/layout/tour-footer';
import { usePathname } from 'next/navigation';
import { parseConsultantFromURL, setAttribution } from '@/lib/consultant-referral';

export function MainLayout({ children }: { children: React.ReactNode }) {
    const { isTouring, loading } = useAuth();
    const pathname = usePathname();

    const showTourFooter = isTouring && pathname !== '/login' && pathname !== '/register';
    const isAutoknerdSurface = Boolean(pathname?.startsWith('/Autoknerd'));

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
            {!loading && !isAutoknerdSurface && (showTourFooter ? <TourFooter /> : <Footer />)}
        </div>
    );
}
