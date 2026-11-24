import { useEffect, useState } from 'react';
import { loadHalfBlock, pixelColor, type HalfBlockGrid } from '../../lib/asciiArt';
import { TermMatrix, type MatrixApi } from './TermMatrix';

interface TermArtProps {
  /** 封面地址；空字符串表示无图 */
  src: string | null;
  cols?: number;
  rows?: number;
  className?: string;
  /** 标题首字母，用于无图时的占位排版 */
  fallbackChar?: string;
}

/**
 * 半块字符全彩图：终端里唯一的「非文字」视觉，
 * 加载失败时回落到暗色网格占位而不是空白。
 */
export function TermArt({
  src,
  cols = 26,
  rows = 13,
  className,
  fallbackChar = '?',
}: TermArtProps) {
  const [grid, setGrid] = useState<HalfBlockGrid | null>(null);

  useEffect(() => {
    if (!src) {
      setGrid(null);
      return;
    }
    let cancelled = false;
    setGrid(null);

    void loadHalfBlock(src, cols, rows).then((next) => {
      if (!cancelled) setGrid(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src, cols, rows]);

  const paint = (api: MatrixApi) => {
    const { palette } = api;

    if (!grid) {
      // 占位：斜纹网格 + 首字母，避免加载瞬间是一块死黑
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const onStripe = (col + row) % 4 === 0;
          api.put(col, row, onStripe ? '░' : ' ', palette['--tty-dim']);
        }
      }
      const midRow = Math.floor(rows / 2);
      api.put(Math.floor(cols / 2) - 1, midRow, fallbackChar.slice(0, 1), palette['--tty-fg']);
      return;
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const top = pixelColor(grid, col, row * 2);
        const bottom = pixelColor(grid, col, row * 2 + 1);
        // ▄ 的下半用底色、上半用前景色，一格塞进两行像素
        api.put(col, row, '▄', top, bottom);
      }
    }
  };

  return (
    <TermMatrix cols={cols} rows={rows} paint={paint} className={className} intervalMs={120} />
  );
}
