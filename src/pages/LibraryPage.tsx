import { useDeferredValue, useMemo } from 'react';
import { usePlayer } from '../state/player';
import { useLibraryTracks } from '../state/selectors';
import { applyQuery, sumDuration } from '../lib/filters';
import { useLibraryParams } from '../hooks/useLibraryParams';
import { FilterRail } from '../components/FilterRail';
import { TrackTable } from '../components/TrackTable';
import { TrackGrid } from '../components/TrackGrid';
import { PageLoading } from '../components/Skeleton';
import { IconGrid, IconList, IconPlay } from '../components/Icon';

export function LibraryPage() {
  const tracks = useLibraryTracks();
  const status = usePlayer((state) => state.status);
  const view = usePlayer((state) => state.view);
  const playQueue = usePlayer((state) => state.playQueue);
  const { query } = useLibraryParams();
  // 大曲库下输入不卡：搜索词降级渲染，其它筛选项立即生效
  const deferredText = useDeferredValue(query.text);

  const filtered = useMemo(
    () =>
      applyQuery(tracks, {
        text: deferredText,
        artist: query.artist,
        sort: query.sort,
        desc: query.desc,
      }),
    [tracks, deferredText, query.artist, query.sort, query.desc],
  );
  const totalSec = useMemo(() => sumDuration(filtered), [filtered]);

  if (status !== 'ready') return <PageLoading />;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-line pb-5">
        <div>
          <p className="mv-label">LIBRARY / 曲库全量</p>
          <h1 className="mt-1 font-display text-[clamp(38px,7vw,86px)]">
            ALL<span className="text-accent"> TRACKS</span>
          </h1>
        </div>
        <button
          type="button"
          disabled={!filtered.length}
          onClick={() => playQueue({ label: '筛选结果', tracks: filtered }, 0)}
          className="flex items-center gap-2 border-2 border-line bg-accent px-4 py-2.5 font-mono text-[11px] tracking-widest text-on-accent uppercase shadow-hard-sm hover:-translate-y-0.5 disabled:opacity-40"
        >
          <IconPlay size={15} /> 播放这 {filtered.length} 首
        </button>
      </div>

      <FilterRail tracks={tracks} totalSec={totalSec} />

      <div className="flex items-center gap-2 pb-2 font-mono text-[10px] tracking-widest text-muted uppercase">
        {view === 'list' ? <IconList size={13} /> : <IconGrid size={13} />}
        {view === 'list' ? 'LIST VIEW' : 'GRID VIEW'}
      </div>

      {view === 'list' ? (
        <TrackTable tracks={filtered} label="曲库" />
      ) : (
        <TrackGrid tracks={filtered} label="曲库" />
      )}
    </div>
  );
}
