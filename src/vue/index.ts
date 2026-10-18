/*
 * @icen.ai/ui — Vue 3.3+ 薄封装层（@icen.ai/ui/vue）
 *
 * React 层的镜像：薄如蝉翼——生命周期接线（mounted → create / watch deep → update /
 * unmounted → destroy）、onIcen 事件桥（kebab 化名 emits 透出）、类型面 re-export。
 * defineComponent + h()，无 SFC。SSR 天然安全：全部接线在 onMounted 里。
 * CSS 不在本层引入——消费方照常引 tokens.css + 组件 CSS。
 */
import {
  defineComponent, h, onMounted, onUnmounted, ref, watch,
  type PropType, type Ref,
} from 'vue';
import { onIcen, type IcenEventMap } from '../behaviors/events';
import { renderChart, type ChartHandle, type ChartSpec } from '../behaviors/charts';
import { createTable, type TableHandle, type TableOptions } from '../behaviors/datatable';
import { renderAiMessage, type AiMessageModel } from '../behaviors/ai-chat';
import {
  bindComposer, initAiComposer, setComposerModels,
  type AiComposerBindOpts, type AiComposerCurrentModel, type AiProviderOption,
} from '../behaviors/ai-composer';
import type { AiClient } from '../behaviors/ai-provider';

/* 类型面 re-export */
export type { ChartHandle, ChartSpec } from '../behaviors/charts';
export type { TableHandle, TableOptions, TableColumn } from '../behaviors/datatable';
export type { AiMessageModel, AiMessageHandle } from '../behaviors/ai-chat';
export type { AiToolCallModel, AiUsage, AiStatus, AiContent, AiContentPart } from '../behaviors/ai-core';
export type { AiComposerBindOpts, AiComposerCurrentModel, AiProviderOption } from '../behaviors/ai-composer';
export type { AiClient } from '../behaviors/ai-provider';

type MaybeRef<T> = T | Ref<T | null>;
type Cleanup = (() => void) | void;

/* ── 通用原语 ── */

/**
 * 生命周期接线原语：mounted 时调 init，清理函数在 unmounted / deps 变化时执行。
 * init 本体需幂等（库内 init* 全部满足）；SSR 下 onMounted 不上服务端，天然安全。
 */
export function useIcenInit(
  init: (root?: HTMLElement | Document) => Cleanup,
  deps: unknown[] = [],
): void {
  let cleanup: Cleanup;
  onMounted(() => { cleanup = init(); });
  onUnmounted(() => { if (typeof cleanup === 'function') cleanup(); });
  if (deps.length > 0) {
    watch(deps as Array<() => unknown>, () => {
      if (typeof cleanup === 'function') cleanup();
      cleanup = init();
    });
  }
}

/**
 * 事件桥原语：onIcen 的 Vue 形态。within 传 Ref 或元素；缺省全局（广播事件
 * icen:ai-done / icen:ai-usage 只经 [document, window]，要收广播必须缺省 within）。
 */
export function useIcenEvent<K extends keyof IcenEventMap>(
  type: K,
  handler: (detail: IcenEventMap[K], event: CustomEvent<IcenEventMap[K]>) => void,
  opts?: { within?: MaybeRef<HTMLElement | Document | null> },
): void {
  let off: (() => void) | undefined;
  onMounted(() => {
    if (typeof document === 'undefined') return;
    const w = opts?.within;
    const within = (w && typeof w === 'object' && 'value' in w ? w.value : w) ?? document;
    off = onIcen(type, (e) => handler(e.detail, e), { within });
  });
  onUnmounted(() => { off?.(); });
}

/* ── 渲染器工厂 ── */

export interface VueRendererConfig<Opts, Handle> {
  create: (el: HTMLElement, opts: Opts) => Handle;
  /** 缺省：数据变化时 destroy + 重建（同一容器元素） */
  update?: (handle: Handle, opts: Opts) => void;
  destroy: (handle: Handle) => void;
  /** 数据 prop 名（IcenChart 用 'spec'，其余 'opts'） */
  prop?: string;
  /** kebab 化 icen 事件名（不带 icen: 前缀；emits 声明 + 透出，detail 为契约 detail） */
  events?: string[];
  defaultClass?: string;
}

