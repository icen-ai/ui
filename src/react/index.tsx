/*
 * @icen.ai/ui — React 薄封装层（@icen.ai/ui/react）
 *
 * 设计哲学：薄如蝉翼——不复制状态、不重新实现组件逻辑，只做三件事：
 *   1. 生命周期接线：mount → create / props 变 → update（缺省 destroy+重建）/ unmount → destroy
 *   2. 事件桥：onIcen ↔ 回调 + AbortController 清理
 *   3. 类型面 re-export（底下仍是同一个命令式内核）
 *
 * SSR 天然安全：全部接线在 useEffect 里，服务端不执行。
 * CSS 不在本层引入——消费方照常引 tokens.css + 组件 CSS（@icen.ai/ui/tokens.css …）。
 */
'use client';
import {
  useEffect, useRef,
  type CSSProperties, type FC, type ReactElement, type RefObject,
} from 'react';
import { onIcen, type IcenEventMap } from '../behaviors/events';
import { renderChart, type ChartHandle, type ChartSpec } from '../behaviors/charts';
import { createTable, type TableHandle, type TableOptions } from '../behaviors/datatable';
import { renderAiMessage, type AiMessageModel } from '../behaviors/ai-chat';
import { renderAiToolCall, type AiToolCallHandle } from '../behaviors/ai-tool';
import {
  bindComposer, initAiComposer, setComposerModels,
  type AiComposerBindOpts, type AiComposerCurrentModel, type AiProviderOption,
} from '../behaviors/ai-composer';
import type { AiClient } from '../behaviors/ai-provider';
import type { AiToolCallModel } from '../behaviors/ai-core';
import { ICEN_EVENT_TYPES } from './icen-event-names';

/* 类型面 re-export（type-only，构建期擦除，不产生运行时依赖） */
export type { ChartHandle, ChartSpec } from '../behaviors/charts';
export type { TableHandle, TableOptions, TableColumn } from '../behaviors/datatable';
export type { AiMessageModel, AiMessageHandle } from '../behaviors/ai-chat';
export type { AiToolCallHandle } from '../behaviors/ai-tool';
export type { AiToolCallModel, AiUsage, AiStatus, AiContent, AiContentPart } from '../behaviors/ai-core';
export type { AiComposerBindOpts, AiComposerCurrentModel, AiProviderOption } from '../behaviors/ai-composer';
export type { AiClient } from '../behaviors/ai-provider';

/* ── 通用原语 ── */

/**
 * 生命周期接线原语：mount 时调 init，返回的清理函数在 unmount / deps 变化时执行。
 * init 本体需幂等（库内 init* 全部满足）；SSR 下 effect 不上服务端，天然安全。
 */
