import { describe, expect, it } from 'vitest';
import {
  buildOrder,
  nextCursor,
  nextPlayMode,
  prevCursor,
  sequentialIndices,
  shuffledIndices,
} from '../src/lib/playlist';

describe('shuffledIndices', () => {
  it('是原索引的一个置换，不重不漏', () => {
    const order = shuffledIndices(10);
    expect(order).toHaveLength(10);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('注入随机源后可复现', () => {
    const makeRand = () => {
      let seed = 1;
      return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
    };
    expect(shuffledIndices(8, makeRand())).toEqual(shuffledIndices(8, makeRand()));
  });

  it('空列表安全', () => {
    expect(shuffledIndices(0)).toEqual([]);
    expect(sequentialIndices(3)).toEqual([0, 1, 2]);
  });
});

describe('播放游标', () => {
  it('顺序模式走到队尾就停', () => {
    expect(nextCursor(0, 3, 'sequential')).toBe(1);
    expect(nextCursor(2, 3, 'sequential')).toBeNull();
  });

  it('列表循环与随机都回到开头', () => {
    expect(nextCursor(2, 3, 'repeat-all')).toBe(0);
    expect(nextCursor(2, 3, 'shuffle')).toBe(0);
  });

  it('单曲循环原地不动', () => {
    expect(nextCursor(1, 3, 'repeat-one')).toBe(1);
  });

  it('上一曲在开头时绕回末尾', () => {
    expect(prevCursor(0, 3)).toBe(2);
    expect(prevCursor(2, 3)).toBe(1);
    expect(prevCursor(0, 0)).toBeNull();
  });

  it('buildOrder 只在随机时打乱', () => {
    expect(buildOrder(4, 'sequential')).toEqual([0, 1, 2, 3]);
    expect(buildOrder(4, 'shuffle')).toHaveLength(4);
  });
});

describe('nextPlayMode', () => {
  it('四个模式闭环轮换', () => {
    expect(nextPlayMode('sequential')).toBe('repeat-all');
    expect(nextPlayMode('repeat-all')).toBe('repeat-one');
    expect(nextPlayMode('repeat-one')).toBe('shuffle');
    expect(nextPlayMode('shuffle')).toBe('sequential');
  });
});
