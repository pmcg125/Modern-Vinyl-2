import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseEmbeddedLyrics,
  parseId3v2Frames,
  readEmbeddedLyrics,
} from '../server/embeddedLyrics';
import { parseLrc } from '../server/lyrics';

const synchsafe = (n: number) =>
  Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);

/** 手搓一个 ID3v2 标签：单测里不能指望真有带歌词的 MP3 */
function id3(major: number, frames: { id: string; body: Buffer }[]): Buffer {
  const headLen = major <= 2 ? 6 : 10;
  let body = Buffer.alloc(0);

  for (const frame of frames) {
    const head = Buffer.alloc(headLen);
    head.write(frame.id, 0, 'latin1');
    if (major >= 4) synchsafe(frame.body.length).copy(head, 4);
    else if (major <= 2) {
      // v2.2：3 字节帧名 + 3 字节长度，长度紧跟帧名
      head[3] = (frame.body.length >> 16) & 0xff;
      head[4] = (frame.body.length >> 8) & 0xff;
      head[5] = frame.body.length & 0xff;
    } else head.writeUInt32BE(frame.body.length, 4);
    body = Buffer.concat([body, head, frame.body]);
  }

  const header = Buffer.alloc(10);
  header.write('ID3', 0, 'latin1');
  header[3] = major;
  synchsafe(body.length).copy(header, 6);
  return Buffer.concat([header, body]);
}

function uslt(encoding: number, lang: string, text: string, description = ''): Buffer {
  const term = encoding === 1 || encoding === 2 ? Buffer.from([0, 0]) : Buffer.from([0]);
  const asText = (value: string) =>
    encoding === 1
      ? Buffer.from(value, 'utf16le')
      : encoding === 2
        ? Buffer.from(value, 'utf16le') // 再手动翻字节
        : Buffer.from(value, encoding === 0 ? 'latin1' : 'utf8');

  const descBuf = asText(description);
  const textBuf = asText(text);
  if (encoding === 2) {
    descBuf.swap16();
    textBuf.swap16();
  }
  return Buffer.concat([
    Buffer.from([encoding]),
    Buffer.from(lang, 'latin1'),
    descBuf,
    term,
    textBuf,
  ]);
}

function txxx(encoding: number, description: string, value: string): Buffer {
  const term = encoding === 1 || encoding === 2 ? Buffer.from([0, 0]) : Buffer.from([0]);
  const asText = (s: string) => Buffer.from(s, encoding === 1 ? 'utf16le' : 'utf8');
  return Buffer.concat([Buffer.from([encoding]), asText(description), term, asText(value)]);
}

/** v2.3 SYLT：带 MIME 串；v2.4 去掉 */
function sylt(major: number, events: { text: string; stamp: number }[], timeFormat = 2): Buffer {
  const parts = [Buffer.from([0]), Buffer.from('zho', 'latin1')];
  if (major <= 3) parts.push(Buffer.from('text/plain', 'latin1'), Buffer.from([0]));
  parts.push(Buffer.from([0]), Buffer.from([timeFormat]), Buffer.from([0])); // 内容类型 + 空描述
  for (const event of events) {
    parts.push(Buffer.from(event.text, 'latin1'), Buffer.from([0]));
    const stamp = Buffer.alloc(4);
    stamp.writeUInt32BE(event.stamp, 0);
    parts.push(stamp);
  }
  return Buffer.concat(parts);
}

function apev2(items: { key: string; value: string; binary?: boolean }[]): Buffer {
  let body = Buffer.alloc(0);
  for (const item of items) {
    const value = Buffer.from(item.value, 'utf8');
    const head = Buffer.alloc(8);
    head.writeUInt32LE(value.length, 0);
    head.writeUInt32LE(item.binary ? 1 : 0, 4);
    body = Buffer.concat([body, head, Buffer.from(item.key, 'latin1'), Buffer.from([0]), value]);
  }
  const footer = Buffer.alloc(32);
  footer.write('APETAGEX', 0, 'latin1');
  footer.writeUInt32LE(2000, 8);
  footer.writeUInt32LE(body.length + 32, 16);
  footer.writeUInt32LE(items.length, 20);
  footer.writeUInt32LE(0, 24);
  return Buffer.concat([body, footer]);
}