export function useIcenInit(
  init: (root?: HTMLElement | Document) => (() => void) | void,
  deps: unknown[] = [],
): void {
  const initRef = useRef(init);
  initRef.current = init;
  useEffect(() => {
    const cleanup = initRef.current();
    return typeof cleanup === 'function' ? cleanup : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 事件桥原语：onIcen 的 React 形态。within 传 RefObject（组件根）时只收子树事件；
 * 缺省全局（广播事件 icen:ai-done / icen:ai-usage 只经 [document, window]，
 * 要收广播必须缺省 within）。handler 收 (detail, event)。
 */
export function useIcenEvent<K extends keyof IcenEventMap>(
  type: K,
  handler: (detail: IcenEventMap[K], event: CustomEvent<IcenEventMap[K]>) => void,
  opts?: { within?: RefObject<HTMLElement | null> },
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const within = opts?.within;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const ctrl = new AbortController();
    const off = onIcen(type, (e) => handlerRef.current(e.detail, e), {
      within: within?.current ?? document,
      signal: ctrl.signal,
    });
    return () => { ctrl.abort(); off(); };
  }, [type, within]);
}

/* ── 组件工厂 ── */

export interface IcenComponentProps<Opts, Handle> {
  /** 组件契约（纯 JSON；库内 opts 全部 JSON 可序列化，变化经 JSON.stringify 稳定比较） */
  opts: Opts;
  className?: string;
  style?: CSSProperties;
  /** eventRoot=true 时经此回调透出子树内全部 icen:* 事件（type 为事件名，detail 为契约 detail） */
  onEvent?: (type: string, detail: unknown) => void;
  /** 透出命令式句柄（ChartHandle / TableHandle / AiToolCallHandle…） */
  handleRef?: RefObject<Handle | null>;
}

export interface IcenComponentConfig<Opts, Handle> {
  create: (el: HTMLElement, opts: Opts) => Handle;
  /** 缺省：opts 变化时 destroy + 重建（同一容器元素） */
  update?: (handle: Handle, opts: Opts) => void;
  destroy: (handle: Handle) => void;
  /** true 时把子树内 icen:* 事件经 onEvent 透出 */
  eventRoot?: boolean;
  /** 容器元素默认类（如 'icen-chart'；与用户 className 合并） */
  defaultClass?: string;
}

/** opts 变化检测：JSON.stringify 稳定比较（不可序列化时退化为按引用恒更新） */
function optsKeyOf(opts: unknown): string {
  try {
    return JSON.stringify(opts ?? null);
  } catch {
    return '\u0000unserializable'; /* 契约违反：走 update 路径（重建需用户自己 key 换容器） */
  }
}

/**
 * 薄封装工厂：声明式 props 进，同一个命令式内核出。
 * mount → create；opts 变 → update 或 destroy+重建；unmount → destroy。
 */
export function createIcenComponent<Opts, Handle>(
  cfg: IcenComponentConfig<Opts, Handle>,
): FC<IcenComponentProps<Opts, Handle>> {
  function IcenComponent(props: IcenComponentProps<Opts, Handle>): ReactElement {
    const rootRef = useRef<HTMLDivElement>(null);
    const handleBox = useRef<{ h: Handle | null }>({ h: null });
    const onEventRef = useRef(props.onEvent);
    onEventRef.current = props.onEvent;
    const optsRef = useRef(props.opts);
    optsRef.current = props.opts;
    const optsKey = optsKeyOf(props.opts);
    const firstKey = useRef(optsKey);

    /* mount → create + 事件桥；unmount → destroy（optsKey 变化不触发本 effect 的清理） */
    useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const h = cfg.create(el, optsRef.current);
      handleBox.current.h = h;
      if (props.handleRef) props.handleRef.current = h;
      const offBridge = cfg.eventRoot
        ? bridgeIcenEvents(el, (type, detail) => onEventRef.current?.(type, detail))
        : null;
      return () => {
        offBridge?.();
        if (handleBox.current.h != null) cfg.destroy(handleBox.current.h);
        handleBox.current.h = null;
        if (props.handleRef) props.handleRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* opts 变 → update（缺省 destroy + 重建，同一容器） */
    useEffect(() => {
      if (optsKey === firstKey.current) return; /* 首跑由 mount effect 负责 */
      const el = rootRef.current;
      const prev = handleBox.current.h;
      if (!el || prev == null) return;
      if (cfg.update) {
        cfg.update(prev, optsRef.current);
      } else {
        cfg.destroy(prev);
        const h = cfg.create(el, optsRef.current);
        handleBox.current.h = h;
        if (props.handleRef) props.handleRef.current = h;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [optsKey]);

    const cls = cfg.defaultClass
      ? props.className ? `${cfg.defaultClass} ${props.className}` : cfg.defaultClass
      : props.className;
    return <div ref={rootRef} className={cls} style={props.style} />;
  }
  IcenComponent.displayName = 'IcenComponent';
  return IcenComponent;
}

/** eventRoot 桥：子树内全量 icen:* 事件 → onEvent(type, detail) */
function bridgeIcenEvents(
  root: HTMLElement,
  emit: (type: string, detail: unknown) => void,
): () => void {
  const offs = ICEN_EVENT_TYPES.map((type) =>
    onIcen(type, ((e: CustomEvent) => emit(type, e.detail)) as never, { within: root }),
  );
  return () => { for (const off of offs) off(); };
}

/* ── 旗舰组件 ── */

/** 图表：renderChart 封装；spec 变化走 handle.update（原地重渲，保留事件委托） */
export const Chart = createIcenComponent<ChartSpec, ChartHandle>({
  create: (el, spec) => renderChart(el, spec),
  update: (handle, spec) => handle.update(spec),
  destroy: (handle) => handle.destroy(),
  eventRoot: true,
  defaultClass: 'icen-chart',
});

/** 数据表：createTable 封装；opts 变化 destroy + 重建（同容器） */
export const DataTable = createIcenComponent<TableOptions, TableHandle>({
  create: (el, opts) => createTable(el, opts),
  destroy: (handle) => handle.destroy(),
  eventRoot: true,
});

/** AI 消息：renderAiMessage 快照渲染（append 进容器）；model 变化 = 清空容器 + 重渲 */
export const AiMessage = createIcenComponent<AiMessageModel, HTMLElement>({
  create: (el, model) => {
    renderAiMessage(el, model);
    return el;
  },
  destroy: (el) => { el.replaceChildren(); },
  eventRoot: true,
});

/** 工具调用卡：renderAiToolCall 封装；model 变化走 handle.update（增量 patch 重渲） */
export const AiToolCall = createIcenComponent<AiToolCallModel, AiToolCallHandle>({
  create: (el, model) => renderAiToolCall(el, model),
  update: (handle, model) => handle.update(model),
  destroy: (handle) => { handle.el.replaceChildren(); handle.el.removeAttribute('class'); },
  eventRoot: true,
});

/* ── AiComposer ── */

export interface AiComposerModels {
  providers: AiProviderOption[];
  current?: AiComposerCurrentModel;
}

export interface AiComposerProps {
  /** createAiClient(...) 句柄；缺省 = 纯状态绑定（send/stop/环事件照常） */
  client?: AiClient;
  /** 模型切换弹层配置 */
  models?: AiComposerModels;
  /** 用量环口径（缺省不接管环；from:'context' 为环的正确口径） */
  usage?: AiComposerBindOpts['usage'];
  /** client 全托管时的消息挂载容器（client 模式必填才有意义；缺省降级纯状态绑定） */
  messagesRef?: RefObject<HTMLElement | null>;
  /** icen:ai-send 透出（纯状态绑定模式下接发送） */
  onSend?: (text: string) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * AI 输入台：内部 initAiComposer + setComposerModels + bindComposer。
 * unmount 调 binding.unbind() + init 销毁函数。DOM 契约为 ai-composer.css 头注释的标记骨架。
 */
export function AiComposer(props: AiComposerProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const onSendRef = useRef(props.onSend);
  onSendRef.current = props.onSend;
  const clientRef = useRef(props.client);
  clientRef.current = props.client;
  const modelsKey = optsKeyOf(props.models ?? null);
  const firstModelsKey = useRef(modelsKey);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const destroyInit = initAiComposer(el);
    if (props.models) setComposerModels(el, props.models.providers, props.models.current);
    const binding = bindComposer(el, {
      client: clientRef.current,
      messages: props.messagesRef?.current ?? undefined,
      usage: props.usage,
    });
    const offSend = onIcen('icen:ai-send', (e) => onSendRef.current?.(e.detail.text), { within: el });
    return () => { offSend(); binding.unbind(); destroyInit(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* models 变化 → 重配模型弹层（composer init 不受影响） */
  useEffect(() => {
    if (modelsKey === firstModelsKey.current) return;
    const el = rootRef.current;
    if (!el) return;
    if (props.models) setComposerModels(el, props.models.providers, props.models.current);
    else setComposerModels(el, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsKey]);

  const cls = props.className ? `icen-ai-composer ${props.className}` : 'icen-ai-composer';
  return (
    <div ref={rootRef} className={cls} data-icen-ai-composer style={props.style}>
      <div className="icen-ai-composer-queue" hidden />
      <div className="icen-ai-composer-attach" hidden />
      <div className="icen-ai-composer-box icen-control">
        <textarea className="icen-ai-composer-input" rows={1} placeholder="输入消息，Enter 发送 · 运行中回车排队" />
        <div className="icen-ai-composer-actions">
          <button className="icen-ai-composer-btn" data-icen-ai-attach type="button" aria-label="附件" />
          <button className="icen-ai-composer-send" data-icen-ai-send type="button" aria-label="发送" />
        </div>
      </div>
    </div>
  );
}
