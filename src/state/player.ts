import { create } from 'zustand';
import type { LibraryResponse, Track, TrackId } from '@shared/types';
import { api, coverUrl, streamUrl } from '../lib/api';
import { AudioEngine } from '../audio/AudioEngine';
import { buildOrder, nextCursor, nextPlayMode, prevCursor } from '../lib/playlist';
import {
  DEFAULT_PREFS,
  loadFavorites,
  loadPlays,
  loadPrefs,
  saveFavorites,
  savePlays,
  savePrefs,
  type EqState,
  type LibraryView,
  type MotionMode,
  type PlayMode,
  type PlayRecord,
  type ResolvedMotion,
  type ThemeName,
} from '../lib/storage';

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlayContext {
  label: string;
  tracks: Track[];
}

interface PlayerStore {
  library: LibraryResponse | null;
  status: LibraryStatus;
  error: string | null;

  contextLabel: string;
  queue: Track[];
  order: number[];
  cursor: number;
  current: Track | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;

  volume: number;
  muted: boolean;
  playMode: PlayMode;
  eq: EqState;
  view: LibraryView;
  theme: ThemeName;
  motion: MotionMode;
  motionResolved: ResolvedMotion;

  favorites: Set<TrackId>;
  plays: Record<TrackId, PlayRecord>;
  restored: boolean;
  /** 睡眠定时器到点时间戳，null 表示未设 */
  sleepAt: number | null;

  refreshLibrary: (options?: { refresh?: boolean }) => Promise<void>;
  playTrack: (track: Track, context?: PlayContext) => void;
  playQueue: (context: PlayContext, startIndex?: number) => void;
  togglePlay: () => void;
  jumpTo: (position: number) => void;
  enqueueNext: (track: Track) => void;
  removeAt: (position: number) => void;
  next: (reason?: 'auto' | 'manual') => void;
  prev: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSec: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  setEq: (eq: Partial<EqState>) => void;
  resetEq: () => void;
  cyclePlayMode: () => void;
  setPlayMode: (mode: PlayMode) => void;
  setView: (view: LibraryView) => void;
  setTheme: (theme: ThemeName) => void;
  setMotion: (mode: MotionMode) => void;
  cycleMotion: () => void;
  toggleFavorite: (id: TrackId) => void;
  setSleepTimer: (minutes: number | null) => void;
  dismissError: () => void;
}

const PREFS_SESSION_KEY = 'mv2:session:v1';

