'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AutoshopCardProps {
  className?: string;
}

export function AutoshopCard({ className }: AutoshopCardProps) {
  return (
    <Card
      className={cn(
        'flex h-full flex-col justify-between border border-[#9d19ff]/80 bg-black p-6 shadow-[0_0_0_1px_rgba(157,25,255,0.32),0_0_28px_rgba(0,0,0,0.35)] dark:border-[#c084fc]/80 dark:bg-black',
        className
      )}
    >
      <CardHeader className="p-0 pb-4 text-center">
        <div className="flex items-center justify-center">
          <div className="relative h-36 w-72 overflow-hidden rounded-md">
            <Image
              src="/Autoshop logo.png"
              alt="AutoShop"
              fill
              sizes="288px"
              className="object-contain"
            />
          </div>
        </div>
        <CardDescription className="text-center text-sm text-muted-foreground">
          A live support toolset for clearer customer conversations and faster next steps.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        <Button asChild className="h-16 w-full bg-[#7CC242] font-bold tracking-wide text-slate-950 shadow-[0_0_20px_rgba(124,194,66,0.35)] hover:bg-[#8ED24F]">
          <Link href="/autoshop">
            Open AutoShop
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
