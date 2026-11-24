import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { activeLineIndex, lineProgress } from '../src/lib/lyrics';
import {
  decodeLyricBytes,
  findSidecarLyric,
  lyricCandidateKeys,
  lyricCandidateNames,
  normalizeLyricKey,
  parseLrc,
  plainTextLines,
} from '../server/lyrics';

describe('parseLrc', () => {
  it('解析标准时间轴并按时间排序', () => {
    const lines = parseLrc(`[00:10.00]第二句\n[00:02.50]第一句`);
    expect(lines).toEqual([
      { timeSec: 2.5, text: '第一句' },
      { timeSec: 10, text: '第二句' },
    ]);
  });

  it('支持一行多时间戳与逗号毫秒', () => {
    const lines = parseLrc('[01:00,00][02:30.500]副歌');
    expect(lines.map((l) => l.timeSec)).toEqual([60, 150.5]);
    expect(lines.every((l) => l.text === '副歌')).toBe(true);
  });

  it('忽略 [ar:] 之类的头部元信息与空文本行', () => {
    const lines = parseLrc(`[ti:标题]\n[ar:艺人]\n[al:专辑]\n[00:01.00]\n[00:02.00]有词`);
    expect(lines).toEqual([{ timeSec: 2, text: '有词' }]);
  });

  it('纯文本（无时间轴）返回空数组，交给调用方降级显示', () => {
    expect(parseLrc('就是几句没有时间的歌词')).toEqual([]);
    expect(parseLrc('')).toEqual([]);
  });
});

describe('外挂歌词命名', () => {
  it('归一化：全角转半角、去括号注记、只留字母数字', () => {
    expect(normalizeLyricKey('花,太阳,彩虹,你')).toBe('花太阳彩虹你');
    expect(normalizeLyricKey('S.A.T.E.L.L.I.T.E.')).toBe('satellite');
    expect(normalizeLyricKey('聖夜讃歌(feat.初音ミク)')).toBe('聖夜讃歌');
    expect(normalizeLyricKey('ＣＤ　１')).toBe('cd1');
  });

  it('候选名按「整首文件名 → 歌名 → 艺人」优先级，保留原始标点', () => {
    const names = lyricCandidateNames({
      filename: 'STAY - The Kid LAROI、Justin Bieber.mp3',
      title: 'STAY',
      artist: 'The Kid LAROI、Justin Bieber',
    });
    expect(names[0]).toBe('STAY - The Kid LAROI、Justin Bieber');
    expect(names).toContain('STAY');
    expect(names).toContain('The Kid LAROI、Justin Bieber - STAY');
  });

  it('匹配键去重且不带标点', () => {
    const keys = lyricCandidateKeys({
      filename: '耍把戏 - 云中歌Vera.mp3',
      title: '耍把戏',
      artist: '云中歌Vera',
    });
    expect(keys).toContain('耍把戏');
    expect(keys).toContain('云中歌vera耍把戏');
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('plainTextLines', () => {
  it('没有时间轴的文本逐行保留，丢掉 [xx:] 头标签', () => {
    expect(plainTextLines('[ti:歌名]\n第一行\n\n第二行')).toEqual([
      { timeSec: 0, text: '第一行' },
      { timeSec: 0, text: '第二行' },
    ]);
  });

  it('只有时间戳、没有词的 .lrc 不会把 [00:01.00] 当歌词显示', () => {
    expect(plainTextLines('[00:01.00]\n[00:02.00]\n真正的词')).toEqual([
      { timeSec: 0, text: '真正的词' },
    ]);
  });
});

describe('decodeLyricBytes', () => {
  it('剥掉 UTF-8 BOM', () => {
    expect(decodeLyricBytes(Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from('词')]))).toBe('词');
  });

  it('识别 UTF-16 LE', () => {
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('第一行', 'utf16le')]);
    expect(decodeLyricBytes(buffer)).toBe('第一行');
  });

  it('GBK 回退：按 UTF-8 解出替换符时改用 GBK', () => {
    const gbk = Buffer.from([0xbe, 0xa9, 0xe4, 0xf1]); // 京漶
    expect(decodeLyricBytes(gbk)).toBe('京漶');
  });
});

