// 站点读取根 meta.json 的唯一入口（scripts/meta-core.mjs 扫描生成，守卫保新鲜）。
// 文案里的数量主张一律经 META 插值，不得手写数字——guard/meta.ts 会扫硬编码。
import metaJson from '../../../meta.json';

export const META = metaJson;
