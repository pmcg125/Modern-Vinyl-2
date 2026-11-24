import { open } from 'node:fs/promises';
import type { LyricLine } from '@shared/types';

/**
 * 从音频文件里手动提取内嵌歌词。
 *
 * 不走 music-metadata 的 common.lyrics：它只映射 USLT，而实际曲库里常见的
 * SYLT（带时间轴）、TXXX:Mp3Lyrics / ESLyric、以及 APEv2 的 Lyrics 项都会被它丢掉。
 * 这里直接按 ID3v2 / APEv2 的二进制结构自己解一遍。
 */

/** 只读到标签体，不整文件读进来；封面再大也只按标签声明的长度取 */
const MAX_TAG_BYTES = 12 * 1024 * 1024;
/** 文件尾部预留读取长度：够装下 APEv2 头尾 + 常规歌词 */
const TAIL_BYTES = 96 * 1024;

export interface EmbeddedLyrics {
  /** 命中的容器，例如 `ID3v2.3 USLT` / `APEv2 Lyrics`，给 UI 当出处显示 */
  format: string;
  /** 已解析出的时间轴行（SYLT 直接带时间；LRC 文本由调用方 parseLrc） */
  lines: LyricLine[];
  /** 原始文本；可能带 [mm:ss.xx] 时间轴，也可能是纯歌词 */
  text: string;
}

interface RawFrame {
  id: string;
  body: Buffer;
}

const synchsafe = (buf: Buffer, offset: number) =>
  ((buf[offset] ?? 0) << 21) |
  ((buf[offset + 1] ?? 0) << 14) |
  ((buf[offset + 2] ?? 0) << 7) |
  (buf[offset + 3] ?? 0);

/**
 * ID3v2 文本编码字节：0=ISO-8859-1, 1=UTF-16 带 BOM, 2=UTF-16BE, 3=UTF-8。
 * 中文歌词大量是 1/2，直接 toString('utf8') 会得到一堆乱码。
 */
function decodeId3Text(bytes: Buffer, encoding: number): string {
  switch (encoding) {
    case 0:
      return bytes.toString('latin1');
    case 1:
      return new TextDecoder('utf-16').decode(stripBom(bytes));
    case 2:
      return new TextDecoder('utf-16be').decode(bytes);
    default:
      return utf8OrGbk(bytes);
  }
}

function stripBom(bytes: Buffer): Buffer {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.subarray(2);
  return bytes;
}

/** UTF-8 解出替换符说明多半是 GBK（国内抓的标签文件极常见） */
function utf8OrGbk(bytes: Buffer): string {
  const utf8 = bytes.toString('utf8');
  if (!utf8.includes('\ufffd')) return utf8;
  try {
    const gbk = new TextDecoder('gbk').decode(bytes);
    return gbk.includes('\ufffd') ? utf8 : gbk;
  } catch {
    return utf8;
  }
}

/** 找到文本段结束位置：UTF-16 系按双零字节，其余按单零 */
function terminatorSize(encoding: number): number {
  return encoding === 1 || encoding === 2 ? 2 : 1;
}

function indexOfTerminator(bytes: Buffer, from: number, encoding: number): number {
  const step = terminatorSize(encoding);
  for (let i = from; i + step <= bytes.length; i += step) {
    if (step === 1 ? bytes[i] === 0 : bytes[i] === 0 && bytes[i + 1] === 0) return i;
  }
  return bytes.length;
}

/** 解析 ID3v2 标签体（不含 10 字节头）；v2.2 是三字符帧名 + 24 位长度 */
export function parseId3v2Frames(body: Buffer, major: number): RawFrame[] {
  const frames: RawFrame[] = [];
  const idLen = major <= 2 ? 3 : 4;
  const headLen = major <= 2 ? 6 : 10;
  let p = 0;

  while (p + headLen <= body.length) {
    const id = body.subarray(p, p + idLen).toString('latin1');
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break; // 填充区：后面没有帧了

    const size =
      major >= 4
        ? synchsafe(body, p + 4)
        : major <= 2
          ? // v2.2 帧头 = 3 字节帧名 + 3 字节长度，长度紧跟在帧名后面
            ((body[p + 3] ?? 0) << 16) | ((body[p + 4] ?? 0) << 8) | (body[p + 5] ?? 0)
          : body.readUInt32BE(p + 4);

    const start = p + headLen;
    if (size <= 0 || start + size > body.length) break;
    frames.push({ id, body: body.subarray(start, start + size) });
    p = start + size;
  }

  return frames;
}

