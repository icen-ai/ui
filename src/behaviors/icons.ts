/** ICEN interface symbols. One optical grid, shared by SSR, DOM and CSS masks.
 * No icon font, external sprite request or framework dependency. All paths are
 * original geometry in a 20 × 20 grid; labels are always escaped/plain text. */
export const ICON_PATHS = {
  file: 'M6 2.5h5.5L16 7v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a2 2 0 0 1 2-2ZM11.5 2.5V7H16',
  folder: 'M3 5a1.5 1.5 0 0 1 1.5-1.5H8l2 2h5.5A1.5 1.5 0 0 1 17 7v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15Z',
  globe: 'M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0ZM2.5 10h15M10 2.5c-4 4-4 11 0 15 4-4 4-11 0-15Z',
  document: 'M6 2.5h5.5L16 7v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a2 2 0 0 1 2-2ZM11.5 2.5V7H16M7 10.5h6M7 13.5h6',
  agent: 'M10 6V3M8 3h2M5 6h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM1.5 10h1.5M17 10h1.5M7 10v2M13 10v2M8 14h4',
  paperclip: 'M14 7 8.3 12.7a1.6 1.6 0 0 1-2.3-2.3l6.3-6.3a3.2 3.2 0 0 1 4.5 4.5l-7 7a4.7 4.7 0 0 1-6.7-6.7l7-7',
  stop: 'M6.5 5h7A1.5 1.5 0 0 1 15 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 13.5v-7A1.5 1.5 0 0 1 6.5 5Z',
  terminal: 'M5 3.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM6 7l3 3-3 3M11 13h3',
  branch: 'M6 6v8M14 6v2a4 4 0 0 1-4 4H6M8 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM16 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  'line-numbers': 'M3 5h2M3 10h2M3 15h2M8 5h9M8 10h9M8 15h9',
  wrap: 'M3 5h14M3 10h10a3 3 0 0 1 0 6h-3M12.5 13.5 10 16l2.5 2.5',
  calendar: 'M5.5 4h9A2.5 2.5 0 0 1 17 6.5v8a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4ZM6.5 2.5v3M13.5 2.5v3M3 8h14M6.5 11h.1M10 11h.1M13.5 11h.1M6.5 14h.1M10 14h.1',
  close: 'M6 6l8 8M14 6l-8 8',
  check: 'M4.5 10.2l3.6 3.6 7.4-7.6',
  'chevron-down': 'M5.5 7.75 10 12.25l4.5-4.5',
  'chevron-up': 'M5.5 12.25 10 7.75l4.5 4.5',
  'chevron-right': 'M7.75 5.5 12.25 10l-4.5 4.5',
  'chevron-left': 'M12.25 5.5 7.75 10l4.5 4.5',
  'arrow-right': 'M3.5 10h13M11 4.5l5.5 5.5-5.5 5.5',
  'arrow-left': 'M16.5 10h-13M9 4.5 3.5 10 9 15.5',
  'arrow-up': 'M10 16.5v-13M4.5 9 10 3.5 15.5 9',
  'arrow-down': 'M10 3.5v13M4.5 11l5.5 5.5 5.5-5.5',
  plus: 'M10 4v12M4 10h12',
  minus: 'M4 10h12',
  sort: 'M6 15V4M3 7l3-3 3 3M14 5v11M11 13l3 3 3-3',
  search: 'M13.3 13.3 17 17M14.5 8.5a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  sun: 'M13.5 10a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M10 1.75v1.5M10 16.75v1.5M1.75 10h1.5M16.75 10h1.5M4.17 4.17l1.06 1.06M14.77 14.77l1.06 1.06M4.17 15.83l1.06-1.06M14.77 5.23l1.06-1.06',
  moon: 'M17.25 11.15A7.5 7.5 0 0 1 8.85 2.75a7.5 7.5 0 1 0 8.4 8.4Z',
  benzhen: 'M6.5 3h7A3.5 3.5 0 0 1 17 6.5v7a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 3 13.5v-7A3.5 3.5 0 0 1 6.5 3ZM7 10l3-3 3 3-3 3Z',
  pixel: 'M3 3h5v5H3ZM12 3h5v5h-5ZM3 12h5v5H3ZM12 12h5v5h-5Z',
  more: 'M4 9.9v.2M10 9.9v.2M16 9.9v.2',
  copy: 'M7 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7ZM13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
  edit: 'M11.5 4.5l4 4M4 12l9-9a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-9 9-5 1Z',
  link: 'M8 6l2-2a4.2 4.2 0 0 1 6 6l-2 2M12 14l-2 2a4.2 4.2 0 0 1-6-6l2-2M7 13l6-6',
  trash: 'M3.5 5.5h13M7 5.5V3h6v2.5M5 5.5l.7 11.5h8.6L15 5.5M8 9v5M12 9v5',
  spinner: 'M10 3a7 7 0 1 1-7 7',
  'circle-check': 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM6 10l2.7 2.7 5.3-5.4',
  'circle-error': 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM7.2 7.2l5.6 5.6M12.8 7.2l-5.6 5.6',
  'circle-info': 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM10 9v5M10 6.1v.15',
  'triangle-alert': 'M8.7 3.5a1.5 1.5 0 0 1 2.6 0l6.4 11.3a1.5 1.5 0 0 1-1.3 2.2H3.6a1.5 1.5 0 0 1-1.3-2.2ZM10 7.2v4.4M10 14v.15',
  refresh: 'M16.5 7.2A7 7 0 0 0 4.3 5.9L2.5 8M2.5 3.5V8H7M3.5 12.8a7 7 0 0 0 12.2 1.3l1.8-2.1M13 12h4.5v4.5',
  external: 'M11.5 3H17v5.5M17 3l-8 8M8 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  home: 'M3.5 10.25 10 4l6.5 6.25M5.75 8.75v7a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75v-7',
  settings: 'M3.5 5.5h13M3.5 10h13M3.5 14.5h13M7 4v3M12.5 8.5v3M8 13v3',
  star: 'M10 2.5l2.4 5.1 5.6.4-4.2 3.7 1.3 5.5-5.1-3-5.1 3 1.3-5.5L1.8 8l5.6-.4Z',
  eye: 'M2.2 10s3-5.4 7.8-5.4S17.8 10 17.8 10s-3 5.4-7.8 5.4S2.2 10 2.2 10ZM10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z',
  'eye-off': 'M2.2 10s3-5.4 7.8-5.4S17.8 10 17.8 10s-3 5.4-7.8 5.4S2.2 10 2.2 10ZM10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM3.5 3.5l13 13',
  inbox: 'M3.5 12.25h3.7l1.5 2.5h2.6l1.5-2.5h3.7M4.7 5.5l-1.2 6.75v3.25a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-3.25L15.3 5.5a1.3 1.3 0 0 0-1.25-1H5.95a1.3 1.3 0 0 0-1.25 1Z',
  bell: 'M10 3.5a4.5 4.5 0 0 1 4.5 4.5c0 4.5 1.8 5.7 2.5 6.5H3c.7-.8 2.5-2 2.5-6.5A4.5 4.5 0 0 1 10 3.5ZM8.5 16.5a1.6 1.6 0 0 0 3 0',
  users: 'M13.8 16.5v-1.5a3.5 3.5 0 0 0-3.5-3.5H6.3a3.5 3.5 0 0 0-3.5 3.5v1.5M8.3 8.9a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM16.5 16.5v-1.3a3.3 3.3 0 0 0-2.3-3.1M12.3 3.7a2.7 2.7 0 0 1 0 5.2',
  activity: 'M17 10h-2.6l-2 5.8L8 4.2 6 10H3',
  'trend-up': 'M3.5 14.5l4.2-4.2 2.8 2.8 5.9-5.9M12.4 7.2h4.2v4.2',
  'trend-down': 'M3.5 5.5l4.2 4.2 2.8-2.8 5.9 5.9M12.4 12.8h4.2V8.6',
  rocket: 'M10 2.5c2 1.5 3.2 4 3.2 6.8 0 1.5-.3 2.9-.8 4.2H7.6c-.5-1.3-.8-2.7-.8-4.2 0-2.8 1.2-5.3 3.2-6.8ZM10 8.6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM7.6 12.5 5.6 15.4c-.9.3-1.6 1-2 2M12.4 12.5l2 2.9c.9.3 1.6 1 2 2M8.7 13.8c0 1.8.5 3.1 1.3 4.2.8-1.1 1.3-2.4 1.3-4.2',
  bold: 'M6.5 4h4.2a3 3 0 0 1 0 6H6.5M6.5 10h5a3 3 0 0 1 0 6H6.5M6.5 4v12',
  italic: 'M8.5 4.5h7M4.5 15.5h7M12.5 4.5l-5 11',
  underline: 'M6 4v5.5a4 4 0 0 0 8 0V4M4.5 16h11',
  'align-left': 'M3.5 4.5h13M3.5 10h8.5M3.5 15.5h11',
  'align-center': 'M3.5 4.5h13M5.75 10h8.5M4.5 15.5h11',
  'align-right': 'M3.5 4.5h13M8 10h8.5M5.5 15.5h11',
  list: 'M6.5 5h10M6.5 10h10M6.5 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  server: 'M3 3h14a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 17 8H3a1.5 1.5 0 0 1-1.5-1.5v-2A1.5 1.5 0 0 1 3 3ZM3 12h14a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 17 17H3a1.5 1.5 0 0 1-1.5-1.5v-2A1.5 1.5 0 0 1 3 12ZM5 5.5h.01M5 14.5h.01',
  sparkle: 'M10 2.5l1.6 4.3 4.3 1.6-4.3 1.6L10 14.3l-1.6-4.3-4.3-1.6 4.3-1.6ZM15.5 12.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8Z',
  play: 'M6.5 4.8v10.4c0 .9 1 1.5 1.8 1l8.3-5.2a1.2 1.2 0 0 0 0-2L8.3 3.8a1.2 1.2 0 0 0-1.8 1Z',
  'chart-line': 'M3.5 3.5v13h13M6.5 12l2.8-2.8 2.2 2.2 4-4.4',
  layers: 'M10 3.2 3.6 6.5 10 9.8l6.4-3.3ZM4.5 10.4 10 13.2l5.5-2.8M4.5 13.6 10 16.4l5.5-2.8',
  box: 'M17 6 10 3.2 3 6v8l7 2.8 7-2.8ZM3 6l7 2.8L17 6M10 9v7.8',
  filter: 'M4 4.5h12l-4.4 5.1v5l-3.2-1.6V9.6Z',
  columns: 'M3.5 4h13v12h-13ZM8.2 4v12M12.8 4v12',
  download: 'M10 3.5v8M6.8 8.3 10 11.5l3.2-3.2M4 15v2.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V15',
} as const;
export type IconName = keyof typeof ICON_PATHS | (string & {});
export interface IconOptions {
  size?: number;
  className?: string;
  /** Omit for decorative icons inside an already labelled control. */
  label?: string;
}
const custom = new Map<string,string>();
const escape = (s:string) => s.replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
/** Custom symbols use the same grid/stroke and accept only SVG path data. */
export function registerIcon(name: string, path: string): boolean {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(name) || name in ICON_PATHS || !path.trim() || path.length > 12000 || !/^[MmZzLlHhVvCcSsQqTtAaEe0-9.,+\s-]+$/.test(path)) return false;
  custom.set(name,path); return true;
}
export function iconPath(name: IconName): string | null {
  return Object.hasOwn(ICON_PATHS,name) ? ICON_PATHS[name as keyof typeof ICON_PATHS] : custom.get(name) ?? null;
}
/** Shared descriptor for renderers that build their own DOM/SSR tree. */
export function iconAttributes(o: IconOptions = {}): Record<string,string> {
  const size = Number.isFinite(o.size) && o.size! > 0 ? o.size! : 16;
  return { xmlns:'http://www.w3.org/2000/svg',viewBox:'0 0 20 20',width:String(size),height:String(size),fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round',focusable:'false',class:['icen-symbol',o.className].filter(Boolean).join(' '),...(o.label ? {role:'img','aria-label':o.label} : {'aria-hidden':'true'}) };
}
export function iconHTML(name: IconName, o: IconOptions = {}): string {
  const path = iconPath(name); if (!path) return '';
  return `<svg${Object.entries(iconAttributes(o)).map(([k,v])=>` ${k}="${escape(v)}"`).join('')}><path d="${escape(path)}"></path></svg>`;
}
export function createIcon(name: IconName, o: IconOptions = {}): SVGSVGElement | null {
  if (typeof document === 'undefined') return null;
  const path = iconPath(name); if (!path) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  for (const [key,value] of Object.entries(iconAttributes(o))) svg.setAttribute(key,value);
  const line = document.createElementNS(svg.namespaceURI,'path'); line.setAttribute('d',path); svg.append(line);
  return svg;
}
