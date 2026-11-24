import { extname, isAbsolute, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

/** 相对路径（始终用 / 分隔）<-> 不透明 TrackId */
export function encodeTrackId(relativePath: string): string {
  const normalized = relativePath.split('\\').join('/');
  return Buffer.from(normalized, 'utf8').toString('base64url');
}

export function decodeTrackId(id: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(id, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  // NUL 与绝对路径一律拒绝，其余交由 resolveTrackPath 做越界校验
  if (!decoded || decoded.includes('\0') || isAbsolute(decoded)) return null;
  return decoded;
}

/**
 * 把 TrackId 解析为 root 下的绝对路径。
 * 任何跳出 root 或非法后缀的输入都返回 null —— 三个读取端点共用这一道闸口。
 */
export function resolveTrackPath(id: string, root: string): string | null {
  const rel = decodeTrackId(id);
  if (rel === null) return null;

  const abs = resolve(root, rel);
  const back = relative(root, abs);
  if (!back || back.startsWith('..') || isAbsolute(back)) return null;
  if (extname(abs).toLowerCase() !== '.mp3') return null;

  return abs;
}

/** 封面缓存指纹：路径 + 文件指纹，曲库文件一换就自动失效 */
export function cacheKey(relativePath: string, fingerprint: string): string {
  return createHash('sha1').update(`${relativePath}|${fingerprint}`).digest('hex');
}

export function fingerprintOf(size: number, mtimeMs: number): string {
  return `${size}:${Math.round(mtimeMs)}`;
}
