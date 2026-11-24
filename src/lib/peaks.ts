/**
 * 整曲波形峰值：拉取音频 → 解码 → 降采样成固定桶。
 *
 * 只在沉浸页按需触发，结果按曲目缓存在内存里（LRU 3 首），
 * 解码完立刻丢掉 AudioBuffer，避免为 20 秒以上的曲子长期占几十 MB。
 */

const BUCKETS = 160;
const MAX_BYTES = 40 * 1024 * 1024;
const CACHE_LIMIT = 3;

const cache = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[] | null>>();

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext;
    context ??= new Ctor();
    return context;
  } catch {
    return null;
  }
}

function remember(id: string, peaks: number[]): void {
  cache.set(id, peaks);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function computePeaks(url: string): Promise<number[] | null> {
  const ctx = audioContext();
  if (!ctx) return null;

  const response = await fetch(url);
  if (!response.ok) return null;

  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return null;

  const raw = await response.arrayBuffer();
  const decoded = await ctx.decodeAudioData(raw).catch(() => null);
  if (!decoded) return null;

  const channel = decoded.getChannelData(0);
  const size = Math.max(1, Math.floor(channel.length / BUCKETS));
  const peaks = new Array<number>(BUCKETS);

  for (let i = 0; i < BUCKETS; i++) {
    let peak = 0;
    const start = i * size;
    const end = Math.min(channel.length, start + size);
    for (let j = start; j < end; j += 32) {
      const value = Math.abs(channel[j] ?? 0);
      if (value > peak) peak = value;
    }
    peaks[i] = peak;
  }

  // 归一化到 0..1，小声的曲子也能看清形状
  const max = Math.max(...peaks, 0.001);
  return peaks.map((value) => value / max);
}

export function getTrackPeaks(id: string, url: string): Promise<number[] | null> {
  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(id);
  if (pending) return pending;

  const job = computePeaks(url)
    .then((peaks) => {
      if (peaks) remember(id, peaks);
      return peaks;
    })
    .catch(() => null)
    .finally(() => inflight.delete(id));

  inflight.set(id, job);
  return job;
}

export const PEAK_BUCKETS = BUCKETS;
