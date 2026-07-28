/*
 * @icen.ai/ui — Behavior: upload（拖放上传区，与 components/upload.css 配套）
 *
 * DOM 契约：
 *   <div class="upload" role="button" tabindex="0">
 *     <input type="file" multiple />   由 CSS 隐藏
 *     …图标与文案…
 *   </div>
 *
 * 行为：点击 / Enter / Space 触发内部 input[type=file]；dragover 加 .is-drag、
 * dragleave / drop 移除；drop 的文件经 DataTransfer 赋给 input.files 并派发
 * change 事件；环境不支持构造 DataTransfer 时退化为只维护视觉态，并在容器上
 * 派发自定义事件 icn:upload（detail = { files: File[] }，bubbles）。
 * 同一容器重复 init 幂等。
 */

interface MarkedUpload extends HTMLElement {
  __icenUploadInit?: boolean;
}

function setup(zone: HTMLElement): void {
  const el = zone as MarkedUpload;
  if (el.__icenUploadInit) return;
  el.__icenUploadInit = true;

  const input = zone.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) return;

  const openPicker = (): void => input.click();

  zone.addEventListener('click', (ev) => {
    if (ev.target === input) return; // 防止 input 自身 click 冒泡回来再触发一次
    openPicker();
  });
  zone.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openPicker();
    }
  });

  zone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    zone.classList.add('is-drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'));
  zone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    zone.classList.remove('is-drag');
    const files = ev.dataTransfer?.files;
    if (!files || files.length === 0) return;
    let assigned = false;
    try {
      const dt = new DataTransfer();
      for (const f of Array.from(files)) dt.items.add(f);
      input.files = dt.files;
      assigned = true;
    } catch {
      assigned = false;
    }
    if (assigned) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const list = Array.from(files);
      zone.dispatchEvent(new CustomEvent('icn:upload', { bubbles: true, detail: { files: list } }));
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
