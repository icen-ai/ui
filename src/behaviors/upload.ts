/*
 * @icen.ai/ui — Behavior: upload（拖放上传区，与 components/upload.css 配套）
 *
 * DOM 契约：
 *   <div class="upload" role="button" tabindex="0"
 *        [data-upload-list] [data-max-size="5242880"] [data-max-files="10"]>
 *     <input type="file" multiple accept="…" />
 *     …图标与文案…
 *   </div>
 *
 * 增强（data-upload-list 开启）：
 *   - 选择/拖放后自动渲染 .upload-list 文件列表
 *   - 图片显示缩略图（createObjectURL），非图片显示类型图标
 *   - 单文件大小格式化（B/KB/MB/GB）
 *   - 每个文件可单独移除（×），列表可整体清空
 *   - accept 类型校验 + data-max-size 大小校验 + data-max-files 数量上限
 *   - 校验失败派发 icen:upload-error（detail: { file, reason }）
 *
 * 事件：
 *   icen:upload       { files: File[] }            选择/拖放成功（仅含本次新追加的文件）
 *   icen:upload-error { file: File | null, reason } 校验失败（maxFiles 超限等无单文件语境时 file 为 null）
 *   icen:upload-remove { file: File }         单个文件移除
 *
 * 同一容器重复 init 幂等。SSR 下为 no-op。
 */

import { emitIcen } from './events';

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

/** SVG 图标：文件占位（非图片）。 */
const fileIconSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
  '<polyline points="14 2 14 8 20 8"/></svg>';

/** SVG 图标：移除 ×。 */
const xIconSvg =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/** 惰性解析受控 SVG 常量为 DOM 节点（避免 innerHTML；仅在浏览器内调用）。 */
function parseSvg(source: string): Element | null {
  try {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;
    return document.importNode(svg, true);
  } catch {
    return null;
  }
}

