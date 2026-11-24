import { describe, expect, it } from 'vitest';
import { isTypingTarget, ownsArrowKeys } from '../src/hooks/useAppHooks';

/** 只需要 tagName / type / isContentEditable，不用真 DOM */
const el = (tagName: string, extra: Record<string, unknown> = {}) =>
  ({ tagName, ...extra }) as unknown as HTMLElement;

describe('isTypingTarget', () => {
  it('文本类控件吞掉快捷键', () => {
    for (const type of ['text', 'search', 'number', 'password', 'email', 'url', 'date']) {
      expect(isTypingTarget(el('INPUT', { type })), type).toBe(true);
    }
    expect(isTypingTarget(el('INPUT', { type: '' }))).toBe(true);
    expect(isTypingTarget(el('TEXTAREA'))).toBe(true);
    expect(isTypingTarget(el('SELECT'))).toBe(true);
    expect(isTypingTarget(el('DIV', { isContentEditable: true }))).toBe(true);
  });

  it('滑块/勾选类 input 不算打字：拖完音量空格仍然能暂停', () => {
    for (const type of ['range', 'checkbox', 'radio', 'color', 'file', 'submit', 'button']) {
      expect(isTypingTarget(el('INPUT', { type })), type).toBe(false);
    }
  });

  it('普通元素与 null 不拦', () => {
    expect(isTypingTarget(el('BUTTON'))).toBe(false);
    expect(isTypingTarget(el('DIV'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('ownsArrowKeys', () => {
  it('只有 range 滑块自己处理方向键', () => {
    expect(ownsArrowKeys(el('INPUT', { type: 'range' }))).toBe(true);
    expect(ownsArrowKeys(el('INPUT', { type: 'number' }))).toBe(false);
    expect(ownsArrowKeys(el('INPUT', { type: 'search' }))).toBe(false);
    expect(ownsArrowKeys(el('BUTTON'))).toBe(false);
    expect(ownsArrowKeys(null)).toBe(false);
  });
});
