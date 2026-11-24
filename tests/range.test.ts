import { describe, expect, it } from 'vitest';
import { parseRange } from '../server/stream';

describe('parseRange', () => {
  const size = 1000;

  it('解析闭区间', () => {
    expect(parseRange('bytes=0-499', size)).toEqual({ start: 0, end: 499 });
    expect(parseRange('bytes=500-999', size)).toEqual({ start: 500, end: 999 });
  });

  it('开放末端表示到文件结尾', () => {
    expect(parseRange('bytes=700-', size)).toEqual({ start: 700, end: 999 });
  });

  it('后缀区间取末尾 N 字节', () => {
    expect(parseRange('bytes=-200', size)).toEqual({ start: 800, end: 999 });
    expect(parseRange('bytes=-5000', size)).toEqual({ start: 0, end: 999 });
  });

  it('末端越界夹回文件末尾', () => {
    expect(parseRange('bytes=900-5000', size)).toEqual({ start: 900, end: 999 });
  });

  it('非法或不可能满足的区间返回 null，交给 416', () => {
    expect(parseRange(undefined, size)).toBeNull();
    expect(parseRange('bytes=-', size)).toBeNull();
    expect(parseRange('bytes=abc-def', size)).toBeNull();
    expect(parseRange('items=0-10', size)).toBeNull();
    expect(parseRange('bytes=1200-1400', size)).toBeNull();
    expect(parseRange('bytes=500-100', size)).toBeNull();
    expect(parseRange('bytes=-0', size)).toBeNull();
  });
});
