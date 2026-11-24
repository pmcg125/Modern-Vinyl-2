import type { Track, TrackId } from '@shared/types';

export type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'recent' | 'quality';

export interface LibraryQuery {
  text: string;
  artist: string | null;
  sort: SortKey;
  desc: boolean;
}

export const DEFAULT_QUERY: LibraryQuery = {
  text: '',
  artist: null,
  sort: 'title',
  desc: false,
};

export const SORT_LABELS: Record<SortKey, string> = {
  title: '曲名',
  artist: '艺人',
  album: '专辑',
  duration: '时长',
  recent: '入库',
  quality: '码率',
};

/** 全角/大小写/空白差异都不应影响搜索 */
export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000·、,，.。'’-]+/g, '');
}

export function matchesQuery(track: Track, text: string): boolean {
  const needle = normalize(text);
  if (!needle) return true;

  const haystack = normalize(
    [track.title, track.artist, track.albumArtist, track.album, track.genre, track.filename].join(
      ' ',
    ),
  );
  return haystack.includes(needle);
}

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

export function sortTracks(tracks: Track[], sort: SortKey, desc: boolean): Track[] {
  const factor = desc ? -1 : 1;

  const compare = (a: Track, b: Track): number => {
    switch (sort) {
      case 'title':
        return collator.compare(a.title, b.title);
      case 'artist':
        return collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);
      case 'album':
        return collator.compare(a.album, b.album) || (a.trackNo ?? 0) - (b.trackNo ?? 0);
      case 'duration':
        return a.durationSec - b.durationSec;
      case 'recent':
        return a.mtimeMs - b.mtimeMs;
      case 'quality':
        return (a.bitrateKbps ?? 0) - (b.bitrateKbps ?? 0) || collator.compare(a.title, b.title);
    }
  };

  return [...tracks].sort((a, b) => compare(a, b) * factor);
}

export function applyQuery(tracks: Track[], query: LibraryQuery): Track[] {
  const filtered = tracks.filter(
    (track) => matchesQuery(track, query.text) && (!query.artist || track.artist === query.artist),
  );
  return sortTracks(filtered, query.sort, query.desc);
}

export function countBy(
  tracks: Track[],
  pick: (track: Track) => string | null,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    const key = pick(track);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function facetArtists(tracks: Track[]): { name: string; count: number }[] {
  return [...countBy(tracks, (t) => t.artist)]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
}

export function sumDuration(tracks: Track[]): number {
  return tracks.reduce((total, track) => total + track.durationSec, 0);
}

/** 按 key 集合（如收藏 ID）挑出曲目，保持传入顺序 */
export function pickByIds(tracks: Track[], ids: TrackId[]): Track[] {
  const index = new Map(tracks.map((track) => [track.id, track]));
  return ids.map((id) => index.get(id)).filter((track): track is Track => Boolean(track));
}
