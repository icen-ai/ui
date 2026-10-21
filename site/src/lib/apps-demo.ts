import { initSwitch, initSegmented } from '../../../src/behaviors/controls';
import { initSelect, refreshSelect } from '../../../src/behaviors/select';
import { initSlider } from '../../../src/behaviors/slider';
import { initAiComposer, bindComposer, setComposerRefs } from '../../../src/behaviors/ai-composer';
import { initAiTool } from '../../../src/behaviors/ai-tool';
import { createAiClient } from '../../../src/behaviors/ai-provider';
import { renderChart } from '../../../src/behaviors/charts';
import { onIcen } from '../../../src/behaviors/events';
import { getTheme, setTheme } from '../../../src/behaviors/theme';

interface Preferences { mode: 'light' | 'auto' | 'dark'; density: 'compact' | 'normal' | 'comfortable'; reduced: boolean; scrollbars: boolean; motion: number; }
interface Source { name: string; type: string; chunks: number; group: string; pending?: boolean; }
const KEY = 'icen.ui.workspace-preferences';

/** Local transport exercises the same streaming/cancellation path as a provider. */
const localFetch: typeof fetch = async (_input, init) => {
  const body = JSON.parse(String(init?.body ?? '{}'));
  const prompt = String(body.messages?.at(-1)?.content ?? '');
  const answer = `本地演示：已收到“${prompt.slice(0, 100)}”。检索会先按权限过滤，只向你提供可访问的证据。消息与附件均不上传；接入实际业务时可用同一个客户端接口连接服务。`;
  const frames = Array.from({ length: Math.ceil(answer.length / 3) }, (_, i) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content: answer.slice(i * 3, i * 3 + 3) } }] })}\n\n`);
  frames.push('data: [DONE]\n\n');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ended = false;
  const signal = init?.signal;
  let abort: (() => void) | undefined;
  const cleanup = () => { clearTimeout(timer); if (abort) signal?.removeEventListener('abort', abort); };
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => { if (ended) return; ended = true; cleanup(); controller.error(new DOMException('已停止', 'AbortError')); };
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      const push = () => {
        if (ended) return;
        const frame = frames.shift();
        if (frame === undefined) { ended = true; cleanup(); controller.close(); return; }
        controller.enqueue(new TextEncoder().encode(frame)); timer = setTimeout(push, 20);
      };
      push();
    },
    cancel() { ended = true; cleanup(); },
  }), { headers: { 'content-type': 'text/event-stream' } });
};

export function initAppsDemo(): () => void {
  if (typeof document === 'undefined') return () => {};
  const root = document.querySelector<HTMLElement>('#apps-workspace');
  if (!root) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  const cleanups = [initSwitch(), initSegmented(), initSelect(root), initSlider(root), initAiComposer(root), initAiTool(root)];
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const defaults: Preferences = { mode: getTheme().dark ? 'dark' : 'light', density: 'normal', reduced: false, scrollbars: true, motion: 100 };
  let prefs = { ...defaults };
  try {
    const saved: Partial<Preferences> = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (['light', 'auto', 'dark'].includes(saved.mode ?? '')) prefs.mode = saved.mode!;
    if (['compact', 'normal', 'comfortable'].includes(saved.density ?? '')) prefs.density = saved.density!;
    if (typeof saved.reduced === 'boolean') prefs.reduced = saved.reduced;
    if (typeof saved.scrollbars === 'boolean') prefs.scrollbars = saved.scrollbars;
    if (typeof saved.motion === 'number' && Number.isFinite(saved.motion)) prefs.motion = Math.min(100, Math.max(0, saved.motion));
  } catch { /* Private browsing keeps an in-memory preference session. */ }
  const darkMedia = matchMedia('(prefers-color-scheme: dark)');
  const motionMedia = matchMedia('(prefers-reduced-motion: reduce)');
  const syncPreferences = (persist = false) => {
    root.dataset.icenDensity = prefs.density;
    document.documentElement.style.setProperty('--icen-design-motion', String(motionMedia.matches ? 0 : prefs.motion / 100));
    root.dataset.icenScrollbars = prefs.scrollbars ? 'visible' : 'auto';
    document.documentElement.toggleAttribute('data-icen-transparency', false);
    if (prefs.reduced) document.documentElement.dataset.icenTransparency = 'reduced';
    setTheme({ dark: prefs.mode === 'auto' ? darkMedia.matches : prefs.mode === 'dark' });
    $('#app-transparency').setAttribute('aria-checked', String(prefs.reduced));
    $('#app-scrollbars').setAttribute('aria-checked', String(prefs.scrollbars));
    $('#app-appearance').querySelectorAll<HTMLElement>('[data-icen-value]').forEach(el => {
      const selected = el.dataset.icenValue === prefs.mode;
      el.setAttribute('aria-checked', String(selected)); el.classList.toggle('is-active', selected);
    });
    $('#app-density-select').querySelectorAll<HTMLElement>('.icen-select-option').forEach(el => el.classList.toggle('is-selected', el.dataset.icenValue === prefs.density));
    $<HTMLInputElement>('#app-density-select input').value = prefs.density;
    refreshSelect($('#app-density-select'));
    const slider = $<HTMLInputElement>('#app-motion');
    slider.value = String(prefs.motion); slider.dispatchEvent(new Event('input', { bubbles: true }));
    if (persist) {
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); $('#app-settings-status').textContent = '已自动保存到本机'; }
      catch { $('#app-settings-status').textContent = '当前设置已生效；浏览器未允许本机存储'; }
    }
  };
  syncPreferences();
  cleanups.push(onIcen('icen:segmented-change', e => {
    if (e.target === $('#app-appearance')) { prefs.mode = e.detail.value as Preferences['mode']; syncPreferences(true); }
  }, { within: root, signal }));
  cleanups.push(onIcen('icen:switch-change', e => {
    if (e.detail.el.id === 'app-transparency') prefs.reduced = e.detail.checked;
    else if (e.detail.el.id === 'app-scrollbars') prefs.scrollbars = e.detail.checked;
    else return;
    syncPreferences(true);
  }, { within: root, signal }));
  cleanups.push(onIcen('icen:select-change', e => {
    if (e.target !== $('#app-density-select')) return;
    prefs.density = e.detail.value as Preferences['density']; syncPreferences(true);
  }, { within: root, signal }));
  cleanups.push(onIcen('icen:slider-change', e => {
    prefs.motion = e.detail.value ?? 100; syncPreferences(true);
  }, { within: root, signal }));
  darkMedia.addEventListener('change', () => { if (prefs.mode === 'auto') syncPreferences(); }, { signal });
  motionMedia.addEventListener('change', () => syncPreferences(), { signal });
  $('#app-reset').addEventListener('click', () => { prefs = { ...defaults, mode: 'auto' }; syncPreferences(true); }, { signal });
  $('#app-save').addEventListener('click', () => { syncPreferences(true); $('#app-settings-status').textContent = '设置已完成，继续体验下方工作区'; }, { signal });

  const sources: Source[] = [
    { name: '检索架构', type: 'Markdown', chunks: 18, group: '产品手册' },
    { name: '权限模型', type: 'Markdown', chunks: 12, group: '产品手册' },
    { name: '评测基线', type: 'CSV', chunks: 7, group: '产品手册', pending: true },
    { name: '产品术语表', type: 'JSON', chunks: 64, group: '产品手册' },
    { name: '事件接口', type: 'JSON', chunks: 22, group: '接口文档' },
    { name: '接入指南', type: 'Markdown', chunks: 16, group: '接口文档' },
    { name: '团队空间', type: 'Markdown', chunks: 9, group: '数据源' },
    { name: '数据目录', type: 'CSV', chunks: 31, group: '数据源' },
  ];
  let page = 1, group = '', selected = sources[0];
  const tbody = $('#files tbody');
  const fileInput = $<HTMLInputElement>('#app-file-upload');
  const search = $<HTMLInputElement>('#app-file-search');
  const inspect = (item: Source) => {
    selected = item;
    $('#files .app-inspector-title').textContent = item.name;
    const fields = root.querySelectorAll('#files .app-inspector-list dd');
    [item.group, '本机演示', String(item.chunks), '团队可见'].forEach((v, i) => { fields[i].textContent = v; });
    $('#app-file-status').textContent = `已选择：${item.name}`;
    $('#files .app-quote').textContent = item.pending ? '此来源等待同步。可以导入本机资料，或选择其他已索引来源。' : `${item.name} · ${item.type} · ${item.chunks} 个分段。所有结果均在授权范围内呈现。`;
  };
  const renderFiles = () => {
    const filtered = sources.filter(s => (!group || s.group === group) && s.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()));
    const pages = Math.max(1, Math.ceil(filtered.length / 4)); page = Math.min(page, pages);
    tbody.replaceChildren();
    for (const source of filtered.slice((page - 1) * 4, page * 4)) {
      const row = document.createElement('tr'); row.classList.toggle('is-selected', selected === source);
      for (const value of [source.name, source.type, source.pending ? '待更新' : '已索引', String(source.chunks)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      const cell = document.createElement('td'); cell.className = 'icen-ops';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'icen-btn icen-btn-sm icen-btn-ghost'; button.textContent = '打开'; button.setAttribute('aria-label', `打开 ${source.name}`);
      button.addEventListener('click', () => { inspect(source); renderFiles(); }, { signal });
      cell.append(button); row.append(cell); tbody.append(row);
    }
    if (!filtered.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 5; cell.textContent = '没有匹配资料，请更换关键词。'; row.append(cell); tbody.append(row); }
    $('#app-file-count').textContent = `${filtered.length} 个来源 · ${group || '全部资料'}`;
    const pager = $('#files .icen-pagination'); pager.replaceChildren();
    for (let i = 1; i <= pages; i++) {
      const button = document.createElement('button'); button.className = 'icen-page-btn'; button.textContent = String(i); button.type = 'button'; button.classList.toggle('is-active', i === page);
      if (i === page) button.setAttribute('aria-current', 'page');
      button.setAttribute('aria-label', `第 ${i} 页`); button.addEventListener('click', () => { page = i; renderFiles(); }, { signal }); pager.append(button);
    }
  };
  inspect(selected); renderFiles();
  $('#app-filter').addEventListener('click', () => {
    const row = $('#app-file-search-row'); row.hidden = !row.hidden; $('#app-filter').setAttribute('aria-expanded', String(!row.hidden));
    if (!row.hidden) search.focus(); else { search.value = ''; page = 1; renderFiles(); }
  }, { signal });
  search.addEventListener('input', () => { page = 1; renderFiles(); }, { signal });
  $('#app-import').addEventListener('click', () => fileInput.click(), { signal });
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files ?? []);
    for (const file of files) sources.unshift({ name: file.name, type: file.name.split('.').pop()?.toUpperCase() || '文件', chunks: 0, group: '本机导入', pending: true });
    group = ''; search.value = ''; page = 1; renderFiles();
    if (files.length) { inspect(sources[0]); $('#app-file-status').textContent = `已添加 ${files.length} 个本机来源，等待接入业务索引服务`; }
    fileInput.value = '';
  }, { signal });
  $('#files .app-side').querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault(); const label = link.querySelector('.icen-sidebar-item-label')?.textContent ?? ''; group = label === '全部资料' ? '' : label; search.value = ''; page = 1;
      $('#files .app-toolbar-title').textContent = label;
      $('#files .app-side').querySelectorAll('a').forEach(el => { el.classList.toggle('is-active', el === link); if (el === link) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); });
      renderFiles();
    }, { signal });
  });

  const composer = $('#app-composer');
  setComposerRefs(composer, [{ kind: 'doc', id: 'retrieval', label: '检索架构', description: '团队可访问资料' }]);
  const binding = bindComposer(composer, {
    client: createAiClient({ provider: 'openai', apiKey: 'local-demo', fetch: localFetch }), messages: $('#app-messages'),
    prepareMessage: draft => [draft.text, ...(draft.files ?? []).map(f => `本机附件：${f.name}`)].join('\n'),
  });
  cleanups.push(() => binding.unbind());
  $('#ai .app-side').querySelectorAll<HTMLAnchorElement>('a').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault(); const input = $<HTMLTextAreaElement>('#app-composer textarea'); input.value = `继续讨论${link.textContent?.trim()}`; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus();
    }, { signal });
  });

  const datasets = {
    '24h': { labels: ['00', '04', '08', '12', '16', '20'], values: [86, 88, 91, 90, 94, 96], stats: ['96.0%', '112ms', '2.8%', '216'] },
    '7d': { labels: ['一', '二', '三', '四', '五', '六', '日'], values: [62, 74, 68, 82, 78, 88, 94], stats: ['94.2%', '128ms', '3.1%', '1,284'] },
    '30d': { labels: ['第1周', '第2周', '第3周', '第4周'], values: [84, 88, 92, 94], stats: ['91.4%', '136ms', '4.2%', '5,432'] },
  };
  const chart = renderChart($('#app-analytics-chart'), { type: 'line', labels: datasets['7d'].labels, values: datasets['7d'].values, title: '每日命中率', max: 100 });
  cleanups.push(() => chart.destroy());
  cleanups.push(onIcen('icen:segmented-change', e => {
    if (e.target !== $('#app-period')) return;
    const data = datasets[e.detail.value as keyof typeof datasets]; if (!data) return;
    chart.update({ type: 'line', labels: data.labels, values: data.values, title: '命中率趋势', max: 100 });
    root.querySelectorAll('#analytics .icen-stat-num').forEach((el, i) => { el.textContent = data.stats[i]; });
    $('#analytics .app-chart-meta').textContent = `${e.detail.value} · 本地样本`;
  }, { within: root, signal }));
  return () => { controller.abort(); for (const dispose of cleanups.reverse()) dispose(); };
}