describe('findSidecarLyric', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mv2-lyrics-'));
  const root = dir;
  const track = join(dir, '花,太阳,彩虹,你 - Mai、法老.mp3');
  const info = {
    filename: '花,太阳,彩虹,你 - Mai、法老.mp3',
    title: '花,太阳,彩虹,你',
    artist: 'Mai、法老',
  };

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('目录里没有歌词时返回 null', async () => {
    expect(await findSidecarLyric(track, info, root)).toBeNull();
  });

  it('同名 .lrc 直接命中', async () => {
    writeFileSync(track.replace(/\.mp3$/, '.lrc'), '[00:01.00]一');
    const found = await findSidecarLyric(track, info, root);
    expect(found?.kind).toBe('lrc');
    expect(found?.display).toBe('花,太阳,彩虹,你 - Mai、法老.lrc');
    rmSync(track.replace(/\.mp3$/, '.lrc'));
  });

  it('只按歌名命名也能命中，标点大小写无关', async () => {
    writeFileSync(join(dir, '花 太阳 彩虹 你.LRC'), '[00:01.00]一');
    const found = await findSidecarLyric(track, info, root);
    expect(found?.display).toBe('花 太阳 彩虹 你.LRC');
    rmSync(join(dir, '花 太阳 彩虹 你.LRC'));
  });

  it('优先 .lrc，其次才退到同名的 .txt', async () => {
    writeFileSync(join(dir, '花太阳彩虹你.txt'), '纯文本');
    expect((await findSidecarLyric(track, info, root))?.kind).toBe('txt');
    writeFileSync(join(dir, '花太阳彩虹你.lrc'), '[00:01.00]一');
    expect((await findSidecarLyric(track, info, root))?.kind).toBe('lrc');
    rmSync(join(dir, '花太阳彩虹你.txt'));
    rmSync(join(dir, '花太阳彩虹你.lrc'));
  });

  it('支持 lyrics/ 子目录', async () => {
    const sub = join(dir, 'lyrics');
    mkdirSync(sub);
    writeFileSync(join(sub, '花,太阳,彩虹,你 - Mai、法老.lrc'), '[00:01.00]一');
    const found = await findSidecarLyric(track, info, root);
    expect(found?.display).toBe('lyrics/花,太阳,彩虹,你 - Mai、法老.lrc');
    rmSync(sub, { recursive: true, force: true });
  });
});

describe('activeLineIndex', () => {
  const lines = [
    { timeSec: 0, text: 'a' },
    { timeSec: 10, text: 'b' },
    { timeSec: 20, text: 'c' },
  ];

  it('取最近已开始的一行', () => {
    expect(activeLineIndex(lines, 0)).toBe(0);
    expect(activeLineIndex(lines, 9.9)).toBe(0);
    expect(activeLineIndex(lines, 15)).toBe(1);
    expect(activeLineIndex(lines, 999)).toBe(2);
  });

  it('还没到第一行时返回 -1', () => {
    expect(activeLineIndex([{ timeSec: 5, text: 'x' }], 1)).toBe(-1);
    expect(activeLineIndex([], 3)).toBe(-1);
  });
});

describe('lineProgress', () => {
  const lines = [
    { timeSec: 10, text: 'a' },
    { timeSec: 20, text: 'b' },
  ];

  it('在行内按到下一行的时间推进', () => {
    expect(lineProgress(lines, 0, 10, 60)).toBe(0);
    expect(lineProgress(lines, 0, 15, 60)).toBe(0.5);
    expect(lineProgress(lines, 0, 99, 60)).toBe(1);
  });

  it('最后一行用曲目时长兜底', () => {
    expect(lineProgress(lines, 1, 30, 40)).toBe(0.5);
    expect(lineProgress(lines, 1, 80, 40)).toBe(1);
  });

  it('重复时间戳（副歌复用同一句）不会算出 NaN', () => {
    const dup = [
      { timeSec: 10, text: 'a' },
      { timeSec: 10, text: 'b' },
    ];
    expect(lineProgress(dup, 0, 12, 30)).toBeCloseTo(0.1);
    expect(Number.isNaN(lineProgress(dup, 1, 12, 30))).toBe(false);
  });
});
