
'use client';

import { Header } from '@/components/layout/header';
import { LessonView } from '@/components/lessons/lesson-view';
import { getLessonById } from '@/lib/data';
import { Lesson } from '@/lib/definitions';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { notFound, useParams, useSearchParams } from 'next/navigation';

export default function LessonPage() {
    const params = useParams<{ lessonId: string }>();
    const searchParams = useSearchParams();
    const isRecommended = searchParams.get('recommended') === 'true';

    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLesson() {
            setLoading(true);
            const currentLesson = await getLessonById(params.lessonId);
            if (currentLesson) {
                setLesson(currentLesson);
            } else {
                notFound();
            }
            setLoading(false);
        }
        fetchLesson();
    }, [params.lessonId]);

    if (loading || !lesson) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header />
            <main className="flex flex-1 flex-col">
                <LessonView lesson={lesson} isRecommended={isRecommended} />
            </main>
        </div>
    );
}
