
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { BottomNav } from '@/components/layout/bottom-nav';
import { UserRole, LessonLog, Badge as BadgeType, Dealership, managerialRoles } from '@/lib/definitions';
import { getConsultantActivity, getEarnedBadgesByUserId, getDealerships } from '@/lib/data.client';
import { ScoreCard } from '@/components/profile/score-card';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import Link from 'next/link';

export default function ScoreCardPage() {
  const { user, loading, isTouring } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<LessonLog[]>([]);
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const scoreCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      async function fetchData() {
        setDataLoading(true);
        const [fetchedActivity, fetchedBadges, fetchedDealerships] = await Promise.all([
          getConsultantActivity(user!.userId),
          getEarnedBadgesByUserId(user!.userId),
          getDealerships(),
        ]);
        setActivity(fetchedActivity);
        setBadges(fetchedBadges);
        setDealerships(fetchedDealerships);
        setDataLoading(false);
      }
      fetchData();
    }
  }, [user]);

  const dealershipName = useMemo(() => {
    if (!user || !dealerships || dealerships.length === 0) return 'AutoDrive';
    const userDealershipId = user.dealershipIds?.[0] || user.selfDeclaredDealershipId;
    if (userDealershipId) {
        const dealership = dealerships.find(d => d.id === userDealershipId);
        return dealership?.name || 'AutoDrive';
    }
    return 'AutoDrive';
  }, [user, dealerships]);

  const vCardData = useMemo(() => {
    if (!user) return '';

    const nameParts = user.name.split(' ');
    const lastName = nameParts.pop() || '';
    const firstName = nameParts.join(' ');

    return `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName};;;
FN:${user.name}
ORG:${dealershipName}
TITLE:${user.role}
TEL;TYPE=WORK,VOICE:${user.phone || ''}
EMAIL:${user.email}
END:VCARD`;
  }, [user, dealershipName]);

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

  const isManager = managerialRoles.includes(user.role);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            <div className="flex-shrink-0">
                <ScoreCard ref={scoreCardRef} user={user} activity={activity} badges={badges} dealerships={dealerships} />
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Save as Image
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>
            </div>
            {isClient && (
              <div className="flex flex-col items-center gap-4 text-center lg:w-48">
                  <div className="bg-white p-4 rounded-lg border-4 border-cyan-400/50">
                      <QRCode value={vCardData} size={192} />
                  </div>
                  <h3 className="font-bold text-lg">Scan to Add Contact</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Open your phone's camera and point it at the QR code to save {user.name}'s contact information.</p>
              </div>
            )}
        </div>
      </main>
      {!isManager && !isTouring && <BottomNav />}
    </div>
  );
}
