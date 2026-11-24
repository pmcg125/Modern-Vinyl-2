import { describe, expect, it } from 'vitest';
import { asciiBar, formatBytes, formatDuration, formatSampleRate } from '../src/lib/format';

describe('formatDuration', () => {
  it('渲染分秒与小时', () => {
    expect(formatDuration(0)).toBe('--:--');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(224)).toBe('3:44');
    expect(formatDuration(3723)).toBe('1:02:03');
  });

  it('对脏数据保持沉默而不是 NaN', () => {
    expect(formatDuration(Number.NaN)).toBe('--:--');
    expect(formatDuration(-5)).toBe('--:--');
    expect(formatDuration(null)).toBe('--:--');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('--:--');
  });
});

describe('formatBytes', () => {
  it('按量级切换单位', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(100_731_576)).toBe('96.1 MB');
  });
});

describe('元数据芯片', () => {
  it('缺失值给破折号而不是 0', () => {
    expect(formatSampleRate(null)).toBe('—');
    expect(formatSampleRate(44100)).toBe('44.1kHz');
    expect(formatSampleRate(48000)).toBe('48kHz');
  });
});

describe('asciiBar', () => {
  it('按比例填充并夹取越界值', () => {
    expect(asciiBar(0, 10)).toBe('··········');
    expect(asciiBar(0.5, 10)).toBe('#####·····');
    expect(asciiBar(1, 10)).toBe('##########');
    expect(asciiBar(4, 10)).toBe('##########');
    expect(asciiBar(Number.NaN, 10)).toBe('··········');
  });
});
