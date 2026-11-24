import { cx } from '../lib/cx';

/** 列表骨架：与 TrackTable 行高一致，加载时不跳动 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border-2 border-line bg-panel" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-line/40 px-3 py-3 last:border-b-0"
        >
          <span className="w-7 animate-pulse bg-ink/10" style={{ height: 12 }} />
          <span className="size-10 shrink-0 animate-pulse bg-ink/12" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-1/2 animate-pulse bg-ink/12" />
            <span className="block h-2.5 w-1/3 animate-pulse bg-ink/8" />
          </span>
          <span className="h-3 w-10 animate-pulse bg-ink/10" />
        </div>
      ))}
    </div>
  );
}

/** 网格骨架：方形封面块 + 两行文字 */
export function GridSkeleton({ cards = 8, className }: { cards?: number; className?: string }) {
  return (
    <div
      className={cx(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
        className,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: cards }, (_, i) => (
        <div key={i}>
          <div className="aspect-square w-full animate-pulse bg-ink/12" />
          <div className="mt-2 h-3 w-3/4 animate-pulse bg-ink/10" />
          <div className="mt-1.5 h-2.5 w-1/2 animate-pulse bg-ink/8" />
        </div>
      ))}
    </div>
  );
}

/** 页面级加载态：曲库还没回来时统一用它，避免各页把「空」当成「无数据」 */
export function PageLoading({ grid = false }: { grid?: boolean }) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-10">
      <LoadingBlock />
      {grid ? <GridSkeleton /> : <ListSkeleton rows={8} />}
    </div>
  );
}

/** 统一「正在读盘」状态，替代各页各写一份 */
export function LoadingBlock({ label = 'SCANNING · 正在读取本地曲库' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 border-2 border-line bg-panel px-4 py-3 font-mono text-[11px] tracking-widest text-muted uppercase">
      <span className="inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 bg-accent"
            style={{ animation: `mv-eq 0.8s ${i * 0.15}s ease-in-out infinite alternate` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
