/** 从 AnalyserNode 原始缓冲到可视数据的纯函数，与 DOM 无关，可单测 */

/**
 * 时域降采样：每段取「偏离静音中心最远」的采样点，归一化到 -1..1。
 * 初值必须是 128（静音中心）；写成 0 会让每段都恒等于 -1，波形贴底变成一条实线。
 */
export function downsampleWaveform(bytes: Uint8Array, samples: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(samples);
  if (samples <= 0) return out;

  const stride = Math.max(1, Math.floor(bytes.length / samples));
  for (let i = 0; i < samples; i++) {
    let peak = 128;
    for (let j = 0; j < stride; j++) {
      const value = bytes[i * stride + j] ?? 128;
      if (Math.abs(value - 128) > Math.abs(peak - 128)) peak = value;
    }
    out[i] = (peak - 128) / 128;
  }
  return out;
}

export const FMIN = 32;
export const FMAX = 16_000;

export interface Bands {
  /** 每列 0..1 电平 */
  levels: Float32Array;
  /** 每列中心频率（Hz），画坐标轴与截止边界用 */
  frequencies: Float32Array;
}

export interface BandOptions {
  fMin?: number;
  fMax?: number;
  /** 高频抬升量（0..1）：音乐能量天然按 1/f 衰减，不补偿的话右半永远贴地 */
  tilt?: number;
}

/**
 * 频带布局：列数、每列中心频率、上下限。
 *
 * 单独拆出来是因为坐标轴和截止边界要在「没有音频数据」时也能算（暂停、还没播），
 * 而它必须和 adaptiveBands 用完全同一套推导，否则刻度和柱子会错位。
 */
export interface BandLayout {
  /** 实际要画的列数：可能小于请求值 */
  columns: number;
  frequencies: Float32Array;
  bottom: number;
  top: number;
  binHz: number;
}

export function bandLayout(
  binCount: number,
  sampleRate: number,
  requestedColumns: number,
  options: BandOptions = {},
): BandLayout {
  const fMin = options.fMin ?? FMIN;
  const fMax = options.fMax ?? FMAX;
  const rate = sampleRate > 0 ? sampleRate : 44100;
  const nyquist = rate / 2;
  const bins = Math.max(1, binCount);
  const binHz = nyquist / bins;
  const top = Math.min(fMax, nyquist * 0.98);
  // 下限至少留出半个桶，否则最左几列全在 DC 上打转
  const bottom = Math.min(Math.max(fMin, binHz * 0.5), top / 2);
  const span = Math.log(top / bottom);

  // 一列窄到只剩 8% 个桶宽就没有新信息了（插值已保证相邻列取值不同，
  // 这里只挡「柱子数远多于频点数」），据此收回列数而不是摊成空列
  const columns = Math.max(
    8,
    Math.min(Math.max(1, requestedColumns), Math.floor(span / Math.log1p((0.08 * binHz) / bottom))),
  );

  const frequencies = new Float32Array(columns);
  for (let c = 0; c < columns; c++) {
    const e0 = bottom * Math.exp((span * c) / columns);
    const e1 = bottom * Math.exp((span * (c + 1)) / columns);
    frequencies[c] = Math.sqrt(e0 * e1);
  }

  return { columns, frequencies, bottom, top, binHz };
}

/**
 * 自适应对数分频带。
 *
 * 频带边界保持在「浮点 FFT 桶」坐标上，用线性插值取值，绝不 floor/ceil 成整数区间 ——
 * 整数区间会让相邻十几列都落在同一个桶上、取到一模一样的峰值，画出来就是黏成一整块的柱子。
 * 插值之后每列都是频响曲线上的一个不同采样点，低分辨率区也是渐变而不是平台。
 */
export function adaptiveBands(
  bins: Uint8Array,
  sampleRate: number,
  requestedColumns: number,
  options: BandOptions = {},
): Bands {
  if (requestedColumns <= 0) {
    return { levels: new Float32Array(0), frequencies: new Float32Array(0) };
  }
  const layout = bandLayout(bins.length, sampleRate, requestedColumns, options);
  const levels = new Float32Array(layout.columns);
  if (bins.length === 0) return { levels, frequencies: layout.frequencies };

  const tilt = Math.max(0, options.tilt ?? 0);
  const { columns, binHz, bottom, top } = layout;
  const span = Math.log(top / bottom);

  // 浮点桶位置上的线性插值
  const at = (x: number) => {
    const i = Math.floor(x);
    if (i < 0) return bins[0] ?? 0;
    if (i >= bins.length - 1) return bins[bins.length - 1] ?? 0;
    const a = bins[i] ?? 0;
    return a + ((bins[i + 1] ?? 0) - a) * (x - i);
  };

  for (let c = 0; c < columns; c++) {
    const f0 = bottom * Math.exp((span * c) / columns);
    const f1 = bottom * Math.exp((span * (c + 1)) / columns);
    const b0 = f0 / binHz;
    const width = (f1 - f0) / binHz;

    let value: number;
    if (width <= 1) {
      value = at(b0 + width / 2);
    } else {
      // 宽带取「峰值为主 + 均值为辅」：纯峰值被单根毛刺顶满，纯均值把鼓点抹平
      const steps = Math.min(32, Math.max(2, Math.ceil(width)));
      let peak = 0;
      let sum = 0;
      for (let s = 0; s < steps; s++) {
        const v = at(b0 + ((s + 0.5) / steps) * width);
        if (v > peak) peak = v;
        sum += v;
      }
      value = peak * 0.72 + (sum / steps) * 0.28;
    }

    const boost = 1 + tilt * (c / Math.max(1, columns - 1));
    levels[c] = Math.min(1, (value / 255) * boost);
  }

  return { levels, frequencies: layout.frequencies };
}

/**
 * 估算编码器截止频率：从右往左找第一个仍有能量的列。
 * 有损音源的高频本来就是空的，标出边界比留一片空白诚实。
 */
export function estimateRollOffHz(
  frequencies: ArrayLike<number>,
  levels: ArrayLike<number>,
): number | null {
  if (!frequencies.length || !levels.length) return null;

  const sorted = Array.from(levels, Number).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(0.06, median * 0.22);

  for (let i = frequencies.length - 1; i >= 0; i--) {
    if ((levels[i] ?? 0) >= threshold) return frequencies[i] ?? null;
  }
  return null;
}

export function formatHz(hz: number): string {
  if (hz < 1000) return String(Math.round(hz));
  const k = hz / 1000;
  return `${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k`;
}
