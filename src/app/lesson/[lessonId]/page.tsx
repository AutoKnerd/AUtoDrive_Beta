
'use client';

import { Header } from '@/components/layout/header';
import { LessonView } from '@/components/lessons/lesson-view';
import { getDailyLessonLimits, getDealershipById, getLessonById } from '@/lib/data.client';
import { Lesson, managerialRoles } from '@/lib/definitions';
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function LessonPage() {
    const params = useParams<{ lessonId: string }>();
    const searchParams = useSearchParams();
    const isRecommended = searchParams.get('recommended') === 'true';
    const isTestingRetake = searchParams.get('retake') === 'testing';
    const isTestingNewRecommended = searchParams.get('new') === 'testing';
    const { user, isTouring } = useAuth();
    const [isPaused, setIsPaused] = useState(false);
    const [canUseTestingRetake, setCanUseTestingRetake] = useState(false);
    const [canUseTestingNewRecommended, setCanUseTestingNewRecommended] = useState(false);
    const [recommendedTakenToday, setRecommendedTakenToday] = useState(false);

    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const userId = user?.userId;
    const dealershipIds = useMemo(() => {
        const ids = [...(user?.dealershipIds ?? [])];
        if (user?.selfDeclaredDealershipId) {
            ids.push(user.selfDeclaredDealershipId);
        }
        return Array.from(new Set(ids));
    }, [user?.dealershipIds, user?.selfDeclaredDealershipId]);
    const dealershipIdsKey = dealershipIds.join('|');

    // Effect for fetching the lesson data, depends on lessonId and user for tour mode context
    useEffect(() => {
        async function fetchLesson() {
            if (!userId) return;
            setLoading(true);
            const currentLesson = await getLessonById(params.lessonId, userId);
            if (currentLesson) {
                setLesson(currentLesson);
            } else {
                notFound();
            }
            setLoading(false);
        }
        fetchLesson();
    }, [params.lessonId, userId]);

    // Effect for checking user's paused status, depends on user
    useEffect(() => {
        async function checkStatus() {
            if (!userId) return;
            const limits = await getDailyLessonLimits(userId);
            setRecommendedTakenToday(limits.recommendedTaken);

            if (dealershipIds.length > 0 && !isTouring) {
                const dealershipData = await Promise.all(dealershipIds.map(id => getDealershipById(id, userId)));
                const activeDealerships = dealershipData.filter(d => d && d.status === 'active');
                const retakeTestingAccess = dealershipData.some(d => d?.enableRetakeRecommendedTesting === true);
                const newRecommendedTestingAccess = dealershipData.some(d => d?.enableNewRecommendedTesting === true);
                setCanUseTestingRetake(retakeTestingAccess);
                setCanUseTestingNewRecommended(newRecommendedTestingAccess);
                if (activeDealerships.length === 0) {
                    setIsPaused(true);
                } else {
                    setIsPaused(false);
                }
            } else {
                 setIsPaused(false);
                 setCanUseTestingRetake(false);
                 setCanUseTestingNewRecommended(false);
            }
        }
        checkStatus();
    }, [userId, dealershipIdsKey, isTouring]);


    if (loading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Spinner size="lg" />
            </div>
        );
    }
    
    const isManager = managerialRoles.includes(user.role);

    if (isPaused) {
        return (
            <div className="flex flex-col min-h-screen w-full">
                <Header />
                 <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 pb-20 md:pb-8">
                    <div className="w-full max-w-2xl">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Account Paused</AlertTitle>
                            <AlertDescription>
                                Your access to lessons is temporarily unavailable because your dealership's account is paused. Please contact your manager.
                            </AlertDescription>
                        </Alert>
                        <Button asChild className="mt-4">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Link>
                        </Button>
                    </div>
                </main>
                {!isManager && !isTouring && <BottomNav />}
            </div>
        )
    }

    if (!lesson) {
         return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Spinner size="lg" />
            </div>
        );
    }

    if (isTestingRetake && !canUseTestingRetake) {
        return (
            <div className="flex flex-col min-h-screen w-full">
                <Header />
                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 pb-20 md:pb-8">
                    <div className="w-full max-w-2xl">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Testing Access Restricted</AlertTitle>
                            <AlertDescription>
                                Your dealership does not currently have access to the Retake Recommended (Testing) feature.
                            </AlertDescription>
                        </Alert>
                        <Button asChild className="mt-4">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Link>
                        </Button>
                    </div>
                </main>
                {!isManager && !isTouring && <BottomNav />}
            </div>
        );
    }

    if (isTestingNewRecommended && !canUseTestingNewRecommended) {
        return (
            <div className="flex flex-col min-h-screen w-full">
                <Header />
                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 pb-20 md:pb-8">
                    <div className="w-full max-w-2xl">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Testing Access Restricted</AlertTitle>
                            <AlertDescription>
                                Your dealership does not currently have access to the New Recommended (Testing) feature.
                            </AlertDescription>
                        </Alert>
                        <Button asChild className="mt-4">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Link>
                        </Button>
                    </div>
                </main>
                {!isManager && !isTouring && <BottomNav />}
            </div>
        );
    }

    const isAllowedTestingRepeat =
        (isTestingRetake && canUseTestingRetake) ||
        (isTestingNewRecommended && canUseTestingNewRecommended);

    if (isRecommended && recommendedTakenToday && !isAllowedTestingRepeat) {
        return (
            <div className="flex flex-col min-h-screen w-full">
                <Header />
                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 pb-20 md:pb-8">
                    <div className="w-full max-w-2xl">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Recommended Lesson Complete</AlertTitle>
                            <AlertDescription>
                                You have already completed today&apos;s recommended lesson. Only assigned lessons are available until tomorrow.
                            </AlertDescription>
                        </Alert>
                        <Button asChild className="mt-4">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Dashboard
                            </Link>
                        </Button>
                    </div>
                </main>
                {!isManager && !isTouring && <BottomNav />}
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex flex-1 flex-col items-center p-4 md:p-8 pb-24">
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="fixed right-4 top-20 z-40 h-10 w-10 rounded-full border-cyan-400/40 bg-slate-900/90 backdrop-blur hover:bg-slate-800"
                >
                    <Link href="/" aria-label="Exit lesson">
                        <X className="h-5 w-5" />
                    </Link>
                </Button>
                <LessonView lesson={lesson} isRecommended={isRecommended} />
            </main>
            {!isManager && !isTouring && <BottomNav />}
        </div>
    );
}
