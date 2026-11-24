import { getLibraryCache } from '../server/library.js';
import { pruneCovers, warmCovers } from '../server/covers.js';

const prune = process.argv.includes('--prune');
const started = performance.now();
const { library } = await getLibraryCache({ refresh: true });

console.log(`[warm] ${library.tracks.length} 首曲目，开始生成封面缓存…`);
const result = await warmCovers(library.tracks.map((t) => t.id));

console.log(
  `[warm] 命中 ${result.hit} · 新生成 ${result.generated} · 无封面/失败 ${result.missing}` +
    ` · 耗时 ${Math.round(performance.now() - started)}ms`,
);

if (prune) {
  const removed = await pruneCovers();
  console.log(`[warm] 清理孤儿封面缓存 ${removed} 个`);
} else {
  console.log('[warm] 提示：加 --prune 可清理改名/删除后残留的封面缓存');
}
