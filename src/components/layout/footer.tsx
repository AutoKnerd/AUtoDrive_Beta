
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/layout/logo';

export function Footer() {
    const [currentYear, setCurrentYear] = useState<string>('');
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
    const gitSha = process.env.NEXT_PUBLIC_GIT_SHA ?? 'local';
    const pathname = usePathname();
    const isAutoForge = Boolean(pathname?.startsWith('/autoforge'));
    const isAutoDrive = Boolean(pathname?.startsWith('/autodrive'));

    useEffect(() => {
        // This effect runs only on the client, after hydration
        setCurrentYear(new Date().getFullYear().toString());
    }, []);

    if (isAutoForge || isAutoDrive) {
        const logoSrc = isAutoForge ? '/AutoForge%20logo.png' : '/logo2.png';
        const logoAlt = isAutoForge ? 'AutoForge Logo' : 'AutoDriveCX Logo';

        return (
            <footer className="w-full border-t border-zinc-900 bg-black">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 py-16 md:flex-row">
                    <Link
                        href="/Autoknerd"
                        className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#bdfc00] transition-colors hover:text-[#d7ff66] md:text-[10px]"
                        style={{ fontFamily: "'Press Start 2P', monospace" }}
                    >
                        AutoKnerd
                    </Link>
                    <div className="flex items-center justify-center">
                        <Image
                            src={logoSrc}
                            alt={logoAlt}
                            width={120}
                            height={36}
                            className="h-auto w-[96px] md:w-[120px]"
                            priority={false}
                        />
                    </div>
                    <div
                        className="flex flex-wrap items-center justify-center gap-3 text-[8px] uppercase tracking-[0.18em] text-zinc-700 opacity-80 md:text-[9px]"
                        style={{ fontFamily: "'Press Start 2P', monospace" }}
                    >
                        <span>© 2024 AutoKnerd LLC Dealership CX Development.</span>
                        <span className="text-zinc-800">|</span>
                        <Link href="/legal" className="text-zinc-600 transition-colors hover:text-zinc-300">
                            Legal
                        </Link>
                    </div>
                </div>
            </footer>
        );
    }

    return (
        <footer className="w-full border-t border-zinc-900 bg-black">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 py-16 md:flex-row">
                <div
                    className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600 md:text-[10px]"
                    style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                    AutoDriveCX
                </div>
                <div className="flex items-center justify-center">
                    <Logo variant="full" width={120} height={36} className="h-auto w-[96px] md:w-[120px]" />
                </div>
                <div
                    className="flex flex-wrap items-center justify-center gap-3 text-[8px] uppercase tracking-[0.18em] text-zinc-700 opacity-80 md:text-[9px]"
                    style={{ fontFamily: "'Press Start 2P', monospace" }}
                >
                    <span suppressHydrationWarning>© {currentYear} AutoDriveCX, LLC. All rights reserved.</span>
                    <span className="text-zinc-800">|</span>
                    <span>v{appVersion}-{gitSha}</span>
                    <span className="text-zinc-800">|</span>
                    <Link href="/legal" className="text-zinc-600 transition-colors hover:text-zinc-300">
                        Legal
                    </Link>
                </div>
            </div>
        </footer>
    );
}
