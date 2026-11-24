import { createReadStream, promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

interface ByteRange {
  start: number;
  end: number;
}

/** 解析单个 Range；不支持多段与非法区间，返回 null 让调用方回退整文件 */
export function parseRange(header: string | undefined, size: number): ByteRange | null {
  if (!header) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  // `bytes=-N` 表示末尾 N 字节
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Number(rawEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= size || start > end) return null;

  return { start, end: Math.min(end, size - 1) };
}

/** 音频分段下载：播放器 seek 依赖 206，缺了就只能从头播 */
export async function streamFile(
  res: Response,
  absPath: string,
  rangeHeader: string | undefined,
): Promise<void> {
  const stats = await fs.stat(absPath);
  const size = stats.size;
  const type = MIME[extname(absPath).toLowerCase()] ?? 'application/octet-stream';
  const etag = `W/"${size}-${Math.round(stats.mtimeMs)}"`;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', type);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (res.req?.method === 'HEAD') {
    res.setHeader('Content-Length', String(size));
    res.status(200).end();
    return;
  }

  const range = parseRange(rangeHeader, size);

  if (rangeHeader && !range) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
    return;
  }

  if (!range) {
    res.status(200).setHeader('Content-Length', String(size));
    await pipeline(createReadStream(absPath), res);
    return;
  }

  const span = range.end - range.start + 1;
  res.status(206).set({
    'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    'Content-Length': String(span),
  });
  await pipeline(createReadStream(absPath, { start: range.start, end: range.end }), res);
}
