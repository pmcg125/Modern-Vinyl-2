import { describe, expect, it } from 'vitest';
import {
  adaptiveBands,
  bandLayout,
  downsampleWaveform,
  estimateRollOffHz,
  formatHz,
} from '../src/lib/audioMath';

/** 44.1k / 1024 桶：每桶约 21.5Hz，与 AnalyserNode fftSize=2048 一致 */
const SR = 44100;
const BINS = 1024;
const binOf = (hz: number) => Math.round((hz / (SR / 2)) * BINS);

describe('downsampleWaveform', () => {
  it('静音（全 128）必须归零，而不是贴到 -1', () => {
    const silence = new Uint8Array(64).fill(128);
    const out = downsampleWaveform(silence, 8);
    expect(Array.from(out)).toEqual(Array(8).fill(0));
  });

  it('取偏离中心最远的采样点并归一化', () => {
    const segment = new Uint8Array(16).fill(128);
    segment[5] = 255;
    segment[11] = 100;
    const out = downsampleWaveform(segment, 1);
    expect(out[0]).toBeCloseTo(0.9921, 3);
  });

  it('负向峰值保留符号', () => {
    const segment = new Uint8Array(8).fill(128);
    segment[2] = 0;
    expect(downsampleWaveform(segment, 1)[0]).toBeCloseTo(-1, 5);
  });

  it('samples 为 0 给空数组', () => {
    expect(downsampleWaveform(new Uint8Array(8).fill(128), 0)).toEqual(new Float32Array(0));
  });
});

describe('bandLayout', () => {
  it('中心频率单调递增且落在 32Hz..16kHz', () => {
    const { frequencies, columns } = bandLayout(BINS, SR, 64);
    expect(columns).toBe(64);
    expect(frequencies.length).toBe(64);
    expect(frequencies[0]).toBeGreaterThanOrEqual(32);
    expect(frequencies[columns - 1]).toBeLessThanOrEqual(16000);
    for (let i = 1; i < columns; i++) {
      expect((frequencies[i] ?? 0) > (frequencies[i - 1] ?? 0)).toBe(true);
    }
  });

  it('频点太少时收回列数，而不是摊出一堆空列', () => {
    // 只有 8 个桶：分 64 列纯属浪费
    const few = bandLayout(8, SR, 64);
    expect(few.columns).toBeLessThan(24);
    expect(few.columns).toBeGreaterThanOrEqual(8);
    const many = bandLayout(BINS, SR, 64);
    expect(many.columns).toBeGreaterThan(few.columns);
  });

  it('非法采样率回退 44.1k', () => {
    expect(bandLayout(BINS, 0, 32).columns).toBe(32);
  });
});

describe('adaptiveBands', () => {
  it('把指定频率的尖峰放进对数轴上正确的那一列', () => {
    const bins = new Uint8Array(BINS);
    bins[binOf(1000)] = 255;
    const { levels } = adaptiveBands(bins, SR, 24);
    // 32Hz..16kHz 对数分 24 列，1kHz 落在第 13 列
    const hot = Array.from(levels).reduce((best, v, i) => (v > (levels[best] ?? 0) ? i : best), 0);
    expect(hot).toBe(13);
    expect(levels.filter((v) => v > 0)).toHaveLength(1);
  });

  it('低频区不再出现「相邻十几列取到同一个桶」的黏连', () => {
    // 真实流行曲的低频是条上坡曲线；旧的分桶把 32-130Hz 摊给 20 列，
    // 每列都 floor 到 bin 0，于是那 20 根柱子值完全相同、糊成一整块。
    const ramp = Uint8Array.from({ length: BINS }, (_, i) => Math.min(255, Math.round(40 + i * 6)));
    const { levels } = adaptiveBands(ramp, SR, 64);
    const low = Array.from(levels.slice(0, 16), (v) => v.toFixed(4));
    expect(new Set(low).size).toBeGreaterThanOrEqual(12);
  });

  it('高频补偿只抬右边，不改变左边', () => {
    const bins = new Uint8Array(BINS).fill(128);
    const flat = adaptiveBands(bins, SR, 32, { tilt: 0 });
    const tilted = adaptiveBands(bins, SR, 32, { tilt: 0.6 });
    expect(tilted.levels[0] ?? 0).toBeCloseTo(flat.levels[0] ?? 0, 5);
    expect(tilted.levels[31] ?? 0).toBeGreaterThan(flat.levels[31] ?? 0);
  });

  it('超过 16kHz 的内容被忽略（显示区间就到 16k）', () => {
    const bins = new Uint8Array(BINS);
    bins[binOf(21000)] = 255;
    expect(adaptiveBands(bins, SR, 24).levels.every((v) => v === 0)).toBe(true);
  });

  it('空数据与非法输入不崩', () => {
    expect(adaptiveBands(new Uint8Array(0), SR, 8).levels).toHaveLength(8);
    expect(adaptiveBands(new Uint8Array(BINS).fill(100), 0, 8).levels.every((v) => v > 0)).toBe(
      true,
    );
    expect(adaptiveBands(new Uint8Array(BINS), SR, 0).levels).toHaveLength(0);
  });
});

describe('estimateRollOffHz', () => {
  it('高频列全空时给出截止点，而不是返回最后一列', () => {
    const { frequencies } = bandLayout(BINS, SR, 24);
    const levels = Array.from(frequencies, (f) => (f < 16000 ? 0.8 : 0));
    const roll = estimateRollOffHz(frequencies, levels);
    expect(roll).not.toBeNull();
    expect(roll!).toBeLessThanOrEqual(16000);
  });

  it('接受 Float32Array，全零信号返回 null', () => {
    const { frequencies, levels } = adaptiveBands(new Uint8Array(BINS), SR, 12);
    expect(estimateRollOffHz(frequencies, levels)).toBeNull();
    expect(estimateRollOffHz([], [])).toBeNull();
  });
});

describe('formatHz', () => {
  it('整千用 k，低频保留原值', () => {
    expect(formatHz(60)).toBe('60');
    expect(formatHz(125)).toBe('125');
    expect(formatHz(1000)).toBe('1k');
    expect(formatHz(2500)).toBe('2.5k');
    expect(formatHz(16000)).toBe('16k');
  });
});
