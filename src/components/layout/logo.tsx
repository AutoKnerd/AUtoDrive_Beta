'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
    variant?: 'full' | 'icon';
}

export function Logo({ width = 24, height = 24, className, variant = 'icon' }: LogoProps) {
  const src = variant === 'full' ? '/AutoDriveCXLogo030625.png' : '/logo-icon1.png';
  const alt = variant === 'full' ? 'AutoDriveCX Logo' : 'AutoDrive Icon';
  
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn('object-contain', className)}
    />
  );
}