/** 判断两个 File 是否指向同一文件（重复选择/拖放去重用）。 */
function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function setup(zone: HTMLElement): void {
  const el = zone as MarkedUpload;
  if (el.__icenUploadInit) return;

  const input = zone.querySelector<HTMLInputElement>('input[type="file"]');
  // 校验通过后再置位：无 file input 早退不置位，以便补上后重新 init 可重试
  if (!input) return;
  el.__icenUploadInit = true;

  const hasList = zone.hasAttribute('data-upload-list');
  const maxSize = Number(zone.getAttribute('data-max-size')) || 0;
  const maxFiles = Number(zone.getAttribute('data-max-files')) || 0;
  const accept = input.getAttribute('accept') ?? '';

  /** 当前文件列表（列表模式的唯一事实源）。 */
  let currentFiles: File[] = [];
  /** 对象 URL 映射，移除/重渲染时回收。 */
  const urlMap = new Map<File, string>();
  /** 同步守卫：setInputFiles 程序化回写期间忽略 input 的 change，防止重入 handleFiles。 */
  let syncing = false;

  /** 查找或创建文件列表容器。 */
  function getListEl(): HTMLUListElement | null {
    if (!hasList) return null;
    let list = zone.querySelector<HTMLUListElement>('.upload-list');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'upload-list';
      zone.appendChild(list);
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
      li.className = 'upload-list-item';

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
        img.className = 'upload-list-item-thumb';
        img.src = thumbUrl;
        img.alt = file.name;
        li.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.className = 'upload-list-item-icon';
        const svg = parseSvg(fileIconSvg);
        if (svg) icon.appendChild(svg);
        li.appendChild(icon);
      }

      // 文件名 + 大小
      const info = document.createElement('div');
      info.className = 'upload-list-item-info';
      const name = document.createElement('span');
      name.className = 'upload-list-item-name';
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'upload-list-item-size';
      size.textContent = formatSize(file.size);
      info.appendChild(name);
      info.appendChild(size);
      li.appendChild(info);

      // 移除按钮
      const removeBtn = document.createElement('button');
      removeBtn.className = 'upload-list-item-x';
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `移除 ${file.name}`);
      const xSvg = parseSvg(xIconSvg);
      if (xSvg) removeBtn.appendChild(xSvg);
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        currentFiles = currentFiles.filter((f) => f !== file);
        emitIcen(zone, 'icen:upload-remove', { file });
        renderList();
        syncInputFiles();
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
      input!.dispatchEvent(new Event('change', { bubbles: true }));
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
    if (accept && !isAccepted(file, accept)) return '文件类型不支持';
    if (maxSize > 0 && file.size > maxSize) return `文件超过 ${formatSize(maxSize)}`;
    return null;
  }

  /** 处理新文件：校验 → 去重 → 累积/替换 → 渲染列表 → 派发事件。 */
  function handleFiles(files: File[]): void {
    const valid: File[] = [];
    for (const file of files) {
      const reason = validate(file);
      if (reason) {
        emitIcen(zone, 'icen:upload-error', { file, reason });
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    if (hasList) {
      // 累积模式：只追加新文件（按 name+size+lastModified 对已有列表与本批去重）
      const fresh: File[] = [];
      for (const f of valid) {
        if (currentFiles.some((c) => sameFile(c, f)) || fresh.some((c) => sameFile(c, f))) continue;
        fresh.push(f);
      }
      if (fresh.length === 0) return;
      if (maxFiles > 0) {
        const remaining = maxFiles - currentFiles.length;
        if (remaining <= 0) {
          emitIcen(zone, 'icen:upload-error', { file: null, reason: `最多 ${maxFiles} 个文件` });
          return;
        }
        if (fresh.length > remaining) fresh.length = remaining;
      }
      currentFiles.push(...fresh);
      renderList();
      syncInputFiles();
      emitIcen(zone, 'icen:upload', { files: fresh });
      return;
    }

    emitIcen(zone, 'icen:upload', { files: valid });
  }

  const openPicker = (): void => input.click();

  zone.addEventListener('click', (ev) => {
    if (ev.target === input) return;
    // 不在文件列表项内点击
    const tgt = ev.target;
    if (tgt instanceof Element && tgt.closest('.upload-list')) return;
    openPicker();
  });
  zone.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      // 镜像 click 守卫：焦点在 .upload-list 内控件（如移除钮）时放行原生激活，
      // 否则 Enter/Space 被吃掉反而打开文件选择器
      const tgt = ev.target;
      if (tgt instanceof Element && tgt.closest('.upload-list')) return;
      ev.preventDefault();
      openPicker();
    }
  });

  // input change（用户通过选择器选了文件）
  input.addEventListener('change', () => {
    if (syncing) return; // syncInputFiles 的程序化回写，忽略
    if (!input.files) return;
    const files = Array.from(input.files);
    if (hasList) {
      // 先清空再处理：currentFiles 才是事实源；清空避免重复选择同名文件不触发 change
      input.value = '';
    }
    handleFiles(files);
  });

  zone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    zone.classList.add('is-drag');
  });
  zone.addEventListener('dragleave', (ev) => {
    // 只在离开 zone 本身时移除（子元素 dragleave 忽略）
    if (ev.target === zone) zone.classList.remove('is-drag');
  });
  zone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    zone.classList.remove('is-drag');
    const files = ev.dataTransfer?.files;
    if (!files || files.length === 0) return;
    handleFiles(Array.from(files));

    // 非 list 模式把拖放结果回写 input.files（与 list 模式共用 setInputFiles，
    // 守卫期内派发的 change 不会重复触发 icen:upload）
    if (!hasList) setInputFiles(Array.from(files));
  });
}

/** 为 root 下每个 .upload 容器初始化（root 自身是 .upload 也算）。 */
export function initUpload(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const scope: ParentNode = root ?? document;
  const zones: HTMLElement[] = [];
  if (scope instanceof HTMLElement && scope.matches('.upload')) zones.push(scope);
  zones.push(...Array.from(scope.querySelectorAll<HTMLElement>('.upload')));
  for (const z of zones) setup(z);
}
