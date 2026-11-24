import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';
import express from 'express';
import { config } from './env.js';
import { createApp, SERVER_VERSION } from './app.js';
import { getLibraryCache } from './library.js';

const app = createApp();
const distDir = join(config.musicDir, '..', 'dist');

/** 本机局域网 IPv4，用于打印可直接在手机打开的地址 */
function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) out.push(entry.address);
    }
  }
  return out;
}

// 生产模式下由 API 进程直接托管构建产物
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res, next) => {
    res.sendFile(join(distDir, 'index.html'), (err) => err && next(err));
  });
}

async function onListening(): Promise<void> {
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : config.port;
  const lines = [
    '',
    '┌─ MODERNVINYL2 ──────────────────────────────',
    `│ bind     ${config.host ?? '0.0.0.0 (IPv4+IPv6)'}:${port}`,
    `│ local    http://localhost:${port}`,
    ...lanAddresses().map((ip) => `│ lan      http://${ip}:${port}`),
    `│ music    ${config.musicDirLabel}`,
    `│ cache    ${config.cacheDir}`,
    `│ version  ${SERVER_VERSION}`,
    '└──────────────────────────────────────────────',
  ];
  console.info(lines.join('\n'));

  try {
    const { library } = await getLibraryCache();
    console.info(
      `[library] ${library.stats.trackCount} 首 / ${library.stats.albumCount} 张，扫描耗时 ${library.scanMs}ms`,
    );
  } catch (err) {
    console.error('[library] 首次索引失败:', err);
  }
}

const server = config.host
  ? app.listen(config.port, config.host, onListening)
  : app.listen(config.port, onListening);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
