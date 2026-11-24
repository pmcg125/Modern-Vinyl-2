import { useEffect, useRef } from 'react';
import { usePlayer } from '../../state/player';

const VARS = [
  '--tty-fg',
  '--tty-cyan',
  '--tty-amber',
  '--tty-magenta',
  '--tty-violet',
  '--tty-dim',
] as const;

export type TermPalette = Record<(typeof VARS)[number], string>;

export interface MatrixApi {
  cols: number;
  rows: number;
  /** 格子宽高比（cellWidth / cellHeight）：画圆必须按它校正，否则按字符数等分永远是椭圆 */
  cellAspect: number;
  palette: TermPalette;
  /** 空网格 */
  clear: () => void;
  /** 在第 col,row 格写一个带颜色的字符（可选底色，用于半块点阵画） */
  put: (col: number, row: number, char: string, color: string, background?: string) => void;
  /** 写一整行 */
  putRow: (row: number, text: string, color: string) => void;
}

interface TermMatrixProps {
  cols: number;
  rows: number;
  /** 每帧调用，往 api 里写字符 */
  paint: (api: MatrixApi, elapsedMs: number) => void;
  className?: string;
  /** 帧间隔，默认 45ms（约 22fps，够顺且不刺眼） */
  intervalMs?: number;
}

const EMPTY = ' ';

/**
 * 字符网格画布：屏幕上只有等宽字形，但每个格子可以有自己的颜色 ——
 * 既保住终端观感，又摆脱单色限制。用 canvas 而不是 DOM 节点，
 * 是因为每帧要着色的格子有几百个。
 */
export function TermMatrix({ cols, rows, paint, className, intervalMs = 45 }: TermMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const theme = usePlayer((state) => state.theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const style = getComputedStyle(document.documentElement);
    const palette = Object.fromEntries(
      VARS.map((name) => [name, style.getPropertyValue(name).trim() || '#888888']),
    ) as TermPalette;

    let frame = 0;
    let last = 0;
    // 自己累计时钟：页面被遮挡时 rAF 会停摆，直接用 performance.now() 差值
    // 会让唱盘/扫描线在回到前台时瞬间 teleport，看起来像动画在抽
    let clock = 0;
    let prevTime = performance.now();
    let drawFrame: () => void = () => {};

    // 回到前台先同步补一帧，别等下一个 rAF 才刷新（否则会被看到一张冻住的旧帧）
    const onVisibility = () => {
      prevTime = performance.now();
      if (!document.hidden) drawFrame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    const chars: string[][] = Array.from({ length: rows }, () => Array(cols).fill(EMPTY));
    const colors: string[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => palette['--tty-fg']),
    );
    const bgs: (string | null)[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => null),
    );

    const api: MatrixApi = {
      cols,
      rows,
      cellAspect: 0.5,
      palette,
      clear: () => {
        for (const line of chars) line.fill(EMPTY);
        for (const line of bgs) line.fill(null);
      },
      put: (col, row, char, color, background) => {
        const cell = chars[row];
        if (col < 0 || col >= cols || !cell) return;
        cell[col] = char;
        colors[row]![col] = color;
        bgs[row]![col] = background ?? null;
      },
      putRow: (row, text, color) => {
        if (row < 0 || row >= rows) return;
        for (let i = 0; i < cols; i++) {
          chars[row]![i] = text[i] ?? EMPTY;
          colors[row]![i] = color;
          bgs[row]![i] = null;
        }
      },
    };

    drawFrame = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth || cols * 8;
      const height = canvas.clientHeight || rows * 12;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cellWidth = width / cols;
      const cellHeight = height / rows;
      api.cellAspect = cellWidth / cellHeight;

      // 先量好格子再画：paint 需要真实宽高比才能把唱片画成圆而不是椭圆
      api.clear();
      paintRef.current(api, clock);

      // 字号既受行高限制，也受列宽限制（等宽字约 0.6em 宽），否则窄格会互相压字
      const fontSize = Math.floor(Math.min(cellHeight * 0.94, cellWidth / 0.6));
      ctx.font = `${fontSize}px "JetBrains Mono Variable", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cellWidth;
          const y = row * cellHeight;
          const bg = bgs[row]?.[col];

          if (bg) {
            // 半块字符靠底色配合才有完整色彩，先铺底再写字
            ctx.fillStyle = bg;
            ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
          }

          const char = chars[row]?.[col];
          if (!char || char === EMPTY) continue;
          ctx.fillStyle = colors[row]?.[col] ?? palette['--tty-fg'];
          ctx.fillText(char, x + cellWidth / 2, y + cellHeight / 2);
        }
      }
    };

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);

      clock += Math.min(120, Math.max(0, time - prevTime));
      prevTime = time;

      if (time - last < intervalMs) return;
      last = time;
      drawFrame();
    };

    drawFrame();
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [cols, rows, intervalMs, theme]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label="音频可视化字符图" />;
}
