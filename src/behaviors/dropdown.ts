/** Dropdown: real template nodes are portalled, preserving listeners and links.
 * Root data-icen-panel-* controls measured layout. data-icen-menu-keep-open on
 * an item supports host-managed checkbox/radio actions. initDropdown(scope?)
 * returns an idempotent disposer; open/close are also available. SSR is a no-op. */
import { applyPanelSizing, computePopoverLayout, readPanelSizing, revealPopoverItem, claimMenuFocus } from './popover';
import { emitMenuSelect } from './context-menu';

interface ActiveDropdown {
  trigger: HTMLElement; template: HTMLElement; panel: HTMLElement;
  highlight: number; typed: string; typedAt: number;
}
let active: ActiveDropdown | null = null;
let sequence = 0;
const scopes = new Map<ParentNode, () => void>();
let finishClosing: (() => void) | null = null;
let releaseMenu: (()=>void) | null = null;
const classDisabled = new WeakSet<HTMLElement>();
const unavailable = (item: Element) => item.matches('.is-disabled,:disabled') || Boolean(item.closest('[aria-disabled="true"],[hidden],[inert],[data-icen-disabled]'));
const items = (menu: HTMLElement) => Array.from(menu.querySelectorAll<HTMLElement>('.icen-menu-item')).filter((item)=>!unavailable(item));
const within = (scope: ParentNode, node: Node) => scope === node || (scope instanceof Node && scope.contains(node));

function setHighlight(index: number, focus = true): void {
  if (!active) return;
  const rows=items(active.panel);
  active.highlight=index;
  active.panel.querySelectorAll<HTMLElement>('.icen-menu-item').forEach((item)=>{
    const selected=item === rows[index];
    item.classList.toggle('is-highlighted',selected);item.tabIndex=selected ? 0 : -1;
  });
  if(rows[index])revealPopoverItem(rows[index],active.panel,{focus});
}

function place(): void {
  if (!active) return;
  const {trigger,panel}=active;
  if (!trigger.isConnected) {closeDropdown(false);return;}
  const sizing=readPanelSizing(trigger.closest('[data-icen-dropdown]'));
  applyPanelSizing(panel,null);applyPanelSizing(panel,sizing);
  const width=panel.offsetWidth || panel.getBoundingClientRect().width || 180;
  const height=panel.scrollHeight || panel.offsetHeight;
  const cssMax=parseFloat(getComputedStyle(panel).maxHeight);
  const layout=computePopoverLayout(trigger.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight},{
    side:'bottom',align:getComputedStyle(trigger).direction === 'rtl' ? 'end' : 'start',offset:4,margin:12,
    minWidth:width,maxWidth:width,minHeight:40,maxHeight:sizing.maxHeight ?? (Number.isFinite(cssMax) ? cssMax : 420),contentHeightHint:height,
  });
  panel.style.left=`${layout.left}px`;panel.style.top=`${layout.top}px`;
  panel.style.width=`${layout.width}px`;panel.style.minWidth=`${layout.width}px`;
  panel.style.maxHeight=`${layout.maxHeight}px`;panel.dataset.icenSide=layout.side;
}

