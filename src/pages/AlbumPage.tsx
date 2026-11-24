import { Link, useParams } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { useLibraryAlbums } from '../state/selectors';
import { formatBytes, formatDuration, formatSampleRate } from '../lib/format';
import { CoverPlate } from '../components/CoverPlate';
import { TrackTable } from '../components/TrackTable';
import { IconArrowRight, IconPlay, IconShuffle } from '../components/Icon';
import { PageLoading } from '../components/Skeleton';

export function AlbumPage() {
  const { key } = useParams();
  const albums = useLibraryAlbums();
  const status = usePlayer((state) => state.status);
  const playQueue = usePlayer((state) => state.playQueue);
  const setPlayMode = usePlayer((state) => state.setPlayMode);

  if (status !== 'ready') return <PageLoading />;

  const album = albums.find((item) => item.key === key);

  if (!album) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-24 text-center">
        <h1 className="font-display text-[42px] text-clash-1">ALBUM NOT FOUND</h1>
        <p className="mt-3 font-mono text-[12px] text-muted">
          索引里找不到 <span className="text-ink">{key ?? '—'}</span>，可能曲库已重新扫描。
        </p>
        <Link to="/albums" className="mv-btn mt-6">
          回到专辑列表 <IconArrowRight size={14} />
        </Link>
      </div>
    );
  }

  const bytes = album.tracks.reduce((sum, track) => sum + track.bytes, 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10">
      <p className="mb-6 font-mono text-[11px] tracking-widest text-muted uppercase">
        <Link to="/albums" className="hover:text-ink">
          ALBUMS
        </Link>{' '}
        / {album.artist}
      </p>

      <div className="mb-10 grid gap-8 border-b-2 border-line pb-10 lg:grid-cols-[320px_1fr]">
        <CoverPlate
          id={album.coverTrackId}
          title={album.title}
          hasCover={album.hasCover}
          className="aspect-square w-full shadow-hard"
        />

        <div className="flex flex-col justify-between">
          <div>
            <p className="mv-label">LP / 专辑</p>
            <h1 className="mt-2 font-display text-[clamp(34px,6vw,72px)] break-words">
              {album.title}
            </h1>
            <p className="mt-3 text-[17px] font-semibold text-accent">{album.artist}</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['TRACKS', String(album.trackCount)],
              ['TIME', formatDuration(album.durationSec)],
              ['SIZE', formatBytes(bytes)],
              ['SR', formatSampleRate(album.tracks[0]?.sampleRateHz ?? null)],
            ].map(([label, value]) => (
              <div key={label} className="border-2 border-line bg-panel px-3 py-2">
                <div className="font-display text-[22px] text-ink tabular-nums">{value}</div>
                <div className="mv-label mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => playQueue({ label: album.title, tracks: album.tracks }, 0)}
              className="flex items-center gap-2 border-2 border-line bg-accent px-5 py-3 font-mono text-[12px] tracking-widest text-on-accent uppercase shadow-hard hover:-translate-y-0.5"
            >
              <IconPlay size={16} /> 播放整张
            </button>
            <button
              type="button"
              onClick={() => {
                setPlayMode('shuffle');
                const start = Math.floor(Math.random() * album.tracks.length);
                playQueue({ label: album.title, tracks: album.tracks }, start);
              }}
              className="flex items-center gap-2 border-2 border-line bg-clash-2 px-5 py-3 font-mono text-[12px] tracking-widest text-ink uppercase shadow-hard-sm hover:-translate-y-0.5"
            >
              <IconShuffle size={16} /> 打乱播放
            </button>
            <Link to="/albums" className="mv-btn !py-3">
              返回专辑列表
            </Link>
          </div>
        </div>
      </div>

      <TrackTable tracks={album.tracks} label={album.title} showAlbum={false} />
    </div>
  );
}
