/*
 * @icen.ai/ui — Behavior: kb-sandbox（MCP App 沙箱工具容器：隔离 iframe + postMessage
 * JSON-RPC 2.0 双向桥，与 components/kb-agent.css 配套；规格 docs/spec/kb-family.md §5.25）
 *
 * DOM 契约（createKbSandbox 构建）：
 *   <div class="kb-sandbox" data-state="idle|loading|ready|error">
 *     <div class="kb-sandbox-stage">
 *       <iframe class="kb-sandbox-frame" sandbox="allow-scripts" title="…"></iframe>
 *       <div class="kb-sandbox-loading"><i class="kb-sandbox-spin"></i></div>
 *       <div class="kb-sandbox-err"><span class="kb-sandbox-err-msg">宿主未提供 ui:// 解析器</span></div>
 *     </div>
 *   </div>
 *
 * 安全模型：
 *   - iframe sandbox="allow-scripts"（绝不加 allow-same-origin：子帧拿不到宿主源与存储）
 *   - 出站 postMessage target 用 '*'（沙箱帧 origin 为 'null'，无从窄化），入站双闸：
 *     event.source === iframe.contentWindow（只信自家帧）+ allowedOrigins 白名单（可选，
 *     沙箱帧恒为 'null'，需要更严的宿主传 ['null']）
 *
 * ── 子帧内约定脚本协议（给 MCP App 开发者的最小 bootstrap）──
 *   消息信封一律 JSON-RPC 2.0（kb-core KbSandboxMessage）：
 *     请求（宿主→应用）  { jsonrpc:'2.0', id: 1, method: 'app.callServerTool', params: {…} }
 *     响应（应用→宿主）  { jsonrpc:'2.0', id: 1, result: {…} } 或 { …, error: { code, message } }
 *     通知（无 id）      应用就绪 { jsonrpc:'2.0', method: 'app.ready' }；
 *                        应用→宿主的其他 method 通知（如 'app.updateModelContext'）原样
 *                        走 icen:kb-sandbox-message {channel:'in'} 交给宿主处置
 *   最小 bootstrap（放入沙箱 HTML）：
 *     <script>
 *       window.addEventListener('message', (e) => {
 *         const m = e.data;
 *         if (!m || m.jsonrpc !== '2.0' || m.method == null) return;
 *         // 按 m.method 分发；计算完成后必须回传同一 id：
 *         e.source.postMessage({ jsonrpc: '2.0', id: m.id, result: { ok: true } }, '*');
 *       });
 *       parent.postMessage({ jsonrpc: '2.0', method: 'app.ready' }, '*');
 *     </script>
 *   宿主侧：createKbSandbox(el, {…}).call('app.callServerTool', args) → Promise<result>；
 *   调用默认 8000ms 超时（timeoutMs 可调）；全部出入站信封以
 *   icen:kb-sandbox-message {channel:'in'|'out', payload} 事件 + opts.onMessage 双通道可观测。
 *
 * load 的三种来源：
 *   'ui://xxx'        声明式资源：opts.resolve?.(uri) 提供 html 字符串（可异步）；无 resolve
 *                     或解析拒绝 → 错误态「宿主未提供 ui:// 解析器 / 解析失败」
 *   opts.srcDoc 或含 '<'（疑似 html 片段） → iframe.srcdoc（受控赋值）
 *   其余（http(s) 等 URL）→ iframe.src
 *
 * destroy：摘全部监听、reject 全部 pending（'destroyed'）、移除 iframe；SSR 安全（句柄全 no-op）。
 */

import { h } from './kb-core';
import type { KbSandboxMessage } from './kb-core';
import { emitIcen } from './events';

