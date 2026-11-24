import { describe, expect, it } from 'vitest';
import {
  applyQuery,
  DEFAULT_QUERY,
  facetArtists,
  matchesQuery,
  normalize,
  pickByIds,
  sortTracks,
  sumDuration,
} from '../src/lib/filters';
import { makeTrack } from './helpers';

describe('normalize', () => {
  it('抹平大小写、全角、空白与常见标点', () => {
    expect(normalize('  Hello  World ')).toBe('helloworld');
    expect(normalize('ＨＥＬＬＯ')).toBe('hello');
    expect(normalize('花、太阳 彩虹')).toBe('花太阳彩虹');
  });
});

describe('matchesQuery', () => {
  const track = makeTrack({
    title: '花,太阳,彩虹,你',
    artist: 'Mai;法老',
    album: 'MYSTERY TOY BOX',
    filename: '花,太阳,彩虹,你 - Mai.mp3',
  });

  it('空查询命中一切', () => {
    expect(matchesQuery(track, '   ')).toBe(true);
  });

  it('曲名 / 艺人 / 专辑 / 文件名都能命中', () => {
    expect(matchesQuery(track, '太阳')).toBe(true);
    expect(matchesQuery(track, 'mai')).toBe(true);
    expect(matchesQuery(track, 'mysterytoybox')).toBe(true);
    expect(matchesQuery(track, '不存在的词')).toBe(false);
  });
});

describe('sortTracks', () => {
  const a = makeTrack({ title: 'Alpha', durationSec: 100, trackNo: 2, mtimeMs: 10 });
  const b = makeTrack({ title: 'Beta', durationSec: 300, trackNo: 1, mtimeMs: 30 });
  const c = makeTrack({ title: 'Gamma', durationSec: 200, trackNo: 3, mtimeMs: 20 });
  const tracks = [a, b, c];

  it('按曲名升序，desc 只是翻转', () => {
    expect(sortTracks(tracks, 'title', false).map((t) => t.title)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
    expect(sortTracks(tracks, 'title', true).map((t) => t.title)).toEqual([
      'Gamma',
      'Beta',
      'Alpha',
    ]);
  });

  it('时长与入库时间排序', () => {
    expect(sortTracks(tracks, 'duration', false).map((t) => t.durationSec)).toEqual([
      100, 200, 300,
    ]);
    expect(sortTracks(tracks, 'recent', true).map((t) => t.mtimeMs)).toEqual([30, 20, 10]);
  });

  it('不修改输入数组', () => {
    const snapshot = tracks.map((t) => t.title);
    sortTracks(tracks, 'duration', true);
    expect(tracks.map((t) => t.title)).toEqual(snapshot);
  });
});

describe('applyQuery', () => {
  const tracks = [
    makeTrack({ title: 'One', artist: 'Kame' }),
    makeTrack({ title: 'Two', artist: 'Noma' }),
    makeTrack({ title: 'Three', artist: 'Kame' }),
  ];

  it('文本 + 艺人叠加过滤', () => {
    expect(applyQuery(tracks, { ...DEFAULT_QUERY, artist: 'Kame' }).map((t) => t.title)).toEqual([
      'One',
      'Three',
    ]);
    expect(
      applyQuery(tracks, { ...DEFAULT_QUERY, artist: 'Kame', text: 'two' }).map((t) => t.title),
    ).toEqual([]);
  });
});

describe('facets 与集合工具', () => {
  const tracks = [
    makeTrack({ title: 'A', artist: 'Kame' }),
    makeTrack({ title: 'B', artist: 'Kame' }),
    makeTrack({ title: 'C', artist: 'Noma' }),
  ];

  it('按数量降序列出艺人', () => {
    expect(facetArtists(tracks)).toEqual([
      { name: 'Kame', count: 2 },
      { name: 'Noma', count: 1 },
    ]);
  });

  it('pickByIds 保持给定顺序并丢弃索引外的 ID', () => {
    const [first, third] = [tracks[0]!, tracks[2]!];
    expect(pickByIds(tracks, [third.id, 'ghost', first.id])).toEqual([third, first]);
  });

  it('sumDuration 汇总', () => {
    expect(sumDuration(tracks)).toBe(540);
  });
});
