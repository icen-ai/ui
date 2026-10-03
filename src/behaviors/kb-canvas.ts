/*
 * @icen.ai/ui — Behavior: kb-canvas（Agent 双栏工作台画布，与 components/kb-agent.css 配套）
 *
 * DOM 契约（createKbCanvas 构建，规格 docs/spec/kb-family.md §5.23）：
 *   <div class="kb-canvas" style="--kb-canvas-ratio: 0.42">
 *     <div class="kb-canvas-main">                    <!-- grid: 比例列 | 6px | 1fr -->
 *       <div class="kb-canvas-chat"></div>            <!-- 左：对话流（滚动容器，宿主节点 appendChild 挂入） -->
 *       <div class="kb-canvas-divider" role="separator" aria-orientation="vertical"
 *            tabindex="0" aria-valuemin="20" aria-valuemax="80" aria-valuenow="42"></div>
 *       <div class="kb-canvas-doc"></div>             <!-- 右：文档/diff（滚动容器） -->
 *     </div>
 *     <div class="kb-canvas-versions" hidden>         <!-- 底部版本时间轴（首个版本到达后展开） -->
 *       <button class="kb-canvas-ver [is-current]" data-version-id="v3">
 *         <i class="kb-canvas-ver-dot"></i>
 *         <span class="kb-canvas-ver-label">v3 · 批量改写</span>
 *         <span class="kb-canvas-ver-time kb-num">14 分钟前</span>
 *       </button>…
 *     </div>
 *     <div class="kb-canvas-selbar" hidden>           <!-- 划词工具条（绝对定位于选区上方） -->
 *       <button class="kb-canvas-selbar-btn" data-instruction="改写">改写</button>…
 *     </div>
 *   </div>
 *
 * 交互：
 *   - 比例拖拽：pointer 拖 .kb-canvas-divider，rAF 批量更新 --kb-canvas-ratio
 *     （范围 [minRatio, 1-minRatio]，默认初值 0.42 / minRatio 0.2；自实现，不依赖 split-pane）；
 *     ←/→ 键盘 ±0.02，Home/End 极值，双击复位 0.42（split-pane 心智）
 *   - 版本时间轴：click → icen:kb-canvas-version {versionId}；addVersion({current:true}) 抢占高亮
 *   - 划词工具条：setSelectionTools 注入工具后，onIcen('icen:text-select', {within}) 主通道
 *     （宿主 data-gestures="text-select" + initGestures）+ 原生 mouseup/Selection 兜底（宿主未启
 *     手势）；选中文本非空 → 浮 .kb-canvas-selbar（getBoundingClientRect 定位 + 宿主矩形夹取），
 *     1.5s 无操作（未 hover）或选区清空即消失；工具点击 → icen:kb-canvas-ai
 *     {instruction, selection:{text}}
 *   - addDiff(files)：ai-diff 复用（宿主传入 parseUnifiedDiff 产物），追加渲染到右栏
 *
 * SSR 安全（无 document 时句柄全 no-op）；destroy 摘全部监听/定时器并清空注入结构。
 */

import { h } from './kb-core';
import type { KbCanvasVersion } from './kb-core';
import { relativeTime } from './kb-core';
import { renderAiDiff } from './ai-diff';
import { emitIcen, onIcen } from './events';

export interface KbCanvasOptions {
  /** 左栏最小占比（同时约束右栏 1-minRatio）；默认 0.2，钳制到 [0.05, 0.5] */
  minRatio?: number;
  /** icen:kb-canvas-ai 的 handle 通道（与事件双轨） */
  onAI?: (detail: { instruction: string; selection?: { text: string } }) => void;
  /** icen:kb-canvas-version 的 handle 通道（与事件双轨） */
  onVersion?: (detail: { versionId: string }) => void;
}

export interface KbCanvasSelectionTool {
  label: string;
  instruction: string;
}

