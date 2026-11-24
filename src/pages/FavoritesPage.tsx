import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { useLibraryTracks } from '../state/selectors';
import { toast } from '../state/toast';
import { applyQuery, facetArtists, pickByIds, sumDuration } from '../lib/filters';
import { useLibraryParams } from '../hooks/useLibraryParams';
import { formatBytes, formatDateTime, formatDuration } from '../lib/format';
import { FilterRail } from '../components/FilterRail';
import { TrackTable } from '../components/TrackTable';
import { TrackGrid } from '../components/TrackGrid';
import { PageLoading } from '../components/Skeleton';
import { IconHeart, IconPlay } from '../components/Icon';

export function FavoritesPage() {
  const tracks = useLibraryTracks();
  const status = usePlayer((state) => state.status);
  const favorites = usePlayer((state) => state.favorites);
  const plays = usePlayer((state) => state.plays);
  const view = usePlayer((state) => state.view);
  const playQueue = usePlayer((state) => state.playQueue);
  const { query } = useLibraryParams();

  const favTracks = useMemo(
    () =>
      pickByIds(tracks, [...favorites]).sort((a, b) =>
        a.title.localeCompare(b.title, 'zh-Hans-CN'),
      ),
    [tracks, favorites],
  );
  const deferredText = useDeferredValue(query.text);
  const filtered = useMemo(
    () =>
      applyQuery(favTracks, {
        text: deferredText,
        artist: query.artist,
        sort: query.sort,
        desc: query.desc,
      }),
    [favTracks, deferredText, query.artist, query.sort, query.desc],
  );
  const topArtist = facetArtists(favTracks)[0];
  const bytes = favTracks.reduce((sum, track) => sum + track.bytes, 0);

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'ModernVinyl2',
      count: favTracks.length,
      tracks: favTracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationSec,
        plays: plays[track.id]?.count ?? 0,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modernvinyl2-favorites.json';
    link.click();
    URL.revokeObjectURL(url);
    toast('已导出收藏清单 JSON', 'accent');
  };

  if (status !== 'ready') return <PageLoading grid={view === 'grid'} />;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-line pb-5">
        <div>
          <p className="mv-label">FAVS / 本机收藏（存在 localStorage）</p>
          <h1 className="mt-1 font-display text-[clamp(38px,7vw,86px)]">
            HEART<span className="text-clash-1">BEAT</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!favTracks.length}
            onClick={() => playQueue({ label: '收藏', tracks: favTracks }, 0)}
            className="flex items-center gap-2 border-2 border-line bg-accent px-4 py-2.5 font-mono text-[11px] tracking-widest text-on-accent uppercase shadow-hard-sm hover:-translate-y-0.5 disabled:opacity-40"
          >
            <IconPlay size={15} /> 播放收藏
          </button>
          <button
            type="button"
            disabled={!favTracks.length}
            onClick={exportJson}
            className="mv-btn !py-2.5"
          >
            导出 JSON
          </button>
        </div>
      </div>

      {favTracks.length === 0 ? (
        <div className="border-2 border-dashed border-line px-6 py-20 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center border-2 border-line bg-clash-1 text-white">
            <IconHeart size={24} />
          </span>
          <h2 className="font-display text-[28px]">EMPTY HANDS</h2>
          <p className="mx-auto mt-3 max-w-[42ch] text-[14px] text-muted">
            还没有收藏。在曲库或播放条上点心形按钮（快捷键{' '}
            <kbd className="font-mono text-ink">F</kbd>） 就会留在这里，只存本机。
          </p>
          <Link to="/library" className="mv-btn mt-6">
            去曲库淘
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['FAVS', String(favTracks.length)],
              ['PLAYTIME', formatDuration(sumDuration(favTracks))],
              ['ON DISK', formatBytes(bytes)],
              ['TOP ARTIST', topArtist?.name ?? '—'],
            ].map(([label, value], index) => (
              <div
                key={label}
                className="border-2 border-line px-4 py-3"
                style={{
                  background:
                    index === 0 ? 'var(--accent)' : index === 3 ? 'var(--clash-1)' : 'var(--panel)',
                  color: index === 0 ? 'var(--on-accent)' : index === 3 ? '#fff' : 'var(--ink)',
                }}
              >
                <div className="font-display truncate text-[clamp(22px,3vw,34px)]">{value}</div>
                <div className="mv-label mt-1 opacity-80">{label}</div>
              </div>
            ))}
          </div>

          <FilterRail tracks={favTracks} totalSec={sumDuration(filtered)} />

          {view === 'list' ? (
            <TrackTable tracks={filtered} label="收藏" />
          ) : (
            <TrackGrid tracks={filtered} label="收藏" />
          )}

          <p className="mt-6 font-mono text-[10px] tracking-widest text-muted uppercase">
            STORAGE · mv2:favorites:v1 · UPDATED {formatDateTime(new Date().toISOString())}
          </p>
        </>
      )}
    </div>
  );
}
