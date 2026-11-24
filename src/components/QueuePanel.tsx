import { usePlayer } from '../state/player';
import { toast } from '../state/toast';
import { formatDuration } from '../lib/format';
import { PLAY_MODE_LABEL } from '../lib/playlist';
import { cx } from '../lib/cx';
import { CoverPlate } from './CoverPlate';
import { IconClose, IconPlay, IconPlus } from './Icon';

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const queue = usePlayer((state) => state.queue);
  const order = usePlayer((state) => state.order);
  const cursor = usePlayer((state) => state.cursor);
  const current = usePlayer((state) => state.current);
  const label = usePlayer((state) => state.contextLabel);
  const playMode = usePlayer((state) => state.playMode);
  const jumpTo = usePlayer((state) => state.jumpTo);
  const enqueueNext = usePlayer((state) => state.enqueueNext);
  const removeAt = usePlayer((state) => state.removeAt);

  // 随机模式下按实际播放顺序展示，才看得懂「下一首是谁」
  const playbackOrder =
    playMode === 'shuffle' ? order.map((index) => index) : queue.map((_, i) => i);
  const totalSec = queue.reduce((sum, track) => sum + track.durationSec, 0);

  return (
    <section className="mv-panel flex max-h-[64vh] w-[min(94vw,460px)] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-[18px]">QUEUE / 播放队列</h3>
          <p className="mv-label mt-0.5 truncate">
            {label || '未命名'} · {queue.length} 首 · {formatDuration(totalSec)} ·{' '}
            {PLAY_MODE_LABEL[playMode]}
          </p>
        </div>
        <button
          type="button"
          className="mv-btn !px-2 !py-1"
          onClick={onClose}
          aria-label="关闭队列"
        >
          <IconClose size={14} />
        </button>
      </header>

      {queue.length === 0 ? (
        <p className="px-4 py-12 text-center font-mono text-[12px] tracking-widest text-muted uppercase">
          EMPTY · 点任意曲目建立队列
        </p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto">
          {playbackOrder.map((trackIndex, position) => {
            const track = queue[trackIndex];
            if (!track) return null;
            const isCurrent = current?.id === track.id;
            const isNext = position === cursor + 1;

            return (
              <li
                key={`${track.id}-${trackIndex}`}
                className={cx(
                  'group flex items-center gap-2 border-b border-line/40 px-3 py-2 transition-colors',
                  isCurrent && 'bg-accent text-on-accent',
                  !isCurrent && 'hover:bg-ink hover:text-bg',
                )}
              >
                <button
                  type="button"
                  onClick={() => jumpTo(trackIndex)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="w-6 shrink-0 font-mono text-[11px] tabular-nums opacity-70">
                    {String(position + 1).padStart(2, '0')}
                  </span>
                  <CoverPlate
                    id={track.id}
                    title={track.title}
                    hasCover={track.hasCover}
                    className="size-8 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{track.title}</span>
                    <span className="block truncate font-mono text-[11px] opacity-70">
                      {track.artist}
                      {isNext ? ' · NEXT' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums opacity-80">
                    {formatDuration(track.durationSec)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    enqueueNext(track);
                    toast(`下一首播放《${track.title}》`, 'accent');
                  }}
                  disabled={isCurrent}
                  aria-label="下一首播放"
                  title="下一首播放"
                  className="grid size-7 shrink-0 place-items-center border-2 border-line opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100 disabled:opacity-20"
                >
                  <IconPlus size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeAt(trackIndex);
                    toast(`已从队列移除《${track.title}》`);
                  }}
                  disabled={queue.length <= 1}
                  aria-label="从队列移除"
                  title="从队列移除"
                  className="grid size-7 shrink-0 place-items-center border-2 border-line text-clash-1 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100 disabled:opacity-20"
                >
                  <IconClose size={13} />
                </button>
                {isCurrent && (
                  <span className="grid size-7 shrink-0 place-items-center">
                    <IconPlay size={12} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <footer className="shrink-0 border-t-2 border-line px-4 py-2 font-mono text-[10px] tracking-widest text-muted uppercase">
        + 下一首播放 · × 移除 · 点行直接跳播
      </footer>
    </section>
  );
}
