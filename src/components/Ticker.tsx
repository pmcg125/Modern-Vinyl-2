import { cx } from '../lib/cx';

interface TickerProps {
  items: string[];
  tone?: 'ink' | 'accent' | 'clash-1';
  /** 每次循环的秒数，正比于内容长度 */
  speed?: number;
}

const TONE: Record<string, string> = {
  ink: 'bg-ink text-bg',
  accent: 'bg-accent text-on-accent',
  'clash-1': 'bg-clash-1 text-white',
};

/** 街头跑马灯：内容复制两份做无缝位移 */
export function Ticker({ items, tone = 'ink', speed = 38 }: TickerProps) {
  if (!items.length) return null;
  const strip = [...items, ...items];

  return (
    <div
      className={cx(
        'mv-ticker overflow-hidden border-y-2 border-line py-2',
        TONE[tone] ?? TONE.ink,
      )}
      aria-hidden="true"
    >
      <div
        className="mv-marquee-track"
        style={{ animationDuration: `${Math.max(12, speed * (items.length / 8))}s` }}
      >
        {strip.map((text, index) => (
          <span key={index} className="flex shrink-0 items-center gap-4 px-4">
            <span className="font-display text-[15px] tracking-tight whitespace-nowrap uppercase">
              {text}
            </span>
            <span className="font-mono text-[13px] opacity-70">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
