/*
 * @icen.ai/ui — Behavior: upload（拖放上传区，与 components/upload.css 配套）
 *
 * DOM 契约：
 *   <div class="icen-upload" role="button" tabindex="0"
 *        [data-icen-upload-list] [data-icen-max-size="5242880"] [data-icen-max-files="10"]>
 *     <input type="file" multiple accept="…" />
 *     …图标与文案…
 *   </div>
 *
 * 增强（data-icen-upload-list 开启）：
 *   - 选择/拖放后自动渲染 .icen-upload-list 文件列表
 *   - 图片显示缩略图（createObjectURL），非图片显示类型图标
 *   - 单文件大小格式化（B/KB/MB/GB）
 *   - 每个文件可单独移除（×），列表可整体清空
 *   - accept 类型校验 + data-icen-max-size 大小校验 + data-icen-max-files 数量上限
 *   - 校验失败派发 icen:upload-error（detail: { file, reason }）
 *
 * 事件：
 *   icen:upload       { files: File[] }            选择/拖放成功（仅含本次新追加的文件）
 *   icen:upload-error { file: File | null, reason } 校验失败（maxFiles 超限等无单文件语境时 file 为 null）
 *   icen:upload-remove { file: File }         单个文件移除
 *
 * 同一容器重复 init 幂等；initUpload 返回销毁函数（摘除监听、回收对象 URL、
 * 移除生成的列表节点、复位幂等标记，销毁后可重新 init）。SSR 下为 no-op。
 */

import { emitIcen } from './events';
import { createIcon } from './icons';
import { t } from './i18n';

interface MarkedUpload extends HTMLElement {
  __icenUploadInit?: boolean;
}

/** 格式化文件大小为人类可读。 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 根据 accept 属性校验文件。 */
function isAccepted(file: File, accept: string): boolean {
  if (!accept.trim()) return true;
  const types = accept.split(',').map((t) => t.trim().toLowerCase());
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return types.some((t) => {
    if (t.startsWith('.')) return fileName.endsWith(t);               // .pdf
    if (t.endsWith('/*')) return mime.startsWith(t.slice(0, -1));     // image/*
    return mime === t;                                                 // exact mime
  });
}

