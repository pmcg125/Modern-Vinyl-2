import type { Bar } from '../lib/stats';
import { formatDuration } from '../lib/format';
import { clashOf, cx } from '../lib/cx';
import { useReveal } from '../hooks/useMotion';

interface BarChartProps {
  title: string;
  bars: Bar[];
  /** 数值怎么显示：秒数用 duration，其它用整数 */
  unit?: 'seconds' | 'count';
  /** 条形配色跟随标签散列，保持撞色一致性 */
  perLabelColor?: boolean;
  color?: string;
}

/** 硬边条形剖面：无图表库，纯 DOM + 进入视口时展开 */
export function BarChart({
  title,
  bars,
  unit = 'count',
  perLabelColor = false,
  color = 'var(--accent)',
}: BarChartProps) {
  const { containerRef, revealed } = useReveal<HTMLDivElement>(bars.length);
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <div className="border-2 border-line bg-panel p-4">
      <h3 className="mb-3 font-display text-[17px]">{title}</h3>

      <div ref={containerRef} className="space-y-2">
        {bars.map((bar) => (
          <div key={bar.label} className="grid grid-cols-[76px_1fr_auto] items-center gap-2">
            <span className="truncate font-mono text-[11px]" title={bar.label}>
              {bar.label}
            </span>
            <span className="relative block h-4 border-2 border-line bg-bg-2">
              <span
                className={cx('absolute inset-y-0 left-0 transition-[width] duration-700 ease-out')}
                style={{
                  width: revealed ? `${Math.max(2, (bar.value / max) * 100)}%` : '0%',
                  background: perLabelColor ? clashOf(bar.label) : color,
                }}
              />
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">
              {unit === 'seconds' ? formatDuration(bar.value) : bar.value}
            </span>
          </div>
        ))}
      </div>

      {bars.some((bar) => bar.hint) && (
        <p className="mv-label mt-3">
          {bars
            .slice(0, 3)
            .map((bar) => `${bar.label} ${bar.hint ?? ''}`)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}
