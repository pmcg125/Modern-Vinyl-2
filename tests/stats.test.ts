import { describe, expect, it } from 'vitest';
import {
  bitrateBreakdown,
  durationExtremes,
  durationHistogram,
  topArtistsByDuration,
} from '../src/lib/stats';
import { makeTrack } from './helpers';

const tracks = [
  makeTrack({ title: 'a', artist: 'Kame', durationSec: 45, bitrateKbps: 128 }),
  makeTrack({ title: 'b', artist: 'Kame', durationSec: 150, bitrateKbps: 320 }),
  makeTrack({ title: 'c', artist: 'Noma', durationSec: 400, bitrateKbps: 320 }),
];

describe('durationHistogram', () => {
  it('分桶覆盖全部曲目且保留时长合计', () => {
    const bars = durationHistogram(tracks);
    expect(bars.map((bar) => bar.label)).toEqual(['< 1min', '1-2min', '2-3min', '3-5min', '5min+']);
    expect(bars.find((b) => b.label === '< 1min')).toMatchObject({ value: 45, hint: '1 首' });
    expect(bars.find((b) => b.label === '2-3min')?.value).toBe(150);
    expect(bars.find((b) => b.label === '5min+')?.value).toBe(400);
  });

  it('空曲库每桶为 0 而不是崩掉', () => {
    expect(durationHistogram([]).every((bar) => bar.value === 0)).toBe(true);
  });
});

describe('bitrateBreakdown', () => {
  it('按数量降序', () => {
    expect(bitrateBreakdown(tracks)).toEqual([
      { label: '320k', value: 2, hint: '2 首' },
      { label: '128k', value: 1, hint: '1 首' },
    ]);
  });

  it('缺失码率归入未知', () => {
    const bars = bitrateBreakdown([makeTrack({ bitrateKbps: null })]);
    expect(bars[0]?.label).toBe('未知');
  });
});

describe('topArtistsByDuration', () => {
  it('按时长排序并带曲目数提示', () => {
    expect(topArtistsByDuration(tracks)).toEqual([
      { label: 'Noma', value: 400, hint: '1 首' },
      { label: 'Kame', value: 195, hint: '2 首' },
    ]);
  });

  it('limit 生效', () => {
    expect(topArtistsByDuration(tracks, 1)).toHaveLength(1);
  });
});

describe('durationExtremes', () => {
  it('给出最长与最短', () => {
    const { longest, shortest } = durationExtremes(tracks);
    expect(longest?.title).toBe('c');
    expect(shortest?.title).toBe('a');
  });

  it('空曲库返回 null 对', () => {
    expect(durationExtremes([])).toEqual({ longest: null, shortest: null });
  });
});
