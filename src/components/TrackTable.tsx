import { useEffect } from 'react';
import type { Track } from '@shared/types';
import { usePlayer } from '../state/player';
import { useReveal } from '../hooks/useMotion';
import { toast } from '../state/toast';
import { formatDuration } from '../lib/format';
import { cx } from '../lib/cx';
import { CoverPlate } from './CoverPlate';
import { IconHeart, IconPause, IconPlay, IconPlus } from './Icon';

interface TrackTableProps {
  tracks: Track[];
  label: string;
  showAlbum?: boolean;
  dense?: boolean;
}

function PlayingBars() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-accent"
          style={{
            height: '100%',
            animation: `mv-eq 0.9s ${i * 0.18}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

export function TrackTable({ tracks, label, showAlbum = true, dense = false }: TrackTableProps) {
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const playTrack = usePlayer((state) => state.playTrack);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const favorites = usePlayer((state) => state.favorites);
  const toggleFavorite = usePlayer((state) => state.toggleFavorite);
  const enqueueNext = usePlayer((state) => state.enqueueNext);
  const plays = usePlayer((state) => state.plays);
  const { containerRef, revealed, delayOf } = useReveal<HTMLUListElement>(tracks.length);

  // 切歌时把当前行带进视野；已经在屏幕上就不动，免得跟用户抢滚动
  useEffect(() => {
    const node = containerRef.current?.querySelector<HTMLElement>('[data-current="1"]');
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const visible = rect.top >= 58 && rect.bottom <= window.innerHeight - 110;
    if (!visible) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [current?.id, tracks]);

  if (!tracks.length) {
    return (
      <div className="border-2 border-dashed border-line p-10 text-center font-mono text-[12px] tracking-widest text-muted uppercase">
        NO TRACKS · 没有匹配的曲目
      </div>
    );
  }

  return (
    <div className="border-2 border-line bg-panel">
      <div className="hidden items-center gap-3 border-b-2 border-line bg-bg-2 px-3 py-2 font-mono text-[10px] tracking-[0.2em] text-muted uppercase sm:flex">
        <span className="w-7 text-right">#</span>
        <span className="w-10" />
        <span className="flex-1">TITLE / 曲目</span>
        {showAlbum && <span className="hidden w-[28%] lg:block">ALBUM / 专辑</span>}
        <span className="hidden w-14 text-right md:block">PLAYS</span>
        <span className="w-14 text-right">TIME</span>
        <span className="w-8" />
      </div>

      <ul
        ref={containerRef}
        onKeyDown={(event) => {
          // 焦点在表内时上下键用于走行；否则交给全局音量快捷键
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-row]'));
          const at = rows.indexOf(document.activeElement as HTMLElement);
          if (at === -1) return;

          event.preventDefault();
          event.stopPropagation();
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          rows[(at + delta + rows.length) % rows.length]?.focus();
        }}
      >
        {tracks.map((track, index) => {
          const isCurrent = current?.id === track.id;
          const fav = favorites.has(track.id);

          return (
            <li
              key={track.id}
              data-in={revealed ? 1 : 0}
              data-current={isCurrent ? '1' : undefined}
              style={{ ['--d' as string]: delayOf(index) }}
              className={cx(
                'mv-reveal group relative flex items-center gap-3 border-b border-line/40 px-3 transition-colors last:border-b-0',
                dense ? 'py-1.5' : 'py-2.5',
                isCurrent ? 'bg-accent/12' : 'hover:bg-ink hover:text-bg',
              )}
            >
              {isCurrent && <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-accent" />}

              <button
                type="button"
                data-row
                onClick={() => (isCurrent ? togglePlay() : playTrack(track, { label, tracks }))}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <span className="w-7 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums group-hover:text-bg">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <CoverPlate
                  id={track.id}
                  title={track.title}
                  hasCover={track.hasCover}
                  className={cx('shrink-0', dense ? 'size-8' : 'size-10')}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">{track.title}</span>
                    {isCurrent && playing && <PlayingBars />}
                  </span>
                  <span className="block truncate font-mono text-[11px] opacity-70">
                    {track.artist}
                    {track.bitrateKbps ? ` · ${track.bitrateKbps}k` : ''}
                  </span>
                </span>

                {showAlbum && (
                  <span className="hidden w-[28%] truncate text-[13px] opacity-80 lg:block">
                    {track.album}
                  </span>
                )}

                <span className="hidden w-14 shrink-0 text-right font-mono text-[11px] tabular-nums opacity-70 md:block">
                  {plays[track.id]?.count ?? 0}
                </span>

                <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums">
                  {formatDuration(track.durationSec)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  enqueueNext(track);
                  toast(`下一首播放《${track.title}》`, 'accent');
                }}
                aria-label="下一首播放"
                title="下一首播放"
                className="grid size-8 shrink-0 place-items-center border-2 border-transparent text-muted opacity-0 transition-all group-hover:border-bg group-hover:text-bg group-focus-within:opacity-100 max-md:opacity-100"
              >
                <IconPlus size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleFavorite(track.id);
                  toast(
                    fav ? `已取消收藏《${track.title}》` : `已收藏《${track.title}》`,
                    fav ? 'info' : 'accent',
                  );
                }}
                aria-label={fav ? '取消收藏' : '收藏'}
                className={cx(
                  'grid size-8 shrink-0 place-items-center border-2 transition-colors',
                  fav
                    ? 'border-clash-1 bg-clash-1 text-white'
                    : 'border-transparent text-muted group-hover:border-bg group-hover:text-bg',
                )}
              >
                {isCurrent ? (
                  playing ? (
                    <IconPause size={14} />
                  ) : (
                    <IconPlay size={14} />
                  )
                ) : (
                  <IconHeart size={15} filled={fav} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
