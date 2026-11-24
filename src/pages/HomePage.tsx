import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { useLibraryTracks } from '../state/selectors';
import { useCountUp, useReveal } from '../hooks/useMotion';
import { SectionHead } from '../components/SectionHead';
import { ThreeBackdrop } from '../components/ThreeBackdrop';
import { Ticker } from '../components/Ticker';
import { TrackTable } from '../components/TrackTable';
import { ArtistWall } from '../components/ArtistWall';
import { CoverPlate } from '../components/CoverPlate';
import { IconArrowRight, IconHeart, IconPlay, IconShuffle, IconTerminal } from '../components/Icon';
import { formatBytes, formatDuration, formatRelativeDays, formatSampleRate } from '../lib/format';
import { sortTracks } from '../lib/filters';
import { splitLetters, useTilt } from '../hooks/useTilt';
import { cx } from '../lib/cx';

const HERO_WORDS: [string, string][] = [
  ['PLAY', 'bg-accent text-on-accent'],
  ['LOCAL', 'bg-clash-1 text-white'],
  ['ONLY.', 'bg-bg-2 text-ink'],
];
import {
  bitrateBreakdown,
  durationExtremes,
  durationHistogram,
  topArtistsByDuration,
} from '../lib/stats';
import { BarChart } from '../components/BarChart';

function StatBlock({
  value,
  target,
  label,
  tone,
  delay = 0,
}: {
  value?: string;
  target?: number;
  label: string;
  tone: string;
  delay?: number;
}) {
  const counted = useCountUp(target ?? 0);
  const shown = value ?? String(counted);

  return (
    <div
      className="mv-block border-2 border-line bg-bg-2 px-3 py-2"
      style={{ ['--d' as string]: `${delay}ms` }}
    >
      <div className="font-display text-[26px] leading-none tabular-nums" style={{ color: tone }}>
        {shown}
      </div>
      <div className="mv-label mt-1">{label}</div>
    </div>
  );
}

