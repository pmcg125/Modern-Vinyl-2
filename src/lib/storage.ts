import type { TrackId } from '@shared/types';

export type ThemeName = 'light' | 'dark';
export type PlayMode = 'sequential' | 'repeat-one' | 'repeat-all' | 'shuffle';
export type LibraryView = 'list' | 'grid';

/** auto = 跟随系统 prefers-reduced-motion；其余为显式覆盖 */
export type MotionMode = 'auto' | 'full' | 'calm' | 'off';
export type ResolvedMotion = 'full' | 'calm' | 'off';

export interface EqState {
  low: number;
  mid: number;
  high: number;
}

export interface Prefs {
  theme: ThemeName | null;
  volume: number;
  muted: boolean;
  eq: EqState;
  playMode: PlayMode;
  view: LibraryView;
  motion: MotionMode;
}

export interface PlayRecord {
  count: number;
  lastAt: number;
}

const PREFS_KEY = 'mv2:prefs:v1';
const FAVS_KEY = 'mv2:favorites:v1';
const PLAYS_KEY = 'mv2:plays:v1';

export const DEFAULT_PREFS: Prefs = {
  theme: null,
  volume: 0.8,
  muted: false,
  eq: { low: 0, mid: 0, high: 0 },
  playMode: 'sequential',
  view: 'list',
  motion: 'auto',
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] 写入 ${key} 失败`, err);
  }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampDb = (n: number) => Math.min(12, Math.max(-12, n));

/** 逐字段校验，坏数据只降级到默认值而不是整体丢弃 */
export function loadPrefs(): Prefs {
  const stored = safeParse<Partial<Prefs>>(
    typeof localStorage === 'undefined' ? null : localStorage.getItem(PREFS_KEY),
  );
  if (!stored) return { ...DEFAULT_PREFS, eq: { ...DEFAULT_PREFS.eq } };

  const eq = typeof stored.eq === 'object' && stored.eq !== null ? stored.eq : DEFAULT_PREFS.eq;
  const num = (value: unknown, fallback: number, clamped: (n: number) => number) =>
    typeof value === 'number' && Number.isFinite(value) ? clamped(value) : fallback;

  return {
    theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : null,
    volume: num(stored.volume, DEFAULT_PREFS.volume, clamp01),
    muted: typeof stored.muted === 'boolean' ? stored.muted : DEFAULT_PREFS.muted,
    eq: {
      low: num(eq.low, 0, clampDb),
      mid: num(eq.mid, 0, clampDb),
      high: num(eq.high, 0, clampDb),
    },
    playMode: (['sequential', 'repeat-one', 'repeat-all', 'shuffle'] as const).includes(
      stored.playMode as PlayMode,
    )
      ? (stored.playMode as PlayMode)
      : DEFAULT_PREFS.playMode,
    view: stored.view === 'grid' ? 'grid' : 'list',
    motion: (['auto', 'full', 'calm', 'off'] as const).includes(stored.motion as MotionMode)
      ? (stored.motion as MotionMode)
      : 'auto',
  };
}

export function savePrefs(prefs: Prefs): void {
  write(PREFS_KEY, prefs);
}

export function loadFavorites(): TrackId[] {
  const stored = safeParse<unknown>(
    typeof localStorage === 'undefined' ? null : localStorage.getItem(FAVS_KEY),
  );
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is TrackId => typeof item === 'string');
}

export function saveFavorites(ids: TrackId[]): void {
  write(FAVS_KEY, ids);
}

export function loadPlays(): Record<TrackId, PlayRecord> {
  const stored = safeParse<Record<string, PlayRecord>>(
    typeof localStorage === 'undefined' ? null : localStorage.getItem(PLAYS_KEY),
  );
  if (!stored || typeof stored !== 'object') return {};
  return Object.fromEntries(
    Object.entries(stored).filter(
      ([, value]) => typeof value?.count === 'number' && typeof value?.lastAt === 'number',
    ),
  );
}

export function savePlays(plays: Record<TrackId, PlayRecord>): void {
  write(PLAYS_KEY, plays);
}
