// CSS 纪律守卫：把 AGENTS.md 第二段「约定」变成强制检查。
// 范围：src/components/*.css + src/base.css（src/tokens/ 是 token 定义层，豁免全部规则）。
// 校准原则（Phase A 定案）：能机械修复的直接修进源码；语义性的进下方 ALLOWLIST 并注明原因。
// 注：类名/自定义属性正经历 icen- 前缀迁移，selector 相关 pattern 一律写成前缀可选形态，
//     保证守卫在前缀前 / 后两种源码状态下同样成立；codemod 不负责扫本目录。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SRC, listFiles, stripComments, type GuardResult } from './shared';

/* ────────────────────────────────────────────────────────────
 * 豁免清单（file = basename（全库 css 文件名唯一）；pattern 命中即豁免，行号漂移免疫；
 *          类名/属性 pattern 中的 (?:icen-)? 兼容前缀迁移前后两种形态）
 * ──────────────────────────────────────────────────────────── */

/** 十六进制颜色豁免。纪律本意 = 组件只消费 --icen-token-*；下列是语义性例外。 */
const HEX_ALLOWLIST: Array<{ file: string; pattern: RegExp; reason: string }> = [
  {
    file: 'base.css',
    pattern: /#000\s+!important/,
    reason: '@media print 绝对色——打印物无主题 token 语义（省墨强制黑白），不属于 theming 面',
  },
  {
    file: 'base.css',
    pattern: /border:\s*1px\s+solid\s+#999/,
    reason: '@media print 绝对色——打印物无主题 token 语义',
  },
  {
    file: 'scroll-area.css',
    pattern: /mask-image[\s\S]*?#000/,
    reason: 'mask 渐变遮罩色——mask 空间语义是「不透明」，#000 是遮罩惯例写法，与主题色无关',
  },
  {
    file: 'code-block.css',
    pattern: /mask-image[\s\S]*?#000/,
    reason: 'mask 渐变遮罩色（折叠态底部渐隐）——同 scroll-area：mask 空间语义是「不透明」，与主题色无关',
  },
];

/** 字面量 z-index 豁免。--icen-z-* 是全局浮层 portal 标尺（base.css 定义），
 *  下列全部是组件局部层叠上下文内的元素压叠（滑块拇指/徽标/sticky 头等），
 *  套全局标尺反而污染浮层序（slider 拇指 z=620 于理不容）——属纪律未覆盖面，非违纪律本意。 */
