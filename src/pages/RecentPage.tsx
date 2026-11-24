import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { useLibraryTracks } from '../state/selectors';
import { toast } from '../state/toast';
import { formatDateTime, formatDuration } from '../lib/format';
import { savePlays } from '../lib/storage';
import { CoverPlate } from '../components/CoverPlate';
import { SectionHead } from '../components/SectionHead';
import { PageLoading } from '../components/Skeleton';
import { IconPlay } from '../components/Icon';
import { useReveal } from '../hooks/useMotion';

function agoLabel(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function RecentPage() {
  const tracks = useLibraryTracks();
  const status = usePlayer((state) => state.status);
  const plays = usePlayer((state) => state.plays);
  const playTrack = usePlayer((state) => state.playTrack);

  const history = useMemo(() => {
    const index = new Map(tracks.map((track) => [track.id, track]));
    return Object.entries(plays)
      .filter(([id]) => index.has(id))
      .map(([id, record]) => ({ track: index.get(id)!, ...record }))
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [tracks, plays]);

  const { containerRef, revealed, delayOf } = useReveal<HTMLOListElement>(history.length);

  const clearHistory = () => {
    savePlays({});
    usePlayer.setState({ plays: {} });
    toast('已清空本机播放记录', 'warn');
  };

  if (status !== 'ready') return <PageLoading />;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10">
      <SectionHead
        index="REC"
        title="RECENTLY PLAYED"
        level={1}
        sub={`${history.length} 条记录 · 只存在这台机器的 localStorage`}
        right={
          <>
            <Link to="/library" className="mv-btn">
              去曲库
            </Link>
            <button
              type="button"
              className="mv-btn"
              disabled={!history.length}
              onClick={clearHistory}
            >
              清空记录
            </button>
          </>
        }
      />

      {!history.length ? (
        <div className="border-2 border-dashed border-line px-6 py-20 text-center">
          <h2 className="font-display text-[30px]">NO HISTORY</h2>
          <p className="mx-auto mt-3 max-w-[40ch] text-[14px] text-muted">
            还没有播放记录。随便播几首，这里会按时间倒序记下你听过什么、听了几次。
          </p>
        </div>
      ) : (
        <ol ref={containerRef} className="border-2 border-line bg-panel">
          {history.map(({ track, count, lastAt }, index) => (
            <li
              key={track.id}
              data-in={revealed ? 1 : 0}
              style={{ ['--d' as string]: delayOf(index) }}
              className="mv-reveal group flex items-center gap-3 border-b border-line/40 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-ink hover:text-bg"
            >
              <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums opacity-70">
                {String(index + 1).padStart(2, '0')}
              </span>
              <CoverPlate
                id={track.id}
                title={track.title}
                hasCover={track.hasCover}
                className="size-10 shrink-0"
              />
              <button
                type="button"
                onClick={() =>
                  playTrack(track, { label: '最近播放', tracks: history.map((row) => row.track) })
                }
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{track.title}</span>
                  <span className="block truncate font-mono text-[11px] opacity-70">
                    {track.artist} · {track.album}
                  </span>
                </span>
                <span className="hidden shrink-0 border-2 border-line px-1.5 py-0.5 font-mono text-[10px] tracking-widest uppercase sm:block">
                  ×{count}
                </span>
                <span className="w-24 shrink-0 text-right font-mono text-[11px] opacity-80">
                  {agoLabel(lastAt)}
                </span>
                <span className="hidden w-32 shrink-0 text-right font-mono text-[10px] opacity-50 lg:block">
                  {formatDateTime(new Date(lastAt).toISOString())}
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums">
                  {formatDuration(track.durationSec)}
                </span>
                <IconPlay size={13} className="shrink-0 opacity-0 group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
