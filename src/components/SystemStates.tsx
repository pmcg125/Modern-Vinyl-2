import { useEffect, useState } from 'react';
import { usePlayer } from '../state/player';

/** 曲库服务掉线时的全局横幅：任何页面都能一键重连 */
export function OfflineBanner() {
  const status = usePlayer((state) => state.status);
  const error = usePlayer((state) => state.error);
  const refresh = usePlayer((state) => state.refreshLibrary);
  const offline = status === 'error';

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed top-[61px] left-0 z-40 w-full border-b-2 border-line bg-clash-1 px-4 py-2 text-white"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] tracking-widest uppercase">API OFFLINE</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] opacity-90">
          {error ?? '曲库服务没有响应'} · 试试 <b>npm run dev:api</b>
        </span>
        <button
          type="button"
          onClick={() => void refresh({ refresh: true })}
          className="border-2 border-white px-2.5 py-1 font-mono text-[11px] tracking-widest uppercase hover:bg-white hover:text-clash-1"
        >
          重连
        </button>
      </div>
    </div>
  );
}

/** 顶栏下方的阅读进度条，街头风的高亮细线 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (progress <= 0.001) return null;

  return (
    <div className="fixed top-[61px] left-0 z-30 h-[3px] w-full bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-accent transition-[width] duration-100"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
