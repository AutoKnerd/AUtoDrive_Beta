
'use client';

import { Header } from '@/components/layout/header';
import { LessonView } from '@/components/lessons/lesson-view';
import { getDealershipById, getLessonById } from '@/lib/data';
import { Lesson, managerialRoles } from '@/lib/definitions';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function LessonPage() {
    const params = useParams<{ lessonId: string }>();
    const searchParams = useSearchParams();
    const isRecommended = searchParams.get('recommended') === 'true';
    const { user } = useAuth();
    const [isPaused, setIsPaused] = useState(false);

    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLesson() {
            setLoading(true);

            if (user && user.dealershipIds.length > 0) {
                const dealershipData = await Promise.all(user.dealershipIds.map(id => getDealershipById(id)));
                const activeDealerships = dealershipData.filter(d => d && d.status === 'active');
                if (activeDealerships.length === 0) {
                    setIsPaused(true);
                    setLoading(false);
                    return;
                }
            }

            const currentLesson = await getLessonById(params.lessonId);
            if (currentLesson) {
                setLesson(currentLesson);
            } else {
                notFound();
            }
            setLoading(false);
        }
        if (user) {
            fetchLesson();
        }
    }, [params.lessonId, user]);

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
                 <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 pb-24 md:pb-8">
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
                {!isManager && <BottomNav />}
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

    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex flex-1 flex-col pb-20 md:pb-0">
                <LessonView lesson={lesson} isRecommended={isRecommended} />
            </main>
            {!isManager && <BottomNav />}
        </div>
    );
}
