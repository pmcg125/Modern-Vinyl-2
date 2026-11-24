/** 纯格式化函数，无副作用 */

export function pad(value: number, width = 2): string {
  return String(Math.floor(Math.abs(value))).padStart(width, '0');
}

/** 3:44 / 1:02:03 —— 时长未知时给 fallback（歌词时间轴用 0:00，播放器用 --:--） */
export function formatDuration(seconds: number | null | undefined, fallback = '--:--'): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return fallback;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exp;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
}

export function formatSampleRate(hz: number | null): string {
  if (!hz) return '—';
  return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}kHz`;
}

/** [####----] 终端进度条 */
export function asciiBar(ratio: number, width = 32, filled = '#', empty = '·'): string {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const count = Math.round(clamped * width);
  return filled.repeat(count) + empty.repeat(width - count);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function formatRelativeDays(mtimeMs: number): string {
  const days = Math.floor((Date.now() - mtimeMs) / 86_400_000);
  if (days <= 0) return 'TODAY';
  if (days === 1) return '1D AGO';
  if (days < 30) return `${days}D AGO`;
  if (days < 365) return `${Math.floor(days / 30)}MO AGO`;
  return `${(days / 365).toFixed(1)}Y AGO`;
}
