import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

// jsdom 没有 matchMedia，主题初始化会用到
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