/**
 * 薄封装工厂：props 进，同一个命令式内核出。
 * mounted → create + 事件桥；数据 prop deep watch → update 或 destroy+重建；unmounted → destroy。
 * 句柄经 defineExpose({ getHandle }) 透出。
 */
export function createVueRenderer<Opts, Handle>(cfg: VueRendererConfig<Opts, Handle>) {
  const prop = cfg.prop ?? 'opts';
  const emits = cfg.events ?? [];
  return defineComponent({
    name: 'IcenRenderer',
    props: {
      [prop]: { type: Object as PropType<Opts>, required: true },
      class: { type: String, default: undefined },
      style: { type: [String, Object] as PropType<string | Record<string, string>>, default: undefined },
    },
    emits,
    setup(props, { emit, expose }) {
      const root = ref<HTMLElement | null>(null);
      let handle: Handle | null = null;
      let offBridge: (() => void) | null = null;
      expose({ getHandle: () => handle });

      onMounted(() => {
        const el = root.value;
        if (!el) return;
        handle = cfg.create(el, (props as Record<string, unknown>)[prop] as Opts);
        if (emits.length > 0) {
          const offs = emits.map((name) =>
            onIcen(`icen:${name}`, ((e: CustomEvent) => emit(name, e.detail)) as never, { within: el }),
          );
          offBridge = () => { for (const off of offs) off(); };
        }
      });

      watch(
        () => (props as Record<string, unknown>)[prop],
        (next) => {
          const el = root.value;
          if (!el || handle == null || next == null) return;
          if (cfg.update) cfg.update(handle, next as Opts);
          else { cfg.destroy(handle); handle = cfg.create(el, next as Opts); }
        },
        { deep: true },
      );

      onUnmounted(() => {
        offBridge?.();
        if (handle != null) cfg.destroy(handle);
        handle = null;
      });

      return () => h('div', {
        ref: root,
        class: cfg.defaultClass ? [cfg.defaultClass, (props as { class?: string }).class] : (props as { class?: string }).class,
        style: (props as { style?: unknown }).style as never,
      });
    },
  });
}

/* ── 旗舰组件 ── */

/** 图表：renderChart 封装；spec deep watch → handle.update（原地重渲） */
export const IcenChart = createVueRenderer<ChartSpec, ChartHandle>({
  create: (el, spec) => renderChart(el, spec),
  update: (handle, spec) => handle.update(spec),
  destroy: (handle) => handle.destroy(),
  prop: 'spec',
  events: ['chart-hover', 'chart-click', 'chart-dblclick', 'chart-contextmenu',
    'chart-legend-toggle', 'chart-legend-visibility', 'chart-zoom'],
  defaultClass: 'icen-chart',
});

/** 数据表：createTable 封装；opts 变化 destroy + 重建 */
export const IcenDataTable = createVueRenderer<TableOptions, TableHandle>({
  create: (el, opts) => createTable(el, opts),
  destroy: (handle) => handle.destroy(),
  events: ['table-sort-change', 'table-page-change', 'table-page-size-change',
    'table-filter-change', 'table-search-change', 'table-selection-change',
    'table-row-click', 'table-row-toggle', 'table-columns-change', 'table-export',
    'table-cell-edit', 'table-column-reorder', 'table-group-toggle', 'table-column-resize'],
});

/** AI 消息：renderAiMessage 快照渲染；model 变化 = 清空容器 + 重渲 */
export const IcenAiMessage = createVueRenderer<AiMessageModel, HTMLElement>({
  create: (el, model) => {
    renderAiMessage(el, model);
    return el;
  },
  destroy: (el) => { el.replaceChildren(); },
  events: ['ai-toggle', 'ai-copy', 'ai-retry'],
});