/** 判断两个 File 是否指向同一文件（重复选择/拖放去重用）。 */
function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function setup(zone: HTMLElement): (() => void) | undefined {
  const el = zone as MarkedUpload;
  if (el.__icenUploadInit) return undefined;

  const input = zone.querySelector<HTMLInputElement>('input[type="file"]');
  // 校验通过后再置位：无 file input 早退不置位，以便补上后重新 init 可重试
  if (!input) return undefined;
  el.__icenUploadInit = true;

  /* 本区的全部监听解绑器（dispose 时统一摘除） */
  const offs: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(node: HTMLElement, type: K, fn: (ev: HTMLElementEventMap[K]) => void): void => {
    node.addEventListener(type, fn as EventListener);
    offs.push(() => node.removeEventListener(type, fn as EventListener));
  };
  /* 列表容器是否由本行为生成（dispose 时决定摘除还是仅清空） */
  let createdList = false;

  const hasList = zone.hasAttribute('data-icen-upload-list');
  const maxSize = Number(zone.getAttribute('data-icen-max-size')) || 0;
  const maxFiles = Number(zone.getAttribute('data-icen-max-files')) || 0;
  const accept = input.getAttribute('accept') ?? '';

  /** 当前文件列表（列表模式的唯一事实源）。 */
  let currentFiles: File[] = hasList ? Array.from(input.files ?? []) : [];
  /** 对象 URL 映射，移除/重渲染时回收。 */
  const urlMap = new Map<File, string>();
  /** 同步守卫：setInputFiles 程序化回写期间忽略 input 的 change，防止重入 handleFiles。 */
  let syncing = false;
  let handlingNativeChange = false;
  let disposed = false;
  const unavailable = (): boolean => input.matches(':disabled') || !!zone.closest('.is-disabled,[aria-disabled="true"],[data-icen-disabled],.is-loading,[aria-busy="true"]');

  /** 查找或创建文件列表容器。 */
  function getListEl(): HTMLUListElement | null {
    if (!hasList) return null;
    let list = zone.querySelector<HTMLUListElement>('.icen-upload-list');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'icen-upload-list';
      zone.appendChild(list);
      createdList = true;
    }
    return list;
  }

  /** 渲染文件列表。 */
  function renderList(): void {
    const list = getListEl();
    if (!list) return;

    // 回收已移出列表的文件 URL（仍在列表中的复用，不重复创建、不重复 revoke）
    urlMap.forEach((url, f) => {
      if (!currentFiles.includes(f)) {
        URL.revokeObjectURL(url);
        urlMap.delete(f);
      }
    });
    list.textContent = '';

    if (currentFiles.length === 0) {
      list.hidden = true;
      return;
    }
    list.hidden = false;

    for (const file of currentFiles) {
      const li = document.createElement('li');
      li.className = 'icen-upload-list-item';

      // 缩略图或图标
      const isImage = file.type.startsWith('image/');
      let thumbUrl: string | undefined;
      if (isImage) {
        thumbUrl = urlMap.get(file);
        if (!thumbUrl) {
          try {
            thumbUrl = URL.createObjectURL(file);
            urlMap.set(file, thumbUrl);
          } catch {
            thumbUrl = undefined; // createObjectURL 不可用 → 回退占位图标
          }
        }
      }
      if (thumbUrl) {
        const img = document.createElement('img');
        img.className = 'icen-upload-list-item-thumb';
        img.src = thumbUrl;
        img.alt = file.name;
        li.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'icen-upload-list-item-icon';
        const svg = createIcon('file');
        if (svg) icon.appendChild(svg);
        li.appendChild(icon);
      }

      // 文件名 + 大小
      const info = document.createElement('div');
      info.className = 'icen-upload-list-item-info';
      const name = document.createElement('span');
      name.className = 'icen-upload-list-item-name';
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'icen-upload-list-item-size';
      size.textContent = formatSize(file.size);
      info.appendChild(name);
      info.appendChild(size);
      li.appendChild(info);

      // 移除按钮
      const removeBtn = document.createElement('button');
      removeBtn.className = 'icen-upload-list-item-x';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', t('upload.remove', { p0: file.name }));
      const xSvg = createIcon('close', { size: 14 });
      if (xSvg) removeBtn.appendChild(xSvg);
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (unavailable()) return;
        const restoreFocus = document.activeElement === removeBtn;
        const index = currentFiles.indexOf(file);
        currentFiles = currentFiles.filter((f) => f !== file);
        emitIcen(zone, 'icen:upload-remove', { file });
        renderList();
        syncInputFiles();
        if (restoreFocus) {
          const actions = zone.querySelectorAll<HTMLButtonElement>('.icen-upload-list-item-x');
          (actions[Math.min(index, actions.length - 1)] ?? clickTarget).focus({preventScroll:true});
        }
      });
      li.appendChild(removeBtn);

      list.appendChild(li);
    }
  }

  /** 把给定文件集回写 input.files（DataTransfer）并派发 change；守卫期内派发的 change
   *  不会重入 handleFiles。两处共用：list 模式写 currentFiles，非 list 模式 drop 写拖放结果。 */
  function setInputFiles(files: File[]): void {
    try {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      syncing = true;
      input!.files = dt.files;
      if (!handlingNativeChange) input!.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      /* DataTransfer 不支持时静默——使用方可监听 icen:upload 事件 */
    } finally {
      syncing = false;
    }
  }

  /** list 模式把事实源 currentFiles 回写 input.files。 */
  function syncInputFiles(): void {
    setInputFiles(currentFiles);
  }

  /** 校验单个文件。 */
  function validate(file: File): string | null {
    if (accept && !isAccepted(file, accept)) return t('upload.typeNotAllowed');
    if (maxSize > 0 && file.size > maxSize) return t('upload.tooBig', { p0: formatSize(maxSize) });
    return null;
  }

  /** 处理新文件：校验 → 去重 → 累积/替换 → 渲染列表 → 派发事件。 */
  function handleFiles(files: File[]): File[] {
    const valid: File[] = [];
    for (const file of files) {
      const reason = validate(file);
      if (reason) {
        emitIcen(zone, 'icen:upload-error', { file, reason });
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) {
      if (hasList) syncInputFiles();
      return [];
    }

    if (hasList) {
      // 累积模式：只追加新文件（按 name+size+lastModified 对已有列表与本批去重）
      const fresh: File[] = [];
      for (const f of valid) {
        if (currentFiles.some((c) => sameFile(c, f)) || fresh.some((c) => sameFile(c, f))) continue;
        fresh.push(f);
      }
      if (fresh.length === 0) { syncInputFiles(); return []; }
      if (maxFiles > 0) {
        const remaining = maxFiles - currentFiles.length;
        if (remaining <= 0) {
          emitIcen(zone, 'icen:upload-error', { file: null, reason: t('upload.tooMany', { p0: maxFiles }) });
          syncInputFiles();
          return [];
        }
        if (fresh.length > remaining) {
          fresh.length = remaining;
          /* 部分截断也如实告知：选了 4 个只落 3 个不能悄无声息 */
          emitIcen(zone, 'icen:upload-error', { file: null, reason: t('upload.tooMany', { p0: maxFiles }) });
        }
      }
      currentFiles.push(...fresh);
      renderList();
      syncInputFiles();
      emitIcen(zone, 'icen:upload', { files: fresh });
      return fresh;
    }

    const limit = input!.multiple ? maxFiles : 1;
    const accepted = limit > 0 ? valid.slice(0, limit) : valid;
    if (accepted.length < valid.length) emitIcen(zone, 'icen:upload-error', {file:null, reason:t('upload.tooMany',{p0:limit})});
    setInputFiles(accepted);
    emitIcen(zone, 'icen:upload', { files: accepted });
    return accepted;
  }

  const openPicker = (): void => { if (!unavailable()) input.click(); };
  /* 推荐结构：交互落在 .icen-upload-dropzone（role=button），列表是它的兄弟不嵌套；
     旧结构回落 zone 本体（视觉与行为不变，但列表模式的移除钮会与外层 role=button 嵌套） */
  const clickTarget = zone.querySelector<HTMLElement>('.icen-upload-dropzone') ?? zone;
  const dragTarget = clickTarget;

  on(clickTarget, 'click', (ev) => {
    if (ev.target === input) return;
    // 不在文件列表项内点击
    const tgt = ev.target;
    if (tgt instanceof Element && tgt.closest('.icen-upload-list')) return;
    openPicker();
  });
  on(clickTarget, 'keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      // 镜像 click 守卫：焦点在 .icen-upload-list 内控件（如移除钮）时放行原生激活，
      // 否则 Enter/Space 被吃掉反而打开文件选择器
      const tgt = ev.target;
      if (tgt instanceof Element && tgt.closest('.icen-upload-list')) return;
      ev.preventDefault();
      openPicker();
    }
  });

  // input change（用户通过选择器选了文件）
  on(input, 'change', () => {
    if (syncing) return; // syncInputFiles 的程序化回写，忽略
    if (unavailable()) return;
    if (!input.files) return;
    handlingNativeChange = true;
    try {
      const files = Array.from(input.files);
      if (hasList) {
        // The original event bubbles after the validated FileList is restored.
        input.value = '';
      }
      const accepted = handleFiles(files);
      if (!hasList && accepted.length === 0) setInputFiles([]);
    } finally {
      handlingNativeChange = false;
    }
  });

  on(zone, 'dragover', (ev) => {
    ev.preventDefault();
    if (unavailable()) return;
    dragTarget.classList.add('is-drag');
  });
  on(zone, 'dragleave', (ev) => {
    // 只在离开 zone 本身时移除（子元素 dragleave 忽略）
    if (!(ev.relatedTarget instanceof Node && zone.contains(ev.relatedTarget))) dragTarget.classList.remove('is-drag');
  });
  on(zone, 'drop', (ev) => {
    ev.preventDefault();
    dragTarget.classList.remove('is-drag');
    if (unavailable()) return;
    const files = ev.dataTransfer?.files;
    if (!files || files.length === 0) return;
    handleFiles(Array.from(files));

  });

  const onReset = (event: Event): void => {
    if (event.target !== input.form) return;
    queueMicrotask(() => {
      if (disposed || event.defaultPrevented) return;
      currentFiles = [];
      renderList();
    });
  };
  document.addEventListener('reset', onReset, true);
  offs.push(() => document.removeEventListener('reset', onReset, true));
  if (hasList) renderList();

  /* 销毁：摘全部监听、回收对象 URL、清理生成的列表、复位幂等标记（可重新 init） */
  return () => {
    disposed = true;
    for (const off of offs) off();
    offs.length = 0;
    urlMap.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch { /* 无 createObjectURL 的环境同样没有可回收对象 */ }
    });
    urlMap.clear();
    const list = zone.querySelector<HTMLElement>('.icen-upload-list');
    if (list) {
      if (createdList) list.remove();
      else list.replaceChildren();
    }
    zone.classList.remove('is-drag');
    dragTarget.classList.remove('is-drag');
    el.__icenUploadInit = false;
  };
}

/** 为 root 下每个 .icen-upload 容器初始化（root 自身是 .icen-upload 也算）。
 *  返回销毁函数：统一摘除本次挂上的各区监听并回收其资源（销毁后可重新 init）。SSR 下返回 no-op。 */
export function initUpload(root?: ParentNode): () => void {
  if (typeof document === 'undefined') return () => {};
  const scope: ParentNode = root ?? document;
  const zones: HTMLElement[] = [];
  if (scope instanceof HTMLElement && scope.matches('.icen-upload')) zones.push(scope);
  zones.push(...Array.from(scope.querySelectorAll<HTMLElement>('.icen-upload')));
  const cleanups: Array<() => void> = [];
  for (const z of zones) {
    const off = setup(z);
    if (off) cleanups.push(off);
  }
  return () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };
}
