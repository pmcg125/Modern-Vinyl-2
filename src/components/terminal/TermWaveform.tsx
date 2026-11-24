import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePlayer } from '../../state/player';

interface TermWaveformProps {
  /** 0..1 归一化峰值；null 表示还没解码出来 */
  peaks: number[] | null;
  ratio: number;
  buffered: number;
  onSeek?: (ratio: number) => void;
  className?: string;
}

/**
 * 整曲波形：终端里唯一的「实心」图形，用磷光三色区分
 * 已播（主色）/ 剩余（暗色）/ 已缓冲（青）/ 磁头（琥珀）。
 * 按进度重绘而不是跑 rAF，因为它本身就是 4Hz 更新的数据。
 *
 * 拖动时先走本地预览、松手才 seek：边拖边 seek 会让 timeupdate 反过来
 * 覆盖磁头位置，手感就是「拖不动、往回弹」。
 */
export function TermWaveform({ peaks, ratio, buffered, onSeek, className }: TermWaveformProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  /** 同 SeekBar：pointermove 可能和 pointerdown 同任务到达，状态还没 flush，得用 ref 当闸门 */
  const scrubbingRef = useRef(false);
  const shown = scrub ?? ratio;
  const theme = usePlayer((state) => state.theme);

  const ratioFrom = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const capture = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 指针已抬起：捕获失败只影响拖出边界 */
    }
  };

  const endScrub = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* 浏览器会隐式释放 */
    }
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setScrub((current) => {
      if (current !== null) onSeek?.(current);
      return null;
    });
  };

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const style = getComputedStyle(document.documentElement);
    const fg = style.getPropertyValue('--tty-fg').trim() || '#00ff6a';
    const dim = style.getPropertyValue('--tty-dim').trim() || '#0a7a3a';
    const cyan = style.getPropertyValue('--tty-cyan').trim() || dim;
    const amber = style.getPropertyValue('--tty-amber').trim() || fg;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!peaks?.length) {
      ctx.fillStyle = dim;
      ctx.globalAlpha = 0.5;
      ctx.font = '10px "JetBrains Mono Variable", ui-monospace, monospace';
      ctx.fillText('DECODING WAVEFORM…', 4, height / 2 + 3);
      ctx.globalAlpha = 1;
      return;
    }

    const barWidth = width / peaks.length;
    const playedCount = Math.round(shown * peaks.length);
    const bufferedCount = Math.round(buffered * peaks.length);

    peaks.forEach((peak, index) => {
      const barHeight = Math.max(1, peak * (height - 2));
      ctx.fillStyle = index < playedCount ? fg : index < bufferedCount ? cyan : dim;
      ctx.globalAlpha = index < playedCount ? 1 : 0.55;
      ctx.fillRect(
        index * barWidth,
        (height - barHeight) / 2,
        Math.max(1, barWidth - 1),
        barHeight,
      );
    });

    ctx.globalAlpha = 1;
    const headX = shown * width;
    ctx.fillStyle = amber;
    ctx.fillRect(headX - 0.5, 0, 1.5, height);
  }, [peaks, shown, buffered, theme]);

  return (
    <canvas
      ref={ref}
      className={className}
      role={onSeek ? 'slider' : 'img'}
      tabIndex={onSeek ? 0 : undefined}
      aria-label="整曲波形，拖动跳转"
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(shown * 100) : undefined}
      onKeyDown={
        onSeek
          ? (event) => {
              const step =
                event.key === 'ArrowRight' ? 0.02 : event.key === 'ArrowLeft' ? -0.02 : 0;
              if (!step) return;
              event.preventDefault();
              event.stopPropagation();
              onSeek(Math.min(1, Math.max(0, shown + step)));
            }
          : undefined
      }
      onPointerDown={
        onSeek
          ? (event) => {
              const next = ratioFrom(event.clientX);
              if (next === null) return;
              scrubbingRef.current = true;
              capture(event);
              setScrub(next);
            }
          : undefined
      }
      onPointerMove={
        onSeek
          ? (event) => {
              if (!scrubbingRef.current) return;
              const next = ratioFrom(event.clientX);
              if (next !== null) setScrub(next);
            }
          : undefined
      }
      onPointerUp={onSeek ? endScrub : undefined}
      onPointerCancel={onSeek ? endScrub : undefined}
      style={onSeek ? { cursor: 'pointer', touchAction: 'none' } : undefined}
    />
  );
}
