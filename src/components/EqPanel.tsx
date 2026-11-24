import type { EqState } from '../lib/storage';
import { usePlayer } from '../state/player';
import { cx } from '../lib/cx';

const PRESETS: { name: string; eq: EqState }[] = [
  { name: 'FLAT', eq: { low: 0, mid: 0, high: 0 } },
  { name: 'BASS+', eq: { low: 6, mid: 1, high: -1 } },
  { name: 'VOCAL', eq: { low: -2, mid: 4, high: 1 } },
  { name: 'NIGHT', eq: { low: 3, mid: -1, high: -4 } },
  { name: 'LIVE', eq: { low: -1, mid: 3, high: 2 } },
  { name: 'AIR', eq: { low: -3, mid: 0, high: 5 } },
];

const BANDS: { key: keyof EqState; label: string; hz: string }[] = [
  { key: 'low', label: 'LOW', hz: '320Hz' },
  { key: 'mid', label: 'MID', hz: '1kHz' },
  { key: 'high', label: 'HIGH', hz: '3kHz' },
];

export function EqPanel({ onClose }: { onClose: () => void }) {
  const eq = usePlayer((state) => state.eq);
  const setEq = usePlayer((state) => state.setEq);
  const resetEq = usePlayer((state) => state.resetEq);

  const isFlat = eq.low === 0 && eq.mid === 0 && eq.high === 0;

  return (
    <section className="mv-panel w-[min(92vw,360px)] p-4">
      <header className="mb-4 flex items-center justify-between border-b-2 border-line pb-2">
        <h3 className="font-display text-[18px]">EQ / 三段均衡</h3>
        <button
          type="button"
          className="mv-btn !px-2 !py-0.5"
          onClick={onClose}
          aria-label="关闭均衡器"
        >
          ×
        </button>
      </header>

      <div className="space-y-4">
        {BANDS.map((band) => {
          const value = eq[band.key];
          return (
            <label key={band.key} className="block">
              <span className="mb-1 flex items-baseline justify-between font-mono text-[11px] tracking-widest uppercase">
                <span className="text-ink">
                  {band.label} <span className="text-muted">{band.hz}</span>
                </span>
                <span className={cx('tabular-nums', value === 0 ? 'text-muted' : 'text-accent')}>
                  {value > 0 ? '+' : ''}
                  {value.toFixed(1)}dB
                </span>
              </span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={value}
                onChange={(event) => setEq({ [band.key]: Number(event.target.value) })}
                className="h-2 w-full cursor-pointer appearance-none border-2 border-line bg-bg-2 accent-[var(--accent)]"
              />
            </label>
          );
        })}
      </div>

      <div className="mt-5 border-t-2 border-line pt-3">
        <p className="mv-label mb-2">PRESETS</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const active =
              eq.low === preset.eq.low && eq.mid === preset.eq.mid && eq.high === preset.eq.high;
            return (
              <button
                key={preset.name}
                type="button"
                data-on={active || undefined}
                className="mv-btn !px-2 !py-1 text-[10px]"
                onClick={() => setEq(preset.eq)}
              >
                {preset.name}
              </button>
            );
          })}
          <button
            type="button"
            className="mv-btn !px-2 !py-1 text-[10px]"
            disabled={isFlat}
            onClick={resetEq}
          >
            RESET
          </button>
        </div>
      </div>
    </section>
  );
}
