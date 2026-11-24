import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import {
  cacheKey,
  decodeTrackId,
  encodeTrackId,
  fingerprintOf,
  resolveTrackPath,
} from '../server/ids';

const ROOT = resolve(process.cwd(), 'music');
const idOf = (rel: string) => encodeTrackId(rel);

describe('TrackId 编解码', () => {
  it('中文名与子目录可以无损往返', () => {
    const rel = 'eps/花,太阳,彩虹,你 - Mai.mp3';
    expect(decodeTrackId(idOf(rel))).toBe(rel);
  });

  it('ID 里没有 URL 保留字符', () => {
    const id = idOf('a b/c+d=e&f.mp3');
    expect(id).not.toMatch(/[+/=&]/);
  });

  it('垃圾 ID 不会抛异常，也拿不到任何路径', () => {
    // base64url 解码是宽容的，所以真正的保证在 resolveTrackPath 这一层
    expect(() => decodeTrackId('!!!not-base64!!!')).not.toThrow();
    expect(resolveTrackPath('!!!not-base64!!!', ROOT)).toBeNull();
    expect(resolveTrackPath('', ROOT)).toBeNull();
    expect(decodeTrackId('')).toBeNull();
  });
});

describe('路径越界防护', () => {
  it('曲库内的 mp3 正常解析', () => {
    expect(resolveTrackPath(idOf('Brain Power - NOMA.mp3'), ROOT)).toBe(
      join(ROOT, 'Brain Power - NOMA.mp3'),
    );
    expect(resolveTrackPath(idOf('sub/track.mp3'), ROOT)).toBe(join(ROOT, 'sub', 'track.mp3'));
  });

  it('拒绝跳出曲库根目录', () => {
    for (const rel of [
      '../package.json',
      '../../secrets.mp3',
      'sub/../../../windows/win.ini',
      './a/../../b/../../c.mp3',
    ]) {
      expect(resolveTrackPath(idOf(rel), ROOT)).toBeNull();
    }
  });

  it('拒绝绝对路径与空路径', () => {
    expect(resolveTrackPath(idOf('/etc/passwd.mp3'), ROOT)).toBeNull();
    expect(resolveTrackPath(idOf(''), ROOT)).toBeNull();
    expect(resolveTrackPath(idOf('.'), ROOT)).toBeNull();
  });

  it('只放行 .mp3', () => {
    expect(resolveTrackPath(idOf('notes.txt'), ROOT)).toBeNull();
    expect(resolveTrackPath(idOf('index.ts'), ROOT)).toBeNull();
    expect(resolveTrackPath(idOf('UPPER.MP3'), ROOT)).toBe(join(ROOT, 'UPPER.MP3'));
  });

  it('NUL 注入被拦下', () => {
    expect(resolveTrackPath(idOf('a.mp3\u0000.exe'), ROOT)).toBeNull();
  });
});

describe('封面缓存指纹', () => {
  it('文件变动会换 key', () => {
    const base = cacheKey('a.mp3', fingerprintOf(1000, 2000));
    expect(cacheKey('a.mp3', fingerprintOf(1000, 2000))).toBe(base);
    expect(cacheKey('a.mp3', fingerprintOf(1001, 2000))).not.toBe(base);
    expect(cacheKey('b.mp3', fingerprintOf(1000, 2000))).not.toBe(base);
  });
});
