/** ModernVinyl2 前后端共享契约 */

/** 不透明曲目 ID：相对路径的 base64url */
export type TrackId = string;

/**
 * 歌词来源：
 * - `lrc` 同目录（或 `lyrics/` 子目录）的带时间轴字幕文件
 * - `txt` 同目录纯文本歌词，没有时间轴
 * - `id3` 内嵌在音频文件里的歌词（ID3v2 USLT/SYLT/TXXX 帧，或 APEv2 的 Lyrics 项）
 * - `none` 都没有
 */
export type LyricSource = 'lrc' | 'txt' | 'id3' | 'none';

export interface Track {
  id: TrackId;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  year: number | null;
  genre: string | null;
  trackNo: number | null;
  durationSec: number;
  filename: string;
  bytes: number;
  bitrateKbps: number | null;
  sampleRateHz: number | null;
  codec: string | null;
  hasCover: boolean;
  lyricSource: LyricSource;
  /** 文件修改时间，用于列表排序与缓存失效 */
  mtimeMs: number;
}

export interface Album {
  /** album + albumArtist 的稳定 slug */
  key: string;
  title: string;
  artist: string;
  year: number | null;
  genre: string | null;
  trackCount: number;
  durationSec: number;
  /** 取第一首曲目作为封面源 */
  coverTrackId: TrackId;
  hasCover: boolean;
  tracks: Track[];
}

export interface LibraryStats {
  trackCount: number;
  albumCount: number;
  artistCount: number;
  totalDurationSec: number;
  totalBytes: number;
  genres: string[];
  years: number[];
  /** 出现次数最多的采样率，用于状态芯片 */
  commonSampleRate: number | null;
}

export interface LibraryResponse {
  schema: number;
  generatedAt: string;
  scanMs: number;
  root: string;
  tracks: Track[];
  albums: Album[];
  stats: LibraryStats;
}

export interface LyricLine {
  timeSec: number;
  text: string;
}

export interface LyricsResponse {
  trackId: TrackId;
  source: LyricSource;
  /** false 表示只有纯文本、没有时间轴，前端不做逐行高亮 */
  synced: boolean;
  lines: LyricLine[];
  /** 歌词出处：外挂时是相对 music/ 的文件名，内嵌时是容器名（如 `ID3v2.3 USLT`） */
  sidecar: string | null;
  /** source 为 none 时列出前端可以放哪些文件名，省去猜命名规则 */
  candidates?: string[];
}

export interface HealthResponse {
  ok: boolean;
  root: string;
  trackCount: number;
  uptimeSec: number;
  version: string;
}

export const LIBRARY_SCHEMA = 1;
