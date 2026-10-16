/** Complete visual recipes share CSS, while each brand only supplies seeds.
 * CSS is compiled without a DOM for SSR/static builds. Import tokens.css first.
 * Mount a compiled recipe once, then put data-icen-preset on documentElement.
 * Appearance belongs on html so body-portalled menus inherit the same tokens.
 */
export interface DesignPalette {
  canvas: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  onAccent: string;
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
}
export interface DesignDefinition {
  /** Lowercase CSS identifier; benzhen is the built-in 本真 recipe. */
  name: string;
  light: DesignPalette;
  dark: DesignPalette;
  /** CSS px; the shared recipe derives the six geometric roles. */
  radius?: number;
  space?: number;
  controlHeight?: number;
  fontSize?: number;
  font?: string;
  glassOpacity?: number;
  glassBlur?: number;
  motion?: number;
}
export interface CompiledDesign { readonly name: string; readonly cssText: string; }

const NAME = /^[a-z][a-z0-9-]{1,30}$/;
const HEX = /^#[\da-f]{6}$/i;
const paletteKeys = ['canvas','surface','ink','muted','accent','onAccent','success','warning','error','info'] as const;
const seedName = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function luminance(hex: string): number {
  const rgb = [1,3,5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
/** WCAG sRGB contrast; six-digit opaque hex only, to keep compilation auditable. */
export function designContrast(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) throw new Error('Design colors must use #rrggbb.');
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function compilePalette(palette: DesignPalette, mode: string): string {
  const required = ['canvas','surface','ink','muted','accent','onAccent'] as const;
  for (const key of required) {
    if (typeof palette[key] !== 'string' || !HEX.test(palette[key])) throw new Error(`${mode}.${key} must use #rrggbb.`);
  }
  for (const key of paletteKeys) {
    const color = palette[key];
    if (color !== undefined && !HEX.test(color)) throw new Error(`${mode}.${key} must use #rrggbb.`);
  }
  for (const bg of ['canvas','surface'] as const) {
    for (const fg of ['ink','muted','accent'] as const) {
      if (designContrast(palette[bg], palette[fg]) < 4.5) throw new Error(`${mode}.${fg} on ${bg} must reach 4.5:1 contrast.`);
    }
  }
  if (designContrast(palette.accent, palette.onAccent) < 4.5) throw new Error(`${mode}.onAccent must reach 4.5:1 contrast.`);
  return paletteKeys.filter((key) => palette[key] !== undefined)
    .map((key) => `  --icen-design-${seedName(key)}: ${palette[key]};`).join('\n')
    + `\n  --icen-design-accent-strong: ${palette.accent};\n  --icen-design-accent-text: ${palette.accent};\n  --icen-design-faint: ${palette.muted};\n  --icen-design-raised: color-mix(in srgb, ${palette.surface} 96%, ${palette.ink});`;
}
/** Compile an independent brand with light AND dark palettes; never injects CSS.
 * Validation covers body/muted/accent text on both surfaces and button labels.
 * Translucent materials still need visual checks over representative content.
 */
export function createDesign(definition: DesignDefinition): CompiledDesign {
  if (!NAME.test(definition.name)) throw new Error('Invalid design name.');
  const knobs: string[] = [];
  const ranges = {
    radius: [0,32,'px'], space: [2,8,'px'], controlHeight: [32,56,'px'],
    fontSize: [12,24,'px'], glassOpacity: [70,100,'%'], glassBlur: [0,40,'px'], motion: [0,1,''],
  } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const value = definition[key];
    if (value === undefined) continue;
    const [min,max,unit] = ranges[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}.`);
    knobs.push(`  --icen-design-${seedName(key)}: ${value}${unit};`);
  }
  if (definition.font !== undefined) {
    if (!definition.font.trim() || /[;{}<>\\\n\r]|\/\*/.test(definition.font)) throw new Error('Invalid font stack.');
    knobs.push(`  --icen-design-font: ${definition.font};`);
  }
  const selector = `:root[data-icen-preset="${definition.name}"]`;
  // Dark selector resets shared knobs too, so opaque/light recipes never leave
  // inherited mode defaults with unexpectedly higher specificity.
  const cssText = `${selector} {\n${compilePalette(definition.light, 'light')}\n${knobs.join('\n')}\n}\n${selector}[data-icen-theme="dark"] {\n${compilePalette(definition.dark, 'dark')}\n${knobs.join('\n')}\n}\n`;
  return Object.freeze({ name: definition.name, cssText });
}
/** Attach trusted, compiled author CSS; safe on the server. CSP sites can write
 * cssText into a static stylesheet instead, or provide the page's nonce. */
export function mountDesign(design: CompiledDesign, nonce?: string): () => void {
  if (typeof document === 'undefined') return () => {};
  const style = document.createElement('style');
  if (nonce) style.nonce = nonce;
  style.textContent = design.cssText;
  document.head.append(style);
  return () => style.remove();
}
let appearanceFrame: number | undefined;
/** Finish palette changes without crossfading text through unreadable midtones.
 * Call before changing design/theme attributes; hover feedback resumes next frame.
 */
export function prepareDesignChange(): void {
  if (typeof document === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
  const root = document.documentElement;
  root.setAttribute('data-icen-design-changing','');
  void root.offsetWidth;
  if (appearanceFrame !== undefined) window.cancelAnimationFrame(appearanceFrame);
  appearanceFrame = window.requestAnimationFrame(() => {
    appearanceFrame = window.requestAnimationFrame(() => {
      void root.offsetWidth;
      root.removeAttribute('data-icen-design-changing');
      appearanceFrame = undefined;
    });
  });
}
/** Set a compiled brand theme. null restores the 本真 theme; primitives remain independent. */
export function setDesign(name: string | null): void {
  if (name !== null && !NAME.test(name)) throw new Error('Invalid design name.');
  if (typeof document === 'undefined') return;
  prepareDesignChange();
  document.documentElement.setAttribute('data-icen-preset', name ?? 'benzhen');
  if (!document.documentElement.hasAttribute('data-icen-style')) document.documentElement.setAttribute('data-icen-style','benzhen');
  document.documentElement.removeAttribute('data-icen-design');
}
