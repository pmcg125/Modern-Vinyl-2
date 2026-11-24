import type { Track } from '@shared/types';

export interface Bar {
  label: string;
  value: number;
  /** 显示用的次要说明，比如曲目数 */
  hint?: string;
}

const DURATION_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '< 1min', min: 0, max: 60 },
  { label: '1-2min', min: 60, max: 120 },
  { label: '2-3min', min: 120, max: 180 },
  { label: '3-5min', min: 180, max: 300 },
  { label: '5min+', min: 300, max: Number.POSITIVE_INFINITY },
];

/** 时长分布：把「没有流派标签」这件事变成可读的曲库形状 */
export function durationHistogram(tracks: Track[]): Bar[] {
  return DURATION_BUCKETS.map((bucket) => {
    const hit = tracks.filter((t) => t.durationSec >= bucket.min && t.durationSec < bucket.max);
    return {
      label: bucket.label,
      value: hit.reduce((sum, t) => sum + t.durationSec, 0),
      hint: `${hit.length} 首`,
    };
  });
}

export function bitrateBreakdown(tracks: Track[]): Bar[] {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    const key = track.bitrateKbps ? `${track.bitrateKbps}k` : '未知';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value, hint: `${value} 首` }))
    .sort((a, b) => b.value - a.value);
}

export function topArtistsByDuration(tracks: Track[], limit = 6): Bar[] {
  const totals = new Map<string, { sec: number; count: number }>();
  for (const track of tracks) {
    const entry = totals.get(track.artist) ?? { sec: 0, count: 0 };
    entry.sec += track.durationSec;
    entry.count += 1;
    totals.set(track.artist, entry);
  }

  return [...totals.entries()]
    .map(([label, entry]) => ({ label, value: entry.sec, hint: `${entry.count} 首` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** 最长 / 最短，用于剖面区的极值提示 */
export function durationExtremes(tracks: Track[]): {
  longest: Track | null;
  shortest: Track | null;
} {
  if (!tracks.length) return { longest: null, shortest: null };

  return {
    longest: tracks.reduce((a, b) => (b.durationSec > a.durationSec ? b : a)),
    shortest: tracks.reduce((a, b) => (b.durationSec < a.durationSec ? b : a)),
  };
}