const Z_INDEX_ALLOWLIST: Array<{ file: string; pattern: RegExp; reason: string }> = [
  { file: 'ai-panel.css', pattern: /\.(?:icen-)*ai-context-head\s*\{[\s\S]*?z-index:\s*1;/, reason: 'sticky 抽屉头压抽屉内容（局部上下文）' },
  { file: 'card.css', pattern: /\.(?:icen-)*card-badge\s*\{[\s\S]*?z-index:\s*1;/, reason: '卡片角标位压在卡片媒体之上' },
  { file: 'content.css', pattern: /\.(?:icen-)*timeline-dot\s*\{[\s\S]*?z-index:\s*1;/, reason: '时间线圆点压在线条之上' },
  { file: 'datatable.css', pattern: /\.(?:icen-)*dt-resize\s*\{[\s\S]*?z-index:\s*1;/, reason: '列宽拖拽手柄压单元格' },
  { file: 'kb-data.css', pattern: /\.(?:icen-)*kb-result-table th\s*\{[\s\S]*?z-index:\s*1;/, reason: 'sticky 表头压数据行' },
  { file: 'kb-ingest.css', pattern: /\.(?:icen-)*kb-pipeline-step > \.(?:icen-)*kb-dot\s*\{[\s\S]*?z-index:\s*1;/, reason: '管线节点圆点压在连接线上' },
  { file: 'kb-ops.css', pattern: /\.(?:icen-)*kb-review-keys\s*\{[\s\S]*?z-index:\s*2;/, reason: '键盘提示浮在评审卡内容之上' },
  { file: 'media.css', pattern: /\.(?:icen-)*carousel-arrow[\s\S]*?z-index:\s*2;/, reason: '轮播箭头压幻灯片' },
  { file: 'media.css', pattern: /\.(?:icen-)*carousel-dots\s*\{[\s\S]*?z-index:\s*2;/, reason: '轮播指示器压幻灯片' },
  { file: 'media.css', pattern: /\.(?:icen-)*carousel-index\s*\{[\s\S]*?z-index:\s*2;/, reason: '轮播序号角标压幻灯片' },
  { file: 'select.css', pattern: /\.(?:icen-)*select-search\s*\{[\s\S]*?z-index:\s*1;/, reason: 'sticky 搜索框压选项列表' },
  { file: 'select.css', pattern: /\.(?:icen-)*select-clear\s*\{[\s\S]*?z-index:\s*1;/, reason: '清除钮叠进 trigger 右侧（chevron 之左）' },
  { file: 'cascader.css', pattern: /\.(?:icen-)*cascader-search\s*\{[\s\S]*?z-index:\s*1;/, reason: 'sticky 搜索框压列区（与 select.css 同款）' },
  { file: 'cascader.css', pattern: /\.(?:icen-)*cascader-clear\s*\{[\s\S]*?z-index:\s*1;/, reason: '清除钮叠进 trigger 行内末端侧（与 select.css 同款）' },
  { file: 'tree-select.css', pattern: /\.(?:icen-)*tree-select-search\s*\{[\s\S]*?z-index:\s*1;/, reason: 'sticky 搜索框压树行（与 select.css 同款）' },
  { file: 'tree-select.css', pattern: /\.(?:icen-)*tree-select-clear\s*\{[\s\S]*?z-index:\s*1;/, reason: '清除钮叠进 trigger 行内末端侧（与 select.css 同款）' },
  { file: 'slider.css', pattern: /\.(?:icen-)*slider-native\s*\{[\s\S]*?z-index:\s*1;/, reason: '透明原生 input 压在轨道（可拖区）之上' },
  { file: 'slider.css', pattern: /\[data-(?:icen-)?thumb='hi'\]\s*\{\s*z-index:\s*2;\s*\}/, reason: '双滑块错层，避免两 input 互抢' },
  { file: 'slider.css', pattern: /\.(?:icen-)*slider-tooltip\s*\{[\s\S]*?z-index:\s*3;/, reason: '值气泡压滑块（同组件内三级层叠）' },
  { file: 'steps.css', pattern: /\.(?:icen-)*step-dot\s*\{[\s\S]*?z-index:\s*1;/, reason: '步骤圆点压在连接线上' },
];

/** @keyframes 白名单（文件 → 允许的动画名集合，名比较容忍可选 icen- 前缀）。
 *  纪律本意 = 共享动画在 base.css 复用；但 kit 一行入口只引组件 CSS（不引 base.css），
 *  组件专属动画必须与组件同文件，否则按需安装即坏。 */
const KEYFRAMES_REASON = '组件专属动画，须随组件 CSS 按需安装（kit 入口不引 base.css，共享 keyframes 模式不可行）';
const KEYFRAMES_ALLOWED_FILES = new Set(['base.css', 'retro-effects.css']);
const KEYFRAMES_ALLOWLIST: Record<string, { names: string[]; reason: string }> = {
  'colors.css': {
    names: ['blink'],
    reason: 'token 层通用动画工具 .animate-blink 的宿主（迁入 base.css 会破 tokens-only 消费方）',
  },
  'ai-chat.css': { names: ['ai-shimmer'], reason: KEYFRAMES_REASON },
  'ai-panel.css': { names: ['ai-status-pulse', 'ai-usage-ring-pulse', 'ai-todo-check-draw'], reason: KEYFRAMES_REASON },
  'ai-tool.css': { names: ['ai-item-pulse'], reason: KEYFRAMES_REASON },
  'command-palette.css': { names: ['icen-cp-fade-in', 'icen-cp-scale-in'], reason: KEYFRAMES_REASON },
  'datatable.css': { names: ['dt-editor-shake'], reason: `${KEYFRAMES_REASON}（数字编辑非法值抖动反馈）` },
  'feedback.css': { names: ['progress-sweep', 'progress-stripe', 'spinner-dot', 'spinner-bar', 'skeleton-shimmer'], reason: KEYFRAMES_REASON },
  'kb-ground.css': { names: ['kb-ground-card-in'], reason: KEYFRAMES_REASON },
  'kb-ops.css': { names: ['kb-ops-pulse'], reason: KEYFRAMES_REASON },
  'kb.css': { names: ['kb-pulse'], reason: KEYFRAMES_REASON },
  'media.css': { names: ['carousel-slide-fade'], reason: KEYFRAMES_REASON },
  'menu.css': { names: ['icen-menu-in', 'icen-menu-in-top', 'icen-menu-in-left', 'icen-menu-in-right'], reason: KEYFRAMES_REASON },
  'modal.css': {
    names: ['icen-modal-fade-in', 'icen-modal-scale-in', 'icen-modal-slide-left', 'icen-modal-slide-right', 'icen-modal-slide-top', 'icen-modal-slide-bottom'],
    reason: KEYFRAMES_REASON,
  },
  'notification.css': { names: ['icen-notif-countdown', 'icen-notif-in'], reason: KEYFRAMES_REASON },
  'panel.css': { names: ['panel-expand'], reason: KEYFRAMES_REASON },
  'pill.css': { names: ['pill-pulse'], reason: KEYFRAMES_REASON },
  'popover.css': { names: ['icen-popover-in', 'icen-popover-in-top', 'icen-popover-in-left', 'icen-popover-in-right'], reason: KEYFRAMES_REASON },
  'table.css': { names: ['row-expand-in'], reason: KEYFRAMES_REASON },
  'tag-input.css': { names: ['tag-pop', 'tag-shake'], reason: KEYFRAMES_REASON },
  'toast.css': { names: ['toast-countdown', 'icen-toast-in'], reason: KEYFRAMES_REASON },
  'upload.css': { names: ['upload-item-in'], reason: KEYFRAMES_REASON },
};

/** ::-webkit-scrollbar 白名单（纪律：全局细薄滚动条由 base.css 统一负责）。
 *  例外：retro 风格全局换肤（风格配置层职责）、scroll-area 组件本体、轮播缩略图隐藏。 */
const SCROLLBAR_ALLOWLIST: Record<string, string> = {
  'style-profiles.css': '.style-retro 全局滚动条换肤——风格配置层的本职，等同 token 定义',
  'scroll-area.css': '组件本体职责：--sm/--lg 变体就是卖定制滚动条尺寸的',
  'media.css': '轮播缩略图隐藏滚动条（display:none，无样式皮肤语义）',
};

/** !important 放行标记：同行或上一行出现该注释即视为已声明理由。 */
const IMPORTANT_MARKER = 'guard:allow-important';

/** 判断命中豁免清单（逐条比对，命中返回原因，未命中返回 null）。 */
function allowedBy(
  list: Array<{ file: string; pattern: RegExp; reason: string }>,
  file: string,
  context: string,
): string | null {
  for (const item of list) {
    if (item.file === file && item.pattern.test(context)) return item.reason;
  }
  return null;
}

/** keyframes 名比对：容忍可选 icen- 前缀（迁移前后同名）。 */
function keyframesNameAllowed(entry: { names: string[] } | undefined, name: string): boolean {
  if (!entry) return false;
  if (entry.names.includes(name)) return true;
  const stripped = name.replace(/^icen-/, '');
  return entry.names.some((n) => n === stripped || n === `icen-${stripped}`);
}

export async function checkCssDiscipline(): Promise<GuardResult> {
  const violations: string[] = [];
  const compFiles = await listFiles(join(SRC, 'components'), '.css');
  /* src/components/*.css + src/base.css；tokens/ 是定义层不在范围内。
     allowlist 一律以 basename 为键（Windows 路径分隔符不参与匹配） */
  const files = [...compFiles.map((f) => join('components', f)), 'base.css'];

  for (const rel of files) {
    const raw = await readFile(join(SRC, rel), 'utf8');
    const rawLines = raw.split('\n');
    const codeLines = stripComments(rawLines);
    const base = rel.split(/[\\/]/).pop() ?? rel;

    /* 规则 6：组件 CSS 必须以 /* 头注释开头（DOM 契约） */
    if (rel.startsWith('components') && !raw.trimStart().startsWith('/*')) {
      violations.push(`${rel}: 缺少 /* 头注释（DOM 契约，AGENTS.md 强制）`);
    }

    /* 该文件是否定义 --icen-z-* 标尺（定义文件豁免字面量 z-index 规则） */
    const definesZScale = codeLines.some((l) => /--(?:icen-)*z-[a-z]+:\s*-?\d/.test(l));

    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i];
      const lineNo = i + 1;
      if (!line.trim()) continue;
      /* 选择器上下文窗：当前行 + 往前 24 行纯代码（覆盖声明块头；迁移期选择器可能远离声明） */
      const context = codeLines.slice(Math.max(0, i - 24), i + 1).join('\n');

      /* 规则 1：禁止十六进制颜色（排除 ID 选择器形态 #xxx { / . / [ ） */
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const after = line.slice((m.index ?? 0) + m[0].length).trimStart();
        if (/^[{.[#:]/.test(after)) continue; /* ID/锚选择器，非颜色 */
        const reason = allowedBy(HEX_ALLOWLIST, base, line) ?? allowedBy(HEX_ALLOWLIST, base, context);
        if (!reason) {
          violations.push(`${rel}:${lineNo}: 十六进制颜色 ${m[0]}（组件只消费 --icen-token-*，hex 只允许出现在 src/tokens/）`);
        }
      }

      /* 规则 2：禁止字面量 z-index 数值（auto / var() 不受限） */
      if (!definesZScale) {
        for (const m of line.matchAll(/\bz-index\s*:\s*(-?\d+)\b/g)) {
          const reason = allowedBy(Z_INDEX_ALLOWLIST, base, context);
          if (!reason) {
            violations.push(`${rel}:${lineNo}: 字面量 z-index: ${m[1]}（浮层一律 var(--icen-z-*)；局部层叠请进 ALLOWLIST 注明原因）`);
          }
        }
      }

      /* 规则 3：@keyframes 白名单制 */
      for (const m of line.matchAll(/@keyframes\s+([a-zA-Z][\w-]*)/g)) {
        if (KEYFRAMES_ALLOWED_FILES.has(base)) continue;
        const entry = KEYFRAMES_ALLOWLIST[base];
        if (!entry || !keyframesNameAllowed(entry, m[1])) {
          violations.push(
            `${rel}:${lineNo}: @keyframes ${m[1]}（共享动画归 base.css；组件专属动画须登记进 KEYFRAMES_ALLOWLIST）`,
          );
        }
      }

      /* 规则 4：::-webkit-scrollbar 白名单制 */
      if (line.includes('::-webkit-scrollbar') && base !== 'base.css' && !SCROLLBAR_ALLOWLIST[base]) {
        violations.push(`${rel}:${lineNo}: ::-webkit-scrollbar（全局滚动条归 base.css；例外须登记进 SCROLLBAR_ALLOWLIST）`);
      }

      /* 规则 5：!important 需 guard:allow-important 注释（同行或上一行） */
      if (line.includes('!important')) {
        const annotated =
          rawLines[i].includes(IMPORTANT_MARKER) || (i > 0 && rawLines[i - 1].includes(IMPORTANT_MARKER));
        if (!annotated) {
          violations.push(`${rel}:${lineNo}: !important 缺少 ${IMPORTANT_MARKER} 注释（同行或上一行标注理由）`);
        }
      }

      /* 复合动效 token 已携带缓动；再次追加会使整条声明失效。 */
      if (/var\(--icen-tx-(?:fast|normal|slow)\)\s+var\(--icen-ease-/.test(line)) {
        violations.push(`${rel}:${lineNo}: 复合 tx token 不可重复追加缓动；需要单独缓动时使用 --icen-duration-*`);
      }

      /* 规则 7：圆角纪律（AGENTS.md「圆角几何契约」）
         - 999px 裸写禁（胶囊跑道形一律 var(--icen-radius-full)）
         - 撞档裸值 6/8/10/12/16px 禁（= xs/sm/md/lg/xl 档，必须消费 token，风格 profile 才能正交归零）
         - calc(var(--icen-radius-*) ± gap) 是同心圆法则的合法形态；50%（几何正圆）/0/inherit 合法
         - 其余裸 px（1–5px 微构件：bar/dot/track/handle 等图形级微件）须行尾 guard:allow-radius 理由 */
      for (const m of line.matchAll(/border-(?:[a-z-]*-)?radius\s*:\s*([^;]+);/g)) {
        const value = m[1];
        for (const tok of value.trim().split(/\s+/)) {
          if (/^var\(|^calc\(|^inherit$|^0(px)?$|^50%$/.test(tok)) continue;
          if (tok === '999px') {
            violations.push(`${rel}:${lineNo}: 裸 999px 胶囊圆角（胶囊一律 var(--icen-radius-full)，terminal/retro 归零才生效）`);
            continue;
          }
          const px = /^(\d+(?:\.\d+)?)px$/.exec(tok);
          if (!px) continue;
          const stepHit = { '6': 'xs', '8': 'sm', '10': 'md', '12': 'lg', '16': 'xl' }[px[1]];
          if (stepHit) {
            violations.push(`${rel}:${lineNo}: 撞档裸圆角 ${px[1]}px（= --icen-radius-${stepHit}，消费 token 风格 profile 才正交）`);
            continue;
          }
          const annotated =
            rawLines[i].includes('guard:allow-radius') || (i > 0 && rawLines[i - 1].includes('guard:allow-radius'));
          if (!annotated) {
            violations.push(`${rel}:${lineNo}: 裸圆角 ${px[0]}（微构件图形件须行尾 guard:allow-radius 理由 登记；容器/控件不允许）`);
          }
        }
      }
    }
  }

  /* 同一行同色重复命中去重（如一行两处 #c0392b） */
  const unique = [...new Set(violations)];
  return { title: 'CSS 纪律（hex / z-index / keyframes / 滚动条 / !important / 头注释）', violations: unique };
}
