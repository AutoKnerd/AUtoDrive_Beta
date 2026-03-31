import { useId, type SVGProps } from 'react';
import { cn } from '@/lib/utils';

interface GearAvatarIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  gearColor?: string;
  innerColor?: string;
  ringColor?: string;
  glassesFrameColor?: string;
  lensColor?: string;
}

function buildGearPath(cx: number, cy: number, innerRadius: number, outerRadius: number, teeth: number) {
  const steps = teeth * 4;
  const points: string[] = [];
  const toothAngle = (Math.PI * 2) / teeth;
  const sideInset = toothAngle * 0.18;
  const valleyInset = toothAngle * 0.12;

  for (let i = 0; i < steps; i += 1) {
    const toothIndex = Math.floor(i / 4);
    const phase = i % 4;
    const baseAngle = (-Math.PI / 2) + toothIndex * toothAngle;
    const angleOffsets = [
      -sideInset,
      sideInset,
      (toothAngle / 2) - valleyInset,
      (toothAngle / 2) + valleyInset,
    ];
    const radius = phase < 2 ? outerRadius : innerRadius;
    const angle = baseAngle + angleOffsets[phase];
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`;
}

const gearPath = buildGearPath(64, 64, 50, 63, 12);

export function GearAvatarIcon({
  size = 128,
  className,
  gearColor = '#0A0A0A',
  innerColor = '#66BC27',
  ringColor = '#F8F4E7',
  glassesFrameColor = '#080808',
  lensColor = '#F4EED9',
  ...props
}: GearAvatarIconProps) {
  const svgId = useId().replace(/:/g, '');
  const leftLensId = `gear-avatar-lens-left-${svgId}`;
  const rightLensId = `gear-avatar-lens-right-${svgId}`;
  const shadowId = `gear-avatar-shadow-${svgId}`;

  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      role="img"
      aria-label="AutoKnerd gear avatar"
      className={cn('shrink-0', className)}
      {...props}
    >
      <defs>
        <linearGradient id={leftLensId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBF6E7" />
          <stop offset="100%" stopColor={lensColor} />
        </linearGradient>
        <linearGradient id={rightLensId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEF" />
          <stop offset="100%" stopColor={lensColor} />
        </linearGradient>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        <path d={gearPath} fill={gearColor} stroke="#78C72B" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="64" cy="64" r="35" fill={ringColor} />
        <circle cx="64" cy="64" r="31" fill={innerColor} stroke="#111111" strokeWidth="1.75" />

        <g transform="translate(4 -1) rotate(3 60 60)">
          <path
            d="M30 58.5c1-5.9 4.6-8.8 11.4-9.8l13.7-1.8c4.6-.6 8.3.2 11.4 2.5 2.6 1.9 5.3 2 7.8.2 2.8-2 6.1-2.8 10.4-2.3l11.6 1.5c6.2.8 9.1 3.3 10.1 8.1l1.4 6.7-4.1.8-1.1-4.6c-.8-3.1-2.6-4.5-6.9-5.1l-11.3-1.4c-3.8-.5-6.4.1-8.5 1.8-4.2 3.2-8.9 3.1-13.3-.1-2.2-1.6-5.2-2.1-9.1-1.6l-13.4 1.8c-4.5.6-6.8 2.4-7.8 6.2l-1.1 4.1-4.1-.9z"
            fill={glassesFrameColor}
          />
          <path
            d="M33.4 61.5c1.5-6 5.7-8.8 12-8.8h7.3c5.3 0 8.5 1.3 10.3 4.7 1.1 2.1 1.3 5.1.6 8.8l-1.2 6.2c-1.6 8-5.8 11.5-13.5 11.5h-6.6c-8.1 0-12.5-4.1-12.5-11.5 0-1.5.2-3 .5-4.6l1.1-6.3z"
            fill={`url(#${leftLensId})`}
          />
          <path
            d="M71.8 66.2c-.8-4.4-.4-7.8 1.4-10.2 2.1-2.8 5.4-4 10.5-4h7c8.7 0 13 3.8 13 11.4 0 1.1-.1 2.3-.4 3.5l-1.3 6.5c-1.4 7.1-5.8 10.8-12.8 10.8h-6.8c-7.4 0-11.8-3.7-13.2-11.3l-.9-6.7z"
            fill={`url(#${rightLensId})`}
          />
          <path
            d="M32.4 60.8c1.5-5.6 5.6-8.2 12-8.2h7.8c6.5 0 10.1 2.4 11 8.1l1.4 8.8c1.2 8-3.1 14.8-11 16l-8.1 1.2c-8.2 1.3-15.5-4.7-15.5-13 0-1 .1-2.1.3-3.1l2.1-9.8z"
            fill="none"
            stroke={glassesFrameColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M71.1 61.5c.8-5.9 4.7-8.9 11.4-8.9h8.1c8.2 0 13.7 5.6 13.7 13.8 0 .9-.1 1.9-.3 2.8l-1.7 8.4c-1.4 6.8-6.2 10.9-13.1 10.9h-8c-6.8 0-11.7-4.1-13-10.9l-1.3-6.8c-.2-1-.3-2.1-.3-3.1 0-1 .2-2.1.5-3.2l.8-3z"
            fill="none"
            stroke={glassesFrameColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M62.8 61.1c1.5 1.4 3.4 2.1 5.6 2.1 2.1 0 4-.7 5.6-2.1"
            fill="none"
            stroke={glassesFrameColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M29.1 56.8c.6-4.3 3.2-6.3 7.7-6.3h5.5"
            fill="none"
            stroke={glassesFrameColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M96.3 50.5h5c4.2 0 6.8 1.9 7.6 5.8"
            fill="none"
            stroke={glassesFrameColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <ellipse cx="36.5" cy="55.6" rx="1.8" ry="1.4" fill="#FFF9EA" />
          <ellipse cx="85.4" cy="54.6" rx="2" ry="1.5" fill="#FFF9EA" />
          <path
            d="M107.7 58.5h4.6"
            fill="none"
            stroke="#FFF9EA"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}
