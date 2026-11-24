import { promises as fs } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import type { LyricLine, LyricSource } from '@shared/types';

export type SidecarKind = Extract<LyricSource, 'lrc' | 'txt'>;

export interface SidecarLyric {
  /** 绝对路径 */
  path: string;
  /** 相对 music/ 的路径，给 UI 显示出处 */
  display: string;
  kind: SidecarKind;
}

const LYRIC_EXTS: Record<string, SidecarKind> = {
  '.lrc': 'lrc',
  '.txt': 'txt',
};

/** 挂在歌词同级的候选子目录 */
const LYRIC_SUBDIRS = ['lyrics', 'lrc'];

/**
 * 归一化文件名用于模糊匹配：全角转半角、丢掉括号注记（feat. / Bonus 之类）、
 * 只留字母和数字（含中日韩），大小写与标点差异就不再影响命中。
 */
export function normalizeLyricKey(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[([{【「『［][^\])}】」』］]*[)\]}】」』］]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** 候选文件名（保留原始标点，用于提示与匹配键的原料），按优先级排列 */
export function lyricCandidateNames(info: {
  filename: string;
  title?: string;
  artist?: string;
}): string[] {
  const stem = basename(info.filename, extname(info.filename));
  const out: string[] = [];
  const push = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  };

  push(stem);
  const parts = stem.split(/\s[-–—]+\s/);
  if (parts.length > 1) {
    // 「艺人 - 歌名」命名的曲库，歌词往往只按其中一个字段命名
    push(parts.slice(1).join(' - '));
    push(parts[0]);
  }
  push(info.title);
  if (info.artist && info.title) {
    push(`${info.artist} - ${info.title}`);
    push(`${info.title} - ${info.artist}`);
  }
  return out;
}

