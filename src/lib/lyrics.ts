import type { LyricLine } from '@shared/types';

/** 当前时刻对应的歌词行下标；-1 表示还没进入第一行 */
export function activeLineIndex(lines: LyricLine[], timeSec: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.timeSec > timeSec) break;
    index = i;
  }
  return index;
}

/**
 * 当前行内的进度 0..1，用来在那一句底下走一根细长进度条。
 * 重复时间戳（副歌复用同一句）没有可分的区间，退回整曲时长。
 */
export function lineProgress(
  lines: LyricLine[],
  index: number,
  timeSec: number,
  fallbackSec: number,
): number {
  const current = lines[index];
  if (!current) return 0;

  const next = lines[index + 1];
  const end = next && next.timeSec > current.timeSec ? next.timeSec : fallbackSec;
  const span = end - current.timeSec;
  if (span <= 0) return 1;

  return Math.min(1, Math.max(0, (timeSec - current.timeSec) / span));
}