interface Session {
  label: string;
  ids: TrackId[];
  currentId: TrackId | null;
  cursor: number;
  positionSec: number;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(PREFS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!Array.isArray(parsed.ids)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(read: () => PlayerStore, positionSec = read().positionSec): void {
  const state = read();
  if (!state.current && !state.queue.length) return;

  const session: Session = {
    label: state.contextLabel,
    ids: state.queue.map((track) => track.id),
    currentId: state.current?.id ?? null,
    cursor: state.cursor,
    positionSec,
  };
  try {
    localStorage.setItem(PREFS_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* 配额满就直接放弃持久化，不影响播放 */
  }
}

/** 刷新后恢复上次收听：队列 + 当前曲 + 进度，但不自动出声 */
async function restoreSession(): Promise<void> {
  const session = readSession();
  if (!session?.ids.length) return;

  await usePlayer.getState().refreshLibrary();
  const state = usePlayer.getState();
  if (state.current || !state.library) return;

  const index = new Map(state.library.tracks.map((track) => [track.id, track]));
  const queue = session.ids
    .map((id) => index.get(id))
    .filter((track): track is Track => Boolean(track));
  if (!queue.length) return;

  const current = session.currentId ? index.get(session.currentId) : undefined;
  const order = buildOrder(queue.length, state.playMode);
  const position = current ? order.indexOf(queue.indexOf(current)) : 0;

  usePlayer.setState({
    queue,
    order,
    cursor: position === -1 ? 0 : position,
    contextLabel: session.label,
    current: current ?? null,
    durationSec: current?.durationSec ?? 0,
    positionSec: current ? Math.max(0, session.positionSec) : 0,
  });
}

const prefs = loadPrefs();

/**
 * ?fx=full|calm|off|auto 可以覆盖持久化偏好并写回，
 * 方便在系统「减少动态效果」开着、但你想要全效的浏览器上一条链接解决。
 */
const MOTION_MODES: MotionMode[] = ['auto', 'full', 'calm', 'off'];
const fxParam = new URLSearchParams(location.search).get('fx') as MotionMode | null;
if (fxParam && MOTION_MODES.includes(fxParam)) {
  prefs.motion = fxParam;
  savePrefs(prefs);
}

const initialTheme: ThemeName =
  prefs.theme ??
  (globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

export const engine = new AudioEngine({
  onPlay: () => usePlayer.setState({ playing: true }),
  onPause: () => {
    usePlayer.setState({ playing: false });
    persistSession(usePlayer.getState);
  },
  onTime: (positionSec) => usePlayer.setState({ positionSec }),
  onLoaded: (durationSec) => {
    if (durationSec > 0) usePlayer.setState({ durationSec });
  },
  onError: (message) => usePlayer.setState({ error: message, playing: false }),
  onEnded: () => usePlayer.getState().next('auto'),
});

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;

  // 移动端浏览器顶栏跟着主题走
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

/** auto 时读系统偏好；系统说 reduce 就退到 calm，而不是把界面冻死 */
export function resolveMotion(mode: MotionMode): ResolvedMotion {
  if (mode !== 'auto') return mode;
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'calm' : 'full';
}

function applyMotion(mode: MotionMode): ResolvedMotion {
  const resolved = resolveMotion(mode);
  document.documentElement.dataset.motion = resolved;
  return resolved;
}

function mediaArtwork(track: Track) {
  const url = coverUrl(track.id);
  return [
    { src: url, sizes: '200x200', type: 'image/webp' },
    { src: url, sizes: '400x400', type: 'image/webp' },
  ];
}

function syncMediaSession(track: Track | null): void {
  engine.setMediaSession(
    track
      ? {
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: mediaArtwork(track),
        }
      : null,
    {
      play: () => usePlayer.getState().togglePlay(),
      pause: () => usePlayer.getState().togglePlay(),
      previoustrack: () => usePlayer.getState().prev(),
      nexttrack: () => usePlayer.getState().next('manual'),
      seekto: (details) => {
        const position = (details as { seekTime?: number }).seekTime;
        if (typeof position === 'number') usePlayer.getState().seek(position);
      },
    },
  );
}

export const usePlayer = create<PlayerStore>()((set, get) => ({
  library: null,
  status: 'idle',
  error: null,

  contextLabel: '',
  queue: [],
  order: [],
  cursor: -1,
  current: null,
  playing: false,
  positionSec: 0,
  durationSec: 0,

  volume: prefs.volume,
  muted: prefs.muted,
  playMode: prefs.playMode,
  eq: prefs.eq,
  view: prefs.view,
  theme: initialTheme,
  motion: prefs.motion,
  motionResolved: resolveMotion(prefs.motion),

  favorites: new Set(loadFavorites()),
  plays: loadPlays(),
  restored: false,
  sleepAt: null,

  async refreshLibrary(options) {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });

    try {
      const library = await api.library({ refresh: options?.refresh });
      set({ library, status: 'ready' });
      if (!get().restored) {
        set({ restored: true });
        await restoreSession();
      }
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : '曲库加载失败',
      });
    }
  },

  playTrack(track, context) {
    const { playMode, current } = get();

    if (!context || !context.tracks.length) {
      // 无上下文时再点当前曲目 = 播放/暂停切换
      if (current?.id === track.id) get().togglePlay();
      else startTrack(track, set, get);
      return;
    }

    const trackIndex = Math.max(
      0,
      context.tracks.findIndex((item) => item.id === track.id),
    );
    // order 是全量下标的置换，所以任意曲目都能直接定位到它的游标位置
    const order = buildOrder(context.tracks.length, playMode);
    const position = order.indexOf(trackIndex);

    set({
      queue: context.tracks,
      order,
      cursor: position === -1 ? trackIndex : position,
      contextLabel: context.label,
    });
    startTrack(track, set, get);
  },

  playQueue(context, startIndex = 0) {
    const track = context.tracks[startIndex] ?? context.tracks[0];
    if (!track) return;
    get().playTrack(track, context);
  },

  togglePlay() {
    const { current, playing, library } = get();

    if (!current) {
      const tracks = library?.tracks ?? [];
      const first = tracks[0];
      if (!first) return;
      get().playTrack(first, { label: '全部曲目', tracks });
      return;
    }

    if (playing) {
      engine.pause();
      return;
    }

    // 刷新后恢复的会话只有 store 状态，<audio> 上还没有音源
    if (!engine.hasSource) {
      startTrack(current, set, get, { startAt: get().positionSec });
      return;
    }

    void engine.play().catch((err: unknown) => {
      if ((err as DOMException)?.name === 'AbortError') return;
      set({ error: '浏览器拦截了播放，再点一次即可', playing: false });
    });
  },

  jumpTo(position) {
    const { queue, order } = get();
    if (position < 0 || position >= queue.length) return;

    const track = queue[position];
    if (!track) return;

    const indexInOrder = order.indexOf(position);
    set({ cursor: indexInOrder === -1 ? position : indexInOrder });
    startTrack(track, set, get);
  },

  enqueueNext(track) {
    const { queue, order, cursor, current } = get();

    // 没有正在播的曲目时，「下一首播放」退化成直接播放
    if (!current || !queue.length) {
      get().playTrack(track, { label: '队列', tracks: [track] });
      return;
    }

    const nextOrder = [...order];

    const existing = queue.findIndex((item) => item.id === track.id);
    if (existing >= 0) {
      const pos = nextOrder.indexOf(existing);
      // 已在后面出现过的条目直接前移，避免同一首连播两次
      if (pos > cursor) {
        nextOrder.splice(pos, 1);
        nextOrder.splice(Math.min(cursor + 1, nextOrder.length), 0, existing);
        set({ order: nextOrder });
      }
      return;
    }

    const nextQueue = [...queue, track];
    nextOrder.splice(Math.min(cursor + 1, nextOrder.length), 0, nextQueue.length - 1);
    set({ queue: nextQueue, order: nextOrder });
  },

  removeAt(position) {
    const { queue, playMode, current } = get();
    const target = queue[position];
    // 至少留一首，否则队列空掉后播放器没有落脚点
    if (!target || queue.length <= 1) return;

    const nextQueue = queue.filter((_, index) => index !== position);
    const nextOrder = buildOrder(nextQueue.length, playMode);
    const wasCurrent = current?.id === target.id;
    const anchor = wasCurrent
      ? Math.min(position, nextQueue.length - 1)
      : Math.max(0, current ? nextQueue.findIndex((item) => item.id === current.id) : 0);
    const cursorPos = nextOrder.indexOf(anchor);

    set({ queue: nextQueue, order: nextOrder, cursor: cursorPos === -1 ? 0 : cursorPos });

    if (wasCurrent) {
      const next = nextQueue[anchor];
      if (next) startTrack(next, set, get);
    }
  },

  next(reason = 'manual') {
    const { queue, order, cursor, playMode } = get();
    if (!queue.length) return;

    if (reason === 'auto' && playMode === 'repeat-one') {
      engine.seek(0);
      set({ positionSec: 0 });
      void engine.play().catch(() => undefined);
      return;
    }

    const advanced = nextCursor(cursor, order.length, playMode);
    if (advanced === null) {
      // 顺序模式播完整表：停在末尾，不自动循环
      engine.pause();
      set({ playing: false, positionSec: 0 });
      return;
    }

    const index = order[advanced];
    const track = index === undefined ? null : (queue[index] ?? null);
    set({ cursor: advanced });
    if (track) startTrack(track, set, get);
  },

  prev() {
    const { queue, order, cursor, positionSec } = get();
    if (!queue.length) return;

    // 听过 3 秒以上，上一首先回到本曲开头（与常规播放器一致）
    if (positionSec > 3) {
      engine.seek(0);
      set({ positionSec: 0 });
      return;
    }

    const back = prevCursor(cursor, order.length);
    if (back === null) return;

    const index = order[back];
    const track = index === undefined ? null : (queue[index] ?? null);
    set({ cursor: back });
    if (track) startTrack(track, set, get);
  },

  seek(seconds) {
    const { durationSec } = get();
    const target = Math.min(Math.max(0, seconds), durationSec || seconds);
    engine.seek(target);
    set({ positionSec: target });
    persistSession(get, target);
  },

  skip(deltaSec) {
    const { positionSec, seek } = get();
    seek(positionSec + deltaSec);
  },

  setVolume(value) {
    const volume = Math.min(1, Math.max(0, value));
    engine.setVolume(volume);
    set({ volume, muted: volume === 0 ? get().muted : false });
    persist(get);
  },

  toggleMute() {
    const muted = !get().muted;
    engine.setMuted(muted);
    set({ muted });
    persist(get);
  },

  setEq(partial) {
    const eq = { ...get().eq, ...partial };
    engine.setEq(eq);
    set({ eq });
    persist(get);
  },

  resetEq() {
    get().setEq({ ...DEFAULT_PREFS.eq });
  },

  cyclePlayMode() {
    get().setPlayMode(nextPlayMode(get().playMode));
  },

  setPlayMode(playMode) {
    if (playMode === get().playMode) return;
    const { queue, current } = get();

    // 切模式时重建播放顺序，并把当前曲目放回它在新顺序里的位置
    if (queue.length) {
      const trackIndex = current ? queue.findIndex((item) => item.id === current.id) : -1;
      const order = buildOrder(queue.length, playMode);
      const position = order.indexOf(Math.max(0, trackIndex));
      set({ playMode, order, cursor: position === -1 ? 0 : position });
    } else {
      set({ playMode });
    }
    persist(get);
  },

  setView(view) {
    set({ view });
    persist(get);
  },

  setTheme(theme) {
    applyTheme(theme);
    set({ theme });
    persist(get);
  },

  setMotion(mode) {
    set({ motion: mode, motionResolved: applyMotion(mode) });
    persist(get);
  },

  cycleMotion() {
    const order: MotionMode[] = ['auto', 'full', 'calm', 'off'];
    const next = order[(order.indexOf(get().motion) + 1) % order.length] ?? 'auto';
    get().setMotion(next);
  },

  toggleFavorite(id) {
    const favorites = new Set(get().favorites);
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);

    set({ favorites });
    saveFavorites([...favorites]);
  },

  setSleepTimer(minutes) {
    if (sleepTimer !== null) window.clearTimeout(sleepTimer);

    if (minutes === null) {
      set({ sleepAt: null });
      return;
    }

    const ms = Math.max(1, Math.round(minutes)) * 60_000;
    sleepTimer = window.setTimeout(() => {
      sleepTimer = null;
      engine.pause();
      usePlayer.setState({ sleepAt: null });
    }, ms);

    set({ sleepAt: Date.now() + ms });
  },

  dismissError() {
    set({ error: null });
  },
}));

