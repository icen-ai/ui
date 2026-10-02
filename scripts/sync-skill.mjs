// skill 源单向同步：ui/skill/icen-ui → ../skill/skills/icen-ui（skill.icen.ai 的源仓库）。
// 纪律：**只在本仓库（ui）改 skill 源**；skill 仓库那份是构建产物，由本脚本覆盖，勿手改。
// 用法：
//   bun scripts/sync-skill.mjs           # 同步（源 → skill 仓库）
//   bun scripts/sync-skill.mjs --check   # 只比对不写入，有漂移 exit 1（可挂 CI）
// 环境变量 ICEN_SKILL_REPO 可覆盖目标仓库路径（默认兄弟目录 ../skill）。
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'skill');
const DEST_ROOT = process.env.ICEN_SKILL_REPO ?? join(ROOT, '..', 'skill');
const check = process.argv.includes('--check');

if (!existsSync(DEST_ROOT)) {
  console.error(`sync-skill: 目标仓库不存在：${DEST_ROOT}（克隆 icen.ai/skill 到兄弟目录，或设 ICEN_SKILL_REPO）`);
  process.exit(1);
}

const skills = existsSync(SRC) ? readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory()) : [];
if (!skills.length) { console.error('sync-skill: 源目录 ui/skill/ 下没有 skill'); process.exit(1); }

for (const name of skills) {
  const dest = join(DEST_ROOT, 'skills', name);
  if (check) {
    // 比对：diff -r 源/目标，有输出即漂移
    try {
      execSync(`git diff --no-index --quiet -- "${join(SRC, name)}" "${dest}"`, { stdio: 'pipe' });
      console.log(`✔ ${name} 无漂移`);
    } catch {
      console.error(`✘ ${name} 与 ui/skill/${name} 不一致 —— 在 ui 仓库改源后运行 bun scripts/sync-skill.mjs`);
      process.exit(1);
    }
  } else {
    cpSync(join(SRC, name), dest, { recursive: true });
    console.log(`→ ${name} 已同步到 ${dest}（记得在 skill 仓库提交并 push，CI 自动重建索引）`);
  }
}