/** Open an authored menu and focus its first/last available action. */
export function openDropdown(trigger: HTMLElement, edge: 'first' | 'last' = 'first'): void {
  if(typeof document === 'undefined' || unavailable(trigger))return;
  closeDropdown(false);finishClosing?.();
  const root=trigger.closest<HTMLElement>('[data-icen-dropdown]');
  const template=root?.querySelector<HTMLElement>('[data-icen-dropdown-menu]');
  if(!root || !template)return;
  releaseMenu=claimMenuFocus(()=>closeDropdown(false));
  if(trigger instanceof HTMLButtonElement && !trigger.hasAttribute('type'))trigger.type='button';
  trigger.setAttribute('aria-haspopup','menu');
  const panel=document.createElement('div');panel.className='icen-menu';panel.id=`icen-dropdown-${++sequence}`;
  panel.setAttribute('role','menu');panel.tabIndex=-1;panel.style.visibility='hidden';
  trigger.id ||= `icen-dropdown-trigger-${sequence}`;
  panel.setAttribute('aria-labelledby',trigger.id);trigger.setAttribute('aria-controls',panel.id);
  applyPanelSizing(panel,readPanelSizing(root));
  while(template.firstChild)panel.append(template.firstChild);
  panel.querySelectorAll<HTMLElement>('.icen-menu-item').forEach((item)=>{
    if(item instanceof HTMLButtonElement && !item.hasAttribute('type'))item.type='button';
    if(!item.hasAttribute('role'))item.setAttribute('role',item.hasAttribute('aria-checked') || item.classList.contains('icen-menu-item--checked') ? 'menuitemcheckbox' : 'menuitem');
    if(item.getAttribute('role') === 'menuitemcheckbox' && !item.hasAttribute('aria-checked'))item.setAttribute('aria-checked',String(item.classList.contains('icen-menu-item--checked')));
    if(classDisabled.has(item)){item.removeAttribute('aria-disabled');classDisabled.delete(item);}
    if(item.classList.contains('is-disabled') && !item.hasAttribute('aria-disabled')){item.setAttribute('aria-disabled','true');classDisabled.add(item);}
    item.tabIndex=-1;
    item.querySelector('.icen-menu-item-check')?.remove();
    item.querySelector('.icen-menu-item-shortcut')?.setAttribute('aria-hidden','true');
  });
  panel.querySelectorAll('.icen-menu-separator').forEach((separator)=>separator.setAttribute('role','separator'));
  document.body.append(panel);
  active={trigger,template,panel,highlight:-1,typed:'',typedAt:0};
  trigger.setAttribute('aria-expanded','true');place();panel.style.visibility='';
  const rows=items(panel);if(rows.length)setHighlight(edge === 'last' ? rows.length-1 : 0);else panel.focus({preventScroll:true});
  panel.addEventListener('pointermove',onPointerMove);
  panel.addEventListener('focusin',(event)=>{
    const item=event.target instanceof Element ? event.target.closest<HTMLElement>('.icen-menu-item') : null;
    if(active?.panel === panel && item)setHighlight(items(panel).indexOf(item),false);
  });
  panel.addEventListener('click',(event)=>{
    const item=event.target instanceof Element ? event.target.closest('.icen-menu-item') : null;
    if(item && unavailable(item)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  document.addEventListener('click',onClick);
  document.addEventListener('pointerdown',onOutsidePointerDown,true);
  document.addEventListener('scroll',onScroll,true);window.addEventListener('resize',place);
  window.addEventListener('keydown',onKeyDown,true);
}

/** Closing is interruptible: reopening/destroying first restores template nodes. */
export function closeDropdown(restoreFocus = true): void {
  if(!active)return;
  const {trigger,template,panel}=active;active=null;
  releaseMenu?.();releaseMenu=null;
  trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');
  panel.removeEventListener('pointermove',onPointerMove);
  document.removeEventListener('pointerdown',onOutsidePointerDown,true);
  document.removeEventListener('scroll',onScroll,true);window.removeEventListener('resize',place);window.removeEventListener('keydown',onKeyDown,true);
  if(!scopes.size)document.removeEventListener('click',onClick);
  if(restoreFocus && trigger.isConnected)trigger.focus({preventScroll:true});
  panel.inert=true;panel.setAttribute('aria-hidden','true');panel.dataset.icenState='closing';
  let done=false;let animation: Animation | undefined;
  const finish=()=>{
    if(done)return;done=true;animation?.cancel();
    while(panel.firstChild)template.append(panel.firstChild);
    panel.remove();if(finishClosing === finish)finishClosing=null;
  };
  finishClosing=finish;
  const css=getComputedStyle(panel),duration=parseFloat(css.animationDuration)*(css.animationDuration.endsWith('ms') ? 1 : 1000);
  if(typeof panel.animate === 'function' && trigger.isConnected && duration !== 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animation=panel.animate([{opacity:css.opacity,transform:css.transform === 'none' ? 'scale(1)' : css.transform},{opacity:0,transform:'scale(.985)'}],{duration:Number.isFinite(duration) ? Math.min(90,duration*.75) : 90,easing:css.getPropertyValue('--icen-ease-out').trim() || 'ease-out',fill:'forwards'});
    void animation.finished.then(finish,finish);
  } else finish();
}

function onOutsidePointerDown(event: Event): void {
  if(active && event.target instanceof Node && !active.panel.contains(event.target) && !active.trigger.contains(event.target))closeDropdown(false);
}
function onScroll(event: Event): void {
  if(active && !(event.target instanceof Node && active.panel.contains(event.target)))closeDropdown(false);
}
function onPointerMove(event: PointerEvent): void {
  if(!active || event.pointerType === 'touch' || !(event.target instanceof Element))return;
  const item=event.target.closest<HTMLElement>('.icen-menu-item');
  if(item && active.panel.contains(item))setHighlight(items(active.panel).indexOf(item),false);
}
function onKeyDown(event: KeyboardEvent): void {
  if(!active || event.isComposing || event.keyCode === 229)return;
  if(event.key === 'Escape') {event.preventDefault();event.stopPropagation();closeDropdown();return;}
  if(event.key === 'Tab') {closeDropdown();return;}
  if(event.target instanceof Element && event.target.matches('input,textarea,[contenteditable="true"]'))return;
  const rows=items(active.panel);if(!rows.length)return;
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
    event.preventDefault();
    const next=event.key === 'Home' ? 0 : event.key === 'End' ? rows.length-1 : (active.highlight+(event.key === 'ArrowDown' ? 1 : -1)+rows.length)%rows.length;
    setHighlight(next);return;
  }
  if(event.key === 'Enter' || event.key === ' ') {event.preventDefault();rows[active.highlight]?.click();return;}
  if(event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey)return;
  event.preventDefault();const now=Date.now();
  active.typed=now-active.typedAt<600 ? active.typed+event.key : event.key;active.typedAt=now;
  let query=active.typed.toLocaleLowerCase();
  if([...query].every((character)=>character===query[0]))query=active.typed=query[0];
  for(let step=1;step<=rows.length;step++) {
    const index=(Math.max(0,active.highlight)+(query.length === 1 ? step : step-1))%rows.length;
    const label=rows[index].querySelector('.icen-menu-item-label')?.textContent ?? rows[index].textContent ?? '';
    if(label.trim().toLocaleLowerCase().startsWith(query)){setHighlight(index);break;}
  }
}
function onClick(event: MouseEvent): void {
  if(!(event.target instanceof Element))return;
  const item=event.target.closest<HTMLElement>('.icen-menu-item');
  if(active && item && active.panel.contains(item)) {
    if(unavailable(item)){event.preventDefault();event.stopPropagation();return;}
    const current=active;emitMenuSelect(current.panel,item);
    if(active === current && !item.hasAttribute('data-icen-menu-keep-open'))closeDropdown(current.panel.contains(document.activeElement));
    return;
  }
  const trigger=event.target.closest<HTMLElement>('[data-icen-dropdown-trigger]');
  if(!trigger || ![...scopes.keys()].some((scope)=>within(scope,trigger)))return;
  event.preventDefault();
  if(active?.trigger === trigger)closeDropdown();else openDropdown(trigger);
}
function onTriggerKey(event: KeyboardEvent): void {
  if(active || event.isComposing || !['ArrowDown','ArrowUp','Enter',' '].includes(event.key))return;
  const trigger=event.target instanceof Element ? event.target.closest<HTMLElement>('[data-icen-dropdown-trigger]') : null;
  if(!trigger || ![...scopes.keys()].some((scope)=>within(scope,trigger)))return;
  event.preventDefault();openDropdown(trigger,event.key === 'ArrowUp' ? 'last' : 'first');
  event.stopPropagation();
}

export function initDropdown(root?: ParentNode): () => void {
  if(typeof document === 'undefined')return ()=>{};
  const scope=root ?? document,existing=scopes.get(scope);if(existing)return existing;
  const triggers=[...(scope instanceof HTMLElement && scope.matches('[data-icen-dropdown-trigger]') ? [scope] : []),...scope.querySelectorAll<HTMLElement>('[data-icen-dropdown-trigger]')];
  triggers.forEach((trigger)=>{
    if(active?.trigger !== trigger)trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-haspopup','menu');
    if(trigger instanceof HTMLButtonElement && !trigger.hasAttribute('type'))trigger.type='button';
  });
  if(!scopes.size){document.addEventListener('click',onClick);document.addEventListener('keydown',onTriggerKey);}
  let disposed=false;
  const dispose=()=>{
    if(disposed)return;disposed=true;scopes.delete(scope);
    if(active && within(scope,active.trigger))closeDropdown(false);
    finishClosing?.();
    if(!scopes.size){if(!active)document.removeEventListener('click',onClick);document.removeEventListener('keydown',onTriggerKey);}
  };
  scopes.set(scope,dispose);return dispose;
}
