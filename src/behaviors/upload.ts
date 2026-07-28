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
 *   icen:upload       { files: File[] }       选择/拖放成功
 *   icen:upload-error { file: File, reason }  校验失败
 *   icen:upload-remove { file: File }         单个文件移除
 *
 * 同一容器重复 init 幂等。SSR 下为 no-op。
 */

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

function setup(zone: HTMLElement): void {
  const el = zone as MarkedUpload;
  if (el.__icenUploadInit) return;
  el.__icenUploadInit = true;

  const input = zone.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) return;

  const hasList = zone.hasAttribute('data-upload-list');
  const maxSize = Number(zone.getAttribute('data-max-size')) || 0;
  const maxFiles = Number(zone.getAttribute('data-max-files')) || 0;
  const accept = input.getAttribute('accept') ?? '';

  /** 当前文件列表（用于 data-upload-list 模式下的累积管理）。 */
  let currentFiles: File[] = [];
  /** 对象 URL 映射，用于销毁时回收。 */
  const urlMap = new Map<File, string>();

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

    // 回收旧 URL
    urlMap.forEach((url) => URL.revokeObjectURL(url));
    urlMap.clear();
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
      if (isImage) {
        try {
          const url = URL.createObjectURL(file);
          urlMap.set(file, url);
          const img = document.createElement('img');
          img.className = 'upload-list-item-thumb';
          img.src = url;
          img.alt = file.name;
          li.appendChild(img);
        } catch {
          const icon = document.createElement('span');
          icon.className = 'upload-list-item-icon';
          icon.innerHTML = fileIconSvg;
          li.appendChild(icon);
        }
      } else {
        const icon = document.createElement('span');
        icon.className = 'upload-list-item-icon';
        icon.innerHTML = fileIconSvg;
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
      removeBtn.innerHTML = xIconSvg;
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        currentFiles = currentFiles.filter((f) => f !== file);
        zone.dispatchEvent(new CustomEvent('icen:upload-remove', { bubbles: true, detail: { file } }));
        renderList();
        syncInputFiles();
      });
      li.appendChild(removeBtn);

      list.appendChild(li);
    }
  }

  /** 将 currentFiles 同步回 input.files（DataTransfer）。 */
  function syncInputFiles(): void {
    try {
      const dt = new DataTransfer();
      for (const f of currentFiles) dt.items.add(f);
      input!.files = dt.files;
      input!.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      /* DataTransfer 不支持时静默——使用方可监听 icen:upload 事件 */
    }
  }

  /** 校验单个文件。 */
  function validate(file: File): string | null {
    if (accept && !isAccepted(file, accept)) return '文件类型不支持';
    if (maxSize > 0 && file.size > maxSize) return `文件超过 ${formatSize(maxSize)}`;
    return null;
  }

  /** 处理新文件：校验 → 累积/替换 → 渲染列表 → 派发事件。 */
  function handleFiles(files: File[]): void {
    const valid: File[] = [];
    for (const file of files) {
      const reason = validate(file);
      if (reason) {
        zone.dispatchEvent(new CustomEvent('icen:upload-error', { bubbles: true, detail: { file, reason } }));
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    if (hasList) {
      // 累积模式：追加（受 maxFiles 约束）
      if (maxFiles > 0) {
        const remaining = maxFiles - currentFiles.length;
        if (remaining <= 0) {
          zone.dispatchEvent(new CustomEvent('icen:upload-error', {
            bubbles: true,
            detail: { reason: `最多 ${maxFiles} 个文件` },
          }));
          return;
        }
        valid.splice(remaining);
      }
      currentFiles.push(...valid);
      renderList();
      syncInputFiles();
    }

    zone.dispatchEvent(new CustomEvent('icen:upload', { bubbles: true, detail: { files: valid } }));
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
      ev.preventDefault();
      openPicker();
    }
  });

  // input change（用户通过选择器选了文件）
  input.addEventListener('change', () => {
    if (!input.files) return;
    const files = Array.from(input.files);
    if (hasList) {
      // 列表模式下，change 的文件直接处理（已含累积逻辑）
      handleFiles(files);
      // 清空 input.value 避免重复选择同名文件不触发 change
      input.value = '';
    } else {
      handleFiles(files);
    }
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

    // 非 list 模式下尝试赋给 input.files
    if (!hasList) {
      try {
        const dt = new DataTransfer();
        for (const f of Array.from(files)) dt.items.add(f);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        /* noop */
      }
    }
  });
}

/** 为 root 下每个 .upload 容器初始化（root 自身是 .upload 也算）。 */
export function initUpload(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;
  const zones: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches('.upload')) zones.push(root);
  zones.push(...Array.from(root.querySelectorAll<HTMLElement>('.upload')));
  for (const z of zones) setup(z);
}
