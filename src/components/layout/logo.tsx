'use client';

import Image from 'next/image';
import { GearAvatarIcon } from '@/components/branding/gear-avatar-icon';
import { cn } from '@/lib/utils';

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
    variant?: 'full' | 'icon';
}

export function Logo({ width = 24, height = 24, className, variant = 'icon' }: LogoProps) {
  if (variant === 'icon') {
    return <GearAvatarIcon size={Math.max(width, height)} className={className} />;
  }

  return (
    <Image
      src="/AutoDriveCXLogo030625.png"
      alt="AutoDriveCX Logo"
      width={width}
      height={height}
      className={cn('object-contain', className)}
    />
  );
}