export interface KbSandboxOptions {
  /** 通信观测双通道（与 icen:kb-sandbox-message 事件同 payload） */
  onMessage?: (msg: { channel: 'in' | 'out'; payload: KbSandboxMessage }) => void;
  /** 入站 origin 白名单（不传 = 只校验 event.source；沙箱帧 origin 恒为 'null'） */
  allowedOrigins?: string[];
  /** 单次 call() 超时（默认 8000ms） */
  timeoutMs?: number;
  /** 'ui://' 声明式资源解析器：返回 html 字符串（同步或 Promise）；null/undefined/抛错 = 拒绝 */
  resolve?: (uri: string) => string | null | Promise<string | null>;
}

export interface KbSandboxHandle {
  /** 载入应用：'ui://' 声明式资源 / html 片段 / URL（opts.srcDoc 强制按 html 处理） */
  load: (uriOrHtml: string, opts?: { srcDoc?: boolean }) => void;
  /** 调用子帧方法（JSON-RPC 请求→响应）；超时 / destroy / 重载时 reject */
  call: (name: string, args?: unknown) => Promise<unknown>;
  /** 摘监听、清 pending、移除 iframe；可重复调用 */
  destroy: () => void;
}

const DEFAULT_TIMEOUT_MS = 8000;

type SandboxState = 'idle' | 'loading' | 'ready' | 'error';

interface Pending {
  resolve: (v: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** 入站结构校验：jsonrpc 2.0 信封 + （有 method = 请求/通知）或（有 id 且带 result/error = 响应） */
function isSandboxMessage(data: unknown): data is KbSandboxMessage {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  if (m.jsonrpc !== '2.0') return false;
  if (typeof m.method === 'string') return true;
  if (m.id !== undefined && m.id !== null && ('result' in m || 'error' in m)) return true;
  return false;
}

/**
 * 创建 MCP App 沙箱容器：iframe sandbox="allow-scripts" + JSON-RPC 2.0 双向桥。
 * 三态样式（idle/loading/ready/error）由 data-state 驱动（纯 CSS，见 kb-agent.css）。
 */
export function createKbSandbox(el: HTMLElement, opts: KbSandboxOptions = {}): KbSandboxHandle {
  const stub: KbSandboxHandle = { load: () => undefined, call: () => Promise.reject(new Error('kb-sandbox: SSR')), destroy: () => undefined };
  if (typeof document === 'undefined' || !el) return stub; /* SSR：no-op 句柄 */

  const timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const allowedOrigins = Array.isArray(opts.allowedOrigins) ? opts.allowedOrigins.filter((o) => typeof o === 'string') : null;

  el.classList.add('kb-sandbox');
  el.dataset.state = 'idle';

  const stage = h('div', 'kb-sandbox-stage');
  const frame = document.createElement('iframe');
  frame.className = 'kb-sandbox-frame';
  frame.setAttribute('sandbox', 'allow-scripts'); /* 严禁 allow-same-origin */
  frame.title = 'MCP App 沙箱';
  const loading = h('div', 'kb-sandbox-loading');
  loading.appendChild(h('i', 'kb-sandbox-spin'));
  const err = h('div', 'kb-sandbox-err');
  const errMsg = h('span', 'kb-sandbox-err-msg');
  err.appendChild(errMsg);
  stage.append(frame, loading, err);
  el.textContent = '';
  el.appendChild(stage);

  const ac = new AbortController();
  const { signal } = ac;
  const pending = new Map<string | number, Pending>();
  let seq = 0;
  let loadSeq = 0; /* 异步 resolve 竞态令牌：仅最新一次 load 的回调可生效 */
  let destroyed = false;
  let state: SandboxState = 'idle';

  const setState = (s: SandboxState): void => {
    state = s;
    el.dataset.state = s;
  };

  const notify = (channel: 'in' | 'out', payload: KbSandboxMessage): void => {
    emitIcen(el, 'icen:kb-sandbox-message', { channel, payload });
    opts.onMessage?.({ channel, payload });
  };

  const showError = (message: string): void => {
    errMsg.textContent = message;
    setState('error');
  };

  const failPending = (message: string): void => {
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error(`kb-sandbox: ${message}`));
    }
    pending.clear();
  };

