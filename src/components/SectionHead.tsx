import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface SectionHeadProps {
  index: string;
  title: string;
  sub?: string;
  right?: ReactNode;
  tone?: 'accent' | 'clash-1' | 'clash-2';
  /** 当页面主标题用时传 1：每页都该有且只有一个 h1 */
  level?: 1 | 2;
}

const TONE_BG: Record<string, string> = {
  accent: 'bg-accent text-on-accent',
  'clash-1': 'bg-clash-1 text-white',
  'clash-2': 'bg-clash-2 text-ink',
};

export function SectionHead({
  index,
  title,
  sub,
  right,
  tone = 'accent',
  level = 2,
}: SectionHeadProps) {
  const Heading = (level === 1 ? 'h1' : 'h2') as 'h1' | 'h2';

  return (
    <div className="relative mb-6 flex flex-wrap items-end justify-between gap-4 pb-4">
      {/* 分割线从左往右画出，比静态 border 更有入场感 */}
      <span className="mv-rule absolute inset-x-0 bottom-0 h-[2px] bg-line" aria-hidden="true" />
      <div className="flex items-end gap-3">
        <span
          className={cx(
            'mv-pop-in grid size-9 shrink-0 place-items-center border-2 border-line font-mono text-[12px] font-bold',
            'transition-transform duration-200 hover:rotate-[-6deg] hover:scale-110',
            TONE_BG[tone] ?? TONE_BG.accent,
          )}
        >
          {index}
        </span>
        <div>
          <Heading className="font-display text-[clamp(26px,4.2vw,46px)]">{title}</Heading>
          {sub && (
            <p className="mt-1 font-mono text-[11px] tracking-widest text-muted uppercase">{sub}</p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
