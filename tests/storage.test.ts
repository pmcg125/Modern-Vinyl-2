import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  loadFavorites,
  loadPlays,
  loadPrefs,
  saveFavorites,
  savePlays,
  savePrefs,
} from '../src/lib/storage';

describe('loadPrefs', () => {
  it('没有存储时给默认值', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('脏 JSON 只降级不炸', () => {
    localStorage.setItem('mv2:prefs:v1', '{ this is not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('越界数值被夹回合法区间', () => {
    localStorage.setItem(
      'mv2:prefs:v1',
      JSON.stringify({
        volume: 42,
        muted: 'yes',
        eq: { low: -99, mid: 99, high: 1 },
        theme: 'neon',
      }),
    );

    const prefs = loadPrefs();
    expect(prefs.volume).toBe(1);
    expect(prefs.muted).toBe(false);
    expect(prefs.eq).toEqual({ low: -12, mid: 12, high: 1 });
    expect(prefs.theme).toBeNull();
    expect(prefs.playMode).toBe('sequential');
    expect(prefs.view).toBe('list');
  });

  it('合法值原样读回', () => {
    savePrefs({
      ...DEFAULT_PREFS,
      theme: 'light',
      volume: 0.42,
      playMode: 'shuffle',
      view: 'grid',
    });
    const prefs = loadPrefs();
    expect(prefs.theme).toBe('light');
    expect(prefs.volume).toBe(0.42);
    expect(prefs.playMode).toBe('shuffle');
    expect(prefs.view).toBe('grid');
  });
});

describe('收藏', () => {
  it('往返一致', () => {
    saveFavorites(['a', 'b']);
    expect(loadFavorites()).toEqual(['a', 'b']);
  });

  it('混入非字符串时只留 ID', () => {
    localStorage.setItem('mv2:favorites:v1', JSON.stringify(['a', 7, null, 'b', {}]));
    expect(loadFavorites()).toEqual(['a', 'b']);
  });

  it('结构损坏时视为空', () => {
    localStorage.setItem('mv2:favorites:v1', JSON.stringify({ nope: true }));
    expect(loadFavorites()).toEqual([]);
  });
});

describe('播放次数', () => {
  it('丢弃字段不完整的记录', () => {
    localStorage.setItem(
      'mv2:plays:v1',
      JSON.stringify({
        good: { count: 3, lastAt: 123 },
        broken: { count: 'x' },
        alsoBroken: null,
      }),
    );
    expect(loadPlays()).toEqual({ good: { count: 3, lastAt: 123 } });
  });

  it('保存后可读回', () => {
    savePlays({ t1: { count: 2, lastAt: 999 } });
    expect(loadPlays().t1).toEqual({ count: 2, lastAt: 999 });
  });
});