function usltText(frame: Buffer): string {
  const encoding = frame[0] ?? 0;
  // [encoding][lang(3)][description][term][text]
  const text = indexOfTerminator(frame, 4, encoding);
  return decodeId3Text(frame.subarray(text + terminatorSize(encoding)), encoding).trim();
}

function txxxPair(frame: Buffer): { description: string; value: string } {
  const encoding = frame[0] ?? 0;
  const split = indexOfTerminator(frame, 1, encoding);
  return {
    description: decodeId3Text(frame.subarray(1, split), encoding).trim(),
    value: decodeId3Text(frame.subarray(split + terminatorSize(encoding)), encoding).trim(),
  };
}

/**
 * SYLT：同步歌词帧。
 *
 * v2.3（含 v2.2）多了一个可变长的 MIME 串，v2.4 去掉并重排字段，
 * 所以偏移必须按版本走，不能写死：
 *   v2.3  [enc][lang x3]["text/plain"\0][content type][时间戳格式][描述\0]([文本\0][戳:4BE])*
 *   v2.4  [enc][lang x3][content type][时间戳格式][描述\0]([文本\0][戳:4BE])*
 * 时间戳格式：1=MPEG 帧号、2=毫秒。
 */
function syltLines(frame: Buffer, sampleRate: number, major: number): LyricLine[] {
  const encoding = frame[0] ?? 0;
  let p = 4; // 跳过 encoding + language
  if (major <= 3) {
    const mimeEnd = frame.indexOf(0, p);
    if (mimeEnd < 0) return [];
    p = mimeEnd + 1 + 1; // content type 占一字节
  } else {
    p += 1; // v2.4 只有 content type
  }
  const timeFormat = frame[p] ?? 2;
  p += 1;

  const descEnd = indexOfTerminator(frame, p, encoding);
  p = descEnd + terminatorSize(encoding);

  const frameSec = 1152 / (sampleRate > 0 ? sampleRate : 44100);
  const lines: LyricLine[] = [];

  while (p < frame.length) {
    const end = indexOfTerminator(frame, p, encoding);
    const text = decodeId3Text(frame.subarray(p, end), encoding);
    p = end + terminatorSize(encoding);
    if (p + 4 > frame.length) break;
    const stamp = frame.readUInt32BE(p);
    p += 4;
    if (!text) continue;
    lines.push({ timeSec: timeFormat === 1 ? stamp * frameSec : stamp / 1000, text });
  }

  return lines.sort((a, b) => a.timeSec - b.timeSec);
}

/** APEv2 项：[value size:4LE][flags:4LE][key\0][value]，多个值用 \0 分隔 */
function parseApev2(tail: Buffer): { key: string; value: string }[] {
  const footer = tail.subarray(tail.length - 32);
  if (footer.subarray(0, 8).toString('latin1') !== 'APETAGEX') return [];

  const tagSize = footer.readUInt32LE(16);
  const items = footer.readUInt32LE(20);
  const flags = footer.readUInt32LE(24);
  const hasHeader = (flags & 0x8000_0000) !== 0;
  if (tagSize <= 32 || tagSize > tail.length) return [];
  const bodyStart = tail.length - tagSize + (hasHeader ? 32 : 0);
  if (bodyStart < 0) return [];

  const out: { key: string; value: string }[] = [];
  let p = bodyStart;
  for (let i = 0; i < items && p + 8 <= tail.length; i++) {
    const valueSize = tail.readUInt32LE(p);
    const itemFlags = tail.readUInt32LE(p + 4);
    const keyStart = p + 8;
    const keyEnd = tail.indexOf(0, keyStart);
    if (keyEnd < 0) break;
    const key = tail.subarray(keyStart, keyEnd).toString('latin1');
    const valueStart = keyEnd + 1;
    const valueEnd = valueStart + valueSize;
    if (valueEnd > tail.length) break;
    // bit 1 置位是二进制（封面），不当歌词读
    if ((itemFlags & 0x3) === 0)
      out.push({ key, value: tail.subarray(valueStart, valueEnd).toString('utf8') });
    p = valueEnd;
  }
  return out;
}

