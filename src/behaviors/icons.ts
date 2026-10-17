/** ICEN interface symbols. One optical grid, shared by SSR, DOM and CSS masks.
 * No icon font, external sprite request or framework dependency. All paths are
 * original geometry in a 20 × 20 grid; labels are always escaped/plain text. */
export const ICON_PATHS = {
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