export function HomePage() {
  const library = usePlayer((state) => state.library);
  const status = usePlayer((state) => state.status);
  const refresh = usePlayer((state) => state.refreshLibrary);
  const tracks = useLibraryTracks();
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const positionSec = usePlayer((state) => state.positionSec);
  const durationSec = usePlayer((state) => state.durationSec);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const favorites = usePlayer((state) => state.favorites);
  const plays = usePlayer((state) => state.plays);
  const playQueue = usePlayer((state) => state.playQueue);
  const setPlayMode = usePlayer((state) => state.setPlayMode);

  const fresh = useMemo(() => sortTracks(tracks, 'recent', true).slice(0, 7), [tracks]);

  const mostPlayed = useMemo(() => {
    const counted = tracks
      .map((track) => ({ track, count: plays[track.id]?.count ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return counted;
  }, [tracks, plays]);

  const spotlight = library?.albums.slice(0, 8) ?? [];
  const headlineTrack = current ?? tracks[0] ?? null;

  const durationBars = useMemo(() => durationHistogram(tracks), [tracks]);
  const bitrateBars = useMemo(() => bitrateBreakdown(tracks), [tracks]);
  const artistBars = useMemo(() => topArtistsByDuration(tracks), [tracks]);
  const extremes = useMemo(() => durationExtremes(tracks), [tracks]);
  const {
    containerRef: spotRef,
    revealed: spotIn,
    delayOf: spotDelay,
  } = useReveal<HTMLDivElement>(Math.min(spotlight.length, 8));
  const tilt = useTilt(6);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-20">
        <div className="h-[70vh] animate-pulse border-2 border-line bg-panel" />
        <p className="mv-label mt-4">SCANNING · 正在读取本地曲库…</p>
      </div>
    );
  }

  if (status === 'error' || !library) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-24">
        <div className="mv-panel border-clash-1 p-8">
          <h1 className="font-display text-[34px] text-clash-1">API OFFLINE</h1>
          <p className="mt-3 font-mono text-[13px] text-muted">
            曲库服务没有响应。在项目目录执行 <span className="text-ink">npm run dev:api</span>{' '}
            后重试。
          </p>
          <button
            type="button"
            className="mv-btn mt-6"
            onClick={() => void refresh({ refresh: true })}
          >
            重试连接
          </button>
        </div>
      </div>
    );
  }

  if (!library.tracks.length) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-24">
        <div className="mv-panel mv-grid relative p-8">
          <p className="mv-label">EMPTY LIBRARY</p>
          <h1 className="mt-2 font-display text-[clamp(38px,8vw,72px)]">
            DROP <span className="text-accent">MP3</span>
          </h1>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-muted">
            <code className="border-2 border-line px-1 font-mono text-[13px]">music/</code> 里一个
            mp3 都没有。把歌曲文件放进去（子目录也会递归扫描），然后点下面的按钮重扫。
            歌词可以放同名 <code className="font-mono text-[13px]">.lrc</code> 边车文件。
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="mv-btn"
              onClick={() => void refresh({ refresh: true })}
            >
              重新扫描曲库
            </button>
            <Link to="/about" className="mv-btn">
              看接口说明
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* HERO：撞色街头大字 + 当前曲目规格表 */}
      <section className="mv-grid mv-grid-drift mv-noise relative overflow-hidden border-b-2 border-line bg-bg-2">
        {/* 线框 3D 背景：掩膜把左半边让给标题，右半给唱套，避免线条穿字 */}
        <ThreeBackdrop
          className="absolute inset-0 h-full w-full opacity-70"
          style={{
            maskImage:
              'radial-gradient(120% 96% at 74% 42%, #000 30%, rgba(0,0,0,0.45) 55%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(120% 96% at 74% 42%, #000 30%, rgba(0,0,0,0.45) 55%, transparent 78%)',
          }}
        />
        <div className="relative z-10 mx-auto grid max-w-[1600px] items-center gap-10 px-4 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <p className="mb-5 inline-block border-2 border-line bg-ink px-2 py-1 font-mono text-[10px] tracking-[0.25em] text-bg uppercase">
              {library.root} · {library.stats.trackCount} TRACKS · NO CLOUD
            </p>

            <h1 className="font-display text-[clamp(52px,11vw,132px)] leading-[0.82]">
              {HERO_WORDS.map(([word, tone], line) => (
                <span
                  key={word}
                  className={cx('mv-block block w-fit px-3', tone)}
                  style={{ ['--d' as string]: `${line * 110}ms` }}
                >
                  {splitLetters(word, 55).map(({ char, delay }, i) => (
                    <span
                      key={`${word}-${i}`}
                      className="mv-letter"
                      style={{ ['--d' as string]: delay }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
              ))}
            </h1>

            <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-muted">
              只播你硬盘上的歌。没有账号、没有算法推荐、没有上传——扫目录、读标签、抽封面、流式播放，
              全部发生在本机。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-2 border-2 border-line bg-accent px-5 py-3 font-mono text-[12px] tracking-widest text-on-accent uppercase shadow-hard transition-transform hover:-translate-y-1"
                onClick={() => playQueue({ label: '全部曲目', tracks }, 0)}
              >
                <IconPlay size={16} /> 播放全部
              </button>
              <button
                type="button"
                className="flex items-center gap-2 border-2 border-line bg-clash-2 px-5 py-3 font-mono text-[12px] tracking-widest text-ink uppercase shadow-hard-sm transition-transform hover:-translate-y-1"
                onClick={() => {
                  setPlayMode('shuffle');
                  const random = tracks[Math.floor(Math.random() * tracks.length)];
                  if (random) playQueue({ label: '随机播放', tracks }, tracks.indexOf(random));
                }}
              >
                <IconShuffle size={16} /> 随机切一首
              </button>
              <Link
                to="/library"
                className="flex items-center gap-2 border-2 border-line px-5 py-3 font-mono text-[12px] tracking-widest uppercase hover:bg-ink hover:text-bg"
              >
                浏览曲库 <IconArrowRight size={16} />
              </Link>
              {current && !playing && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="mv-pop flex items-center gap-2 border-2 border-line bg-clash-1 px-5 py-3 font-mono text-[12px] tracking-widest text-white uppercase shadow-hard-sm hover:-translate-y-1"
                >
                  <IconPlay size={16} /> 继续 · {formatDuration(positionSec)} /{' '}
                  {formatDuration(durationSec)}
                </button>
              )}
            </div>

            <div className="mt-10 grid max-w-[560px] grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock
                target={library.stats.trackCount}
                label="TRACKS"
                tone="var(--accent)"
                delay={0}
              />
              <StatBlock
                target={library.stats.albumCount}
                label="ALBUMS"
                tone="var(--clash-1)"
                delay={90}
              />
              <StatBlock
                value={formatDuration(library.stats.totalDurationSec)}
                label="PLAYTIME"
                tone="var(--ink)"
                delay={180}
              />
              <StatBlock
                value={formatBytes(library.stats.totalBytes)}
                label="ON DISK"
                tone="var(--ink)"
                delay={270}
              />
            </div>
          </div>

          {/* 当前/首曲规格 */}
          <div className="relative">
            <div className="mv-hazard absolute -top-4 -left-4 h-full w-full" aria-hidden="true" />
            {headlineTrack && (
              <div className="relative">
                <div
                  className="mv-sleeve mv-tilt"
                  data-spine={current ? 'SIDE B' : 'SIDE A'}
                  onPointerMove={tilt.onPointerMove}
                  onPointerLeave={tilt.onPointerLeave}
                >
                  <CoverPlate
                    id={headlineTrack.id}
                    title={headlineTrack.title}
                    hasCover={headlineTrack.hasCover}
                    artClassName="mv-sleeve-art aspect-square w-full"
                    className="aspect-square w-full"
                    active={Boolean(current?.id === headlineTrack.id)}
                  />
                </div>
                <dl className="mt-2 grid grid-cols-2 border-2 border-line bg-panel font-mono text-[11px]">
                  {[
                    ['ARTIST', headlineTrack.artist],
                    ['ALBUM', headlineTrack.album],
                    [
                      'BITRATE',
                      headlineTrack.bitrateKbps ? `${headlineTrack.bitrateKbps} kbps` : '—',
                    ],
                    ['SR', formatSampleRate(headlineTrack.sampleRateHz)],
                    ['CODEC', headlineTrack.codec ?? '—'],
                    ['ADDED', formatRelativeDays(headlineTrack.mtimeMs)],
                  ].map(([key, value]) => (
                    <div key={key} className="flex flex-col border-line px-3 py-2 odd:border-r">
                      <dt className="text-[9px] tracking-[0.22em] text-muted uppercase">{key}</dt>
                      <dd className="truncate text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </section>

      <Ticker
        items={tracks.map((track) => `${track.title} — ${track.artist}`)}
        tone="accent"
        speed={46}
      />

      {/* 01 专辑精选 */}
      <section className="mx-auto max-w-[1600px] px-4 py-14">
        <SectionHead
          index="01"
          title="SELECTED"
          sub={`${library.stats.albumCount} 张专辑 / 点封面直接播放`}
          right={
            <Link to="/albums" className="mv-btn">
              全部专辑 <IconArrowRight size={14} />
            </Link>
          }
        />
        <div
          ref={spotRef}
          className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3"
        >
          {spotlight.map((album, index) => (
            <div
              key={album.key}
              data-in={spotIn ? 1 : 0}
              style={{ ['--d' as string]: spotDelay(index) }}
              className="mv-reveal w-[240px] shrink-0 snap-start"
            >
              <Link
                to={`/albums/${encodeURIComponent(album.key)}`}
                className="mv-sleeve mv-lift block border-2 border-line"
                data-spine={String(index + 1).padStart(2, '0')}
              >
                <CoverPlate
                  id={album.coverTrackId}
                  title={album.title}
                  hasCover={album.hasCover}
                  artClassName="mv-sleeve-art aspect-square w-full"
                  className="aspect-square w-full"
                />
              </Link>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{album.title}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{album.artist}</p>
                </div>
                <span className="shrink-0 border-2 border-line px-1 font-mono text-[10px] tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] tracking-widest text-muted uppercase">
                {album.trackCount} TRACKS · {formatDuration(album.durationSec)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 02 最新入库 */}
      <section className="border-y-2 border-line bg-bg-2">
        <div className="mx-auto max-w-[1600px] px-4 py-14">
          <SectionHead
            index="02"
            title="FRESH CUTS"
            tone="clash-1"
            sub="按文件时间倒序 · 前 7 首"
            right={
              <Link to="/library" className="mv-btn">
                全列表
              </Link>
            }
          />
          <TrackTable tracks={fresh} label="最新入库" dense />
        </div>
      </section>

      {/* 03 艺人墙 + 04 收藏/常听 */}
      <section className="mx-auto grid max-w-[1600px] gap-14 px-4 py-14 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHead
            index="03"
            title="ARTIST WALL"
            tone="clash-2"
            sub="字号 = 曲目数 · 点击筛选"
          />
          <ArtistWall tracks={tracks} />
        </div>

        <div>
          <SectionHead index="04" title="HEAVY ROTATION" sub="本机播放次数" />
          {mostPlayed.length ? (
            <ol className="border-2 border-line bg-panel">
              {mostPlayed.map(({ track, count }, index) => (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() =>
                      usePlayer.getState().playTrack(track, {
                        label: '常听',
                        tracks: mostPlayed.map((row) => row.track),
                      })
                    }
                    className="flex w-full items-center gap-3 border-b border-line/40 px-3 py-2 text-left last:border-b-0 hover:bg-ink hover:text-bg"
                  >
                    <span className="w-5 font-display text-[15px] text-accent tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {track.title}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">×{count}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="border-2 border-dashed border-line p-8 text-center">
              <p className="font-mono text-[12px] tracking-widest text-muted uppercase">
                NO PLAYDATA YET
              </p>
              <p className="mt-2 text-[13px] text-muted">播几首之后，这里会记录你的循环偏好。</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/favs"
              className="flex items-center gap-2 border-2 border-line bg-clash-1 px-4 py-2 font-mono text-[11px] tracking-widest text-white uppercase"
            >
              <IconHeart size={14} filled /> {favorites.size} 收藏
            </Link>
            <Link
              to="/now"
              className="flex items-center gap-2 border-2 border-line px-4 py-2 font-mono text-[11px] tracking-widest uppercase hover:bg-ink hover:text-bg"
            >
              <IconTerminal size={14} /> 沉浸模式
            </Link>
          </div>
        </div>
      </section>
      {/* 05 曲库剖面：没有流派标签，就用真实可得的形状说话 */}
      <section className="border-t-2 border-line bg-bg-2">
        <div className="mx-auto max-w-[1600px] px-4 py-14">
          <SectionHead
            index="05"
            title="CUT PROFILE"
            tone="clash-1"
            sub="曲库剖面 · 由本地元数据实时计算"
            right={
              extremes.longest && extremes.shortest ? (
                <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  LONGEST {extremes.longest.title.slice(0, 14)} ·{' '}
                  {formatDuration(extremes.longest.durationSec)}
                </span>
              ) : null
            }
          />
          <div className="grid gap-3 lg:grid-cols-3">
            <BarChart title="时长分布" bars={durationBars} unit="seconds" />
            <BarChart title="码率分布" bars={bitrateBars} perLabelColor />
            <BarChart
              title="艺人时长 TOP"
              bars={artistBars}
              unit="seconds"
              color="var(--clash-1)"
            />
          </div>
        </div>
      </section>
    </>
  );
}
