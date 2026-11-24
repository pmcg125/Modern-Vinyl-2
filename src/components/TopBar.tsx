import { NavLink, useLocation } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { useClock } from '../hooks/useAppHooks';
import { toast } from '../state/toast';
import { formatSampleRate, pad } from '../lib/format';
import { cx } from '../lib/cx';
import { IconDisc, IconMoon, IconRefresh, IconSun } from './Icon';

const NAV = [
  { to: '/', label: 'HOME', cn: '首页' },
  { to: '/library', label: 'LIBRARY', cn: '曲库' },
  { to: '/albums', label: 'ALBUMS', cn: '专辑' },
  { to: '/favs', label: 'FAVS', cn: '收藏' },
  { to: '/recent', label: 'RECENT', cn: '最近' },
  { to: '/about', label: 'ABOUT', cn: '关于' },
];

function Clock() {
  const now = useClock();
  const stamp = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return (
    <span className="font-mono text-[11px] tracking-widest text-muted tabular-nums">{stamp}</span>
  );
}

export function TopBar() {
  const stats = usePlayer((state) => state.library?.stats);
  const status = usePlayer((state) => state.status);
  const theme = usePlayer((state) => state.theme);
  const setTheme = usePlayer((state) => state.setTheme);
  const motion = usePlayer((state) => state.motion);
  const motionResolved = usePlayer((state) => state.motionResolved);
  const cycleMotion = usePlayer((state) => state.cycleMotion);
  // auto 且被系统降级：芯片要自己喊出来，不然只看到「动效变少」却不知为何
  const downgraded = motion === 'auto' && motionResolved !== 'full';
  const refresh = usePlayer((state) => state.refreshLibrary);
  const { pathname } = useLocation();

  const live = status === 'ready';

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b-2 border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[58px] max-w-[1600px] items-center gap-4 px-4">
        <NavLink to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-[34px] place-items-center border-2 border-line bg-accent text-on-accent">
            <IconDisc size={18} />
          </span>
          <span className="hidden font-display text-[19px] leading-none sm:block">
            MODERN<span className="text-accent">VINYL</span>2
          </span>
        </NavLink>

        <nav className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cx(
                  'shrink-0 border-2 border-transparent px-2.5 py-1 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors',
                  active
                    ? 'border-line bg-ink text-bg'
                    : 'text-muted hover:border-line hover:text-ink',
                )}
              >
                {item.label}
                <span className="ml-1 hidden text-[10px] opacity-60 lg:inline">{item.cn}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <span
            className={cx(
              'border-2 px-2 py-1 font-mono text-[10px] tracking-widest uppercase',
              live ? 'border-accent text-accent' : 'border-clash-1 text-clash-1',
            )}
            title={live ? '曲库索引就绪' : 'API 未就绪'}
          >
            {live ? `■ LIB ${stats?.trackCount ?? 0}` : '■ API OFFLINE'}
          </span>
          {stats?.commonSampleRate && (
            <span className="border-2 border-line px-2 py-1 font-mono text-[10px] tracking-widest text-muted uppercase">
              {formatSampleRate(stats.commonSampleRate)}
            </span>
          )}
          <Clock />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="mv-btn !px-2 !py-1.5"
            aria-label="重新扫描曲库"
            title="重新扫描曲库 (R 循环播放模式)"
            disabled={status === 'loading'}
            onClick={() => {
              void refresh({ refresh: true });
              toast('重新扫描曲库…', 'accent');
            }}
          >
            <IconRefresh size={16} className={status === 'loading' ? 'animate-spin' : undefined} />
          </button>
          <button
            type="button"
            className={cx('mv-btn !px-2 !py-1.5', downgraded && '!border-clash-1 !text-clash-1')}
            aria-label={`动效档位 ${motionResolved}`}
            title={
              downgraded
                ? `系统开启了「减少动态效果」，当前已降级为 ${motionResolved}。点击强制开启全部动效 (V)`
                : `动效档位：${motionResolved}（偏好 ${motion}）· 按 V 切换`
            }
            onClick={cycleMotion}
          >
            <span className="font-mono text-[10px] leading-none tracking-widest">
              {downgraded ? 'FX!' : 'FX·'}
              {/* 三格电平：满 / 降一档 / 全关，一眼分得清 full 和 calm */}
              {motionResolved === 'full' ? '▉▉▉' : motionResolved === 'calm' ? '▉▉▯' : '▯▯▯'}
            </span>
          </button>
          <button
            type="button"
            className="mv-btn !px-2 !py-1.5"
            aria-label={theme === 'dark' ? '切到亮色主题' : '切到暗色主题'}
            title={theme === 'dark' ? '切到亮色 (T)' : '切到暗色 (T)'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
        </div>
      </div>

      <div className="mv-hazard h-[3px] w-full opacity-80" />
    </header>
  );
}
