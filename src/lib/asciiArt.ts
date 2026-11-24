export interface HalfBlockGrid {
  cols: number;
  /** 文本行数；实际采样了 rows*2 个像素行 */
  rows: number;
  /** rgba 像素，宽 cols、高 rows*2 */
  data: Uint8ClampedArray;
}

const cache = new Map<string, HalfBlockGrid | null>();

/**
 * 把图片降采样成「每字符格两像素行」的半块网格。
 * 终端里配合 ▄ + 前景/底色就能用等宽字符画出全彩图像，
 * 而且尺寸不变，天然带着位图转字符画的观感。
 */
export function loadHalfBlock(
  url: string,
  cols: number,
  rows: number,
): Promise<HalfBlockGrid | null> {
  const key = `${url}@${cols}x${rows}`;
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const image = new Image();

    const settle = (value: HalfBlockGrid | null) => {
      cache.set(key, value);
      resolve(value);
    };

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = cols;
        canvas.height = rows * 2;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return settle(null);

        ctx.drawImage(image, 0, 0, cols, rows * 2);
        settle({ cols, rows, data: ctx.getImageData(0, 0, cols, rows * 2).data });
      } catch {
        // 跨域画布会污染 getImageData；本项目封面同源，走到这里就是真的取不到
        settle(null);
      }
    };
    image.onerror = () => settle(null);
    image.src = url;
  });
}

/** 取第 x 列、第 y 个像素行的 rgb 字符串 */
export function pixelColor(grid: HalfBlockGrid, x: number, y: number): string {
  const index = (y * grid.cols + x) * 4;
  const r = grid.data[index] ?? 0;
  const g = grid.data[index + 1] ?? 0;
  const b = grid.data[index + 2] ?? 0;
  return `rgb(${r},${g},${b})`;
}
