import { useEffect, useRef } from 'react';
import type { Track } from '@shared/types';
import { facetArtists, SORT_LABELS, type SortKey } from '../lib/filters';
import { formatDuration } from '../lib/format';
import { useLibraryParams } from '../hooks/useLibraryParams';
import { usePlayer } from '../state/player';
import { cx } from '../lib/cx';
import { IconClose, IconGrid, IconList, IconSearch } from './Icon';

const SORTS: SortKey[] = ['title', 'artist', 'album', 'duration', 'recent', 'quality'];

interface FilterRailProps {
  tracks: Track[];
  totalSec: number;
}

export function FilterRail({ tracks, totalSec }: FilterRailProps) {
  const { query, update } = useLibraryParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const view = usePlayer((state) => state.view);
  const setView = usePlayer((state) => state.setView);
  const artists = facetArtists(tracks);

  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('mv2:focus-search', focus);
    return () => window.removeEventListener('mv2:focus-search', focus);
  }, []);

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 border-2 border-line bg-panel px-3 py-2">
          <IconSearch size={16} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query.text}
            onChange={(event) => update({ text: event.target.value })}
            placeholder="搜索曲名 / 艺人 / 专辑 / 文件名"
            className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:text-muted"
          />
          <kbd className="hidden border border-line px-1 font-mono text-[10px] text-muted sm:block">
            /
          </kbd>
          {query.text && (
            <button type="button" onClick={() => update({ text: '' })} aria-label="清空搜索">
              <IconClose size={14} className="text-muted hover:text-clash-1" />
            </button>
          )}
        </label>

        <div className="flex items-center gap-1">
          {SORTS.map((key) => (
            <button
              key={key}
              type="button"
              data-on={query.sort === key || undefined}
              onClick={() =>
                update(
                  query.sort === key
                    ? { desc: !query.desc }
                    : {
                        sort: key,
                        desc: key === 'duration' || key === 'recent' || key === 'quality',
                      },
                )
              }
              title={
                query.sort === key ? (query.desc ? '降序' : '升序') : `按${SORT_LABELS[key]}排序`
              }
              className="mv-btn !px-2 !py-1.5 !text-[10px]"
            >
              {SORT_LABELS[key]}
              {query.sort === key && <span>{query.desc ? ' ↓' : ' ↑'}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            data-on={view === 'list' || undefined}
            onClick={() => setView('list')}
            aria-label="列表视图"
            className="mv-btn !px-2 !py-1.5"
          >
            <IconList size={15} />
          </button>
          <button
            type="button"
            data-on={view === 'grid' || undefined}
            onClick={() => setView('grid')}
            aria-label="网格视图"
            className="mv-btn !px-2 !py-1.5"
          >
            <IconGrid size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mv-label">ARTIST</span>
        <button
          type="button"
          data-on={!query.artist || undefined}
          onClick={() => update({ artist: null })}
          className="mv-btn !px-2 !py-1 !text-[10px]"
        >
          全部
        </button>
        {artists.map((artist) => (
          <button
            key={artist.name}
            type="button"
            data-on={query.artist === artist.name || undefined}
            onClick={() => update({ artist: query.artist === artist.name ? null : artist.name })}
            className="mv-btn !px-2 !py-1 !text-[10px]"
          >
            {artist.name}
            <span className="opacity-60 tabular-nums">{artist.count}</span>
          </button>
        ))}
      </div>

      <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
        {tracks.length} / {formatDuration(totalSec)} ·{' '}
        {cx(
          query.artist ? `ARTIST=${query.artist}` : '',
          query.text ? `Q="${query.text}"` : '',
        ).trim() || 'NO FILTER'}
      </p>
    </div>
  );
}
