import { useEffect, useMemo, useRef, useState } from 'react';

const GLYPHS = '█▓▒░<>/\\|#@$%&*+=-:·';

/**
 * 进入视口时逐格揭示。返回 ref 与已揭示数量，调用方按 index < revealed 决定样式。
 * 只观察一次，揭示后不再回收，避免列表滚动时反复闪烁。
 */
export function useReveal<T extends HTMLElement>(count: number, step = 55) {
  const containerRef = useRef<T>(null);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || count === 0) {
      setRevealed(count);
      return;
    }
    if (!('IntersectionObserver' in window)) {
      setRevealed(count);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setRevealed(count);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  const delayOf = (index: number) => `${Math.min(index, 14) * step}ms`;

  return { containerRef, revealed, delayOf };
}

/** 数字滚动，用于首页统计块 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(target || 0);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return value;
}

/**
 * 字符乱码揭示：切歌时先把文本打乱再逐位定格。
 * key 变化即重放，所以调用方传曲目 ID 之类的稳定标识。
 */
export function useScramble(text: string, key: string | number, speedMs = 26): string {
  const [output, setOutput] = useState(text);

  const frames = useMemo(() => {
    const total = Math.max(6, Math.min(28, text.length));
    return Array.from({ length: total }, (_, i) => {
      const settled = Math.floor(((i + 1) / total) * text.length);
      let out = text.slice(0, settled);
      for (let j = settled; j < text.length; j++) {
        out += text[j] === ' ' ? ' ' : (GLYPHS[(i * 7 + j * 3) % GLYPHS.length] ?? '·');
      }
      return out;
    });
  }, [text]);

  useEffect(() => {
    if (!text) {
      setOutput(text);
      return;
    }

    let index = 0;
    setOutput(frames[0] ?? text);
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= frames.length) {
        setOutput(text);
        window.clearInterval(timer);
        return;
      }
      setOutput(frames[index] ?? text);
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [key, text, frames, speedMs]);

  return output;
}
