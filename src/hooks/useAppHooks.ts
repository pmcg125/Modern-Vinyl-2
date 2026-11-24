import { useEffect, useRef, useState } from 'react';
import { engine, usePlayer } from '../state/player';
import { toast } from '../state/toast';

/**
 * auto 档被系统降级时说明一次。
 * 否则用户只会看到「动效莫名其妙少了」，不知道该去哪里开回来。
 */
export function useMotionNotice() {
  const shown = useRef(false);
  const motion = usePlayer((state) => state.motion);
  const resolved = usePlayer((state) => state.motionResolved);

  useEffect(() => {
    if (shown.current || motion !== 'auto' || resolved === 'full') return;
    shown.current = true;
    toast('系统开启了「减少动态效果」，已自动降到 CALM · 点 FX 或按 V 可强制 FULL', 'warn');
  }, [motion, resolved]);
}

/**
 * 播放错误只有 store.error，而离线横幅只盯 status==='error'；
 * 不接出来的话，解码失败 / 文件丢失会表现为「点了没反应」。
 */
export function useErrorNotice() {
  const error = usePlayer((state) => state.error);

  useEffect(() => {
    if (!error) return;
    toast(error, 'warn');
    const timer = window.setTimeout(() => usePlayer.getState().dismissError(), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);
}

/** 标签页标题与系统播放中心的进度，跟着当前曲目走 */
export function useNowPlayingMeta() {
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);

  useEffect(() => {
    document.title = current
      ? `${playing ? '▶' : '❚'} ${current.title} · ${current.artist} — MV2`
      : 'MODERNVINYL2 // 本地黑胶曲库';
  }, [current, playing]);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const state = usePlayer.getState();
      engine.setPositionState(state.positionSec, state.durationSec);
    };
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, [playing]);
}

/** 首次挂载拉取曲库；失败时保留重试入口 */
export function useLibraryBootstrap() {
  const refreshLibrary = usePlayer((state) => state.refreshLibrary);
  const status = usePlayer((state) => state.status);

  useEffect(() => {
    if (status === 'idle') void refreshLibrary();
  }, [status, refreshLibrary]);

  return { status, retry: () => void refreshLibrary({ refresh: true }) };
}

/** 顶栏世界时钟，1Hz 刷新 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

/** 真正会吞键盘输入的文本框类型 */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'number',
  'password',
  'url',
  'tel',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

/**
 * 判断事件是否发生在「会打字」的控件里，避免快捷键吃掉正常输入。
 *
 * 不能把所有 <input> 都算进来：音量条、均衡器都是 type=range，
 * 拖完音量后焦点留在滑块上，空格 / T / F 就全被吞掉，看起来像快捷键坏了。
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;

  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;

  const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
  return type === '' || TEXT_INPUT_TYPES.has(type);
}

/** 方向键归原生滑块所有（音量、均衡器、进度条都是 range），全局快捷键别抢 */
export function ownsArrowKeys(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range');
}