/** 从候选文件名推出的归一化匹配键，去重后保持优先级 */
export function lyricCandidateKeys(info: {
  filename: string;
  title?: string;
  artist?: string;
}): string[] {
  const out: string[] = [];
  for (const name of lyricCandidateNames(info)) {
    const key = normalizeLyricKey(name);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function kindOf(name: string): SidecarKind | null {
  return LYRIC_EXTS[extname(name).toLowerCase()] ?? null;
}

/** 给空状态用：直接列出可以放哪些文件名，别让用户猜命名规则 */
export function lyricCandidateFilenames(info: {
  filename: string;
  title?: string;
  artist?: string;
}): string[] {
  const names = lyricCandidateNames(info);
  const out: string[] = [];
  for (const name of names.slice(0, 3)) {
    out.push(`${name}.lrc`, `${name}.txt`);
  }
  const first = names[0];
  if (first) out.push(`lyrics/${first}.lrc`);
  return [...new Set(out)].slice(0, 7);
}

/** 前缀宽松匹配：只按歌名命名的 .lrc 也要命中，但短键容易误伤，设个下限 */
function looseMatch(candidate: string, key: string): boolean {
  const shorter = candidate.length <= key.length ? candidate : key;
  const longer = candidate.length <= key.length ? key : candidate;
  return shorter.length >= 4 && longer.startsWith(shorter);
}

async function statKind(path: string): Promise<SidecarKind | null> {
  try {
    return (await fs.stat(path)).isFile() ? kindOf(path) : null;
  } catch {
    return null;
  }
}

/**
 * 在曲目所在目录（及其 lyrics/ 子目录）里找歌词文件。
 *
 * 每次都实读目录：往 music/ 里补一个 .lrc 应该立刻能用，
 * 而不是等一次全量重扫，一次 readdir 的代价可以忽略。
 */
export async function findSidecarLyric(
  trackPath: string,
  info: { filename?: string; title?: string; artist?: string },
  root: string,
): Promise<SidecarLyric | null> {
  const dir = dirname(trackPath);
  const stem = basename(trackPath, extname(trackPath));

  // 快路径：与音频完全同名
  for (const candidate of [join(dir, `${stem}.lrc`), join(dir, `${stem}.txt`)]) {
    const kind = await statKind(candidate);
    if (kind)
      return { path: candidate, display: relative(root, candidate).split('\\').join('/'), kind };
  }

  const candidates = lyricCandidateKeys({
    filename: info.filename ?? `${stem}.mp3`,
    title: info.title,
    artist: info.artist,
  });
  if (!candidates.length) return null;

  const dirs = [dir, ...LYRIC_SUBDIRS.map((sub) => join(dir, sub))];
  for (const searchDir of dirs) {
    let entries: string[];
    try {
      entries = await fs.readdir(searchDir);
    } catch {
      continue;
    }

    const pool = entries
      .map((name) => ({ name, kind: kindOf(name) }))
      .filter((entry): entry is { name: string; kind: SidecarKind } => entry.kind !== null)
      // 同名既有 .lrc 又有 .txt 时优先带时间轴的那个
      .sort((a, b) => Number(a.kind !== 'lrc') - Number(b.kind !== 'lrc'));
    if (!pool.length) continue;

    // 先按候选优先级，再要求精确相等；都落空才允许前缀宽松匹配
    for (const candidate of candidates) {
      let loose: (typeof pool)[number] | null = null;
      for (const entry of pool) {
        const key = normalizeLyricKey(basename(entry.name, extname(entry.name)));
        if (!key) continue;
        if (key === candidate) {
          return {
            path: join(searchDir, entry.name),
            display: relative(root, join(searchDir, entry.name)).split('\\').join('/'),
            kind: entry.kind,
          };
        }
        if (!loose && looseMatch(candidate, key)) loose = entry;
      }
      if (loose) {
        return {
          path: join(searchDir, loose.name),
          display: relative(root, join(searchDir, loose.name)).split('\\').join('/'),
          kind: loose.kind,
        };
      }
    }
  }

  return null;
}

/**
 * 歌词文件编码不可控：UTF-8 BOM / UTF-16 LE / 简体中文 GBK 都很常见。
 * 按 UTF-8 解出乱码替换符就回退 GBK，别把一整篇歌词显示成豆腐块。
 */
export function decodeLyricBytes(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }

  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('\ufffd')) return utf8;

  try {
    const gbk = new TextDecoder('gbk').decode(buffer);
    return gbk.includes('\ufffd') ? utf8 : gbk;
  } catch {
    return utf8;
  }
}

/** 解析 LRC：支持一行多个时间戳 `[00:01.23]` / `[00:01,23]`，忽略 [ar:] 之类的元信息标签。 */
export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const stamp = /\[(\d{1,3}):(\d{1,2})(?:[.,](\d{1,3}))?\]/g;

  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*\[[a-z]{1,4}:.*$/i.test(raw)) continue; // [ti:][ar:][al:] 等头部标签

    // 注意不能用 `(\[...\])+` 捕获：重复的捕获组只会留下最后一次匹配
    const stamps = [...raw.matchAll(stamp)];
    if (!stamps.length) continue;

    const content = raw.replace(stamp, '').trim();
    if (!content) continue;

    for (const match of stamps) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const frac = match[3] ? Number(`0.${match[3]}`) : 0;
      if (!Number.isFinite(min) || !Number.isFinite(sec)) continue;

      lines.push({ timeSec: min * 60 + sec + frac, text: content });
    }
  }

  return lines.sort((a, b) => a.timeSec - b.timeSec);
}

/** 没有时间轴的纯文本：剥掉头标签与残留的时间戳，逐行留原样 */
export function plainTextLines(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((raw) =>
      raw
        .replace(/\[\d{1,3}:\d{1,2}(?:[.,]\d{1,3})?\]/g, '')
        .replace(/^\s*\[[a-z]{1,4}:[^\]]*\]/i, '')
        .trim(),
    )
    .filter(Boolean)
    .map((line) => ({ timeSec: 0, text: line }));
}
