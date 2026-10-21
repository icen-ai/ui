// Catalogue → complete palette CSS. No component styles or primitive geometry.
import {readFile,writeFile} from 'node:fs/promises';
const source=new URL('../src/tokens/themes.json',import.meta.url);
const target=new URL('../src/tokens/colors.css',import.meta.url);
const seedNames={bg:'canvas',surface:'surface',raised:'raised',ink:'ink',muted:'muted',faint:'faint',accent:'accent',accentStrong:'accent-strong',accentText:'accent-text',onAccent:'on-accent',cold:'cold',success:'success',warning:'warning',error:'error',info:'info',shadowColor:'shadow-color'};
const materialNames={glassOpacity:'glass-opacity',shadowStrength:'shadow-strength',edgeStrength:'edge-strength',highlightStrength:'highlight-strength'};
const roles={bg:'canvas','bg-soft':'bg-soft',surface:'surface','surface-strong':'raised',text:'ink','text-muted':'muted','text-faint':'faint',accent:'accent','accent-strong':'accent-strong','accent-text':'accent-text','accent-deep':'accent-strong','accent-cold':'cold','on-accent':'on-accent',success:'success','success-text':'success',warning:'warning',error:'error',danger:'error',info:'info'};

export function renderThemeColors(themes) {
  let css=`/* GENERATED from themes.json by bun run colors. Edit the catalogue, never this file.\n * ${themes.length} complete themes × light/dark; 现代 is the default. Primitives are separate. */\n`;
  for(const [index,theme] of themes.entries()) {
    for(const mode of ['light','dark']) {
      const palette=theme[mode];
      let selector=`[data-icen-preset="${theme.id}"]`+(mode==='dark'?'[data-icen-theme="dark"]':'');
      if(index===0) selector=(mode==='light'?':root, ': '[data-icen-theme="dark"], ')+selector;
      css+=`\n/* ${theme.name} · ${theme.material} · ${mode} */\n${selector} {\n`;
      for(const [key,seed] of Object.entries(seedNames)) {
        if(!/^#[\da-f]{6}$/i.test(palette[key])) throw new Error(`${theme.id}.${mode}.${key}: invalid hex color`);
        css+=`  --icen-design-${seed}: ${palette[key]};\n`;
      }
      for(const [key,seed] of Object.entries(materialNames)) {
        if(!Number.isFinite(palette[key])||palette[key]<0||palette[key]>100) throw new Error(`${theme.id}.${mode}.${key}: invalid percentage`);
        css+=`  --icen-design-${seed}: ${palette[key]}%;\n`;
      }
      css+=`  color-scheme: ${mode};\n}\n`;
    }
  }
  css+='\n/* Recompute semantic aliases at each palette boundary (including nested specimens). */\n:root, [data-icen-preset], [data-icen-theme="dark"] {\n';
  css+='  --icen-design-bg-soft: color-mix(in srgb, var(--icen-design-canvas) 70%, var(--icen-design-raised));\n';
  for(const [token,seed] of Object.entries(roles)) css+=`  --icen-token-${token}: var(--icen-design-${seed});\n`;
  css+=`  --icen-token-surface-hover: color-mix(in srgb, var(--icen-design-surface) 94%, var(--icen-design-ink));
  --icen-token-line-soft: color-mix(in srgb, var(--icen-design-ink) 10%, transparent);
  --icen-token-line: color-mix(in srgb, var(--icen-design-ink) 19%, transparent);
  --icen-token-line-strong: color-mix(in srgb, var(--icen-design-ink) 38%, transparent);
  --icen-token-line-dashed: var(--icen-token-line);
  --icen-token-outline-soft: var(--icen-token-line-soft);
  --icen-token-outline: var(--icen-token-line);
  --icen-token-outline-strong: var(--icen-token-line-strong);
  --icen-token-fill-1: color-mix(in srgb, var(--icen-design-ink) 4%, transparent);
  --icen-token-fill-2: color-mix(in srgb, var(--icen-design-ink) 7%, transparent);
  --icen-token-fill-3: color-mix(in srgb, var(--icen-design-ink) 12%, transparent);
  --icen-token-fill-4: color-mix(in srgb, var(--icen-design-ink) 18%, transparent);
  --icen-token-accent-subtle: color-mix(in srgb, var(--icen-design-accent) 10%, transparent);
  --icen-token-accent-glow: color-mix(in srgb, var(--icen-design-accent) 8%, transparent);
  --icen-token-glow: transparent;
  --icen-token-glow-cold: transparent;
  --icen-token-success-muted: color-mix(in srgb, var(--icen-design-success) 12%, transparent);
  --icen-token-warning-muted: color-mix(in srgb, var(--icen-design-warning) 12%, transparent);
  --icen-token-error-muted: color-mix(in srgb, var(--icen-design-error) 12%, transparent);
  --icen-token-error-soft: var(--icen-token-error-muted);
  --icen-token-info-muted: color-mix(in srgb, var(--icen-design-info) 12%, transparent);
  --icen-token-canvas: var(--icen-token-bg);
  --icen-token-sidebar: var(--icen-token-bg-soft);
  --icen-token-panel: var(--icen-token-bg-soft);
  --icen-token-card: var(--icen-token-surface);
  --icen-token-card-strong: var(--icen-token-surface-strong);
  --icen-token-control: color-mix(in srgb, var(--icen-design-surface) 70%, var(--icen-design-canvas));
  --icen-token-control-hover: var(--icen-token-surface-hover);
  --icen-token-surface-glass: color-mix(in srgb, var(--icen-token-surface) var(--icen-design-glass-opacity), transparent);
  --icen-token-overlay-bg: var(--icen-token-surface-glass);
  --icen-token-scrollbar-size: 8px;
  --icen-token-scrollbar-size-sm: 6px;
  --icen-token-scrollbar-size-lg: 12px;
  --icen-token-scrollbar-inset: 2px;
  --icen-token-scrollbar-gutter: auto;
  --icen-token-scrollbar-idle-delay: 900ms;
  --icen-token-scrollbar-fade-duration: var(--icen-duration-normal);
  --icen-token-scrollbar-track: transparent;
  --icen-token-scrollbar-thumb: color-mix(in srgb, var(--icen-design-ink) 22%, transparent);
  --icen-token-scrollbar-thumb-hover: color-mix(in srgb, var(--icen-design-ink) 38%, transparent);
  --icen-token-scrollbar-button: transparent;
`;
  const bridges={
    'accent-cold':'accent-cold',
    'bg-primary':'bg','bg-secondary':'bg-soft','bg-tertiary':'surface','bg-card':'card','bg-card-muted':'bg-soft','bg-panel':'panel','bg-hover':'surface-hover',
    'text-primary':'text','text-secondary':'text','text-tertiary':'text-muted','text-muted':'text-muted','text-subtle':'text-faint',
    'border-subtle':'line-soft','border-default':'line','border-strong':'line-strong','shadow-sm':'shadow-elevated','shadow-md':'shadow-overlay',
    'color-success':'success','color-success-bg':'success-muted','color-warning':'warning','color-warning-bg':'warning-muted','color-error':'error','color-error-bg':'error-muted','color-info':'info','color-info-bg':'info-muted','color-pending':'text-muted','color-pending-bg':'bg-soft'
  };
  for(const [name,token] of Object.entries(bridges)) css+=`  --icen-${name}: var(--icen-token-${token});\n`;
  return css+'}\n';
}
export async function generateThemeColors(check=false) {
  const themes=JSON.parse(await readFile(source,'utf8'));
  const css=renderThemeColors(themes);
  let existing=''; try{existing=await readFile(target,'utf8');}catch{}
  if(existing!==css) {
    if(check) throw new Error('colors.css is stale. Run bun run colors.');
    await writeFile(target,css);
  }
  return themes;
}
if(import.meta.main) { const themes=await generateThemeColors(process.argv.includes('--check')); console.log(`theme colors: ${themes.length} themes × light/dark`); }
