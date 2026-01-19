'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
}

export function Logo({ width = 64, height = 64, className }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="AutoDrive Logo"
      width={width}
      height={height}
      className={cn('object-contain', className)}
    />
  );
}
