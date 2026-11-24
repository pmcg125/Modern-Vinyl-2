import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { coverUrl, streamUrl } from '../lib/api';
import { getTrackPeaks } from '../lib/peaks';
import { activeLineIndex, lineProgress } from '../lib/lyrics';
import { useTrackLyrics } from '../hooks/useTrackLyrics';
import { formatDuration, pad } from '../lib/format';
import { PLAY_MODE_LABEL } from '../lib/playlist';
import { engine, usePlayer } from '../state/player';
import { useScramble } from '../hooks/useMotion';
import { cx } from '../lib/cx';
import { AsciiDisc } from '../components/terminal/AsciiDisc';
import { TermArt } from '../components/terminal/TermArt';
import { TermWaveform } from '../components/terminal/TermWaveform';
import { TermAnalyzer } from '../components/terminal/TermAnalyzer';
import {
  IconHeart,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconShuffle,
} from '../components/Icon';

const BOOT_LINES: [string, string][] = [
  ['MV2 BIOS v2.0', 'OK'],
  ['MOUNT music/', 'OK'],
  ['READ ID3 TAGS', 'OK'],
  ['DECODE MPEG1 L3', 'OK'],
  ['AUDIO PATH 44.1kHz STEREO', 'READY'],
];

const EQ_BANDS = [
  { key: 'low', label: 'LOW', hz: '320Hz', color: 'var(--tty-magenta)' },
  { key: 'mid', label: 'MID', hz: '1kHz', color: 'var(--tty-cyan)' },
  { key: 'high', label: 'HIGH', hz: '3kHz', color: 'var(--tty-amber)' },
] as const;

const SLEEP_OPTIONS = [5, 15, 30, 60] as const;

type ViewMode = 'both' | 'spectrum' | 'scope';
type SidePanel = 'lyrics' | 'queue';

/**
 * 分段双向电平表：┤ 框 + 中心零点 │ + 已推起的段。
 * 推到 ±9dB 以上换成实心块，一眼分清「微调」和「明显染色」。
 */
function asciiMeter(value: number, width = 24): string {
  const center = Math.floor(width / 2);
  const slots = Math.round((value / 12) * center);
  const cells: string[] = Array.from({ length: width }, (_, i) => (i === center ? '│' : '·'));
  const fill = Math.abs(value) >= 9 ? '█' : '▰';

  if (slots > 0)
    for (let i = center + 1; i <= Math.min(width - 1, center + slots); i++) cells[i] = fill;
  if (slots < 0) for (let i = center - 1; i >= Math.max(0, center + slots); i--) cells[i] = fill;

  return `┤${cells.join('')}├`;
}

/** 音量电平：单边柱，从左侧起填 */
function volumeMeter(value: number, width = 24): string {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * width);
  return `┤${'█'.repeat(filled)}${'·'.repeat(Math.max(0, width - filled))}├`;
}

function AsciiProgress({
  ratio,
  buffered,
  onSeekRatio,
}: {
  ratio: number;
  buffered: number;
  /** 给了就可点：按横向比例跳转，沉浸页也能 seek */
  onSeekRatio?: (ratio: number) => void;
}) {
  const width = 46;
  const played = Math.round(Math.min(1, Math.max(0, ratio)) * width);
  const loaded = Math.round(Math.min(1, Math.max(0, buffered)) * width);
  const ahead = Math.max(0, loaded - played);
  const rest = Math.max(0, width - played - ahead);

  const inner = (
    <span className="tty-bar text-[12px]">
      <span style={{ color: 'var(--tty-fg)' }}>{'#'.repeat(played)}</span>
      <span style={{ color: 'var(--tty-amber)' }}>{played < width ? '▸' : ''}</span>
      <span style={{ color: 'var(--tty-cyan)' }}>{'·'.repeat(ahead)}</span>
      <span className="tty-dim">{'·'.repeat(rest)}</span>
    </span>
  );

  if (!onSeekRatio) return inner;

  return (
    <button
      type="button"
      aria-label="点击跳转播放位置"
      title="点击跳转"
      className="cursor-pointer"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width === 0) return;
        onSeekRatio(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
      }}
    >
      {inner}
    </button>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 gap-1.5 text-[11px]">
      <span className="tty-dim shrink-0">{label}</span>
      <span className="truncate" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

