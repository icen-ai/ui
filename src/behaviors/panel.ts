/** Collapsible panels: delegated, SSR safe and disposable. The header remains a
 * layout container; its real toggle button provides native keyboard activation. */
import { createIcon } from './icons';
import { emitIcen } from './events';
import { t } from './i18n';
let sequence=0;
const bound=new WeakMap<ParentNode,()=>void>();
export function setPanelExpanded(panel: HTMLElement, expanded: boolean): void {
  panel.classList.toggle('is-collapsed',!expanded);
  const toggle=panel.querySelector<HTMLButtonElement>('.icen-panel-toggle');
  const body=panel.querySelector<HTMLElement>('.icen-panel-body');
  if(!toggle) return;
  toggle.type='button';
  toggle.setAttribute('aria-expanded',String(expanded));
  const name=panel.querySelector('.icen-panel-title-text')?.textContent?.trim() ?? '';
  toggle.setAttribute('aria-label',`${t(expanded?'panel.collapse':'panel.expand')}${name ? ' '+name : ''}`);
  if(body) { body.id ||= `icen-panel-body-${++sequence}`; toggle.setAttribute('aria-controls',body.id); }
  if(!toggle.querySelector('.icen-symbol')) toggle.replaceChildren(createIcon('chevron-down',{className:'icen-panel-toggle-icon'})!);
}
export function initPanel(scope?: ParentNode): ()=>void {
  if(typeof document==='undefined') return ()=>{};
  const root=scope ?? document;
  const panels=[...(root instanceof HTMLElement && root.matches('.icen-panel--collapsible') ? [root] : []),...root.querySelectorAll<HTMLElement>('.icen-panel--collapsible')];
  panels.forEach((panel)=>setPanelExpanded(panel,!panel.classList.contains('is-collapsed')));
  const previous=bound.get(root);if(previous) return previous;
  const click=(event:Event)=>{
    if(!(event.target instanceof Element))return;
    const title=event.target.closest('.icen-panel-title');
    const panel=title?.closest<HTMLElement>('.icen-panel--collapsible');
    if(!panel || !(root as Node).contains(panel))return;
    const interactive=event.target.closest('button,a,input,select,textarea,[role="button"]');
    if(interactive && !interactive.matches('.icen-panel-toggle'))return;
    const expanded=panel.classList.contains('is-collapsed');
    setPanelExpanded(panel,expanded);
    emitIcen(panel,'icen:panel-toggle',{panel,expanded});
  };
  root.addEventListener('click',click);
  const destroy=()=>{root.removeEventListener('click',click);bound.delete(root);};bound.set(root,destroy);return destroy;
}
