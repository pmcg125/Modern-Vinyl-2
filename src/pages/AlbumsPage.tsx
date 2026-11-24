import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Album } from '@shared/types';
import { usePlayer } from '../state/player';
import { useLibraryAlbums } from '../state/selectors';
import { normalize } from '../lib/filters';
import { formatDuration } from '../lib/format';
import { CoverPlate } from '../components/CoverPlate';
import { IconPlay, IconSearch } from '../components/Icon';
import { SectionHead } from '../components/SectionHead';
import { PageLoading } from '../components/Skeleton';

function albumHaystack(album: Album): string {
  return normalize(
    [album.title, album.artist, album.genre, ...album.tracks.map((t) => t.title)].join(' '),
  );
}

export function AlbumsPage() {
  const albums = useLibraryAlbums();
  const status = usePlayer((state) => state.status);
  const playQueue = usePlayer((state) => state.playQueue);
  const [text, setText] = useState('');

  const filtered = useMemo(() => {
    const needle = normalize(text);
    if (!needle) return albums;
    return albums.filter((album) => albumHaystack(album).includes(needle));
  }, [albums, text]);

  if (status !== 'ready') return <PageLoading grid />;

  const multi = albums.filter((album) => album.trackCount > 1).length;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10">
      <SectionHead
        index="AL"
        title="ALBUMS"
        level={1}
        sub={`${albums.length} 张 · 其中 ${multi} 张多曲目 · 单曲按同名归为一张`}
        right={
          <label className="flex items-center gap-2 border-2 border-line bg-panel px-3 py-2">
            <IconSearch size={15} className="text-muted" />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="筛专辑"
              className="w-40 bg-transparent font-mono text-[12px] outline-none placeholder:text-muted"
            />
          </label>
        }
      />

      {filtered.length === 0 ? (
        <p className="border-2 border-dashed border-line p-10 text-center font-mono text-[12px] tracking-widest text-muted uppercase">
          NO ALBUM MATCH · 没有匹配的专辑
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((album) => (
            <article key={album.key} className="group relative">
              <Link
                to={`/albums/${encodeURIComponent(album.key)}`}
                className="mv-sleeve mv-lift block border-2 border-line"
                data-spine={album.year ? String(album.year) : `${album.trackCount} TRK`}
              >
                <CoverPlate
                  id={album.coverTrackId}
                  title={album.title}
                  hasCover={album.hasCover}
                  artClassName="mv-sleeve-art aspect-square w-full"
                  className="aspect-square w-full"
                />
              </Link>

              <button
                type="button"
                onClick={() => playQueue({ label: album.title, tracks: album.tracks }, 0)}
                aria-label={`播放专辑 ${album.title}`}
                className="absolute top-2 left-2 grid size-9 place-items-center border-2 border-line bg-clash-1 text-white opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
              >
                <IconPlay size={15} />
              </button>

              <div className="mt-2">
                <Link
                  to={`/albums/${encodeURIComponent(album.key)}`}
                  className="block truncate text-[14px] font-semibold hover:text-accent"
                >
                  {album.title}
                </Link>
                <p className="truncate font-mono text-[11px] text-muted">{album.artist}</p>
                <p className="mt-0.5 flex items-center justify-between font-mono text-[10px] tracking-wider text-muted uppercase">
                  <span>
                    {album.trackCount} TRK · {formatDuration(album.durationSec)}
                  </span>
                  <span>{album.year ?? '—'}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
