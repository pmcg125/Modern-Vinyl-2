import { useCallback, useRef } from 'react';

interface TiltHandlers {
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * 3D 倾斜：把指针位置写进元素的 --rx/--ry，交给 CSS 做 transform。
 * 走 CSS 变量而不是 state，避免每次 mousemove 触发一次 React 重渲染。
 */
export function useTilt(maxDeg = 7): TiltHandlers {
  const ref = useRef<HTMLElement | null>(null);

  return {
    onPointerMove: useCallback(
      (event: React.PointerEvent<HTMLElement>) => {
        const node = ref.current ?? (event.currentTarget as HTMLElement);
        ref.current = node;

        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        node.style.setProperty('--ry', `${(px * maxDeg * 2).toFixed(2)}deg`);
        node.style.setProperty('--rx', `${(-py * maxDeg * 2).toFixed(2)}deg`);
      },
      [maxDeg],
    ),
    onPointerLeave: useCallback(() => {
      const node = ref.current;
      if (!node) return;
      node.style.setProperty('--rx', '0deg');
      node.style.setProperty('--ry', '0deg');
    }, []),
  };
}

/** 把字符串拆成带延迟的字符，用于大标题逐字入场 */
export function splitLetters(text: string, stepMs = 45) {
  return Array.from(text).map((char, index) => ({
    char,
    delay: `${index * stepMs}ms`,
  }));
}
