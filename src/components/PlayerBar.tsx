import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { toast } from '../state/toast';
import { formatDuration } from '../lib/format';
import { PLAY_MODE_LABEL } from '../lib/playlist';
import { useScramble } from '../hooks/useMotion';
import { cx } from '../lib/cx';
import { CoverPlate } from './CoverPlate';
import { EqPanel } from './EqPanel';
import { QueuePanel } from './QueuePanel';
import { SeekBar } from './SeekBar';
import { SpectrumCanvas } from './SpectrumCanvas';
import {
  IconEq,
  IconHeart,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconTerminal,
  IconVolume,
} from './Icon';

type Panel = 'eq' | 'queue' | null;

const MODE_ICON = {
  sequential: IconRepeat,
  'repeat-all': IconRepeat,
  'repeat-one': IconRepeatOne,
  shuffle: IconShuffle,
} as const;

export function PlayerBar() {
  const [panel, setPanel] = useState<Panel>(null);
  const { pathname } = useLocation();
  const footerRef = useRef<HTMLElement>(null);

  /**
   * 播放条是 fixed 的，页面底部得留出它的真实高度。
   * 写死一个数在窄屏会失效：手机布局下三段纵向堆叠，高度从 88 涨到 180 左右，
   * 内容正好被盖住。这里量一次、写进 CSS 变量，页面和弹层都跟着走。
   */
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty('--mv-footer-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--mv-footer-h');
    };
  }, []);

  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const positionSec = usePlayer((state) => state.positionSec);
  const durationSec = usePlayer((state) => state.durationSec);
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const playMode = usePlayer((state) => state.playMode);
  const favorites = usePlayer((state) => state.favorites);
  const queue = usePlayer((state) => state.queue);
  const contextLabel = usePlayer((state) => state.contextLabel);
  const sleepAt = usePlayer((state) => state.sleepAt);
  const setSleepTimer = usePlayer((state) => state.setSleepTimer);
  const eq = usePlayer((state) => state.eq);
  const eqActive = eq.low !== 0 || eq.mid !== 0 || eq.high !== 0;

  const togglePlay = usePlayer((state) => state.togglePlay);
  const next = usePlayer((state) => state.next);
  const prev = usePlayer((state) => state.prev);
  const seek = usePlayer((state) => state.seek);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleMute = usePlayer((state) => state.toggleMute);
  const cyclePlayMode = usePlayer((state) => state.cyclePlayMode);
  const toggleFavorite = usePlayer((state) => state.toggleFavorite);

  useEffect(() => {
    const onToggleEq = () => setPanel((open) => (open === 'eq' ? null : 'eq'));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    window.addEventListener('mv2:toggle-eq', onToggleEq);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mv2:toggle-eq', onToggleEq);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const favorite = current ? favorites.has(current.id) : false;
  const ModeIcon = MODE_ICON[playMode];
  const inContext = contextLabel === '全部曲目' || !contextLabel;
  const scrambledTitle = useScramble(current?.title ?? '', current?.id ?? 'idle', 30);

  return (
    <>
      {panel && (
        <button
          type="button"
          aria-label="关闭面板"
          className="fixed inset-0 z-[65] cursor-default bg-bg/40"
          onClick={() => setPanel(null)}
        />
      )}

      {panel && (
        <div className="fixed bottom-[var(--mv-footer-h,104px)] left-1/2 z-[70] -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
          {panel === 'eq' ? <EqPanel onClose={() => setPanel(null)} /> : null}
          {panel === 'queue' ? <QueuePanel onClose={() => setPanel(null)} /> : null}
        </div>
      )}

      <footer
        ref={footerRef}
        className="fixed bottom-0 left-0 z-50 w-full border-t-2 border-line bg-bg-2"
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2 md:h-[88px] md:flex-row md:items-center md:gap-4">
          {/* 当前曲目 */}
          <div className="flex min-w-0 items-center gap-3 md:w-[200px] lg:w-[300px]">
            {current ? (
              <>
                <Link
                  to="/now"
                  state={{ from: pathname }}
                  title="进入沉浸模式"
                  className="block shrink-0"
                >
                  <CoverPlate
                    id={current.id}
                    title={current.title}
                    hasCover={current.hasCover}
                    active={playing}
                    className="size-12"
                  />
                </Link>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{scrambledTitle}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{current.artist}</p>
                </div>
              </>
            ) : (
              <>
                <div className="grid size-12 shrink-0 place-items-center border-2 border-line bg-panel font-mono text-[10px] text-muted">
                  2
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">未选择曲目</p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    SPACE 播放 · 点任意曲目
                  </p>
                </div>
              </>
            )}

            {current && (
              <button
                type="button"
                onClick={() => {
                  toggleFavorite(current.id);
                  toast(favorite ? '已取消收藏' : '已加入收藏', favorite ? 'info' : 'accent');
                }}
                aria-label="收藏当前曲目"
                className={cx(
                  'ml-auto hidden size-8 shrink-0 place-items-center border-2 lg:grid',
                  favorite
                    ? 'border-clash-1 bg-clash-1 text-white'
                    : 'border-line text-muted hover:text-ink',
                )}
              >
                <IconHeart size={15} filled={favorite} />
              </button>
            )}
          </div>

          {/* 传输控制 + 进度：按钮和进度条分两行。
              挤在同一行时固定内容就要 288px，比这一列能拿到的还多，
              flex-1 的进度条会被压到 9px —— 根本点不中，谈不上拖动。 */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => cyclePlayMode()}
                title={`播放模式：${PLAY_MODE_LABEL[playMode]} (R)`}
                className={cx(
                  'grid size-8 place-items-center border-2',
                  playMode === 'sequential'
                    ? 'border-line text-muted'
                    : 'border-accent text-accent',
                )}
              >
                <ModeIcon size={15} />
              </button>
              <button
                type="button"
                onClick={prev}
                aria-label="上一曲"
                className="grid size-8 place-items-center border-2 border-line text-ink hover:bg-ink hover:text-bg"
              >
                <IconPrev size={15} />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? '暂停' : '播放'}
                className={cx(
                  'grid size-11 place-items-center border-2 border-line bg-accent text-on-accent transition-transform hover:-translate-y-0.5 active:translate-y-0',
                  playing && 'mv-shine',
                )}
              >
                {playing ? <IconPause size={19} /> : <IconPlay size={19} />}
              </button>
              <button
                type="button"
                onClick={() => next('manual')}
                aria-label="下一曲"
                className="grid size-8 place-items-center border-2 border-line text-ink hover:bg-ink hover:text-bg"
              >
                <IconNext size={15} />
              </button>

              <SpectrumCanvas bins={28} className="hidden h-7 w-[132px] shrink-0 xl:block" />
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <span className="w-11 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums">
                {formatDuration(positionSec)}
              </span>
              <SeekBar
                positionSec={positionSec}
                durationSec={durationSec}
                onSeek={seek}
                className="min-w-[64px] flex-1"
              />
              <span className="w-11 shrink-0 font-mono text-[11px] text-muted tabular-nums">
                {formatDuration(durationSec || current?.durationSec || 0)}
              </span>
            </div>
          </div>

          {/* 工具区 */}
          <div className="flex shrink-0 items-center gap-1.5">
            {sleepAt && (
              <button
                type="button"
                onClick={() => {
                  setSleepTimer(null);
                  toast('已取消睡眠定时');
                }}
                title="取消睡眠定时"
                className="hidden h-8 items-center gap-1 border-2 border-line px-2 font-mono text-[10px] tracking-widest uppercase md:flex"
                style={{ color: 'var(--clash-1)' }}
              >
                ZZ {formatDuration(Math.max(0, sleepAt - Date.now()) / 1000, '0:00')}
              </button>
            )}
            <span className="hidden font-mono text-[10px] tracking-widest text-muted uppercase 2xl:inline">
              {inContext ? 'LIB' : 'CTX'} {queue.length}
            </span>

            <button
              type="button"
              onClick={() => setPanel(panel === 'queue' ? null : 'queue')}
              aria-label="播放队列"
              className={cx(
                'grid size-8 place-items-center border-2',
                panel === 'queue'
                  ? 'border-line bg-ink text-bg'
                  : 'border-line text-ink hover:bg-ink hover:text-bg',
              )}
            >
              <IconQueue size={15} />
            </button>
            <button
              type="button"
              onClick={() => setPanel(panel === 'eq' ? null : 'eq')}
              aria-label="均衡器"
              className={cx(
                'grid size-8 place-items-center border-2',
                panel === 'eq'
                  ? 'border-line bg-ink text-bg'
                  : eqActive
                    ? 'border-accent text-accent hover:bg-ink hover:text-bg'
                    : 'border-line text-ink hover:bg-ink hover:text-bg',
              )}
              title={eqActive ? `均衡器已调整 ${eq.low}/${eq.mid}/${eq.high}dB` : '均衡器 (E)'}
            >
              <IconEq size={15} />
            </button>

            <div className="hidden items-center gap-1.5 border-2 border-line px-2 py-1 sm:flex">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? '取消静音' : '静音'}
                className="text-ink"
              >
                {muted || volume === 0 ? <IconMute size={15} /> : <IconVolume size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="音量"
                className="h-1.5 w-20 cursor-pointer appearance-none bg-line accent-[var(--accent)]"
              />
            </div>

            <Link
              to="/now"
              state={{ from: pathname }}
              className="flex h-8 items-center gap-1.5 border-2 border-line bg-clash-1 px-2 font-mono text-[10px] tracking-widest text-white uppercase transition-transform hover:-translate-y-0.5"
              title="沉浸模式 (I)"
            >
              <IconTerminal size={14} />
              <span className="hidden lg:inline">IMMERSIVE</span>
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
