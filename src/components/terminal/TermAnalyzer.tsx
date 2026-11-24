import { useEffect, useRef } from 'react';
import { adaptiveBands, bandLayout, estimateRollOffHz, formatHz } from '../../lib/audioMath';
import { engine, usePlayer } from '../../state/player';

const DB_STOPS: [number, string][] = [
  [1, '0'],
  [0.72, '-20'],
  [0.44, '-40'],
  [0.16, '-60'],
];

const OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const AXIS_TICKS = [60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';

/** 高频抬升：不补偿的话 1/f 衰减会让右半边常年贴地 */
const TILT = 0.5;

interface TermAnalyzerProps {
  /** 显示模式：频谱柱 / 时域波形 / 两者叠加 */
  mode: 'spectrum' | 'scope' | 'both';
  className?: string;
}

/**
 * 像素级频谱 / 示波器。
 *
 * 分频逻辑不在这里：柱子黏成块的根因是「相邻列取到同一个 FFT 桶」，
 * 由 audioMath.adaptiveBands 用浮点桶插值解决。这里只负责画，
 * 并且保证每根柱子之间一定有缝（间隙至少 2px），不靠颜色差别硬撑。
 */
export function TermAnalyzer({ mode, className }: TermAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = usePlayer((state) => state.theme);
  const motion = usePlayer((state) => state.motionResolved);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const root = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) =>
      root.getPropertyValue(name).trim() || fallback;

    const palette = {
      fg: color('--tty-fg', '#00ff6a'),
      dim: color('--tty-dim', '#0a7a3a'),
      cyan: color('--tty-cyan', '#4de2ff'),
      amber: color('--tty-amber', '#ffc447'),
      magenta: color('--tty-magenta', '#ff4da6'),
      violet: color('--tty-violet', '#b388ff'),
      bg: color('--tty-bg', '#03110a'),
    };

    // 逐列平滑值与峰值保持常驻 effect 作用域：换视图/换主题不重置，
    // 暂停时靠它们把柱形缓缓沉下去，而不是瞬间清空成一块白板。
    let smooth: Float32Array | null = null;
    let hold: Float32Array | null = null;
    let freqs: Float32Array | null = null;

    const frameInterval = motion === 'off' ? 1 / 8 : motion === 'calm' ? 1 / 20 : 0;
    let frame = 0;
    let last = 0;
    const startedAt = performance.now();

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (frameInterval && time - last < frameInterval * 1000) return;
      last = time;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const axisH = 14;
      const gutter = 30;
      const plotW = Math.max(10, w - gutter);
      const plotH = Math.max(10, h - axisH - 2);
      const paused = engine.element.paused;
      const rate = engine.analyserSampleRate;

      // BOTH 分上下两带：示波器的过零线叠在柱子上只会读成一片噪点
      const specH = mode === 'both' ? Math.round(plotH * 0.66) : plotH;
      const scopeTop = mode === 'both' ? Math.round(plotH * 0.72) : 0;
      const scopeH = plotH - scopeTop;

      const raw = paused ? null : engine.readSpectrum();
      const wanted = Math.max(20, Math.min(96, Math.round(plotW / 6)));
      const layout = raw
        ? null
        : bandLayout(engine.spectrumBinCount || 1024, rate, wanted, { tilt: TILT });
      const bands = raw ? adaptiveBands(raw, rate, wanted, { tilt: TILT }) : null;
      const columns = bands?.levels.length ?? layout?.columns ?? smooth?.length ?? wanted;
      const scale = bands?.frequencies ?? layout?.frequencies ?? freqs ?? new Float32Array(0);

      if (!smooth || smooth.length !== columns) {
        smooth = new Float32Array(columns);
        hold = new Float32Array(columns);
      }
      const values = smooth;
      const peaks = hold ?? new Float32Array(columns);
      if (scale.length) freqs = scale;

      let rolloffMark: { x: number; hz: number } | null = null;

      ctx.lineWidth = 1;
      ctx.textBaseline = 'middle';

      // 倍频程竖网格
      ctx.strokeStyle = palette.dim;
      ctx.globalAlpha = 0.18;
      for (const mark of OCTAVES) {
        const idx = indexOfFreq(scale, mark);
        if (idx < 0) continue;
        const x = Math.round(gutter + ((idx + 0.5) / columns) * plotW) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // dB 横网格 + 左侧刻度
      ctx.font = `9px ${MONO}`;
      ctx.textAlign = 'right';
      for (const [level, label] of DB_STOPS) {
        const y = Math.round(specH - level * specH) + 0.5;
        ctx.strokeStyle = palette.dim;
        ctx.globalAlpha = 0.26;
        ctx.beginPath();
        ctx.moveTo(gutter, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = palette.dim;
        ctx.fillText(label, gutter - 5, y);
      }
      ctx.globalAlpha = 1;

      if (mode !== 'scope' && bands) {
        for (let i = 0; i < columns; i++) {
          const target = bands.levels[i] ?? 0;
          const prev = values[i] ?? 0;
          // 上升跟手、回落慢：快起慢落才是频谱该有的呼吸
          values[i] = target > prev ? prev + (target - prev) * 0.55 : prev * 0.84;
          peaks[i] = Math.max(values[i] ?? 0, (peaks[i] ?? 0) - 0.0075);
        }

        const rollOff = estimateRollOffHz(bands.frequencies, bands.levels);
        const idx = rollOff ? indexOfFreq(bands.frequencies, rollOff) : -1;
        if (idx > 1 && idx < columns - 2) {
          rolloffMark = { x: gutter + (idx + 1) * (plotW / columns), hz: rollOff ?? 0 };
        }
      } else if (mode !== 'scope') {
        // 暂停：不采样，让上一帧的柱形按指数沉底，形状留在屏幕上
        for (let i = 0; i < columns; i++) {
          values[i] = (values[i] ?? 0) * 0.9;
          peaks[i] = Math.max(values[i] ?? 0, (peaks[i] ?? 0) - 0.004);
        }
      }

      if (mode !== 'scope') {
        const slot = plotW / columns;
        // 缝至少 2px：柱子挤在一起就没有「一根一根」可读性了
        const barW = Math.max(1, Math.min(slot - 2, slot * 0.66));
        const offset = (slot - barW) / 2;

        // 横向色带：低频 magenta → 中频主色 → 高频 cyan/violet，能量落点一眼可辨
        const hue = ctx.createLinearGradient(gutter, 0, w, 0);
        hue.addColorStop(0, palette.magenta);
        hue.addColorStop(0.2, palette.amber);
        hue.addColorStop(0.5, palette.fg);
        hue.addColorStop(0.8, palette.cyan);
        hue.addColorStop(1, palette.violet);

        // 1) 柱体：整条横向渐变当 fillStyle，逐柱自动取到所在频段的颜色
        ctx.fillStyle = hue;
        for (let i = 0; i < columns; i++) {
          const value = values[i] ?? 0;
          if (value < 0.004) continue;
          const barH = Math.max(1.5, value * specH);
          ctx.fillRect(gutter + i * slot + offset, specH - barH, barW, barH);
        }

        // 2) 柱顶连线：只描边不填充，填了会把相邻同高的柱子焊成一块
        ctx.beginPath();
        for (let i = 0; i < columns; i++) {
          const x = gutter + (i + 0.5) * slot;
          const y = specH - (values[i] ?? 0) * specH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = hue;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 3) 底部渐隐：压一层面板底色，柱根沉下去、柱头更亮。
        //    只压下半段：亮色主题下整段压过去会把柱子直接抹白。
        const sink = ctx.createLinearGradient(0, specH * 0.5, 0, specH);
        sink.addColorStop(0, 'transparent');
        sink.addColorStop(1, palette.bg);
        ctx.globalAlpha = paused ? 0.4 : 0.55;
        ctx.fillStyle = sink;
        ctx.fillRect(gutter, specH * 0.5, plotW, specH * 0.5);

        // 4) 峰值保持帽：柱顶上方一条细亮线，慢落
        ctx.globalAlpha = paused ? 0.4 : 0.95;
        ctx.fillStyle = palette.amber;
        for (let i = 0; i < columns; i++) {
          const held = peaks[i] ?? 0;
          if (held < 0.02) continue;
          ctx.fillRect(gutter + i * slot + offset, specH - held * specH - 2, barW, 1.6);
        }
        ctx.globalAlpha = 1;

        // 5) 镜像倒影：只在纯频谱视图用，BOTH 下会和示波器带糊成一片
        if (mode !== 'both') {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = hue;
          for (let i = 0; i < columns; i++) {
            const value = values[i] ?? 0;
            if (value < 0.02) continue;
            ctx.fillRect(gutter + i * slot + offset, specH + 1, barW, Math.min(9, value * 14));
          }
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = palette.dim;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.moveTo(gutter, specH + 5.5);
          ctx.lineTo(w, specH + 5.5);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // 编码器截止边界：有损音源高频本来就是空的，标出边界比留白诚实
        if (rolloffMark) {
          const x = Math.round(rolloffMark.x) + 0.5;
          ctx.strokeStyle = palette.violet;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, specH);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = palette.violet;
          ctx.font = `9px ${MONO}`;
          ctx.textAlign = 'left';
          ctx.fillText(`CUT ${formatHz(rolloffMark.hz)}`, x + 3, 9);
        }

        if (paused) {
          ctx.font = `10px ${MONO}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = palette.dim;
          ctx.fillText('HOLD — 已暂停，柱形冻结在下沉路径上', gutter + plotW / 2, 12);
        }
      }

      if (mode !== 'spectrum') {
        const wave = engine.readWaveform(Math.max(32, Math.floor(plotW / 2)));
        if (wave) {
          const mid = scopeTop + scopeH / 2;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 1;
          ctx.strokeStyle = palette.cyan;
          ctx.beginPath();
          for (let i = 0; i < wave.length; i++) {
            const x = gutter + (i / Math.max(1, wave.length - 1)) * plotW;
            const y = mid - (wave[i] ?? 0) * (scopeH / 2) * 0.92;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // 中轴线：示波器没有零线就读不出正负
          ctx.globalAlpha = 0.3;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(gutter, mid);
          ctx.lineTo(w, mid);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }

      // 频率轴
      ctx.strokeStyle = palette.dim;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(gutter, plotH + 0.5);
      ctx.lineTo(w, plotH + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.dim;
      ctx.font = `9px ${MONO}`;
      ctx.textAlign = 'center';
      for (const mark of AXIS_TICKS) {
        const idx = indexOfFreq(scale, mark);
        if (idx < 0) continue;
        ctx.fillText(formatHz(mark), gutter + ((idx + 0.5) / columns) * plotW, plotH + axisH - 5);
      }
      ctx.textAlign = 'left';
      ctx.fillText('Hz', 2, plotH + axisH - 5);
      ctx.font = `9px ${MONO}`;
      ctx.fillText(`${columns} BANDS`, gutter + 3, plotH + axisH - 5);

      if (mode === 'scope' && paused) {
        // 示波器待机：一条缓慢行走的扫描标，避免整块死黑
        const sweepX = gutter + (((time - startedAt) / 2600) % 1) * plotW;
        ctx.strokeStyle = palette.cyan;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.round(sweepX) + 0.5, 0);
        ctx.lineTo(Math.round(sweepX) + 0.5, plotH);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.dim;
        ctx.font = `10px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText('NO SIGNAL — 按 SPACE 播放', gutter + plotW / 2, plotH / 2);
      }
    };

    last = performance.now();
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [theme, motion, mode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={mode === 'scope' ? '时域波形' : '音频频谱'}
    />
  );
}

/** 升序频率数组里第一个 >= target 的下标 */
function indexOfFreq(frequencies: ArrayLike<number>, target: number): number {
  for (let i = 0; i < frequencies.length; i++) if ((frequencies[i] ?? 0) >= target) return i;
  return -1;
}