export interface IcenAiComposerProps {
  client?: AiClient;
  models?: { providers: AiProviderOption[]; current?: AiComposerCurrentModel };
  usage?: AiComposerBindOpts['usage'];
  messagesEl?: MaybeRef<HTMLElement | null>;
  class?: string;
  style?: string | Record<string, string>;
}

/** composer 事件族（kebab，不带 icen: 前缀）：emits 声明 + 透出桥共用 */
const COMPOSER_EVENTS = ['ai-send', 'ai-stop', 'ai-queue', 'ai-dequeue', 'ai-attach',
  'ai-model-change', 'ai-command', 'ai-ref', 'ai-todo-toggle', 'ai-usage'] as const;

/**
 * AI 输入台：内部 initAiComposer + setComposerModels + bindComposer，
 * unmounted 调 binding.unbind()。emits 透出 composer 事件族（kebab）。
 * DOM 契约为 ai-composer.css 头注释的标记骨架。
 */
export const IcenAiComposer = defineComponent({
  name: 'IcenAiComposer',
  props: {
    client: { type: Object as PropType<AiClient>, default: undefined },
    models: { type: Object as PropType<IcenAiComposerProps['models']>, default: undefined },
    usage: { type: Object as PropType<IcenAiComposerProps['usage']>, default: undefined },
    messagesEl: { type: Object as PropType<IcenAiComposerProps['messagesEl']>, default: undefined },
    class: { type: String, default: undefined },
    style: { type: [String, Object] as PropType<string | Record<string, string>>, default: undefined },
  },
  emits: [...COMPOSER_EVENTS],
  setup(props, { emit, expose }) {
    const root = ref<HTMLElement | null>(null);
    let binding: { unbind: () => void } | null = null;
    let destroyInit: (() => void) | null = null;
    let offBridge: (() => void) | null = null;
    expose({ getBinding: () => binding });

    onMounted(() => {
      const el = root.value;
      if (!el) return;
      destroyInit = initAiComposer(el);
      if (props.models) setComposerModels(el, props.models.providers, props.models.current);
      const m = props.messagesEl;
      binding = bindComposer(el, {
        client: props.client,
        messages: (m && typeof m === 'object' && 'value' in m ? m.value : m) ?? undefined,
        usage: props.usage,
      });
      const offs = COMPOSER_EVENTS.map((name) =>
        onIcen(`icen:${name}`, ((e: CustomEvent) => emit(name, e.detail)) as never, { within: el }),
      );
      offBridge = () => { for (const off of offs) off(); };
    });

    watch(() => props.models, (next) => {
      const el = root.value;
      if (!el) return;
      if (next) setComposerModels(el, next.providers, next.current);
      else setComposerModels(el, []);
    }, { deep: true });

    onUnmounted(() => {
      offBridge?.();
      binding?.unbind();
      binding = null;
      destroyInit?.();
      destroyInit = null;
    });

    return () => h('div', {
      ref: root,
      class: props.class ? `icen-ai-composer ${props.class}` : 'icen-ai-composer',
      'data-icen-ai-composer': '',
      style: props.style as never,
    }, [
      h('div', { class: 'icen-ai-composer-queue', hidden: true }),
      h('div', { class: 'icen-ai-composer-attach', hidden: true }),
      h('div', { class: 'icen-ai-composer-box icen-control' }, [
        h('textarea', { class: 'icen-ai-composer-input', rows: 1, placeholder: '输入消息，Enter 发送 · 运行中回车排队' }),
        h('div', { class: 'icen-ai-composer-toolbar' }, [
          h('span', { class: 'icen-ai-composer-spacer' }),
          h('button', { class: 'icen-ai-composer-btn', 'data-icen-ai-attach': '', type: 'button', ariaLabel: '附件' }),
          h('button', { class: 'icen-ai-composer-send', 'data-icen-ai-send': '', type: 'button', ariaLabel: '发送' }),
        ]),
      ]),
    ]);
  },
});