export interface KbCanvasHandle {
  /** 挂左栏（对话流）：Node 经 appendChild 接收（宿主保留所有权）；字符串按纯文本写入 */
  setChat: (content?: Node | string | null) => void;
  /** 挂右栏（文档）：同 setChat 语义 */
  setDoc: (content?: Node | string | null) => void;
  /** 右栏追加内联 diff（宿主传入已解析的 AiDiffFile[]，渲染复用 ai-diff） */
  addDiff: (files: Parameters<typeof renderAiDiff>[1]['files']) => void;
  /** 版本时间轴追加节点；current=true 时抢占高亮（其余去 current） */
  addVersion: (v: KbCanvasVersion) => void;
  /** 注入划词工具条工具（label + instruction）；空数组 = 关闭划词功能 */
  setSelectionTools: (tools: KbCanvasSelectionTool[]) => void;
  /** 摘监听/定时器并清空注入结构；可重复调用 */
  destroy: () => void;
}

const DEFAULT_RATIO = 0.42;
const SELBAR_HIDE_MS = 1500;

function clampNum(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function mountContent(target: HTMLElement, content?: Node | string | null): void {
  target.textContent = '';
  if (content == null) return;
  if (typeof content === 'string') target.textContent = content; /* 纯文本，禁 innerHTML */
  else target.appendChild(content);
}

/**
 * 创建双栏工作台画布句柄：左对话/右文档 + 比例拖拽 + 内联 diff 挂载 + 版本时间轴 +
 * 划词 AI 工具条。事件：icen:kb-canvas-ai / icen:kb-canvas-version（均自画布根冒泡）。
 */
export function createKbCanvas(el: HTMLElement, opts: KbCanvasOptions = {}): KbCanvasHandle {
  const stub: KbCanvasHandle = {
    setChat: () => undefined,
    setDoc: () => undefined,
    addDiff: () => undefined,
    addVersion: () => undefined,
    setSelectionTools: () => undefined,
    destroy: () => undefined,
  };
  if (typeof document === 'undefined' || !el) return stub; /* SSR：no-op 句柄 */

  /* 同元素重复 create：先销毁旧实例并清空挂载点，杜绝整树翻倍与旧监听泄漏 */
  const canvasHost = el as HTMLElement & { __icenKbCanvas?: { destroy(): void } };
  canvasHost.__icenKbCanvas?.destroy();
  el.textContent = '';

  const minR = clampNum(opts.minRatio, 0.2, 0.05, 0.5);
  const maxR = 1 - minR;
  let ratio = clampNum(DEFAULT_RATIO, DEFAULT_RATIO, minR, maxR);

  el.classList.add('kb-canvas');

  /* ── 结构 ── */
  const main = h('div', 'kb-canvas-main');
  const chat = h('div', 'kb-canvas-chat');
  const divider = h('div', 'kb-canvas-divider');
  const doc = h('div', 'kb-canvas-doc');
  main.append(chat, divider, doc);

  const versions = h('div', 'kb-canvas-versions');
  versions.hidden = true;

  const selbar = h('div', 'kb-canvas-selbar');
  selbar.hidden = true;

  el.append(main, versions, selbar);

  const ac = new AbortController();
  const { signal } = ac;
  let destroyed = false;
  let tools: KbCanvasSelectionTool[] = [];
  let selText = '';

  /* ── 比例拖拽（rAF 批处理；touch-action:none 由 CSS 提供） ── */
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'vertical');
  divider.setAttribute('aria-label', '调整画布双栏比例');
  divider.tabIndex = 0;
  divider.title = '拖拽调整比例（←/→ 微调，双击复位）';

  const applyRatio = (r: number): void => {
    ratio = Math.min(maxR, Math.max(minR, r));
    el.style.setProperty('--kb-canvas-ratio', String(Math.round(ratio * 10000) / 10000));
    divider.setAttribute('aria-valuemin', String(Math.round(minR * 1000) / 10));
    divider.setAttribute('aria-valuemax', String(Math.round(maxR * 1000) / 10));
    divider.setAttribute('aria-valuenow', String(Math.round(ratio * 1000) / 10));
  };
  applyRatio(ratio);

  let dragging = false;
  let dragStartX = 0;
  let dragStartRatio = ratio;
  let dragWidth = 1;
  let rafId = 0;
  let pendingRatio: number | null = null;

  const flushRatio = (): void => {
    rafId = 0;
    if (pendingRatio != null) {
      applyRatio(pendingRatio);
      pendingRatio = null;
    }
  };
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (pendingRatio != null) {
      applyRatio(pendingRatio);
      pendingRatio = null;
    }
    divider.classList.remove('is-active');
    el.classList.remove('is-dragging');
    try {
      divider.releasePointerCapture(e.pointerId);
    } catch {
      /* 指针已被释放：无操作 */
    }
  };

  divider.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartRatio = ratio;
    dragWidth = main.clientWidth || 1;
    divider.setPointerCapture(e.pointerId);
    divider.classList.add('is-active');
    el.classList.add('is-dragging'); /* CSS：拖拽中禁文本选择，避免划词误触 */
    e.preventDefault();
  });
  divider.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (!dragging) return;
      pendingRatio = dragStartRatio + (e.clientX - dragStartX) / dragWidth;
      if (!rafId) rafId = requestAnimationFrame(flushRatio);
    },
    { passive: true, signal },
  );
  divider.addEventListener('pointerup', endDrag, { passive: true, signal });
  divider.addEventListener('pointercancel', endDrag, { passive: true, signal });
  divider.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      let next: number | null = null;
      if (e.key === 'ArrowLeft') next = ratio - 0.02;
      else if (e.key === 'ArrowRight') next = ratio + 0.02;
      else if (e.key === 'Home') next = minR;
      else if (e.key === 'End') next = maxR;
      if (next == null) return;
      e.preventDefault();
      applyRatio(next);
    },
    { signal },
  );
  divider.addEventListener('dblclick', () => applyRatio(DEFAULT_RATIO), { signal });

  /* ── 版本时间轴 ── */
  versions.addEventListener(
    'click',
    (e: Event) => {
      const t = e.target instanceof Element ? e.target : null;
      const ver = t?.closest<HTMLElement>('.kb-canvas-ver');
      if (!ver) return;
      const versionId = ver.dataset.versionId ?? '';
      if (!versionId) return;
      emitIcen(ver, 'icen:kb-canvas-version', { versionId });
      opts.onVersion?.({ versionId });
    },
    { signal },
  );

  /* ── 划词工具条 ── */
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let selbarHovered = false;

  const hideSelbar = (): void => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    selbarHovered = false;
    selbar.hidden = true;
  };
  const armHide = (): void => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = selbarHovered
      ? null
      : setTimeout(() => {
          hideTimer = null;
          hideSelbar();
        }, SELBAR_HIDE_MS);
  };

  const selectionWithinHost = (): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    const node = sel.anchorNode;
    return node != null && el.contains(node);
  };

  /** 幂等展示：以选区 rect 定位（上方优先，越界翻下方）+ 宿主矩形夹取，重置 1.5s 自动隐藏 */
  const showSelbar = (text: string): void => {
    if (destroyed || !tools.length) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      hideSelbar();
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideSelbar();
      return;
    }
    selText = text;
    selbar.hidden = false;
    const bw = selbar.offsetWidth || 0;
    const bh = selbar.offsetHeight || 0;
    const host = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - bw / 2 - host.left;
    let top = rect.top - bh - 8 - host.top;
    left = Math.max(4, Math.min(left, host.width - bw - 4));
    if (top < 4) top = rect.bottom - host.top + 8; /* 顶部放不下 → 选区下方 */
    selbar.style.left = `${Math.round(left)}px`;
    selbar.style.top = `${Math.round(top)}px`;
    armHide();
  };

  /* 主通道：宿主 data-gestures="text-select"（+ initGestures）时经手势层派发 */
  onIcen(
    'icen:text-select',
    (e) => {
      if (destroyed) return;
      const text = e.detail.text ?? '';
      if (text.trim()) showSelbar(text);
    },
    { within: el, signal },
  );
  /* 兜底：宿主未启手势层时直接看原生 Selection（与主通道幂等，重复触发无害） */
  document.addEventListener(
    'mouseup',
    () => {
      if (destroyed) return;
      const sel = window.getSelection();
      const text = sel?.toString() ?? '';
      if (!sel || !text.trim() || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
      showSelbar(text);
    },
    { passive: true, signal },
  );
  document.addEventListener(
    'selectionchange',
    () => {
      if (selbar.hidden) return;
      if (!selectionWithinHost()) hideSelbar(); /* 选区清空/移出画布 → 立即消失 */
    },
    { passive: true, signal },
  );

  selbar.addEventListener('pointerenter', () => {
    selbarHovered = true;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });
  selbar.addEventListener('pointerleave', () => {
    selbarHovered = false;
    armHide();
  });
  /* mousedown 阻断默认行为：点击工具时保住选区（click 前不丢 selection） */
  selbar.addEventListener('mousedown', (e) => e.preventDefault());
  selbar.addEventListener(
    'click',
    (e: Event) => {
      const t = e.target instanceof Element ? e.target : null;
      const btn = t?.closest<HTMLButtonElement>('.kb-canvas-selbar-btn');
      if (!btn) return;
      const instruction = btn.dataset.instruction ?? '';
      if (!instruction) return;
      const detail = { instruction, selection: { text: selText } };
      emitIcen(el, 'icen:kb-canvas-ai', detail);
      opts.onAI?.(detail);
      hideSelbar();
    },
    { signal },
  );

  const rebuildSelbar = (): void => {
    selbar.textContent = '';
    for (const tool of tools) {
      const btn = h('button', 'kb-canvas-selbar-btn');
      btn.type = 'button';
      btn.textContent = tool.label;
      btn.dataset.instruction = tool.instruction;
      selbar.appendChild(btn);
    }
    if (selbar.hidden) return;
    if (!tools.length) hideSelbar();
    else armHide();
  };

  /* ── 句柄 ── */
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    ac.abort();
    if (hideTimer) clearTimeout(hideTimer);
    if (rafId) cancelAnimationFrame(rafId);
    hideTimer = null;
    rafId = 0;
    el.classList.remove('kb-canvas', 'is-dragging');
    el.style.removeProperty('--kb-canvas-ratio');
    el.textContent = '';
  };

  const handle: KbCanvasHandle = {
    setChat: (content) => {
      if (!destroyed) mountContent(chat, content);
    },
    setDoc: (content) => {
      if (!destroyed) mountContent(doc, content);
    },
    addDiff: (files) => {
      if (destroyed) return;
      const wrap = h('div', 'kb-canvas-diff');
      renderAiDiff(wrap, { files });
      doc.appendChild(wrap);
    },
    addVersion: (v) => {
      if (destroyed || !v || !v.id) return;
      const ver = h('button', 'kb-canvas-ver');
      ver.type = 'button';
      ver.dataset.versionId = String(v.id);
      if (v.current === true) {
        for (const prev of Array.from(versions.querySelectorAll('.kb-canvas-ver.is-current'))) {
          prev.classList.remove('is-current');
        }
        ver.classList.add('is-current');
      }
      const dot = h('i', 'kb-canvas-ver-dot');
      dot.setAttribute('aria-hidden', 'true');
      ver.appendChild(dot);
      ver.appendChild(h('span', 'kb-canvas-ver-label', v.label ?? String(v.id)));
      ver.appendChild(h('span', 'kb-canvas-ver-time kb-num', relativeTime(v.at)));
      versions.appendChild(ver);
      versions.hidden = false;
    },
    setSelectionTools: (list) => {
      if (destroyed) return;
      tools = Array.isArray(list)
        ? list.filter((t) => t && typeof t.label === 'string' && typeof t.instruction === 'string')
        : [];
      rebuildSelbar();
    },
    destroy,
  };
  /* 登记句柄：下一次同元素装配的入口销毁依赖它 */
  canvasHost.__icenKbCanvas = handle;
  return handle;
}
