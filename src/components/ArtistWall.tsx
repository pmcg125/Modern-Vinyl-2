import { Link } from 'react-router-dom';
import type { Track } from '@shared/types';
import { facetArtists } from '../lib/filters';
import { clashOf, cx } from '../lib/cx';

/** 艺人墙：出现越多字号越大，颜色由名字散列决定（明暗主题都保持撞色） */
export function ArtistWall({ tracks }: { tracks: Track[] }) {
  const artists = facetArtists(tracks).slice(0, 18);
  if (!artists.length) return null;

  const max = artists[0]?.count ?? 1;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {artists.map((artist, index) => {
        const weight = artist.count / max;
        const size = 14 + weight * 30;

        return (
          <Link
            key={artist.name}
            to={`/library?a=${encodeURIComponent(artist.name)}`}
            className={cx(
              'mv-pop-in inline-flex items-baseline gap-1.5 border-2 border-line px-2.5 py-1 leading-none',
              'transition-transform duration-150 hover:-translate-y-1 hover:rotate-[-1.5deg] hover:shadow-hard-sm',
              weight > 0.66 && 'bg-ink text-bg',
            )}
            style={{
              fontSize: `${size}px`,
              ['--d' as string]: `${Math.min(index, 14) * 45}ms`,
            }}
          >
            <span className="font-display uppercase">{artist.name}</span>
            <span
              className="font-mono text-[10px] tracking-widest tabular-nums"
              style={{ color: weight > 0.66 ? undefined : clashOf(artist.name) }}
            >
              ×{artist.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
