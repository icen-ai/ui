// guard 共享工具：结果类型 / 目录扫描 / CSS 注释剥离（保留行号对齐）。
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** scripts/guard/shared.ts → 上三层 = 仓库根（ui/）。 */
export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const SRC = join(ROOT, 'src');

export interface GuardResult {
  /** 检查项中文名（报告展示用） */
  title: string;
  /** 违规明细；空数组 = 通过 */
  violations: string[];
}

/** 读目录下指定后缀的文件名（升序）。 */
export async function listFiles(dir: string, ext: string): Promise<string[]> {
  return (await readdir(dir)).filter((f) => f.endsWith(ext)).sort();
}

/** 逐行剥掉 /* … *\/ 块注释（跨行状态机），返回与原文件行号对齐的「纯代码」行。
    注释占的行返回空串——hex / z-index / keyframes 等规则只扫纯代码，
    避免 DOM 契约注释里的示例值（如色卡说明）误报。 */
export function stripComments(lines: string[]): string[] {
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) {
          i = line.length;
          continue;
        }
        inBlock = false;
        i = end + 2;
      } else {
        const start = line.indexOf('/*', i);
        if (start === -1) {
          out += line.slice(i);
          break;
        }
        out += line.slice(i, start);
        const end = line.indexOf('*/', start + 2);
        if (end === -1) {
          inBlock = true;
          break;
        }
        i = end + 2;
      }
    }
    return out;
  });
}
