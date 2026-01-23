
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { BottomNav } from '@/components/layout/bottom-nav';
import { UserRole, LessonLog, Badge as BadgeType } from '@/lib/definitions';
import { getConsultantActivity, getEarnedBadgesByUserId } from '@/lib/data';
import { ScoreCard } from '@/components/profile/score-card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ScoreCardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const scoreCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      async function fetchData() {
        setDataLoading(true);
        const [fetchedActivity, fetchedBadges] = await Promise.all([
          getConsultantActivity(user!.userId),
          getEarnedBadgesByUserId(user!.userId),
        ]);
        setActivity(fetchedActivity);
        setBadges(fetchedBadges);
        setDataLoading(false);
      }
      fetchData();
    }
  }, [user]);

  const handleDownload = () => {
    if (scoreCardRef.current === null) {
      return;
    }

    import('html-to-image')
      .then((htmlToImage) => {
        htmlToImage.toPng(scoreCardRef.current!, { 
            cacheBust: true,
            pixelRatio: 2,
        })
        .then((dataUrl) => {
            const link = document.createElement('a');
            link.download = 'autodrive-score-card.png';
            link.href = dataUrl;
            link.click();
        })
        .catch((err) => {
            console.error('Could not save score card image', err);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'Could not save the Score Card as an image.',
            });
        });
    })
    .catch((err) => {
        console.error('Could not load html-to-image library', err);
        toast({
            variant: 'destructive',
            title: 'Feature not available',
            description: 'The image saving feature could not be loaded.',
        });
    });
  };

  if (loading || dataLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  const managerialRoles: UserRole[] = ['manager', 'Service Manager', 'Parts Manager', 'Finance Manager', 'Owner', 'Trainer', 'Admin', 'General Manager'];
  const isManager = managerialRoles.includes(user.role);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
        <ScoreCard ref={scoreCardRef} user={user} activity={activity} badges={badges} />
        <Button onClick={handleDownload} className="mt-4">
            <Download className="mr-2 h-4 w-4" />
            Save as Image
        </Button>
      </main>
      {!isManager && <BottomNav />}
    </div>
  );
}
