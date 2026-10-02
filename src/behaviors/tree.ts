/*
 * @icen.ai/ui — Behavior: tree（树形，与 components/content.css 的 .tree 配套）
 *
 * DOM 契约：
 *   <ul class="tree">
 *     <li>
 *       <div class="tree-node" style="--depth:0">
 *         <button class="tree-toggle" aria-expanded="true" aria-label="折叠/展开"><svg>…</svg></button>
 *         <span class="tree-label">父节点</span>
 *       </div>
 *       <ul>…子节点…</ul>          <!-- 分支节点才有；叶子省略，toggle 用空 span 占位 -->
 *     </li>
 *   </ul>
 *
 * 交互：
 * - 点击 .tree-toggle：切换紧邻子 ul 的 hidden + toggle 挂 .is-collapsed（chevron 转 -90°）；
 * - 点击叶子 .tree-node：单选——同树内其余节点移除 .is-selected，当前节点挂上。
 *   .is-disabled 节点不响应。同一棵树重复 init 幂等。SSR 下为 no-op。
 */

import { emitIcen } from './events';

interface MarkedElement extends Element {
  __icenTreeInit?: boolean;
}

function setup(tree: Element): void {
  const el = tree as MarkedElement;
  if (el.__icenTreeInit) return;
  el.__icenTreeInit = true;

  /* 让 tree-node 可被键盘聚焦（roving tabindex 模式：tabindex=0） */
  tree.querySelectorAll<HTMLElement>('.tree-node').forEach((node) => {
    if (!node.hasAttribute('tabindex')) node.tabIndex = 0;
  });

  tree.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;

    // 只处理属于本树的节点（嵌套 .tree 各自 init）
    const node = target.closest('.tree-node');
    if (!node || node.closest('.tree') !== tree) return;
    if (node.classList.contains('is-disabled')) return;

    const li = node.closest('li');
    if (!li) return;
    const childUl = li.querySelector(':scope > ul');

    // 1) 点在 toggle 上：折叠/展开分支（叶子 toggle 是占位空壳，无子 ul 时不动作）
    if (target.closest('.tree-toggle')) {
      if (!childUl) return;
      const toggle = node.querySelector('.tree-toggle');
      const collapsed = childUl.hasAttribute('hidden');
      if (collapsed) {
        childUl.removeAttribute('hidden');
        toggle?.classList.remove('is-collapsed');
        toggle?.setAttribute('aria-expanded', 'true');
      } else {
        childUl.setAttribute('hidden', '');
        toggle?.classList.add('is-collapsed');
        toggle?.setAttribute('aria-expanded', 'false');
      }
      return;
    }

    // 2) 点在节点其余位置：仅叶子参与单选
    if (childUl) return;
    tree.querySelectorAll('.tree-node.is-selected, .tree-node[aria-selected="true"]')
      .forEach((n) => {
        n.classList.remove('is-selected');
        n.removeAttribute('aria-selected');
      });
    node.classList.add('is-selected');
    node.setAttribute('aria-selected', 'true');
    emitIcen(tree, 'icen:tree-select', { node });
  });

  /* 键盘 ↑/↓/←/→ 导航（仅叶子节点参与） */
  tree.addEventListener('keydown', (ev: Event) => {
    const kev = ev as KeyboardEvent;
    const target = kev.target;
    if (!(target instanceof Element)) return;
    const node = target.closest('.tree-node');
    if (!node || node.closest('.tree') !== tree) return;
    if (node.classList.contains('is-disabled')) return;

    const allNodes = Array.from(tree.querySelectorAll<HTMLElement>('.tree-node:not(.is-disabled)'));
    const idx = allNodes.indexOf(node as HTMLElement);
    if (idx === -1) return;

    switch (kev.key) {
      case 'ArrowDown': {
        kev.preventDefault();
        allNodes[(idx + 1) % allNodes.length]?.focus();
        break;
      }
      case 'ArrowUp': {
        kev.preventDefault();
        allNodes[(idx - 1 + allNodes.length) % allNodes.length]?.focus();
        break;
      }
      case 'ArrowRight': {
        const li = node.closest('li');
        const childUl = li?.querySelector(':scope > ul');
        if (childUl?.hasAttribute('hidden')) {
          kev.preventDefault();
          childUl.removeAttribute('hidden');
          node.querySelector('.tree-toggle')?.setAttribute('aria-expanded', 'true');
          node.querySelector('.tree-toggle')?.classList.remove('is-collapsed');
        }
        break;
      }
      case 'ArrowLeft': {
        const li = node.closest('li');
        const childUl = li?.querySelector(':scope > ul');
        if (childUl && !childUl.hasAttribute('hidden')) {
          kev.preventDefault();
          childUl.setAttribute('hidden', '');
          node.querySelector('.tree-toggle')?.setAttribute('aria-expanded', 'false');
          node.querySelector('.tree-toggle')?.classList.add('is-collapsed');
        }
        break;
      }
    }
  });
}

/** 为 root 下每棵 .tree 初始化（root 自身是 .tree 也算）。 */
export function initTree(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;
  const trees: Element[] = [];
  if (scope instanceof Element && scope.matches('.tree')) trees.push(scope);
  trees.push(...Array.from(scope.querySelectorAll('.tree')));
  for (const t of trees) setup(t);
}