const LYRIC_KEY = /^(lyrics?|lyric\/[a-z]{2,3}|{lyrics})$/i;
const LYRIC_DESC = /(lyric|歌词|mp3lyrics|eslyric)/i;

/**
 * head = 文件开头（含 ID3v2 头与标签体），tail = 文件结尾若干字节。
 * 纯函数，方便拿手搓的字节块做单测。
 */
export function parseEmbeddedLyrics(
  input: { head: Buffer; tail: Buffer },
  options: { sampleRate?: number } = {},
): EmbeddedLyrics | null {
  const sampleRate = options.sampleRate ?? 44100;

  if (input.head.subarray(0, 3).toString('latin1') === 'ID3') {
    const major = input.head[3] ?? 3;
    const size = synchsafe(input.head, 6);
    let p = 10;
    if (major === 3 && input.head[5]! & 0x40) p += 4 + input.head.readUInt32BE(p); // v2.3 扩展头
    if (major >= 4 && input.head[5]! & 0x40) p += synchsafe(input.head, p); // v2.4 扩展头
    const body = input.head.subarray(p, Math.min(input.head.length, 10 + size));

    for (const frame of parseId3v2Frames(body, major)) {
      if (frame.id === 'USLT' || frame.id === 'ULT') {
        const text = usltText(frame.body);
        if (text) return { format: `ID3v2.${major} USLT`, lines: [], text };
      }
      if (frame.id === 'SYLT' || frame.id === 'STL') {
        const lines = syltLines(frame.body, sampleRate, major);
        if (lines.length)
          return {
            format: `ID3v2.${major} SYLT`,
            lines,
            text: lines.map((l) => l.text).join('\n'),
          };
      }
      if (frame.id === 'TXXX' || frame.id === 'TXX' || frame.id === 'XXXT') {
        const { description, value } = txxxPair(frame.body);
        if (value && LYRIC_DESC.test(description))
          return { format: `ID3v2.${major} TXXX:${description}`, lines: [], text: value };
      }
    }
  }

  for (const item of parseApev2(input.tail)) {
    if (LYRIC_KEY.test(item.key.trim()) && item.value.trim()) {
      // APEv2 允许一个键挂多行值，用 \0 分隔
      return {
        format: `APEv2 ${item.key}`,
        lines: [],
        text: item.value.split('\0').filter(Boolean).join('\n'),
      };
    }
  }

  return null;
}

/**
 * 只读文件头和文件尾，不解码音频。
 * 先读 10 字节拿标签声明的长度，再按那个长度读 —— 直接读一大块会把整首
 * MP3（几十 MB）都拉进内存，标签本身通常只有几十 KB。
 */
export async function readEmbeddedLyrics(
  path: string,
  options: { sampleRate?: number } = {},
): Promise<EmbeddedLyrics | null> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    if (size < 10) return null;

    const header = Buffer.alloc(10);
    await handle.read(header, 0, 10, 0);

    let head = header;
    if (header.subarray(0, 3).toString('latin1') === 'ID3') {
      const tagLen = Math.min(synchsafe(header, 6), MAX_TAG_BYTES, size - 10);
      head = Buffer.alloc(10 + tagLen);
      await handle.read(head, 0, head.length, 0);
    }

    const tailLen = Math.min(size, TAIL_BYTES);
    const tail = Buffer.alloc(tailLen);
    await handle.read(tail, 0, tailLen, size - tailLen);

    return parseEmbeddedLyrics({ head, tail }, options);
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}
