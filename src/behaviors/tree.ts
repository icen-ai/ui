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
 * - 点击叶子 .tree-node：单选——同树内其余节点移除 .is-selected，当前节点挂上，
 *   派发 icen:tree-select { node }（node 为 .tree-node 元素）；
 * - 展开/折叠两条路径（点击 toggle 与键盘 ←/→）在切换 hidden/aria-expanded 后派发
 *   icen:tree-toggle { node, open }（node 为 .tree-node 所在的 li 元素）。
 *   .is-disabled 节点不响应。同一棵树重复 init 幂等；initTree 返回销毁函数
 *   （移除容器监听并复位幂等标记，可重新 init）。SSR 下返回 no-op。
 */

import { emitIcen } from './events';

interface MarkedElement extends Element {
  __icenTreeInit?: boolean;
}

function setup(tree: Element): (() => void) | undefined {
  const el = tree as MarkedElement;
  if (el.__icenTreeInit) return undefined;
  el.__icenTreeInit = true;

  /* 让 tree-node 可被键盘聚焦（roving tabindex 模式：tabindex=0） */
  tree.querySelectorAll<HTMLElement>('.tree-node').forEach((node) => {
    if (!node.hasAttribute('tabindex')) node.tabIndex = 0;
  });

  const onClick = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof Element)) return;

    // 只处理属于本树的节点（嵌套 .tree 各自 init）
    const node = target.closest<HTMLElement>('.tree-node');
    if (!node || node.closest('.tree') !== tree) return;
    if (node.classList.contains('is-disabled')) return;

    const li = node.closest<HTMLElement>('li');
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
      emitIcen(tree, 'icen:tree-toggle', { node: li, open: !collapsed });
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
  };

  /* 键盘 ↑/↓/←/→ 导航（仅叶子节点参与） */
  const onKeyDown = (ev: Event): void => {
    const kev = ev as KeyboardEvent;
    const target = kev.target;
    if (!(target instanceof Element)) return;
    const node = target.closest<HTMLElement>('.tree-node');
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
        const li = node.closest<HTMLElement>('li');
        const childUl = li?.querySelector(':scope > ul');
        if (childUl?.hasAttribute('hidden')) {
          kev.preventDefault();
          childUl.removeAttribute('hidden');
          node.querySelector('.tree-toggle')?.setAttribute('aria-expanded', 'true');
          node.querySelector('.tree-toggle')?.classList.remove('is-collapsed');
          if (li) emitIcen(tree, 'icen:tree-toggle', { node: li, open: true });
        }
        break;
      }
      case 'ArrowLeft': {
        const li = node.closest<HTMLElement>('li');
        const childUl = li?.querySelector(':scope > ul');
        if (childUl && !childUl.hasAttribute('hidden')) {
          kev.preventDefault();
          childUl.setAttribute('hidden', '');
          node.querySelector('.tree-toggle')?.setAttribute('aria-expanded', 'false');
          node.querySelector('.tree-toggle')?.classList.add('is-collapsed');
          if (li) emitIcen(tree, 'icen:tree-toggle', { node: li, open: false });
        }
        break;
      }
    }
  };

  tree.addEventListener('click', onClick);
  tree.addEventListener('keydown', onKeyDown);

  /* 销毁：移除容器监听并复位幂等标记（可重新 init） */
  return () => {
    tree.removeEventListener('click', onClick);
    tree.removeEventListener('keydown', onKeyDown);
    el.__icenTreeInit = false;
  };
}

/**
 * 为 root 下每棵 .tree 初始化（root 自身是 .tree 也算）。
 * 返回销毁函数：移除本次挂上的容器监听并复位幂等标记（销毁后可重新 init）。SSR 下返回 no-op。
 */
export function initTree(root?: ParentNode): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof document !== 'undefined') {
    const scope = root ?? document;
    const trees: Element[] = [];
    if (scope instanceof Element && scope.matches('.tree')) trees.push(scope);
    trees.push(...Array.from(scope.querySelectorAll('.tree')));
    for (const t of trees) {
      const cleanup = setup(t);
      if (cleanup) cleanups.push(cleanup);
    }
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
