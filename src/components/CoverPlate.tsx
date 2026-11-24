import { useState } from 'react';
import type { TrackId } from '@shared/types';
import { coverUrl } from '../lib/api';
import { clashOf, cx } from '../lib/cx';
import { IconPlay } from './Icon';

interface CoverPlateProps {
  id: TrackId;
  title: string;
  hasCover: boolean;
  className?: string;
  /** 传了就渲染悬停播放层 */
  onPlay?: () => void;
  active?: boolean;
  /** 附加到根元素，供外层做封套/倾斜等复合效果 */
  artClassName?: string;
  rounded?: never;
}

/**
 * 封面块：有内嵌封面就用封面，没有就生成一张排版海报（首字母 + 撞色底）。
 * 曲库里的中文单曲多数没有封面，所以这套回落视觉是主视觉的一部分。
 */
export function CoverPlate({
  id,
  title,
  hasCover,
  className,
  onPlay,
  active = false,
  artClassName,
}: CoverPlateProps) {
  const [broken, setBroken] = useState(false);
  const color = clashOf(id);
  const letter = (title.trim()[0] ?? '?').toUpperCase();

  return (
    <div
      className={cx(
        'group/plate relative overflow-hidden border-2 border-line bg-panel',
        active && 'shadow-clash',
        className,
        artClassName,
      )}
    >
      {hasCover && !broken ? (
        <img
          src={coverUrl(id)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={cx(
            'size-full object-cover transition-transform duration-500',
            onPlay && 'group-hover/plate:scale-[1.06]',
          )}
        />
      ) : (
        <div className="grid size-full place-items-center" style={{ background: color }}>
          <span className="font-display text-[2.6em] leading-none text-bg mix-blend-difference">
            {letter}
          </span>
          <span
            className="absolute inset-x-0 bottom-0 h-1/3 opacity-70"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, var(--ink) 0 6px, transparent 6px 12px)',
            }}
          />
        </div>
      )}

      {active && (
        <span className="absolute top-0 left-0 flex items-center gap-1 border-2 border-line bg-accent px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-on-accent uppercase">
          NOW
        </span>
      )}

      {onPlay && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPlay();
          }}
          aria-label={`播放 ${title}`}
          className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition-all duration-200 group-hover/plate:bg-ink/45 group-hover/plate:opacity-100"
        >
          <span className="grid size-12 place-items-center border-2 border-line bg-accent text-on-accent shadow-hard-sm">
            <IconPlay size={20} />
          </span>
        </button>
      )}
    </div>
  );
}
