import type { ReactNode, SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  children: ReactNode;
}

/** 直角线性图标：方头描边，与全站硬边语言一致 */
function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconPause = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconPrev = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M19 5v14L8 12z" fill="currentColor" stroke="none" />
    <path d="M5 5v14" />
  </Icon>
);

export const IconNext = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M5 5v14l11-7z" fill="currentColor" stroke="none" />
    <path d="M19 5v14" />
  </Icon>
);

export const IconShuffle = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M3 6h4l10 12h4M3 18h4L17 6h4" />
    <path d="M18 3l3 3-3 3M18 15l3 3-3 3" />
  </Icon>
);

export const IconRepeat = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 12V8a3 3 0 013-3h10M20 12v4a3 3 0 01-3 3H7" />
    <path d="M14 2l3 3-3 3M10 22l-3-3 3-3" />
  </Icon>
);

export const IconRepeatOne = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 12V8a3 3 0 013-3h10M20 12v4a3 3 0 01-3 3H7" />
    <path d="M14 2l3 3-3 3M10 22l-3-3 3-3" />
    <path d="M12 10v4M12 10l1.5-1" strokeWidth={2.6} />
  </Icon>
);

export const IconHeart = ({
  filled,
  ...p
}: {
  size?: number;
  className?: string;
  filled?: boolean;
}) => (
  <Icon {...p}>
    <path
      d="M12 20.5l-7.4-7A4.6 4.6 0 018.6 5.6L12 8.9l3.4-3.3a4.6 4.6 0 014 7.9z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);

export const IconSun = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    <path d="M9 9h6v6H9z" />
  </Icon>
);

export const IconMoon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
  </Icon>
);

export const IconSearch = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 10a6 6 0 016-6 6 6 0 016 6 6 6 0 01-6 6 6 6 0 01-6-6z" />
    <path d="M15.5 15.5L21 21" />
  </Icon>
);

export const IconList = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Icon>
);

export const IconGrid = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" />
  </Icon>
);

export const IconTerminal = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M3 4h18v16H3z" />
    <path d="M7 9l3 3-3 3M12.5 15H17" />
  </Icon>
);

export const IconVolume = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    <path d="M17 8.5l3 3.5-3 3.5" />
  </Icon>
);

export const IconMute = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </Icon>
);

export const IconClose = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </Icon>
);

export const IconRefresh = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M20 6v5h-5M4 18v-5h5" />
    <path d="M19.2 11A7.5 7.5 0 006.5 6.5L4 9M4.8 13a7.5 7.5 0 0012.7 4.5L20 15" />
  </Icon>
);

export const IconQueue = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 6h12M4 12h12M4 18h8" />
    <path d="M17 14.5l5 3-5 3z" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconEq = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M6 3v18M12 3v18M18 3v18" />
    <path d="M3.5 9.5h5M9.5 15.5h5M15.5 7.5h5" strokeWidth={3} />
  </Icon>
);

export const IconDisc = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M3 3h18v18H3z" />
    <path d="M8 8h8v8H8z" />
    <path d="M11.5 11.5h1v1h-1z" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconPlus = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconArrowRight = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M4 12h14M13 6l6 6-6 6" />
  </Icon>
);