  /* 入站：source 闸 + 可选 origin 白名单 + 结构校验 → 事件/onMessage 双通道 + pending 路由 */
  const onWindowMessage = (e: MessageEvent): void => {
    if (destroyed || e.source !== frame.contentWindow) return;
    if (allowedOrigins && !allowedOrigins.includes(e.origin)) return;
    const payload = e.data;
    if (!isSandboxMessage(payload)) return;
    notify('in', payload);

    if (payload.method === 'app.ready') {
      setState('ready');
      return;
    }
    if (payload.id != null && ('result' in payload || 'error' in payload)) {
      const p = pending.get(payload.id);
      if (!p) return;
      pending.delete(payload.id);
      clearTimeout(p.timer);
      if (payload.error) p.reject(new Error(`kb-sandbox: ${payload.error.message}`));
      else p.resolve(payload.result);
    }
  };
  window.addEventListener('message', onWindowMessage, { signal });

  /* 普通页面（无 app.ready 约定）load 事件即视为就绪；srcdoc 应用 ready 常早于 load，取先到者 */
  frame.addEventListener(
    'load',
    () => {
      if (!destroyed && state === 'loading') setState('ready');
    },
    { signal },
  );

  const mountSrcdoc = (html: string): void => {
    /* iframe srcdoc 属受控赋值（非 innerHTML 渲染路径），库规允许 */
    frame.removeAttribute('src');
    frame.srcdoc = html;
    setState('loading');
  };

  const load = (uriOrHtml: string, loadOpts?: { srcDoc?: boolean }): void => {
    if (destroyed) return;
    const s = String(uriOrHtml ?? '');
    failPending('reloaded'); /* 换应用：旧调用一律作废 */
    errMsg.textContent = '';
    const mySeq = ++loadSeq;

    if (s.startsWith('ui://')) {
      if (typeof opts.resolve !== 'function') {
        showError('宿主未提供 ui:// 解析器');
        return;
      }
      let resolved: string | null | Promise<string | null>;
      try {
        resolved = opts.resolve(s);
      } catch (e) {
        showError(`ui:// 解析失败：${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      if (resolved != null && typeof (resolved as Promise<string | null>).then === 'function') {
        setState('loading');
        (resolved as Promise<string | null>).then(
          (html) => {
            if (destroyed || mySeq !== loadSeq) return; /* 已被更新的 load 取代 */
            if (typeof html === 'string' && html) mountSrcdoc(html);
            else showError('宿主未提供 ui:// 解析器');
          },
          (e: unknown) => {
            if (destroyed || mySeq !== loadSeq) return;
            showError(`ui:// 解析失败：${e instanceof Error ? e.message : String(e)}`);
          },
        );
        return;
      }
      if (typeof resolved === 'string' && resolved) {
        mountSrcdoc(resolved);
        return;
      }
      showError('宿主未提供 ui:// 解析器');
      return;
    }

    if (loadOpts?.srcDoc || s.includes('<')) mountSrcdoc(s);
    else {
      frame.removeAttribute('srcdoc');
      setState('loading');
      frame.src = s;
    }
  };

  const call = (name: string, args?: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (destroyed) {
        reject(new Error('kb-sandbox: destroyed'));
        return;
      }
      if (state === 'idle' || state === 'error' || !frame.contentWindow) {
        reject(new Error('kb-sandbox: 应用未就绪'));
        return;
      }
      const id = ++seq;
      const payload: KbSandboxMessage = { jsonrpc: '2.0', id, method: name, params: args };
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`kb-sandbox: 调用超时（${timeoutMs}ms）`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      frame.contentWindow.postMessage(payload, '*'); /* 沙箱帧 origin 为 'null'，target 只能 '*' */
      notify('out', payload);
    });

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    ac.abort();
    failPending('destroyed');
    frame.remove();
    el.classList.remove('kb-sandbox');
    delete el.dataset.state;
    el.textContent = '';
  };

  return { load, call, destroy };
}
