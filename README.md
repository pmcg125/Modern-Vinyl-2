# Modern Vinyl 2

本地黑胶曲库 Web 播放器。扫描本机 `music/` 目录，生成唱片墙、波形与频谱，并提供一个终端（CRT/TTY）风格的沉浸式播放页。无账号、无遥测、不访问外部服务。

视觉主题：**街头服饰 × 终端**。

## 特性

- **本地曲库**：递归扫描 `music/`，读取 ID3/APE 标签与内嵌封面；后端用 `sharp` 转 webp 并做磁盘缓存（按 size + mtime 指纹失效）
- **沉浸播放页 `/now`**：CRT 扫描线、ASCII 唱盘、频谱示波器、歌词跟随、ASCII 电平/EQ/睡眠定时
- **音频引擎**：单个 `AudioEngine`，`<audio>` + Web Audio 三段 BiquadFilter EQ + AnalyserNode 频谱
- **歌词**：同名 `.lrc` / `.txt`（支持 `lyrics/`、`lrc/` 子目录与模糊匹配，自动识别 UTF-8 / UTF-16 / GBK），回落到自写的 ID3v2 `USLT`/`SYLT` 与 APEv2 解析
- **主题与动效**：明/暗双主题（Tailwind v4 `@theme inline` 令牌），动效档位 `auto / full / calm / off` 跟随 `prefers-reduced-motion`，可用 `?fx=` 覆盖
- **纯本地状态**：收藏、播放次数、偏好、上次会话只写 `localStorage`

## 技术栈

Vite 8 · React 19 · TypeScript 5.9 (strict) · Tailwind CSS v4 · Zustand · React Router 7 · Express 5 · music-metadata 11 · sharp 0.35 · Three.js · Vitest

## 快速开始

需要 Node.js ≥ 20.19。

```bash
npm install
npm run dev
```

- 前端：http://localhost:5180
- API：http://localhost:3210
- 默认监听 `0.0.0.0`，方便手机/局域网访问；只给本机用时设置 `MV2_LOCAL=1`

生产模式：

```bash
npm run build
npm run serve     # Express 同时托管 dist 与 API
```

## 准备曲库

仓库**不包含**任何音频文件。把 `.mp3` 放进 `music/`（支持多级子目录），需要歌词就放同名的 `.lrc` / `.txt`：

```
music/
├── Brain Power - NOMA.mp3
├── Brain Power - NOMA.lrc
└── album/
    └── track.mp3
```

封面优先读内嵌图片；没有则回落到默认唱片图。

## 目录结构

```
src/          前端（页面、组件、音频引擎、hooks、状态）
server/       Express API（曲库索引、流式播放、封面、歌词）
shared/       前后端共享类型契约（@shared）
tests/        Vitest 单测
scripts/      曲库缓存预热等脚本
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `API_PORT` | `3210` | API 端口 |
| `API_HOST` | 全部网卡 | 设 `127.0.0.1` 可只监听本机 |
| `MV2_MUSIC_DIR` | `music` | 曲库目录 |
| `MV2_CACHE_DIR` | `.cache/covers` | 封面缓存目录 |
| `MV2_COVER_SIZE` | `400` | 封面边长（px） |
| `MV2_LOCAL` | – | `1` 时 Vite 只监听本机 |

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/library` | 曲库索引（ETag/304，`?refresh=1` 强制重扫） |
| GET | `/api/track/:id` | 单曲元数据 |
| GET | `/api/track/:id/lyrics` | 歌词（外挂文件或内嵌标签） |
| GET | `/api/cover/:id` | 封面 webp（immutable 缓存） |
| GET | `/api/stream/:id` | 音频流，支持 Range/206 + ETag |

曲目 ID 是相对路径的 base64url；服务端对路径做目录穿越与后缀白名单校验。

## 脚本

```bash
npm run typecheck   # tsc 检查前端 + 服务端
npm test            # Vitest
npm run lint
npm run format
npm run warm        # 预热封面缓存
```

## 说明

本仓库只包含代码与样式。音乐文件受版权保护，请自行准备合法来源的曲目，`music/` 已在 `.gitignore` 中排除。
