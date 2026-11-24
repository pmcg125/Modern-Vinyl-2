import { promises as fs } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { parseFile } from 'music-metadata';
import { LIBRARY_SCHEMA } from '@shared/types';
import type { Album, LibraryResponse, LibraryStats, LyricSource, Track } from '@shared/types';
import { encodeTrackId } from './ids.js';
import { readEmbeddedLyrics } from './embeddedLyrics.js';
import { findSidecarLyric } from './lyrics.js';
import { config } from './env.js';

export interface IndexedTrack {
  track: Track;
  /** root 下的相对路径，用 / 分隔 */
  relPath: string;
  absPath: string;
}

export interface LibraryCache {
  library: LibraryResponse;
  byId: Map<string, IndexedTrack>;
}

const MP3 = '.mp3';

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function byZh(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN');
}

async function readTrack(absPath: string, relPath: string, root: string): Promise<IndexedTrack> {
  const [stats, meta] = await Promise.all([
    fs.stat(absPath),
    parseFile(absPath, { duration: true, skipCovers: false }),
  ]);

  const fileStem = basename(absPath, MP3);
  const picture = meta.common.picture?.[0];
  const id3Lyrics = meta.common.lyrics
    ?.map((entry) => ('text' in entry ? entry.text : entry))
    .join('\n');

  const title = meta.common.title?.trim() || fileStem;
  const artist = meta.common.artist?.trim() || '未知艺人';

  let lyricSource: LyricSource = 'none';
  const sidecar = await findSidecarLyric(
    absPath,
    { filename: basename(absPath), title, artist },
    root,
  );
  if (sidecar) lyricSource = sidecar.kind;
  // 标签映射没给歌词时，再手动解一遍二进制帧：SYLT / TXXX / APEv2 都不在 common.lyrics 里
  else if (id3Lyrics?.trim() || (await readEmbeddedLyrics(absPath))) lyricSource = 'id3';

  const track: Track = {
    id: encodeTrackId(relPath),
    title,
    artist,
    albumArtist: meta.common.albumartist?.trim() || artist,
    album: meta.common.album?.trim() || fileStem,
    year: meta.common.year ?? null,
    genre: meta.common.genre?.[0]?.trim() || null,
    trackNo: meta.common.track?.no ?? null,
    durationSec: Math.round(meta.format.duration ?? 0),
    filename: basename(absPath),
    bytes: stats.size,
    bitrateKbps: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : null,
    sampleRateHz: meta.format.sampleRate ?? null,
    codec: meta.format.codec?.trim() || null,
    hasCover: Boolean(picture?.data?.length),
    lyricSource,
    mtimeMs: Math.round(stats.mtimeMs),
  };

  return { track, relPath, absPath };
}

async function walkMusicDir(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [root];

  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      console.warn(`[library] 跳过不可读目录 ${relative(root, dir) || '.'}:`, err);
      continue;
    }

    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(abs);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === MP3) out.push(abs);
    }
  }

  return out.sort();
}

