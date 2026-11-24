import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { formatDuration } from '../lib/format';
import { cx } from '../lib/cx';

interface SeekBarProps {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
  className?: string;
  /** 焦点在条上时用方向键微调，需要阻断全局的上一曲/下一曲 */
  keyboard?: boolean;
}

/**
 * 拖动时只更新本地预览，松手才真正 seek：
 * 否则 timeupdate 会和指针位置互相打架，进度条来回跳。
 */
export function SeekBar({
  positionSec,
  durationSec,
  onSeek,
  className,
  keyboard = true,
}: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  /**
   * 拖动标记必须放 ref，不能用 dragging 状态：pointermove 常常和 pointerdown
   * 落在同一个任务里，那时状态还没 flush，判断为 false 就会把开头几下当成 hover 丢掉。
   */
  const draggingRef = useRef(false);
  /** 预览值也留一份 ref：松手那一下可能和最后几下 move 同任务，闭包里的 state 还是旧值 */
  const previewRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const shown = preview ?? positionSec;
  const ratio = durationSec > 0 ? Math.min(1, Math.max(0, shown / durationSec)) : 0;

  const ratioFrom = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  /** 预览位置统一用「秒」，和 positionSec 同一单位 */
  const track = (seconds: number | null) => {
    previewRef.current = seconds;
    setPreview(seconds);
  };

  const commit = () => {
    const seconds = previewRef.current ?? positionSec;
    draggingRef.current = false;
    track(null);
    setDragging(false);
    if (durationSec > 0) onSeek(seconds);
  };

  /** 指针已抬起时 setPointerCapture 会抛 InvalidPointerId，不兜住的话整次拖动都会失效 */
  const capture = (event: ReactPointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 捕获失败只是不能拖出边界，按下定位仍然可用 */
    }
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* 浏览器会自己隐式释放 */
    }
  };

  return (
    <div
      ref={trackRef}
      role={keyboard ? 'slider' : undefined}
      tabIndex={keyboard ? 0 : undefined}
      aria-valuemin={keyboard ? 0 : undefined}
      aria-valuemax={keyboard ? Math.round(durationSec) : undefined}
      aria-valuenow={keyboard ? Math.round(shown) : undefined}
      aria-label="播放进度"
      onKeyDown={
        keyboard
          ? (event) => {
              const step = event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0;
              if (!step || durationSec <= 0) return;
              event.preventDefault();
              event.stopPropagation();
              onSeek(Math.min(durationSec, Math.max(0, positionSec + step)));
            }
          : undefined
      }
      className={cx(
        'group/seek relative flex h-4 cursor-pointer touch-none items-center',
        className,
      )}
      onPointerDown={(event) => {
        capture(event);
        draggingRef.current = true;
        setDragging(true);
        setHover(null);
        track(ratioFrom(event.clientX) * durationSec);
      }}
      onPointerMove={(event) => {
        const next = ratioFrom(event.clientX) * durationSec;
        if (draggingRef.current) track(next);
        else setHover(next);
      }}
      onPointerLeave={() => {
        if (!draggingRef.current) setHover(null);
      }}
      onPointerUp={(event) => {
        release(event);
        commit();
      }}
      onPointerCancel={(event) => {
        release(event);
        commit();
      }}
    >
      <div className="relative h-[10px] w-full border-2 border-line bg-bg-2">
        <div
          className={cx(
            'absolute inset-y-0 left-0 bg-accent',
            // 拖的时候去掉过渡：100ms 的宽度动画会让柱子明显落后于指针，像跟不上手
            !dragging && 'transition-[width] duration-100',
          )}
          style={{ width: `${ratio * 100}%` }}
        />
        {hover !== null && durationSec > 0 && (
          <span
            className="absolute inset-y-[-4px] w-[2px] bg-clash-2 opacity-80"
            style={{ left: `${Math.min(1, Math.max(0, hover / durationSec)) * 100}%` }}
          />
        )}
        <div
          className={cx(
            'absolute top-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 border-2 border-line bg-clash-1 transition-transform',
            dragging ? 'scale-125' : 'scale-90 group-hover/seek:scale-110',
          )}
          style={{ left: `${ratio * 100}%` }}
        />
      </div>

      {(dragging || hover !== null) && durationSec > 0 && (
        <span
          className="pointer-events-none absolute -top-7 -translate-x-1/2 border-2 border-line bg-ink px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-bg tabular-nums"
          style={{
            left: `${Math.min(1, Math.max(0, (dragging ? shown : (hover ?? 0)) / durationSec)) * 100}%`,
          }}
        >
          {formatDuration(dragging ? shown : hover)} / {formatDuration(durationSec)}
        </span>
      )}
    </div>
  );
}