const MPEG_HEAD = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
const noTail = Buffer.alloc(0);

describe('parseId3v2Frames', () => {
  it('v2.3 用普通 32 位长度，v2.4 用 synchsafe', () => {
    const frames = [
      { id: 'TIT2', body: Buffer.from('标题') },
      { id: 'USLT', body: uslt(0, 'zho', 'la la') },
    ];
    expect(parseId3v2Frames(id3(3, frames).subarray(10), 3).map((f) => f.id)).toEqual([
      'TIT2',
      'USLT',
    ]);
    expect(parseId3v2Frames(id3(4, frames).subarray(10), 4).map((f) => f.id)).toEqual([
      'TIT2',
      'USLT',
    ]);
  });

  it('遇到填充区就停，不会把零字节当成帧名', () => {
    const body = Buffer.concat([
      (() => {
        const head = Buffer.alloc(10);
        head.write('TALB', 0, 'latin1');
        head.writeUInt32BE(3, 4);
        return Buffer.concat([head, Buffer.from('abc')]);
      })(),
      Buffer.alloc(64),
    ]);
    expect(parseId3v2Frames(body, 3).map((f) => f.id)).toEqual(['TALB']);
  });
});

describe('内嵌歌词提取', () => {
  it('USLT / ISO-8859-1', () => {
    const head = id3(3, [{ id: 'USLT', body: uslt(0, 'eng', 'Yesterday all my troubles') }]);
    const found = parseEmbeddedLyrics({ head, tail: noTail });
    expect(found?.format).toBe('ID3v2.3 USLT');
    expect(found?.text).toBe('Yesterday all my troubles');
  });

  it('USLT / UTF-16 中文不乱码', () => {
    const head = id3(3, [{ id: 'USLT', body: uslt(1, 'zho', '我在诗里看到了你') }]);
    expect(parseEmbeddedLyrics({ head, tail: noTail })?.text).toBe('我在诗里看到了你');
  });

  it('USLT / UTF-16BE', () => {
    const head = id3(3, [{ id: 'USLT', body: uslt(2, 'zho', '换季') }]);
    expect(parseEmbeddedLyrics({ head, tail: noTail })?.text).toBe('换季');
  });

  it('声明 UTF-8 实际是 GBK 时回退解码', () => {
    const gbk = Buffer.from([0xbe, 0xa9, 0xe4, 0xf1]); // 京漶
    const body = Buffer.concat([Buffer.from([3]), Buffer.from('zho'), Buffer.from([0]), gbk]);
    const head = id3(3, [{ id: 'USLT', body }]);
    expect(parseEmbeddedLyrics({ head, tail: noTail })?.text).toBe('京漶');
  });

  it('USLT 里塞的是 LRC 文本时能直接进时间轴解析', () => {
    const head = id3(3, [
      { id: 'USLT', body: uslt(0, 'zho', '[00:12.50]line one\n[01:02]line two') },
    ]);
    const found = parseEmbeddedLyrics({ head, tail: noTail });
    expect(parseLrc(found?.text ?? '')).toEqual([
      { timeSec: 12.5, text: 'line one' },
      { timeSec: 62, text: 'line two' },
    ]);
  });

  it('SYLT 毫秒时间戳直接给出带时间的行', () => {
    const head = id3(3, [
      {
        id: 'SYLT',
        body: sylt(3, [
          { text: 'first', stamp: 1500 },
          { text: 'second', stamp: 4200 },
        ]),
      },
    ]);
    const found = parseEmbeddedLyrics({ head, tail: noTail });
    expect(found?.format).toBe('ID3v2.3 SYLT');
    expect(found?.lines).toEqual([
      { timeSec: 1.5, text: 'first' },
      { timeSec: 4.2, text: 'second' },
    ]);
  });

  it('SYLT 的 MPEG 帧号按 1152/samplerate 换算', () => {
    const head = id3(4, [
      {
        id: 'SYLT',
        body: sylt(
          4,
          [
            { text: 'a', stamp: 100 },
            { text: 'b', stamp: 200 },
          ],
          1,
        ),
      },
    ]);
    const found = parseEmbeddedLyrics({ head, tail: noTail }, { sampleRate: 44100 });
    const expected = (100 * 1152) / 44100;
    expect(found?.lines[0]?.timeSec).toBeCloseTo(expected, 5);
    expect(found?.lines[1]?.timeSec).toBeCloseTo(expected * 2, 5);
  });

  it('TXXX 只在描述像歌词时才算歌词', () => {
    const lyricTag = id3(3, [{ id: 'TXXX', body: txxx(0, 'MP3LYRICS Text', '[00:01.00]卡拉 OK') }]);
    expect(parseEmbeddedLyrics({ head: lyricTag, tail: noTail })?.format).toContain('TXXX');

    const other = id3(3, [{ id: 'TXXX', body: txxx(0, 'MusicBrainz Artist Id', 'x') }]);
    expect(parseEmbeddedLyrics({ head: other, tail: noTail })).toBeNull();
  });

  it('v2.2 三字符帧名也认', () => {
    const head = id3(2, [{ id: 'ULT', body: uslt(0, 'zho', 'old school') }]);
    expect(parseEmbeddedLyrics({ head, tail: noTail })?.text).toBe('old school');
  });

  it('APEv2 的 Lyrics 项，多个值按行拆开；二进制项跳过', () => {
    const tail = apev2([
      { key: 'Cover (front)', value: 'not-text', binary: true },
      { key: 'Lyrics', value: '第一行\0第二行' },
    ]);
    const found = parseEmbeddedLyrics({ head: MPEG_HEAD, tail });
    expect(found?.format).toBe('APEv2 Lyrics');
    expect(found?.text).toBe('第一行\n第二行');
  });

  it('只有 TIT2/TALB 的普通标签返回 null', () => {
    const head = id3(3, [
      { id: 'TIT2', body: Buffer.from([0, ...Buffer.from('Brain Power')]) },
      { id: 'TALB', body: Buffer.from([3, ...Buffer.from('Cytus II')]) },
    ]);
    expect(parseEmbeddedLyrics({ head, tail: noTail })).toBeNull();
  });

  it('没有标签的文件不炸', () => {
    expect(parseEmbeddedLyrics({ head: MPEG_HEAD, tail: noTail })).toBeNull();
    expect(parseEmbeddedLyrics({ head: Buffer.alloc(0), tail: Buffer.alloc(4) })).toBeNull();
  });
});

describe('readEmbeddedLyrics 对真实曲库', () => {
  it('当前 13 首只带 TIT2/TPE1/TALB/APIC，不该误报有内嵌歌词', async () => {
    const dir = join(process.cwd(), 'music');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.mp3'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const found = await readEmbeddedLyrics(join(dir, file));
      expect(found, file).toBeNull();
    }
  });

  it('能读出临时文件里的 USLT', async () => {
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const dir = await mkdtemp(join(tmpdir(), 'mv2-id3-'));
    const path = join(dir, 'fake.mp3');
    try {
      await writeFile(
        path,
        Buffer.concat([
          id3(3, [{ id: 'USLT', body: uslt(1, 'zho', '[00:03.00]临时歌词') }]),
          Buffer.from([0xff, 0xfb, 0x90, 0x00]),
        ]),
      );
      const found = await readEmbeddedLyrics(path);
      expect(found?.text).toBe('[00:03.00]临时歌词');
      expect(parseLrc(found?.text ?? '')).toEqual([{ timeSec: 3, text: '临时歌词' }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
