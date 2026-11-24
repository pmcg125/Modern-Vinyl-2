import { usePlayer } from '../state/player';
import { SHORTCUTS } from '../lib/shortcuts';
import { formatBytes, formatDuration } from '../lib/format';
import { SectionHead } from '../components/SectionHead';

const ENDPOINTS: [string, string][] = [
  ['GET /api/library', '曲库索引：tracks + albums + stats，?refresh=1 重扫'],
  ['GET /api/track/:id', '单曲元数据'],
  ['GET /api/track/:id/lyrics', '歌词：.lrc 边车优先，回落 ID3 未同步文本'],
  ['GET /api/cover/:id', '内嵌封面 → 400px webp，sha1 磁盘缓存，immutable'],
  ['GET /api/stream/:id', '音频流，支持 Range/206 与 ETag'],
  ['GET /api/health', '存活与索引曲目数'],
];

export function AboutPage() {
  const library = usePlayer((state) => state.library);
  const theme = usePlayer((state) => state.theme);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <SectionHead index="??" title="ABOUT" sub="这是一个只读本地目录的播放器" level={1} />

      <div className="mv-panel mv-grid mb-8 p-6">
        <p className="text-[16px] leading-relaxed">
          <b className="font-display text-accent">MODERNVINYL2</b> 扫描{' '}
          <code className="border-2 border-line px-1 font-mono text-[13px]">music/</code> 下的
          MP3，读取 ID3 标签与内嵌封面，把封面转成 webp 缓存到磁盘，然后通过 HTTP Range
          流给浏览器播放。没有账号、没有云端、没有遥测；收藏、音量、EQ 和播放次数只写在本机的{' '}
          <code className="font-mono text-[13px]">localStorage</code>。
        </p>
        <p className="mt-4 font-mono text-[11px] tracking-wider text-muted uppercase">
          CURRENT THEME {theme.toUpperCase()} · ROOT {library?.root ?? '—'} · SCANNED{' '}
          {library ? `${library.scanMs}ms` : '—'} ·{' '}
          {library
            ? `${library.stats.trackCount} TRACKS / ${formatBytes(library.stats.totalBytes)} / ${formatDuration(library.stats.totalDurationSec)}`
            : '—'}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 border-b-2 border-line pb-2 font-display text-[26px]">
            KEYBOARD / 快捷键
          </h2>
          <dl className="border-2 border-line bg-panel">
            {SHORTCUTS.map(([key, desc]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 border-b border-line/40 px-3 py-2 last:border-b-0"
              >
                <dt>
                  <kbd className="border-2 border-line bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-right text-[13px] text-muted">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="mb-4 border-b-2 border-line pb-2 font-display text-[26px]">
            API / 后端接口
          </h2>
          <dl className="border-2 border-line bg-panel">
            {ENDPOINTS.map(([path, desc]) => (
              <div key={path} className="border-b border-line/40 px-3 py-2 last:border-b-0">
                <dt className="font-mono text-[12px] text-accent">{path}</dt>
                <dd className="mt-0.5 text-[12px] text-muted">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 border-b-2 border-line pb-2 font-display text-[26px]">
          STACK / 技术栈
        </h2>
        <ul className="grid gap-2 font-mono text-[12px] sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Vite 8 + React 19 + TypeScript 5.9 (strict)',
            'Tailwind CSS v4，@theme inline 令牌，明暗双主题',
            'Zustand 状态层 + 单例 AudioEngine',
            'WebAudio：三段 BiquadFilter + AnalyserNode 频谱',
            'Express 5 + music-metadata 11 + sharp 0.35',
            'Vitest 单测（格式化 / 筛选 / ID 防护 / 歌词解析）',
            'ESLint 9 flat config + Prettier',
            'React Router 7，筛选状态写在 URL',
            'Fontsource 自托管字体，无外部 CDN 依赖',
          ].map((item) => (
            <li key={item} className="border-2 border-line bg-panel px-3 py-2">
              <span className="text-accent">▸</span> {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 border-b-2 border-line pb-2 font-display text-[26px]">
          DESIGN / 视觉规则
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['直角', '全站 border-radius 归零，硬边 2px 描边 + 偏移硬阴影。'],
            ['撞色', '主色之外固定两种撞色（洋红 / 酸绿），按名字散列分配。'],
            ['终端', 'CRT 扫描线与等宽排版只出现在沉浸播放器，其它页面保持街头海报感。'],
          ].map(([title, body]) => (
            <article key={title} className="border-2 border-line bg-bg-2 p-4">
              <h3 className="font-display text-[20px] text-accent">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
