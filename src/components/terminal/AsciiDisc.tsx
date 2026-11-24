import { usePlayer } from '../../state/player';
import { TermMatrix, type MatrixApi } from './TermMatrix';

const COLS = 22;
const ROWS = 14;
/** 圆心刻意偏左：右边留出位置给唱臂 */
const CENTER_COL = 8;

const GROOVES = ['·', ':', '-', '=', '+', '*'];

/** 唱臂两端用归一化圆盘坐标写：u²+v²=1 就是唱片边缘，换尺寸不用重算 */
const ARM_PIVOT = { u: 0.98, v: -0.8 };
const ARM_TIP = { u: 0.26, v: -0.16 };

function segmentCells(
  pivot: { u: number; v: number },
  tip: { u: number; v: number },
  count: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return { u: pivot.u + (tip.u - pivot.u) * t, v: pivot.v + (tip.v - pivot.v) * t };
  });
}

/**
 * 字符黑胶：距离场画同心纹路，一条高光随播放角度转，外加唱臂。
 * 半径按 api.cellAspect 换算成真实像素比，否则按字符数等分只会得到一个椭圆。
 */
export function AsciiDisc({ playing }: { playing: boolean }) {
  // 持续旋转属于「大幅运动」，calm/off 下即使正在播放也不转，只留静态唱片
  const motion = usePlayer((state) => state.motionResolved);
  const spinning = playing && motion === 'full';

  const paint = (api: MatrixApi, elapsed: number) => {
    const { palette } = api;
    const aspect = api.cellAspect || 0.5;
    const cy = (ROWS - 1) / 2;
    const radius = Math.max(2, Math.min(cy, CENTER_COL * aspect, (COLS - 1 - CENTER_COL) * aspect));
    const spin = spinning ? (elapsed / 1000) * ((Math.PI * 2) / 2.6) : 0;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const dx = (col - CENTER_COL) * aspect;
        const dy = row - cy;
        const r = Math.hypot(dx, dy) / radius;
        if (r > 1) continue;

        const a = Math.atan2(dy, dx);

        if (r < 0.1) {
          api.put(col, row, '◉', palette['--tty-dim']);
          continue;
        }

        if (r < 0.3) {
          api.put(col, row, '▒', palette['--tty-magenta']);
          continue;
        }

        if (r > 0.96) {
          api.put(col, row, '═', palette['--tty-fg']);
          continue;
        }

        let char = GROOVES[Math.floor((r - 0.3) * 12) % GROOVES.length] ?? '·';
        let color = palette['--tty-dim'];

        const delta = Math.abs(wrapAngle(a - spin));
        if (delta < 0.13) {
          // 亮色缺口：旋转时最显眼的一刀。角度阈值要窄，否则整块楔形糊成一个三角
          char = '█';
          color = palette['--tty-amber'];
        } else if (delta < 0.34) {
          char = '▮';
          color = palette['--tty-cyan'];
        } else if (Math.abs(wrapAngle(a - spin - Math.PI)) < 0.13) {
          char = '▌';
          color = palette['--tty-violet'];
        }

        api.put(col, row, char, color);
      }
    }

    const toCell = (point: { u: number; v: number }) => ({
      col: Math.round(CENTER_COL + (point.u * radius) / aspect),
      row: Math.round(cy + point.v * radius),
    });

    const pivot = toCell(ARM_PIVOT);
    const tip = toCell(ARM_TIP);
    const seen = new Set<string>();
    for (const point of segmentCells(ARM_PIVOT, ARM_TIP, 14)) {
      const cell = toCell(point);
      const key = `${cell.col}:${cell.row}`;
      if (seen.has(key) || cell.col < 0 || cell.col >= COLS || cell.row < 0 || cell.row >= ROWS)
        continue;
      seen.add(key);
      api.put(cell.col, cell.row, '╱', palette['--tty-fg']);
    }

    if (pivot.col < COLS && pivot.row < ROWS)
      api.put(pivot.col, pivot.row, '◎', palette['--tty-fg']);
    if (tip.col < COLS && tip.row < ROWS) api.put(tip.col, tip.row, '●', palette['--tty-amber']);
  };

  return <TermMatrix cols={COLS} rows={ROWS} paint={paint} className="h-full w-full" />;
}

function wrapAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}
