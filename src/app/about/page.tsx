
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, BarChart, Bot, BrainCircuit, Users, Target, ArrowRight, User, Shield } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';

export default function AboutPage() {
  const [isTouring, setIsTouring] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleStartTour = async (role: 'consultant' | 'manager') => {
    setIsTouring(true);
    const email = role === 'consultant' ? 'consultant.demo@autodrive.com' : 'manager.demo@autodrive.com';
    const roleName = role === 'consultant' ? 'Sales Consultant' : 'Sales Manager';
    try {
        await login(email, 'readyplayer1');
        toast({
            title: 'Tour Started!',
            description: `You're now viewing as a ${roleName}.`,
        });
        router.push('/');
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Tour Failed',
            description: (error as Error).message || 'Could not start the tour. Please try again.',
        });
        setIsTouring(false);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative h-[60vh] flex items-center justify-center text-center text-white bg-slate-900">
          <Image
            src="https://picsum.photos/seed/about-hero/1200/800"
            alt="Interior of a modern luxury car"
            fill
            className="absolute inset-0 z-0 object-cover opacity-30"
            data-ai-hint="modern car interior"
          />
          <div className="relative z-10 p-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">
              The Future of Automotive Training is Here
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground mb-8">
              Stop settling for inconsistent results. AutoDrive uses AI to build elite sales and service teams that consistently delight customers and smash targets.
            </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="lg" disabled={isTouring}>
                      {isTouring ? <Spinner /> : 'Take a Guided Tour'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Choose Your Tour Perspective</DialogTitle>
                      <DialogDescription>
                        Select a role to experience how AutoDrive empowers every member of your team.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <Button variant="outline" className="h-auto p-6 flex-col gap-2 items-start whitespace-normal" onClick={() => handleStartTour('consultant')} disabled={isTouring}>
                            <div className="flex items-center gap-2">
                               <User className="h-5 w-5 text-primary" />
                               <h3 className="font-semibold">Team Member</h3>
                            </div>
                            <p className="text-sm text-muted-foreground text-left">Explore as a Sales Consultant or Service Writer. Focus on personal growth and mastering customer interactions.</p>
                             <div className="flex items-center text-sm text-primary font-semibold mt-2">
                                Start Tour <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </Button>
                         <Button variant="outline" className="h-auto p-6 flex-col gap-2 items-start whitespace-normal" onClick={() => handleStartTour('manager')} disabled={isTouring}>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold">Leader</h3>
                            </div>
                            <p className="text-sm text-muted-foreground text-left">View as a Manager or Owner. See how AutoDrive provides high-level insights to coach your team effectively.</p>
                             <div className="flex items-center text-sm text-primary font-semibold mt-2">
                                Start Tour <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                 <Button asChild size="lg" variant="outline">
                    <Link href="/login">Sign In</Link>
                </Button>
            </div>
          </div>
        </section>

        {/* What is AutoDrive Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Why Choose AutoDrive?</h2>
            <p className="max-w-3xl mx-auto text-lg text-muted-foreground">
              In today's competitive market, a highly skilled team is your biggest advantage. AutoDrive replaces outdated, one-size-fits-all training with a dynamic, on-demand platform. We use sophisticated AI to simulate thousands of real-world customer interactions, providing a safe space for your team to practice, make mistakes, and master their craft. Our system doesn't just train—it transforms, turning potential into peak performance and driving measurable ROI for your dealership.
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">A Smarter Way to Train</h2>
              <p className="text-lg text-muted-foreground mt-2">Powerful features designed for modern dealerships.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card>
                <CardHeader className="items-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-2">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Hyper-Realistic AI Role-Play</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                  Practice any scenario, from handling tough objections to navigating complex service issues. Our AI coach provides instant, unbiased feedback 24/7.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="items-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-2">
                    <Target className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Personalized Skill Paths</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                  AutoDrive identifies individual weaknesses in core CX traits and automatically assigns lessons to create well-rounded, confident professionals.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="items-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-2">
                    <BarChart className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Actionable Manager Insights</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                  Go beyond numbers. Our dashboards reveal team-wide trends and individual progress, empowering you to coach with precision and impact.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="items-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-2">
                    <BrainCircuit className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>AI-Assisted Content Creation</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                  Quickly build and assign custom lessons for your dealership's unique processes. Let our AI suggest realistic scenarios to save you time.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="items-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-2">
                    <Award className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Motivating Gamification</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                  Experience points (XP), levels, and achievement badges foster healthy competition and a culture of continuous learning and improvement.
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="items-center">
                  <div className="p-4 bg-primary/10 rounded-full mb-2">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Enterprise-Ready Platform</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                  Tailored training paths for every role: Sales, Service, Parts, F&I, and Management. Unify your entire dealership's training strategy.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Nationwide Presence Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Trusted by Professionals Nationwide</h2>
            <p className="max-w-3xl mx-auto text-lg text-muted-foreground mb-12">
              From coast to coast, top-performing dealerships and automotive groups rely on AutoDrive to elevate their teams and drive exceptional customer experiences.
            </p>
            <div className="relative aspect-video max-w-5xl mx-auto">
              <Image
                src="https://picsum.photos/seed/usa-heatmap/1200/675"
                alt="A map of the United States showing user locations"
                fill
                className="object-contain"
                data-ai-hint="USA map heatmap"
              />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24 bg-background">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold mb-4">Stop Training. Start Performing.</h2>
                <p className="max-w-2xl mx-auto text-lg text-muted-foreground mb-8">
                    See firsthand how AutoDrive can revolutionize your dealership's performance. Take a free, no-obligation tour today.
                </p>
                 <div className="flex justify-center gap-4">
                    <Button asChild size="lg">
                        <Link href="/signup">Get Started</Link>
                    </Button>
                </div>
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
