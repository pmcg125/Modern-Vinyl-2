import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

export const config = {
  port: Number(process.env.API_PORT ?? 3210),
  /**
   * 留空时交给 Node 默认行为：同时监听所有网卡的 IPv4 + IPv6。
   * 需要收窄就设 API_HOST=127.0.0.1（仅本机）或某个具体地址。
   */
  host: process.env.API_HOST || undefined,
  /** 曲库根目录，可用 MV2_MUSIC_DIR 指向别处 */
  musicDir: resolve(projectRoot, process.env.MV2_MUSIC_DIR ?? 'music'),
  cacheDir: resolve(projectRoot, process.env.MV2_CACHE_DIR ?? '.cache/covers'),
  /** 对外只暴露目录名，不泄露绝对路径 */
  musicDirLabel: 'music/',
  coverSize: Number(process.env.MV2_COVER_SIZE ?? 400),
} as const;

export type AppConfig = typeof config;