let sleepTimer: number | null = null;

function persist(read: () => PlayerStore): void {
  const state = read();
  savePrefs({
    theme: state.theme,
    volume: state.volume,
    muted: state.muted,
    eq: state.eq,
    playMode: state.playMode,
    view: state.view,
    motion: state.motion,
  });
}

function startTrack(
  track: Track,
  set: (partial: Partial<PlayerStore>) => void,
  get: () => PlayerStore,
  options: { startAt?: number } = {},
) {
  const startAt = options.startAt ?? 0;

  set({
    current: track,
    durationSec: track.durationSec,
    positionSec: startAt,
    error: null,
  });

  recordPlay(track.id, set, get);
  syncMediaSession(track);
  persistSession(get, startAt);

  void engine.playTrack(streamUrl(track.id), { startAt }).catch((err: unknown) => {
    if ((err as DOMException)?.name === 'AbortError') return;
    set({
      error: `无法播放《${track.title}》：${err instanceof Error ? err.message : '未知错误'}`,
      playing: false,
    });
  });
}

function recordPlay(
  id: TrackId,
  set: (partial: Partial<PlayerStore>) => void,
  get: () => PlayerStore,
) {
  const previous = get().plays[id] ?? { count: 0, lastAt: 0 };
  if (Date.now() - previous.lastAt < 5_000) return;

  const plays = { ...get().plays, [id]: { count: previous.count + 1, lastAt: Date.now() } };
  set({ plays });
  savePlays(plays);
}

/** 主题与动效在模块加载时立刻落到 <html>，避免首屏闪色/闪动 */
applyTheme(usePlayer.getState().theme);
applyMotion(usePlayer.getState().motion);
engine.setVolume(usePlayer.getState().volume);
engine.setMuted(usePlayer.getState().muted);
engine.setEq(usePlayer.getState().eq);

// motion=auto 时跟着系统偏好实时切换
const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
motionQuery?.addEventListener?.('change', () => {
  const { motion } = usePlayer.getState();
  if (motion === 'auto') usePlayer.setState({ motionResolved: applyMotion(motion) });
});

// 关页/切后台时把进度落盘，下次进来能接着听
window.addEventListener('pagehide', () => persistSession(usePlayer.getState));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistSession(usePlayer.getState);
});