function buildAlbums(tracks: Track[]): Album[] {
  const buckets = new Map<string, Track[]>();

  for (const track of tracks) {
    const key = `${slug(track.albumArtist)}::${slug(track.album)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(track);
    else buckets.set(key, [track]);
  }

  const albums: Album[] = [];
  for (const [key, list] of buckets) {
    const sorted = [...list].sort((a, b) => {
      const byNo = (a.trackNo ?? 9999) - (b.trackNo ?? 9999);
      return byNo !== 0 ? byNo : byZh(a.title, b.title);
    });
    const head = sorted[0];
    if (!head) continue;

    const years = sorted.map((t) => t.year).filter((y): y is number => y != null);
    const genres = sorted.map((t) => t.genre).filter((g): g is string => Boolean(g));

    albums.push({
      key,
      title: head.album,
      artist: head.albumArtist,
      year: years.length ? Math.min(...years) : null,
      genre: genres[0] ?? null,
      trackCount: sorted.length,
      durationSec: sorted.reduce((sum, t) => sum + t.durationSec, 0),
      coverTrackId: head.id,
      hasCover: sorted.some((t) => t.hasCover),
      tracks: sorted,
    });
  }

  return albums.sort((a, b) => byZh(a.artist, b.artist) || byZh(a.title, b.title));
}

function modeSampleRate(tracks: Track[]): number | null {
  const counts = new Map<number, number>();
  for (const t of tracks) {
    if (!t.sampleRateHz) continue;
    counts.set(t.sampleRateHz, (counts.get(t.sampleRateHz) ?? 0) + 1);
  }

  let best: number | null = null;
  let bestCount = 0;
  for (const [rate, count] of counts) {
    if (count > bestCount) {
      best = rate;
      bestCount = count;
    }
  }
  return best;
}

function buildStats(tracks: Track[], albums: Album[]): LibraryStats {
  const unique = <T>(values: (T | null | '')[]): T[] => [
    ...new Set(values.filter((v): v is T => v !== null && v !== '')),
  ];

  return {
    trackCount: tracks.length,
    albumCount: albums.length,
    artistCount: unique(tracks.map((t) => t.artist)).length,
    totalDurationSec: tracks.reduce((sum, t) => sum + t.durationSec, 0),
    totalBytes: tracks.reduce((sum, t) => sum + t.bytes, 0),
    genres: unique(tracks.map((t) => t.genre)).sort(byZh),
    years: unique(tracks.map((t) => t.year))
      .sort((a, b) => b - a)
      .map(Number),
    commonSampleRate: modeSampleRate(tracks),
  };
}

let cache: LibraryCache | null = null;
let pending: Promise<LibraryCache> | null = null;

async function scanLibrary(root: string): Promise<LibraryCache> {
  const startedAt = performance.now();
  const files = await walkMusicDir(root);

  const settled = await Promise.allSettled(
    files.map(async (abs) => {
      const relPath = relative(root, abs).split('\\').join('/');
      return readTrack(abs, relPath, root);
    }),
  );

  const indexed: IndexedTrack[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') indexed.push(result.value);
    else console.warn('[library] 解析失败:', result.reason);
  }

  indexed.sort((a, b) => byZh(a.track.title, b.track.title));

  const byId = new Map(indexed.map((t) => [t.track.id, t]));
  const plain = indexed.map((t) => t.track);
  const albums = buildAlbums(plain);

  const library: LibraryResponse = {
    schema: LIBRARY_SCHEMA,
    generatedAt: new Date().toISOString(),
    scanMs: Math.round(performance.now() - startedAt),
    root: config.musicDirLabel,
    tracks: plain,
    albums,
    stats: buildStats(plain, albums),
  };

  return { library, byId };
}

/** 读取（或重建）曲库缓存；并发调用只会触发一次扫描 */
export function getLibraryCache(
  options: { refresh?: boolean; root?: string } = {},
): Promise<LibraryCache> {
  const root = options.root ?? config.musicDir;
  if (!options.refresh && cache) return Promise.resolve(cache);

  pending ??= scanLibrary(root).then(
    (result) => {
      cache = result;
      pending = null;
      return result;
    },
    (err: unknown) => {
      pending = null;
      throw err;
    },
  );

  return pending;
}

export async function getLibrary(
  options: { refresh?: boolean; root?: string } = {},
): Promise<LibraryResponse> {
  return (await getLibraryCache(options)).library;
}

export async function findTrackId(
  id: string,
  options: { root?: string } = {},
): Promise<IndexedTrack | null> {
  const entry = await getLibraryCache(options);
  return entry.byId.get(id) ?? null;
}

/** 只读已建好的索引，不触发扫描（健康检查用） */
export function peekLibraryStats(): LibraryStats | null {
  return cache?.library.stats ?? null;
}
