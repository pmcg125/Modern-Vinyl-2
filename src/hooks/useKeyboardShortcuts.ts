import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlayer } from '../state/player';
import { isTypingTarget, ownsArrowKeys } from './useAppHooks';

/**
 * 全局快捷键。列表见 /about，也印在沉浸播放器的底栏。
 * `/` 只广播聚焦事件，搜索框自己决定要不要接。
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = usePlayer.getState();

      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('mv2:focus-search'));
        return;
      }

      if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('mv2:toggle-help'));
        return;
      }

      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      // 音量/均衡器滑块获得焦点时，方向键归它自己；其余快捷键照常可用
      if (event.key.startsWith('Arrow') && ownsArrowKeys(event.target)) return;
      if (event.key === 'Escape') {
        if (pathname === '/now') navigate(-1);
        store.dismissError();
        return;
      }

      switch (event.key) {
        case ' ':
        case 'Spacebar': {
          event.preventDefault();
          store.togglePlay();
          return;
        }
        case 'ArrowRight':
          event.preventDefault();
          store.next('manual');
          return;
        case 'ArrowLeft':
          event.preventDefault();
          store.prev();
          return;
        case 'ArrowUp':
        case 'ArrowDown': {
          event.preventDefault();
          const delta = event.key === 'ArrowUp' ? 0.05 : -0.05;
          store.setVolume(Math.round((store.volume + delta) * 100) / 100);
          return;
        }
        default:
          break;
      }

      switch (event.key.toLowerCase()) {
        case 'm':
          store.toggleMute();
          break;
        case 'f':
          if (store.current) store.toggleFavorite(store.current.id);
          break;
        case 't':
          store.setTheme(store.theme === 'dark' ? 'light' : 'dark');
          break;
        case 'v':
          store.cycleMotion();
          break;
        case 'r':
          store.cyclePlayMode();
          break;
        case 'e':
          window.dispatchEvent(new CustomEvent('mv2:toggle-eq'));
          break;
        case 'i':
          if (pathname === '/now') navigate(-1);
          else navigate('/now');
          break;
        case 'j':
          store.skip(-10);
          break;
        case 'k':
          store.skip(10);
          break;
        default:
          if (/^[0-9]$/.test(event.key) && store.durationSec > 0) {
            const ratio = event.key === '0' ? 0 : Number(event.key) / 10;
            store.seek(ratio * store.durationSec);
          }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, pathname]);
}
