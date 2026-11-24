import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import type { HealthResponse, LyricsResponse } from '@shared/types';
import { config } from './env.js';
import { readEmbeddedLyrics } from './embeddedLyrics.js';
import { findTrackId, getLibrary, peekLibraryStats } from './library.js';
import { loadCover, PLACEHOLDER_SVG } from './covers.js';
import { resolveTrackPath } from './ids.js';
import {
  decodeLyricBytes,
  findSidecarLyric,
  lyricCandidateFilenames,
  parseLrc,
  plainTextLines,
} from './lyrics.js';
import { streamFile } from './stream.js';

export const SERVER_VERSION = '2.0.0';

async function statOr404(res: Response, absPath: string) {
  try {
    return await fs.stat(absPath);
  } catch {
    res.status(404).json({ error: 'not_found', message: '曲目文件不存在' });
    return null;
  }
}

export function createApp(root: string = config.musicDir): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res: Response<HealthResponse>) => {
    const stats = peekLibraryStats();
    res.json({
      ok: true,
      root: config.musicDirLabel,
      trackCount: stats?.trackCount ?? 0,
      uptimeSec: Math.round(process.uptime()),
      version: SERVER_VERSION,
    });
  });

  app.get('/api/library', async (req, res) => {
    const refresh = req.query.refresh === '1';
    const library = await getLibrary({ refresh, root });

    // 索引没重扫就不必再传几十 KB JSON
    const etag = `W/"${library.generatedAt}"`;
    res.set('ETag', etag);
    if (!refresh && req.get('if-none-match') === etag) {
      res.status(304).end();
      return;
    }
    res.set('Cache-Control', 'no-cache');
    res.json(library);
  });

  app.get('/api/track/:id', async (req, res) => {
    const entry = await findTrackId(req.params.id, { root });
    if (!entry) {
      res.status(404).json({ error: 'not_found', message: '曲目不在索引中' });
      return;
    }
    res.json({ track: entry.track });
  });

  app.get('/api/track/:id/lyrics', async (req, res) => {
    const id = req.params.id;
    const absPath = resolveTrackPath(id, root);
    if (!absPath) {
      res.status(400).json({ error: 'bad_id', message: '无效的曲目 ID' });
      return;
    }

    const entry = await findTrackId(id, { root });
    const info = {
      filename: entry?.track.filename ?? basename(absPath),
      title: entry?.track.title,
      artist: entry?.track.artist,
    };

    // 每次请求都实扫目录：往 music/ 补一个 .lrc 应当立刻可见，不必重建立索引
    const sidecar = await findSidecarLyric(absPath, info, root);
    if (sidecar) {
      const raw = decodeLyricBytes(await fs.readFile(sidecar.path));
      const timed = sidecar.kind === 'lrc' ? parseLrc(raw) : [];
      const lines = timed.length ? timed : plainTextLines(raw);
      if (lines.length) {
        const payload: LyricsResponse = {
          trackId: id,
          source: sidecar.kind,
          synced: timed.length > 0,
          lines,
          sidecar: sidecar.display,
        };
        res.json(payload);
        return;
      }
    }

    // 内嵌歌词：自己按二进制解 ID3v2 USLT/SYLT/TXXX 与 APEv2，
    // 不用 music-metadata 的 common.lyrics —— 它只映射 USLT，带时间轴的 SYLT 会被丢掉
    const embedded = await readEmbeddedLyrics(absPath, {
      sampleRate: entry?.track.sampleRateHz ?? undefined,
    });
    if (embedded) {
      const timed = embedded.lines.length ? embedded.lines : parseLrc(embedded.text);
      const lines = timed.length ? timed : plainTextLines(embedded.text);
      if (lines.length) {
        const payload: LyricsResponse = {
          trackId: id,
          source: 'id3',
          synced: timed.length > 0,
          lines,
          sidecar: embedded.format,
        };
        res.json(payload);
        return;
      }
    }

    res.json({
      trackId: id,
      source: 'none',
      synced: false,
      lines: [],
      sidecar: null,
      candidates: lyricCandidateFilenames(info),
    } satisfies LyricsResponse);
  });

  app.get('/api/cover/:id', async (req, res) => {
    const cover = await loadCover(req.params.id, root);
    if (!cover) {
      res.type('image/svg+xml').status(200).send(PLACEHOLDER_SVG);
      return;
    }
    if (req.get('if-none-match') === cover.etag) {
      res.status(304).end();
      return;
    }
    res.set({
      'Content-Type': 'image/webp',
      ETag: cover.etag,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.send(cover.buffer);
  });

  app.get('/api/stream/:id', async (req, res) => {
    const absPath = resolveTrackPath(req.params.id, root);
    if (!absPath) {
      res.status(400).json({ error: 'bad_id', message: '无效的曲目 ID' });
      return;
    }
    if (!(await statOr404(res, absPath))) return;

    try {
      await streamFile(res, absPath, req.headers.range);
    } catch (err) {
      // 客户端中断（切歌 / seek）是正常路径，只有其它错误才值得记
      const code = (err as { code?: string }).code;
      if (code !== 'EPIPE' && code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        console.error('[stream] 失败', basename(absPath), err);
      }
      if (!res.writableEnded) res.destroy();
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: '未知接口' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] 未处理异常:', err);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.status(500).json({ error: 'internal', message: '服务器内部错误' });
  });

  return app;
}
