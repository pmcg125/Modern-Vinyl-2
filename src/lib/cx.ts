/** 条件类名拼接 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** 稳定地把字符串散列到 0..n-1，用于撞色分配（同一艺人永远同色） */
function hashIndex(input: string, buckets: number): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, buckets);
}

const CLASH_COLORS = ['var(--accent)', 'var(--clash-1)', 'var(--clash-2)', 'var(--clash-3)'];

export function clashOf(key: string): string {
  return CLASH_COLORS[hashIndex(key, CLASH_COLORS.length)] ?? 'var(--accent)';
}
