import type { Track } from '@shared/types';
import { usePlayer } from '../state/player';
import { useReveal } from '../hooks/useMotion';
import { formatDuration } from '../lib/format';
import { cx } from '../lib/cx';
import { CoverPlate } from './CoverPlate';
import { IconHeart } from './Icon';

export function TrackGrid({ tracks, label }: { tracks: Track[]; label: string }) {
  const current = usePlayer((state) => state.current);
  const playTrack = usePlayer((state) => state.playTrack);
  const favorites = usePlayer((state) => state.favorites);
  const toggleFavorite = usePlayer((state) => state.toggleFavorite);
  const { containerRef, revealed, delayOf } = useReveal<HTMLDivElement>(tracks.length);

  if (!tracks.length) {
    return (
      <div className="border-2 border-dashed border-line p-10 text-center font-mono text-[12px] tracking-widest text-muted uppercase">
        NO TRACKS · 没有匹配的曲目
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
    >
      {tracks.map((track, index) => {
        const active = current?.id === track.id;
        const fav = favorites.has(track.id);

        return (
          <figure
            key={track.id}
            data-in={revealed ? 1 : 0}
            style={{ ['--d' as string]: delayOf(index) }}
            className="mv-reveal group relative"
          >
            <button
              type="button"
              onClick={() => playTrack(track, { label, tracks })}
              className="block w-full text-left"
            >
              <CoverPlate
                id={track.id}
                title={track.title}
                hasCover={track.hasCover}
                active={active}
                className="aspect-square w-full"
              />
              <figcaption className="mt-1.5">
                <p
                  className={cx(
                    'truncate text-[13px] font-semibold',
                    active && 'text-accent group-hover:text-accent',
                  )}
                >
                  {track.title}
                </p>
                <p className="truncate font-mono text-[11px] text-muted">{track.artist}</p>
                <p className="mt-0.5 flex items-center justify-between font-mono text-[10px] tracking-wider text-muted uppercase">
                  <span>{formatDuration(track.durationSec)}</span>
                  <span>{track.bitrateKbps ? `${track.bitrateKbps}k` : '—'}</span>
                </p>
              </figcaption>
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(track.id)}
              aria-label={fav ? '取消收藏' : '收藏'}
              className={cx(
                'absolute top-1.5 right-1.5 grid size-7 place-items-center border-2 transition-opacity',
                fav
                  ? 'border-clash-1 bg-clash-1 text-white opacity-100'
                  : 'border-line bg-bg-2 text-muted opacity-0 group-hover:opacity-100 max-md:opacity-100',
              )}
            >
              <IconHeart size={13} filled={fav} />
            </button>
          </figure>
        );
      })}
    </div>
  );
}
