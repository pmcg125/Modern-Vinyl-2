import type { PlayMode } from '../lib/storage';

/** Fisher-Yates；rand 注入是为了可测 */
export function shuffledIndices(length: number, rand: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = order[i] ?? 0;
    order[i] = order[j] ?? 0;
    order[j] = a;
  }
  return order;
}

export function sequentialIndices(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

export function buildOrder(length: number, mode: PlayMode): number[] {
  return mode === 'shuffle' ? shuffledIndices(length) : sequentialIndices(length);
}

/** 返回 null 表示播放到此为止（顺序模式走到队尾） */
export function nextCursor(cursor: number, length: number, mode: PlayMode): number | null {
  if (length <= 0) return null;
  if (mode === 'repeat-one') return cursor;

  const next = cursor + 1;
  if (next < length) return next;
  return mode === 'repeat-all' || mode === 'shuffle' ? 0 : null;
}

export function prevCursor(cursor: number, length: number): number | null {
  if (length <= 0) return null;
  const prev = cursor - 1;
  return prev < 0 ? length - 1 : prev;
}

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  sequential: '顺序',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机',
};

export const PLAY_MODE_ORDER: PlayMode[] = ['sequential', 'repeat-all', 'repeat-one', 'shuffle'];

export function nextPlayMode(mode: PlayMode): PlayMode {
  const index = PLAY_MODE_ORDER.indexOf(mode);
  return PLAY_MODE_ORDER[(index + 1) % PLAY_MODE_ORDER.length] ?? 'sequential';
}