function Panel({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('tty-panel flex min-h-0 flex-col', className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-current px-2.5 py-1 text-[10px] tracking-[0.18em]">
        <span className="tty-dim">{title}</span>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function TinyButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        'border border-current px-1.5 py-0.5 text-[10px] tracking-widest transition-colors hover:bg-current/15',
        active && 'bg-current/20',
      )}
    >
      {children}
    </button>
  );
}

export function NowPlayingPage() {
  const { pathname, state } = useLocation();
  const from = (state as { from?: string } | null)?.from ?? '/';

  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const positionSec = usePlayer((s) => s.positionSec);
  const durationSec = usePlayer((s) => s.durationSec);
  const playMode = usePlayer((s) => s.playMode);
  const queue = usePlayer((s) => s.queue);
  const order = usePlayer((s) => s.order);
  const cursor = usePlayer((s) => s.cursor);
  const contextLabel = usePlayer((s) => s.contextLabel);
  const favorites = usePlayer((s) => s.favorites);
  const plays = usePlayer((s) => s.plays);
  const eq = usePlayer((s) => s.eq);
  const theme = usePlayer((s) => s.theme);
  const trackCount = usePlayer((s) => s.library?.stats.trackCount ?? 0);
  const sleepAt = usePlayer((s) => s.sleepAt);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const motionResolved = usePlayer((s) => s.motionResolved);
  const cycleMotion = usePlayer((s) => s.cycleMotion);

  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const setEq = usePlayer((s) => s.setEq);
  const cyclePlayMode = usePlayer((s) => s.cyclePlayMode);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const setTheme = usePlayer((s) => s.setTheme);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);

  const screenRef = useRef<HTMLDivElement>(null);
  const lyricRef = useRef<HTMLDivElement>(null);
  /** 程序滚动会顺带触发 onScroll，用它区分「代码在跟行」和「用户在翻页」 */
  const programmaticScroll = useRef(false);

  const [booted, setBooted] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [glitching, setGlitching] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>('both');
  const [side, setSide] = useState<SidePanel>('lyrics');
  const [follow, setFollow] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const lyrics = useTrackLyrics(current?.id);

  const bootDone = booted >= BOOT_LINES.length;
  const scrambledTitle = useScramble(current?.title ?? '', current?.id ?? 'idle');

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bootDone) return;
    const timer = window.setTimeout(() => setBooted((n) => n + 1), 150);
    return () => window.clearTimeout(timer);
  }, [booted, bootDone]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setPeaks(null);

    // 整曲解码要下载完整文件，所以只在沉浸页按需做，并带 LRU 缓存
    void getTrackPeaks(current.id, streamUrl(current.id)).then((next) => {
      if (!cancelled) setPeaks(next);
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  // 切曲时抖一下标题：字符乱码定格 + 整块 clip 抖动是两件事，都要有
  useEffect(() => {
    if (!current) return;
    setGlitching(true);
    const timer = window.setTimeout(() => setGlitching(false), 340);
    return () => window.clearTimeout(timer);
  }, [current]);

  const lines = lyrics.data?.lines ?? [];
  const synced = Boolean(lyrics.data?.synced && lines.length);
  const lyricSourceLabel = (lyrics.data?.source ?? current?.lyricSource ?? 'none').toUpperCase();
  // 每帧重算即可：一次渲染只扫一遍歌词行，比挂一堆 deps 好读
  const activeIndex = synced ? activeLineIndex(lines, positionSec) : -1;
  const withinLine =
    activeIndex < 0 ? 0 : lineProgress(lines, activeIndex, positionSec, durationSec);

  // 换歌重新回到「跟随当前行」
  useEffect(() => {
    setFollow(true);
  }, [current?.id]);

  useEffect(() => {
    if (activeIndex < 0 || !follow) return;
    const container = lyricRef.current;
    const line = container?.querySelector<HTMLElement>(`[data-line="${activeIndex}"]`);
    if (!container || !line) return;
    // 直接算 scrollTop：scrollIntoView 会顺带滚动祖先容器，把整页推走
    programmaticScroll.current = true;
    container.scrollTop = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;
    const timer = window.setTimeout(() => {
      programmaticScroll.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeIndex, follow]);

  // 用户自己滚动就停止跟随，别再抢他的滚动条；6 秒没操作自动接回
  useEffect(() => {
    if (follow) return;
    const timer = window.setTimeout(() => setFollow(true), 6000);
    return () => window.clearTimeout(timer);
  }, [follow, activeIndex]);

  const onLyricsScroll = () => {
    if (programmaticScroll.current) return;
    setFollow(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void screenRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const ratio = durationSec > 0 ? positionSec / durationSec : 0;
  const favorite = current ? favorites.has(current.id) : false;
  const queuePosition = (order[cursor] ?? cursor) + 1;
  const sleepLeft = sleepAt ? Math.max(0, sleepAt - clock.getTime()) : 0;
  const stamp = `${clock.getFullYear()}-${pad(clock.getMonth() + 1)}-${pad(clock.getDate())} ${pad(
    clock.getHours(),
  )}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;

  return (
    <div
      ref={screenRef}
      className="tty-screen fixed inset-0 z-[80] flex flex-col gap-2 overflow-hidden p-2.5 text-[12px] sm:p-4"
    >
      <div className="tty-sweep" aria-hidden="true" />

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-current pb-1.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="text-[13px] font-bold tracking-[0.14em]">
            MODERNVINYL2<span className="tty-dim">://</span>
            <span style={{ color: 'var(--tty-cyan)' }}>NOW</span>
            <span className="tty-dim">.</span>
            <span style={{ color: 'var(--tty-amber)' }}>PLAYING</span>
          </span>
          <span className="tty-dim hidden text-[10px] tracking-widest lg:inline">{stamp}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] tracking-widest">
          <span className="tty-dim mr-1">{playing ? 'STREAM' : 'IDLE'}</span>
          <span className={cx('tty-led', !playing && 'tty-led--idle')} aria-hidden="true" />
          {sleepAt && (
            <span className="tty-amber tabular-nums">
              ZZ {formatDuration(sleepLeft / 1000, '0:00')}
            </span>
          )}
          <TinyButton onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'LIGHT' : 'DARK'}·T
          </TinyButton>
          <TinyButton
            onClick={cycleMotion}
            title="动效档位：FULL 全开 / CALM 停循环 / OFF 静态（系统偏好可用 auto 跟随）"
          >
            FX·{motionResolved.toUpperCase()}
          </TinyButton>
          <TinyButton
            onClick={() => window.dispatchEvent(new CustomEvent('mv2:toggle-help'))}
            title="快捷键 (?)"
          >
            ?
          </TinyButton>
          <TinyButton onClick={toggleFullscreen} title="全屏 (F11 亦可)">
            {fullscreen ? 'WINDOW' : 'FULL'}
          </TinyButton>
          <Link
            to={from === pathname ? '/' : from}
            className="border border-current bg-current/5 px-1.5 py-0.5 transition-colors hover:bg-current/15"
          >
            EXIT·ESC
          </Link>
        </div>
      </header>

      <div className="shrink-0 text-[11px] leading-5">
        {bootDone ? (
          <p className="tty-dim">
            <span style={{ color: 'var(--tty-fg)' }}>SYS OK</span> · {trackCount} TRACKS ·{' '}
            {queue.length} IN QUEUE · PHOSPHOR {theme === 'dark' ? 'GREEN+3' : 'BLUE+3'}
          </p>
        ) : (
          BOOT_LINES.slice(0, booted).map(([line, result]) => (
            <div key={line} className="flex gap-2">
              <span className="tty-dim">›</span>
              <span className="flex-1 truncate">{line}</span>
              <span style={{ color: result === 'READY' ? 'var(--tty-amber)' : 'var(--tty-fg)' }}>
                {result}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 分栏断点用 md 而不是 lg：853px 这种窗口在单栏下左列只剩 350px 高，
          频谱会被推到折叠线以下 —— 沉浸页第一眼看不到频谱就失去意义了 */}
      {current ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden md:grid-cols-[1fr_330px]">
          {/* 左列必须在所有断点自己滚：只给 lg 加 overflow 时，窄屏内容会溢出并压在歌词面板上 */}
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-0.5">
            <Panel
              title="TRACK"
              right={
                <span className="tty-dim truncate">
                  {contextLabel
                    ? `${contextLabel.toUpperCase()} · ${queuePosition}/${queue.length}`
                    : ''}
                </span>
              }
              className="shrink-0"
            >
              <div className="flex flex-wrap gap-3 p-2.5">
                {/* 点阵封面与字符唱盘并排：竖着叠会把频谱推到折叠线以下，沉浸页就废了 */}
                <div className="flex shrink-0 items-end gap-2">
                  <div className={cx('tty-art w-[168px]', playing && 'tty-breathe')}>
                    <TermArt
                      src={coverUrl(current.id)}
                      cols={21}
                      rows={11}
                      fallbackChar={current.title.slice(0, 1)}
                      className="h-[120px] w-full"
                    />
                  </div>
                  <div className="h-[120px] w-[132px] shrink-0 lg:h-[152px] lg:w-[184px]">
                    <AsciiDisc playing={playing} />
                  </div>
                </div>

                <div className="min-w-[220px] flex-1">
                  <h1
                    data-glitch={glitching ? '1' : undefined}
                    className="tty-scramble truncate text-[clamp(17px,2.2vw,24px)] font-bold"
                  >
                    {scrambledTitle}
                  </h1>
                  <p className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--tty-cyan)' }}>
                    {current.artist}
                  </p>
                  <div className="mt-2 grid gap-x-4 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="ALBUM:" value={current.album} />
                    <Field label="DUR:" value={formatDuration(current.durationSec)} />
                    <Field
                      label="BIT:"
                      value={current.bitrateKbps ? `${current.bitrateKbps} kbps` : '—'}
                      tone="var(--tty-amber)"
                    />
                    <Field
                      label="SR:"
                      value={current.sampleRateHz ? `${current.sampleRateHz} Hz` : '—'}
                      tone="var(--tty-amber)"
                    />
                    <Field label="CODEC:" value={current.codec ?? '—'} />
                    <Field label="PLAYS:" value={String(plays[current.id]?.count ?? 0)} />
                    <Field
                      label="MODE:"
                      value={PLAY_MODE_LABEL[playMode]}
                      tone="var(--tty-magenta)"
                    />
                    <Field label="LYRIC:" value={lyricSourceLabel} tone="var(--tty-cyan)" />
                    <Field label="FILE:" value={current.filename} />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title={`VISUAL · ${view === 'both' ? 'SPECTRUM + SCOPE' : view.toUpperCase()}`}
              right={
                <div className="flex items-center gap-1.5">
                  <span className="tty-dim tabular-nums">
                    <span style={{ color: 'var(--tty-fg)' }}>{formatDuration(positionSec)}</span>
                    {' / '}
                    {formatDuration(durationSec)}
                  </span>
                  <TinyButton onClick={() => setView('spectrum')} active={view === 'spectrum'}>
                    FFT
                  </TinyButton>
                  <TinyButton onClick={() => setView('scope')} active={view === 'scope'}>
                    SCOPE
                  </TinyButton>
                  <TinyButton onClick={() => setView('both')} active={view === 'both'}>
                    BOTH
                  </TinyButton>
                </div>
              }
              className="shrink-0"
            >
              <div className="space-y-1 p-1.5">
                <TermAnalyzer mode={view} className="h-[150px] w-full" />
                <TermWaveform
                  peaks={peaks}
                  ratio={ratio}
                  buffered={engine.bufferedRatio}
                  onSeek={(value) => seek(value * durationSec)}
                  className="mb-1 h-[34px] w-full"
                />
                <div className="flex items-center gap-2">
                  <span className="tty-dim shrink-0">[</span>
                  <AsciiProgress
                    ratio={ratio}
                    buffered={engine.bufferedRatio}
                    onSeekRatio={(value) => seek(value * durationSec)}
                  />
                  <span className="tty-dim shrink-0">]</span>
                  <span className="tty-amber shrink-0 tabular-nums">
                    {Math.round(ratio * 100)}%
                  </span>
                </div>
              </div>
            </Panel>

            <div className="grid shrink-0 gap-2 sm:grid-cols-[auto_1fr]">
              <div className="tty-panel flex items-center gap-1.5 p-2">
                <button
                  type="button"
                  onClick={prev}
                  aria-label="上一曲"
                  className="grid size-9 place-items-center border border-current transition-colors hover:bg-current/15 active:translate-y-px"
                >
                  <IconPrev size={15} />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? '暂停' : '播放'}
                  className="grid size-11 place-items-center border border-current transition-colors hover:bg-current/25 active:translate-y-px"
                  style={{ background: 'color-mix(in oklab, var(--tty-fg) 14%, transparent)' }}
                >
                  {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => next('manual')}
                  aria-label="下一曲"
                  className="grid size-9 place-items-center border border-current transition-colors hover:bg-current/15 active:translate-y-px"
                >
                  <IconNext size={15} />
                </button>
                <button
                  type="button"
                  onClick={cyclePlayMode}
                  title={`播放模式：${PLAY_MODE_LABEL[playMode]}`}
                  className={cx(
                    'grid size-9 place-items-center border border-current transition-colors hover:bg-current/15',
                    playMode !== 'sequential' && 'tty-amber',
                  )}
                >
                  <IconShuffle size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(current.id)}
                  title="收藏 (F)"
                  className={cx(
                    'grid size-9 place-items-center border border-current transition-colors',
                    favorite ? 'tty-magenta' : 'hover:bg-current/15',
                  )}
                  style={
                    favorite
                      ? { background: 'color-mix(in oklab, var(--tty-magenta) 22%, transparent)' }
                      : undefined
                  }
                >
                  <IconHeart size={15} filled={favorite} />
                </button>
              </div>

              <div className="tty-panel p-2 text-[10px]">
                <div className="mb-1 grid grid-cols-[58px_auto_42px_1fr] items-center gap-2 text-[8px] tracking-widest">
                  <span className="tty-dim">BAND</span>
                  <span className="tty-dim flex justify-between px-1">
                    <span>-12</span>
                    <span>0dB</span>
                    <span>+12</span>
                  </span>
                  <span />
                  <span className="tty-dim">GAIN</span>
                </div>

                {EQ_BANDS.map((band) => {
                  const value = eq[band.key];
                  return (
                    <label
                      key={band.key}
                      className="grid grid-cols-[58px_auto_42px_1fr] items-center gap-2"
                    >
                      <span className="tty-dim truncate">
                        {band.label} <span className="text-[8px]">{band.hz}</span>
                      </span>
                      <span
                        className={cx('tty-bar', value !== 0 && 'tty-eq-live')}
                        style={{ color: band.color }}
                      >
                        {asciiMeter(value)}
                      </span>
                      <span className="text-right tabular-nums" style={{ color: band.color }}>
                        {value > 0 ? '+' : ''}
                        {value.toFixed(1)}
                      </span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={value}
                        onChange={(event) => setEq({ [band.key]: Number(event.target.value) })}
                        className="h-1 min-w-0 cursor-pointer appearance-none border border-current bg-transparent"
                        style={{ accentColor: band.color }}
                        aria-label={`${band.label} 增益`}
                      />
                    </label>
                  );
                })}

                <div className="mt-1 grid grid-cols-[58px_auto_42px_1fr] items-center gap-2 border-t border-current pt-1">
                  <span className="tty-dim">
                    VOL{' '}
                    <span className="text-[8px]">{Math.round((muted ? 0 : volume) * 100)}%</span>
                  </span>
                  <span className="tty-bar" style={{ color: 'var(--tty-fg)' }}>
                    {volumeMeter(muted ? 0 : volume)}
                  </span>
                  <span />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={muted ? 0 : volume}
                      onChange={(event) => setVolume(Number(event.target.value))}
                      className="h-1 min-w-0 flex-1 cursor-pointer appearance-none border border-current bg-transparent"
                      style={{ accentColor: 'var(--tty-fg)' }}
                      aria-label="音量"
                    />
                    <TinyButton onClick={toggleMute} active={muted} title="静音 (M)">
                      {muted ? 'MUTED' : 'MUTE'}
                    </TinyButton>
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-1.5 border-t border-current pt-1">
                  <span className="tty-dim w-[58px] shrink-0">SLEEP</span>
                  {SLEEP_OPTIONS.map((minutes) => (
                    <TinyButton
                      key={minutes}
                      onClick={() => setSleepTimer(minutes)}
                      active={sleepAt !== null && Math.round(sleepLeft / 60_000) === minutes}
                      title={`${minutes} 分钟后停止播放`}
                    >
                      {minutes}M
                    </TinyButton>
                  ))}
                  <TinyButton onClick={() => setSleepTimer(null)} title="取消睡眠定时">
                    OFF
                  </TinyButton>
                </div>
              </div>
            </div>
          </div>

          <Panel
            title={side === 'lyrics' ? `LYRICS · ${lyricSourceLabel}` : 'QUEUE'}
            right={
              <div className="flex items-center gap-1.5">
                {side === 'lyrics' && synced && (
                  <TinyButton
                    onClick={() => setFollow((value) => !value)}
                    active={!follow}
                    title="自动滚动到当前行；手动翻页会暂时接管"
                  >
                    {follow ? 'FOLLOW' : 'MANUAL'}
                  </TinyButton>
                )}
                <span className="tty-dim">
                  {side === 'lyrics'
                    ? lyrics.loading
                      ? '···'
                      : `${lines.length} LINES`
                    : `${queue.length} TRACKS`}
                </span>
                <TinyButton onClick={() => setSide('lyrics')} active={side === 'lyrics'}>
                  LRC
                </TinyButton>
                <TinyButton onClick={() => setSide('queue')} active={side === 'queue'}>
                  Q
                </TinyButton>
              </div>
            }
            className="min-h-[220px]"
          >
            {side === 'lyrics' ? (
              <div
                ref={lyricRef}
                onScroll={onLyricsScroll}
                className="relative h-full overflow-y-auto px-2.5 py-2 text-[12px] leading-[1.9]"
              >
                {lyrics.loading ? (
                  <p className="tty-dim">
                    READING LYRICS
                    <span className="tty-caret" />
                  </p>
                ) : lyrics.error ? (
                  <div className="tty-dim space-y-1.5">
                    <p className="tty-magenta">LYRICS REQUEST FAILED</p>
                    <p className="break-words">{lyrics.error}</p>
                    <TinyButton onClick={lyrics.retry} title="重新读取歌词">
                      RETRY
                    </TinyButton>
                  </div>
                ) : synced ? (
                  <>
                    {lyrics.data?.sidecar && (
                      <p className="tty-dim mb-1 truncate" title={lyrics.data.sidecar}>
                        <span style={{ color: 'var(--tty-cyan)' }}>›</span> {lyrics.data.sidecar}
                      </p>
                    )}
                    {lines.map((line, index) => {
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={`${line.timeSec}-${index}`}
                          type="button"
                          data-line={index}
                          onClick={() => seek(line.timeSec)}
                          title="跳到这一行"
                          className={cx(
                            'relative block w-full whitespace-pre-wrap break-words text-left transition-all duration-200',
                            isActive
                              ? 'tty-row-hi translate-x-1 px-1'
                              : index < activeIndex
                                ? 'tty-line-past hover:bg-current/10'
                                : index === activeIndex + 1
                                  ? 'tty-line-future tty-line-next hover:bg-current/10'
                                  : 'tty-line-future hover:bg-current/10',
                          )}
                        >
                          <span className="tty-dim mr-2 tabular-nums">
                            {formatDuration(line.timeSec, '0:00')}
                          </span>
                          {line.text}
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-1 bottom-0 h-[2px] bg-current/20"
                            >
                              <span
                                className="block h-full transition-[width] duration-200"
                                style={{
                                  width: `${Math.round(withinLine * 100)}%`,
                                  background: 'var(--tty-cyan)',
                                }}
                              />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                ) : lines.length ? (
                  <>
                    <p className="tty-dim mb-1">
                      无时间轴 · 只显示文本（{lyrics.data?.source.toUpperCase()}）
                    </p>
                    <pre className="m-0 whitespace-pre-wrap break-words font-mono">
                      {lines.map((line) => line.text).join('\n')}
                    </pre>
                  </>
                ) : (
                  <div className="tty-dim space-y-1.5">
                    <p>
                      <span className="tty-magenta">NO LYRICS FOUND</span> ·
                      已在歌曲目录里找过这些名字：
                    </p>
                    <ul className="space-y-0.5">
                      {(
                        lyrics.data?.candidates ?? [current.filename.replace(/\.mp3$/, '') + '.lrc']
                      ).map((name) => (
                        <li key={name} className="truncate" style={{ color: 'var(--tty-cyan)' }}>
                          <span className="tty-dim">›</span> {name}
                        </li>
                      ))}
                    </ul>
                    <p>
                      放任意一个到歌曲同目录（或
                      <span style={{ color: 'var(--tty-amber)' }}> lyrics/ </span>
                      子目录）就行；支持 [mm:ss.xx] 时间轴、无时间的纯文本，UTF-8 / GBK
                      都能读。放好点 RETRY 立刻生效。
                    </p>
                    <TinyButton onClick={lyrics.retry} title="重新扫描歌词文件">
                      RETRY
                    </TinyButton>
                  </div>
                )}
              </div>
            ) : order.length ? (
              <ol className="h-full overflow-y-auto py-1 text-[11px]">
                {order.map((trackIndex, position) => {
                  const track = queue[trackIndex];
                  if (!track) return null;
                  const isCurrent = position === cursor;
                  return (
                    <li key={`${track.id}-${trackIndex}`}>
                      <button
                        type="button"
                        onClick={() => jumpTo(trackIndex)}
                        className={cx(
                          'flex w-full items-center gap-2 px-2.5 py-1 text-left transition-colors',
                          isCurrent ? 'tty-row-hi' : 'hover:bg-current/10',
                        )}
                      >
                        <span className="w-5 shrink-0 tabular-nums opacity-70">
                          {String(position + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{track.title}</span>
                        <span className="shrink-0 tabular-nums opacity-70">
                          {formatDuration(track.durationSec)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="tty-dim px-2.5 py-6 text-center text-[11px]">
                QUEUE EMPTY · 队列还没建立
                <br />
                <span className="opacity-70">回曲库点一首歌即可排队</span>
              </p>
            )}
          </Panel>
        </div>
      ) : (
        <section className="tty-panel flex flex-1 flex-col items-center justify-center gap-4">
          <p style={{ color: 'var(--tty-magenta)' }} className="text-[13px] tracking-[0.2em]">
            NO SIGNAL · 未选择曲目
          </p>
          <button
            type="button"
            onClick={togglePlay}
            className="border border-current px-4 py-2 transition-colors hover:bg-current/15"
          >
            ▶ 播放曲库第一首
          </button>
          <Link to="/" className="tty-dim hover:bg-current/10">
            ← 回首页挑一首
          </Link>
        </section>
      )}

      <footer className="tty-marquee shrink-0 border-t border-current pt-1 text-[10px] tracking-widest tty-dim">
        <span>
          SPACE 播放/暂停 · ← → 切歌 · J K ±10s · 0-9 按百分比跳转 · R 播放模式 · F 收藏 · T 主题 ·
          ? 快捷键 · ESC 退出 &nbsp;&nbsp;◆&nbsp;&nbsp; $ mv2 --now --phosphor {theme}
          --colored --art halfblock &nbsp;&nbsp;◆&nbsp;&nbsp;
        </span>
      </footer>
    </div>
  );
}
