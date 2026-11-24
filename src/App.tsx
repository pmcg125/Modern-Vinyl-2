import { Route, Routes, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { PlayerBar } from './components/PlayerBar';
import { Toaster } from './components/Toaster';
import { OfflineBanner, ScrollProgress } from './components/SystemStates';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutHelp } from './components/ShortcutHelp';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { AlbumPage } from './pages/AlbumPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { RecentPage } from './pages/RecentPage';
import { NowPlayingPage } from './pages/NowPlayingPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import {
  useErrorNotice,
  useLibraryBootstrap,
  useMotionNotice,
  useNowPlayingMeta,
} from './hooks/useAppHooks';
import { cx } from './lib/cx';

export default function App() {
  useLibraryBootstrap();
  useKeyboardShortcuts();
  useNowPlayingMeta();
  useErrorNotice();
  useMotionNotice();

  const { pathname } = useLocation();
  const immersive = pathname === '/now';
  // 只按顶层路由做进场：查询串变化（如搜索）不该把页面重挂载一遍
  const routeKey = pathname.split('/')[1] ?? 'home';

  return (
    <div
      className={cx(
        'min-h-screen bg-bg text-ink font-ui',
        // 播放条是 fixed 的：留出它的实测高度，窄屏下它会长到近 180px
        !immersive && 'pb-[calc(var(--mv-footer-h,104px)+16px)]',
      )}
    >
      <a
        href="#main"
        className="sr-only z-[100] border-2 border-line bg-accent px-3 py-2 font-mono text-[12px] text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        跳到主内容
      </a>

      {!immersive && <TopBar />}
      {!immersive && <ScrollProgress />}
      {!immersive && <OfflineBanner />}

      {/* 沉浸页自带 CRT 开机动画；且 transform 动画会把 main 变成 fixed 子元素的包含块 */}
      <main id="main" key={routeKey} className={cx(!immersive && 'mv-page pt-[58px]')}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/albums" element={<AlbumsPage />} />
            <Route path="/albums/:key" element={<AlbumPage />} />
            <Route path="/favs" element={<FavoritesPage />} />
            <Route path="/recent" element={<RecentPage />} />
            <Route path="/now" element={<NowPlayingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {!immersive && <PlayerBar />}
      <Toaster />
      <ShortcutHelp />
    </div>
  );
}
