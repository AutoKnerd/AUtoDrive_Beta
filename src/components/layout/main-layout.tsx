
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Footer } from '@/components/layout/footer';
import { TourFooter } from '@/components/layout/tour-footer';
import { usePathname } from 'next/navigation';

export function MainLayout({ children }: { children: React.ReactNode }) {
    const { isTouring, loading } = useAuth();
    const pathname = usePathname();

    const showTourFooter = isTouring && pathname !== '/login' && pathname !== '/register';

    useEffect(() => {
        const consultant = (new URLSearchParams(window.location.search).get('consultant') || '').trim().toLowerCase();
        if (!consultant) return;
        localStorage.setItem('consultant_referral', consultant);
    }, [pathname]);

    return (
        <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            {!loading && (showTourFooter ? <TourFooter /> : <Footer />)}
        </div>
    );
}
