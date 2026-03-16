
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
        const queryConsultant = (new URLSearchParams(window.location.search).get('consultant') || '').trim().toLowerCase();
        const pathConsultant = (
            pathname.startsWith('/join/') ? pathname.slice('/join/'.length) :
            pathname.startsWith('/signup/') ? pathname.slice('/signup/'.length) :
            pathname.startsWith('/demo/') ? pathname.slice('/demo/'.length) :
            pathname.startsWith('/tour/') ? pathname.slice('/tour/'.length) :
            ''
        ).trim().toLowerCase();
        const consultant = pathConsultant || queryConsultant;
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
