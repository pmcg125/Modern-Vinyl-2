import { useEffect, useRef } from 'react';
import { adaptiveBands } from '../lib/audioMath';
import { engine, usePlayer } from '../state/player';

interface SpectrumCanvasProps {
  bins?: number;
  className?: string;
  gap?: number;
  colorVar?: '--accent' | '--clash-1' | '--tty-fg';
}

/** 实时频谱：直接读 AnalyserNode，不进 React 状态，避免 60fps 重渲染 */
export function SpectrumCanvas({
  bins = 48,
  className,
  gap = 2,
  colorVar = '--accent',
}: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = usePlayer((state) => state.theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const color = rootStyle.getPropertyValue(colorVar).trim() || '#888888';
    const dimColor = rootStyle.getPropertyValue('--muted').trim() || '#666666';

    let frame = 0;
    let levels = new Float32Array(bins);

    const render = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 对数分频带 + 高频补偿：线性分桶会把能量全挤在最左几根柱子上
      const raw = engine.readSpectrum();
      const bands = raw
        ? adaptiveBands(raw, engine.analyserSampleRate, bins, { tilt: 0.55 }).levels
        : null;
      if (bands && levels.length !== bands.length) levels = new Float32Array(bands.length);
      const count = bands?.length ?? levels.length;
      const barWidth = Math.max(1, (width - (count - 1) * gap) / Math.max(1, count));

      for (let i = 0; i < count; i++) {
        const target = bands?.[i] ?? 0;
        const prev = levels[i] ?? 0;
        // 快起慢落
        const smoothed = target > prev ? target : prev * 0.86 + target * 0.14;
        levels[i] = smoothed;

        const barHeight = Math.max(2, smoothed * height * 0.96);
        ctx.fillStyle = smoothed > 0.02 ? color : dimColor;
        ctx.globalAlpha = smoothed > 0.02 ? 1 : 0.3;
        ctx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
      }
      ctx.globalAlpha = 1;

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [bins, gap, colorVar, theme]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
