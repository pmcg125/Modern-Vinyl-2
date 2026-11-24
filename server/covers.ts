import { promises as fs } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFile } from 'music-metadata';
import sharp from 'sharp';
import { cacheKey, fingerprintOf, resolveTrackPath } from './ids.js';
import { config } from './env.js';

export interface CoverResult {
  buffer: Buffer;
  etag: string;
}

/** 无内嵌封面时给一张占位图，避免 <img> 直接报错 */
export const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${config.coverSize}" height="${config.coverSize}" viewBox="0 0 100 100">
<rect width="100" height="100" fill="none"/>
<path d="M0 0h100v100H0z" fill="#101010"/>
<path d="M0 100 100 0" stroke="#333" stroke-width="1"/>
<circle cx="50" cy="50" r="16" fill="none" stroke="#444" stroke-width="1"/>
<circle cx="50" cy="50" r="2.5" fill="#555"/>
</svg>`;

function coverPath(key: string): string {
  return join(config.cacheDir, `${key}.webp`);
}

/**
 * 读取封面：磁盘缓存命中直接返回，否则解析 ID3 图片并用 sharp 裁成方图。
 * 缓存键含文件指纹，所以曲目一变动就会重生成。
 */
export async function loadCover(id: string, root = config.musicDir): Promise<CoverResult | null> {
  const absPath = resolveTrackPath(id, root);
  if (!absPath) return null;

  let stats;
  try {
    stats = await fs.stat(absPath);
  } catch {
    return null;
  }

  const fp = fingerprintOf(stats.size, stats.mtimeMs);
  const key = cacheKey(relative(root, absPath).split('\\').join('/'), fp);
  const path = coverPath(key);

  try {
    const cached = await fs.readFile(path);
    return { buffer: cached, etag: `W/"${key}"` };
  } catch {
    /* 未命中缓存，继续走解析 */
  }

  const meta = await parseFile(absPath, { duration: false, skipCovers: false });
  const picture = meta.common.picture?.[0];
  if (!picture?.data?.length) return null;

  const buffer = await sharp(picture.data)
    .rotate()
    .resize(config.coverSize, config.coverSize, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await fs.mkdir(config.cacheDir, { recursive: true });
  await fs.writeFile(path, buffer).catch((err: unknown) => {
    console.warn('[covers] 写缓存失败:', err);
  });

  return { buffer, etag: `W/"${key}"` };
}

/** 删掉不再被任何曲目引用的封面缓存（改名/删除歌曲后会留下孤儿文件） */
export async function pruneCovers(root = config.musicDir): Promise<number> {
  const { getLibraryCache } = await import('./library.js');
  const { byId } = await getLibraryCache({ root });

  const live = new Set<string>();
  for (const entry of byId.values()) {
    live.add(
      `${cacheKey(entry.relPath, fingerprintOf(entry.track.bytes, entry.track.mtimeMs))}.webp`,
    );
  }

  let files: string[];
  try {
    files = await fs.readdir(config.cacheDir);
  } catch {
    return 0;
  }

  const orphans = files.filter((name) => name.endsWith('.webp') && !live.has(name));
  await Promise.all(
    orphans.map((name) => fs.rm(join(config.cacheDir, name)).catch(() => undefined)),
  );
  return orphans.length;
}

/** 预生成全部封面缓存用 */
export async function warmCovers(
  ids: string[],
  root = config.musicDir,
): Promise<{ hit: number; generated: number; missing: number }> {
  const result = { hit: 0, generated: 0, missing: 0 };

  for (const id of ids) {
    const absPath = resolveTrackPath(id, root);
    if (!absPath) {
      result.missing++;
      continue;
    }
    const stats = await fs.stat(absPath).catch(() => null);
    if (!stats) {
      result.missing++;
      continue;
    }
    const key = cacheKey(
      relative(root, absPath).split('\\').join('/'),
      fingerprintOf(stats.size, stats.mtimeMs),
    );
    const cached = await fs
      .stat(coverPath(key))
      .then(() => true)
      .catch(() => false);
    if (cached) {
      result.hit++;
      continue;
    }
    const cover = await loadCover(id, root).catch(() => null);
    if (cover) result.generated++;
    else result.missing++;
  }

  return result;
}
